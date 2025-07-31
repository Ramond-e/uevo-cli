/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

// DISCLAIMER: This is a copied version of https://github.com/googleapis/js-genai/blob/main/src/chats.ts with the intention of working around a key bug
// where function responses are not treated as "valid" responses: https://b.corp.google.com/issues/420354090

import {
  GenerateContentResponse,
  Content,
  GenerateContentConfig,
  SendMessageParameters,
  createUserContent,
  Part,
  GenerateContentResponseUsageMetadata,
  Tool,
  FinishReason,
} from '@google/genai';
import { retryWithBackoff } from '../utils/retry.js';
import { isFunctionResponse } from '../utils/messageInspectors.js';
import { ContentGenerator, AuthType } from './contentGenerator.js';
import { Config } from '../config/config.js';
import {
  logApiRequest,
  logApiResponse,
  logApiError,
} from '../telemetry/loggers.js';
import {
  getStructuredResponse,
  getStructuredResponseFromParts,
} from '../utils/generateContentResponseUtilities.js';
import {
  ApiErrorEvent,
  ApiRequestEvent,
  ApiResponseEvent,
} from '../telemetry/types.js';
import { DEFAULT_UEVO_FLASH_MODEL } from '../config/models.js';
import { getProviderForModel, AIProvider } from './modelProviderMapping.js';

/**
 * Returns true if the response is valid, false otherwise.
 */
function isValidResponse(response: GenerateContentResponse): boolean {
  if (response.candidates === undefined || response.candidates.length === 0) {
    return false;
  }
  const content = response.candidates[0]?.content;
  if (content === undefined) {
    return false;
  }
  return isValidContent(content);
}

function isValidContent(content: Content): boolean {
  if (content.parts === undefined || content.parts.length === 0) {
    return false;
  }
  for (const part of content.parts) {
    if (part === undefined || Object.keys(part).length === 0) {
      return false;
    }
    if (!part.thought && part.text !== undefined && part.text === '') {
      return false;
    }
  }
  return true;
}

/**
 * Validates the history contains the correct roles.
 *
 * @throws Error if the history does not start with a user turn.
 * @throws Error if the history contains an invalid role.
 */
function validateHistory(history: Content[]) {
  for (const content of history) {
    if (content.role !== 'user' && content.role !== 'model') {
      throw new Error(`Role must be user or model, but got ${content.role}.`);
    }
  }
}

/**
 * Extracts the curated (valid) history from a comprehensive history.
 *
 * @remarks
 * The model may sometimes generate invalid or empty contents(e.g., due to safety
 * filters or recitation). Extracting valid turns from the history
 * ensures that subsequent requests could be accepted by the model.
 */
function extractCuratedHistory(comprehensiveHistory: Content[]): Content[] {
  if (comprehensiveHistory === undefined || comprehensiveHistory.length === 0) {
    return [];
  }
  const curatedHistory: Content[] = [];
  const length = comprehensiveHistory.length;
  let i = 0;
  while (i < length) {
    if (comprehensiveHistory[i].role === 'user') {
      curatedHistory.push(comprehensiveHistory[i]);
      i++;
    } else {
      const modelOutput: Content[] = [];
      let isValid = true;
      while (i < length && comprehensiveHistory[i].role === 'model') {
        modelOutput.push(comprehensiveHistory[i]);
        if (isValid && !isValidContent(comprehensiveHistory[i])) {
          isValid = false;
        }
        i++;
      }
      if (isValid) {
        curatedHistory.push(...modelOutput);
      } else {
        // Remove the last user input when model content is invalid.
        curatedHistory.pop();
      }
    }
  }
  return curatedHistory;
}

/**
 * Chat session that enables sending messages to the model with previous
 * conversation context.
 *
 * @remarks
 * The session maintains all the turns between user and model.
 */
export class GeminiChat {
  // A promise to represent the current state of the message being sent to the
  // model.
  private sendPromise: Promise<void> = Promise.resolve();

  constructor(
    private readonly config: Config,
    private readonly contentGenerator: ContentGenerator,
    private readonly generationConfig: GenerateContentConfig = {},
    private history: Content[] = [],
  ) {
    validateHistory(history);
  }

  private _getRequestTextFromContents(contents: Content[]): string {
    return contents
      .flatMap((content) => content.parts ?? [])
      .map((part) => part.text)
      .filter(Boolean)
      .join('');
  }

  private async _logApiRequest(
    contents: Content[],
    model: string,
    prompt_id: string,
  ): Promise<void> {
    const requestText = this._getRequestTextFromContents(contents);
    logApiRequest(
      this.config,
      new ApiRequestEvent(model, prompt_id, requestText),
    );
  }

  private async _logApiResponse(
    durationMs: number,
    prompt_id: string,
    usageMetadata?: GenerateContentResponseUsageMetadata,
    responseText?: string,
  ): Promise<void> {
    logApiResponse(
      this.config,
      new ApiResponseEvent(
        this.config.getModel(),
        durationMs,
        prompt_id,
        this.config.getContentGeneratorConfig()?.authType,
        usageMetadata,
        responseText,
      ),
    );
  }

  private _logApiError(
    durationMs: number,
    error: unknown,
    prompt_id: string,
  ): void {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorType = error instanceof Error ? error.name : 'unknown';

    logApiError(
      this.config,
      new ApiErrorEvent(
        this.config.getModel(),
        errorMessage,
        durationMs,
        prompt_id,
        this.config.getContentGeneratorConfig()?.authType,
        errorType,
      ),
    );
  }

  /**
   * Handles falling back to Flash model when persistent 429 errors occur for OAuth users.
   * Uses a fallback handler if provided by the config; otherwise, returns null.
   */
  private async handleFlashFallback(
    authType?: string,
    error?: unknown,
  ): Promise<string | null> {
    // Only handle fallback for OAuth users
    if (authType !== AuthType.LOGIN_WITH_GOOGLE) {
      return null;
    }

    const currentModel = this.config.getModel();
    const fallbackModel = DEFAULT_UEVO_FLASH_MODEL;

    // Don't fallback if already using Flash model
    if (currentModel === fallbackModel) {
      return null;
    }

    // Check if config has a fallback handler (set by CLI package)
    const fallbackHandler = this.config.flashFallbackHandler;
    if (typeof fallbackHandler === 'function') {
      try {
        const accepted = await fallbackHandler(
          currentModel,
          fallbackModel,
          error,
        );
        if (accepted !== false && accepted !== null) {
          this.config.setModel(fallbackModel);
          return fallbackModel;
        }
        // Check if the model was switched manually in the handler
        if (this.config.getModel() === fallbackModel) {
          return null; // Model was switched but don't continue with current prompt
        }
      } catch (error) {
        console.warn('Flash fallback handler failed:', error);
      }
    }

    return null;
  }

  /**
   * Sends a message to the model and returns the response.
   *
   * @remarks
   * This method will wait for the previous message to be processed before
   * sending the next message.
   *
   * @see {@link Chat#sendMessageStream} for streaming method.
   * @param params - parameters for sending messages within a chat session.
   * @returns The model's response.
   *
   * @example
   * ```ts
   * const chat = ai.chats.create({model: 'gemini-2.0-flash'});
   * const response = await chat.sendMessage({
   *   message: 'Why is the sky blue?'
   * });
   * console.log(response.text);
   * ```
   */
  async sendMessage(
    params: SendMessageParameters,
    prompt_id: string,
  ): Promise<GenerateContentResponse> {
    await this.sendPromise;
    const userContent = createUserContent(params.message);
    const requestContents = this.getHistory(true).concat(userContent);

    this._logApiRequest(requestContents, this.config.getModel(), prompt_id);

    const startTime = Date.now();
    let response: GenerateContentResponse;

    try {
      const apiCall = () => {
        const modelToUse = this.config.getModel() || DEFAULT_UEVO_FLASH_MODEL;

        // Prevent Flash model calls immediately after quota error
        if (
          this.config.getQuotaErrorOccurred() &&
          modelToUse === DEFAULT_UEVO_FLASH_MODEL
        ) {
          throw new Error(
            'Please submit a new query to continue with the Flash model.',
          );
        }

        // 检查是否需要使用阿里云 API
        if (this.shouldUseAliyunAPI(modelToUse)) {
          const messages = this.convertToAliyunMessages(requestContents);
          return this.callAliyunAPI(
            modelToUse,
            messages,
            { ...this.generationConfig, ...params.config }
          );
        }

        return this.contentGenerator.generateContent({
          model: modelToUse,
          contents: requestContents,
          config: { ...this.generationConfig, ...params.config },
        });
      };

      response = await retryWithBackoff(apiCall, {
        shouldRetry: (error: Error) => {
          if (error && error.message) {
            if (error.message.includes('429')) return true;
            if (error.message.match(/5\d{2}/)) return true;
          }
          return false;
        },
        onPersistent429: async (authType?: string, error?: unknown) =>
          await this.handleFlashFallback(authType, error),
        authType: this.config.getContentGeneratorConfig()?.authType,
      });
      const durationMs = Date.now() - startTime;
      await this._logApiResponse(
        durationMs,
        prompt_id,
        response.usageMetadata,
        getStructuredResponse(response),
      );

      this.sendPromise = (async () => {
        const outputContent = response.candidates?.[0]?.content;
        // Because the AFC input contains the entire curated chat history in
        // addition to the new user input, we need to truncate the AFC history
        // to deduplicate the existing chat history.
        const fullAutomaticFunctionCallingHistory =
          response.automaticFunctionCallingHistory;
        const index = this.getHistory(true).length;
        let automaticFunctionCallingHistory: Content[] = [];
        if (fullAutomaticFunctionCallingHistory != null) {
          automaticFunctionCallingHistory =
            fullAutomaticFunctionCallingHistory.slice(index) ?? [];
        }
        const modelOutput = outputContent ? [outputContent] : [];
        this.recordHistory(
          userContent,
          modelOutput,
          automaticFunctionCallingHistory,
        );
      })();
      await this.sendPromise.catch(() => {
        // Resets sendPromise to avoid subsequent calls failing
        this.sendPromise = Promise.resolve();
      });
      return response;
    } catch (error) {
      const durationMs = Date.now() - startTime;
      this._logApiError(durationMs, error, prompt_id);
      this.sendPromise = Promise.resolve();
      throw error;
    }
  }

  /**
   * Sends a message to the model and returns the response in chunks.
   *
   * @remarks
   * This method will wait for the previous message to be processed before
   * sending the next message.
   *
   * @see {@link Chat#sendMessage} for non-streaming method.
   * @param params - parameters for sending the message.
   * @return The model's response.
   *
   * @example
   * ```ts
   * const chat = ai.chats.create({model: 'gemini-2.0-flash'});
   * const response = await chat.sendMessageStream({
   *   message: 'Why is the sky blue?'
   * });
   * for await (const chunk of response) {
   *   console.log(chunk.text);
   * }
   * ```
   */
  async sendMessageStream(
    params: SendMessageParameters,
    prompt_id: string,
  ): Promise<AsyncGenerator<GenerateContentResponse>> {
    await this.sendPromise;
    const userContent = createUserContent(params.message);
    const requestContents = this.getHistory(true).concat(userContent);
    this._logApiRequest(requestContents, this.config.getModel(), prompt_id);

    const startTime = Date.now();

    try {
      const apiCall = () => {
        const modelToUse = this.config.getModel();

        // Prevent Flash model calls immediately after quota error
        if (
          this.config.getQuotaErrorOccurred() &&
          modelToUse === DEFAULT_UEVO_FLASH_MODEL
        ) {
          throw new Error(
            'Please submit a new query to continue with the Flash model.',
          );
        }

        // 检查是否需要使用阿里云 API
        if (this.shouldUseAliyunAPI(modelToUse)) {
          const messages = this.convertToAliyunMessages(requestContents);
          return Promise.resolve(this.callAliyunStreamAPI(
            modelToUse,
            messages,
            { ...this.generationConfig, ...params.config }
          ));
        }

        return this.contentGenerator.generateContentStream({
          model: modelToUse,
          contents: requestContents,
          config: { ...this.generationConfig, ...params.config },
        });
      };

      // Note: Retrying streams can be complex. If generateContentStream itself doesn't handle retries
      // for transient issues internally before yielding the async generator, this retry will re-initiate
      // the stream. For simple 429/500 errors on initial call, this is fine.
      // If errors occur mid-stream, this setup won't resume the stream; it will restart it.
      const streamResponse = await retryWithBackoff(apiCall, {
        shouldRetry: (error: Error) => {
          // Check error messages for status codes, or specific error names if known
          if (error && error.message) {
            if (error.message.includes('429')) return true;
            if (error.message.match(/5\d{2}/)) return true;
          }
          return false; // Don't retry other errors by default
        },
        onPersistent429: async (authType?: string, error?: unknown) =>
          await this.handleFlashFallback(authType, error),
        authType: this.config.getContentGeneratorConfig()?.authType,
      });

      // Resolve the internal tracking of send completion promise - `sendPromise`
      // for both success and failure response. The actual failure is still
      // propagated by the `await streamResponse`.
      this.sendPromise = Promise.resolve(streamResponse)
        .then(() => undefined)
        .catch(() => undefined);

      const result = this.processStreamResponse(
        streamResponse,
        userContent,
        startTime,
        prompt_id,
      );
      return result;
    } catch (error) {
      const durationMs = Date.now() - startTime;
      this._logApiError(durationMs, error, prompt_id);
      this.sendPromise = Promise.resolve();
      throw error;
    }
  }

  /**
   * Returns the chat history.
   *
   * @remarks
   * The history is a list of contents alternating between user and model.
   *
   * There are two types of history:
   * - The `curated history` contains only the valid turns between user and
   * model, which will be included in the subsequent requests sent to the model.
   * - The `comprehensive history` contains all turns, including invalid or
   *   empty model outputs, providing a complete record of the history.
   *
   * The history is updated after receiving the response from the model,
   * for streaming response, it means receiving the last chunk of the response.
   *
   * The `comprehensive history` is returned by default. To get the `curated
   * history`, set the `curated` parameter to `true`.
   *
   * @param curated - whether to return the curated history or the comprehensive
   *     history.
   * @return History contents alternating between user and model for the entire
   *     chat session.
   */
  getHistory(curated: boolean = false): Content[] {
    const history = curated
      ? extractCuratedHistory(this.history)
      : this.history;
    // Deep copy the history to avoid mutating the history outside of the
    // chat session.
    return structuredClone(history);
  }

  /**
   * Clears the chat history.
   */
  clearHistory(): void {
    this.history = [];
  }

  /**
   * Adds a new entry to the chat history.
   *
   * @param content - The content to add to the history.
   */
  addHistory(content: Content): void {
    this.history.push(content);
  }
  setHistory(history: Content[]): void {
    this.history = history;
  }

  setTools(tools: Tool[]): void {
    this.generationConfig.tools = tools;
  }

  getFinalUsageMetadata(
    chunks: GenerateContentResponse[],
  ): GenerateContentResponseUsageMetadata | undefined {
    const lastChunkWithMetadata = chunks
      .slice()
      .reverse()
      .find((chunk) => chunk.usageMetadata);

    return lastChunkWithMetadata?.usageMetadata;
  }

  private async *processStreamResponse(
    streamResponse: AsyncGenerator<GenerateContentResponse>,
    inputContent: Content,
    startTime: number,
    prompt_id: string,
  ) {
    const outputContent: Content[] = [];
    const chunks: GenerateContentResponse[] = [];
    let errorOccurred = false;

    try {
      for await (const chunk of streamResponse) {
        if (isValidResponse(chunk)) {
          chunks.push(chunk);
          const content = chunk.candidates?.[0]?.content;
          if (content !== undefined) {
            if (this.isThoughtContent(content)) {
              yield chunk;
              continue;
            }
            outputContent.push(content);
          }
        }
        yield chunk;
      }
    } catch (error) {
      errorOccurred = true;
      const durationMs = Date.now() - startTime;
      this._logApiError(durationMs, error, prompt_id);
      throw error;
    }

    if (!errorOccurred) {
      const durationMs = Date.now() - startTime;
      const allParts: Part[] = [];
      for (const content of outputContent) {
        if (content.parts) {
          allParts.push(...content.parts);
        }
      }
      const fullText = getStructuredResponseFromParts(allParts);
      await this._logApiResponse(
        durationMs,
        prompt_id,
        this.getFinalUsageMetadata(chunks),
        fullText,
      );
    }
    this.recordHistory(inputContent, outputContent);
  }

  private recordHistory(
    userInput: Content,
    modelOutput: Content[],
    automaticFunctionCallingHistory?: Content[],
  ) {
    const nonThoughtModelOutput = modelOutput.filter(
      (content) => !this.isThoughtContent(content),
    );

    let outputContents: Content[] = [];
    if (
      nonThoughtModelOutput.length > 0 &&
      nonThoughtModelOutput.every((content) => content.role !== undefined)
    ) {
      outputContents = nonThoughtModelOutput;
    } else if (nonThoughtModelOutput.length === 0 && modelOutput.length > 0) {
      // This case handles when the model returns only a thought.
      // We don't want to add an empty model response in this case.
    } else {
      // When not a function response appends an empty content when model returns empty response, so that the
      // history is always alternating between user and model.
      // Workaround for: https://b.corp.google.com/issues/420354090
      if (!isFunctionResponse(userInput)) {
        outputContents.push({
          role: 'model',
          parts: [],
        } as Content);
      }
    }
    if (
      automaticFunctionCallingHistory &&
      automaticFunctionCallingHistory.length > 0
    ) {
      this.history.push(
        ...extractCuratedHistory(automaticFunctionCallingHistory),
      );
    } else {
      this.history.push(userInput);
    }

    // Consolidate adjacent model roles in outputContents
    const consolidatedOutputContents: Content[] = [];
    for (const content of outputContents) {
      if (this.isThoughtContent(content)) {
        continue;
      }
      const lastContent =
        consolidatedOutputContents[consolidatedOutputContents.length - 1];
      if (this.isTextContent(lastContent) && this.isTextContent(content)) {
        // If both current and last are text, combine their text into the lastContent's first part
        // and append any other parts from the current content.
        lastContent.parts[0].text += content.parts[0].text || '';
        if (content.parts.length > 1) {
          lastContent.parts.push(...content.parts.slice(1));
        }
      } else {
        consolidatedOutputContents.push(content);
      }
    }

    if (consolidatedOutputContents.length > 0) {
      const lastHistoryEntry = this.history[this.history.length - 1];
      const canMergeWithLastHistory =
        !automaticFunctionCallingHistory ||
        automaticFunctionCallingHistory.length === 0;

      if (
        canMergeWithLastHistory &&
        this.isTextContent(lastHistoryEntry) &&
        this.isTextContent(consolidatedOutputContents[0])
      ) {
        // If both current and last are text, combine their text into the lastHistoryEntry's first part
        // and append any other parts from the current content.
        lastHistoryEntry.parts[0].text +=
          consolidatedOutputContents[0].parts[0].text || '';
        if (consolidatedOutputContents[0].parts.length > 1) {
          lastHistoryEntry.parts.push(
            ...consolidatedOutputContents[0].parts.slice(1),
          );
        }
        consolidatedOutputContents.shift(); // Remove the first element as it's merged
      }
      this.history.push(...consolidatedOutputContents);
    }
  }

  private isTextContent(
    content: Content | undefined,
  ): content is Content & { parts: [{ text: string }, ...Part[]] } {
    return !!(
      content &&
      content.role === 'model' &&
      content.parts &&
      content.parts.length > 0 &&
      typeof content.parts[0].text === 'string' &&
      content.parts[0].text !== ''
    );
  }

  private isThoughtContent(
    content: Content | undefined,
  ): content is Content & { parts: [{ thought: boolean }, ...Part[]] } {
    return !!(
      content &&
      content.role === 'model' &&
      content.parts &&
      content.parts.length > 0 &&
      typeof content.parts[0].thought === 'boolean' &&
      content.parts[0].thought === true
    );
  }

  /**
   * 检查模型是否需要使用阿里云 API
   */
  private shouldUseAliyunAPI(model: string): boolean {
    const provider = getProviderForModel(model);
    return provider === AIProvider.ALIYUN;
  }

  /**
   * 获取阿里云 API 密钥
   */
  private getAliyunApiKey(): string {
    const apiKey = process.env.DASHSCOPE_API_KEY;
    if (!apiKey) {
      throw new Error('DASHSCOPE_API_KEY environment variable is required for Aliyun models');
    }
    return apiKey;
  }

  /**
   * 转换 Content 格式到阿里云消息格式
   */
  private convertToAliyunMessages(contents: Content[]): Array<{ role: 'system' | 'user' | 'assistant'; content: string }> {
    const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [];
    
    for (const content of contents) {
      if (content.role === 'user' || content.role === 'model') {
        const role = content.role === 'model' ? 'assistant' : content.role;
        const textParts = content.parts?.filter(part => 'text' in part && part.text) || [];
        const text = textParts.map(part => (part as any).text).join(' ');
        
        if (text.trim()) {
          messages.push({
            role: role as 'user' | 'assistant',
            content: text.trim(),
          });
        }
      }
    }
    
    return messages;
  }

  /**
   * 调用阿里云非流式 API
   */
  private async callAliyunAPI(
    model: string,
    messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>,
    config: GenerateContentConfig
  ): Promise<GenerateContentResponse> {
    const apiKey = this.getAliyunApiKey();
    const baseUrl = 'https://dashscope.aliyuncs.com/api/v1';
    
    const requestBody = {
      model,
      input: {
        messages,
      },
      parameters: {
        result_format: 'message',
        temperature: config.temperature || 1.0,
        max_tokens: config.maxOutputTokens,
      },
    };

    const response = await fetch(`${baseUrl}/services/aigc/text-generation/generation`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'User-Agent': 'uEVO-CLI/1.0',
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Aliyun DashScope API error: ${errorText}`);
    }

    const data = await response.json();

    let content = '';
    if (data.output.choices && data.output.choices.length > 0) {
      content = data.output.choices[0].message.content;
    } else if (data.output.text) {
      content = data.output.text;
    }

    // 转换为 Gemini 格式的响应
    return {
      candidates: [{
        content: {
          parts: [{ text: content }],
          role: 'model'
        },
        index: 0,
        finishReason: FinishReason.STOP,
        safetyRatings: []
      }],
      promptFeedback: {
        safetyRatings: []
      },
      usageMetadata: {
        promptTokenCount: data.usage.input_tokens,
        candidatesTokenCount: data.usage.output_tokens,
        totalTokenCount: data.usage.total_tokens,
      },
      modelVersion: model,
      text: undefined,
      data: undefined,
      functionCalls: undefined,
      executableCode: undefined,
      codeExecutionResult: undefined,
    };
  }

  /**
   * 调用阿里云流式 API
   */
  private async *callAliyunStreamAPI(
    model: string,
    messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>,
    config: GenerateContentConfig
  ): AsyncGenerator<GenerateContentResponse> {
    const apiKey = this.getAliyunApiKey();
    const baseUrl = 'https://dashscope.aliyuncs.com/api/v1';
    
    const requestBody = {
      model,
      input: {
        messages,
      },
      parameters: {
        result_format: 'message',
        temperature: config.temperature || 1.0,
        max_tokens: config.maxOutputTokens,
        incremental_output: true,
      },
    };

    const response = await fetch(`${baseUrl}/services/aigc/text-generation/generation`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'Accept': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'User-Agent': 'uEVO-CLI/1.0',
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Aliyun DashScope API error: ${errorText}`);
    }

    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error('Failed to get response stream');
    }

    const decoder = new TextDecoder();
    let buffer = '';
    let totalUsage: any = undefined;

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.trim() === '') continue;

          if (line.startsWith('data:')) {
            try {
              const jsonStr = line.slice(5).trim();
              if (jsonStr === '[DONE]') {
                return;
              }

              const data = JSON.parse(jsonStr);
              
              if (data.output?.choices && data.output.choices.length > 0) {
                const choice = data.output.choices[0];
                if (choice.message?.content) {
                  yield {
                    candidates: [{
                      content: {
                        parts: [{ text: choice.message.content }],
                        role: 'model'
                      },
                      index: 0,
                      finishReason: choice.finish_reason === 'stop' ? FinishReason.STOP : undefined,
                      safetyRatings: []
                    }],
                    promptFeedback: {
                      safetyRatings: []
                    },
                    usageMetadata: data.usage ? {
                      promptTokenCount: data.usage.input_tokens,
                      candidatesTokenCount: data.usage.output_tokens,
                      totalTokenCount: data.usage.total_tokens,
                    } : totalUsage,
                    modelVersion: model,
                    text: undefined,
                    data: undefined,
                    functionCalls: undefined,
                    executableCode: undefined,
                    codeExecutionResult: undefined,
                  };
                }
                
                if (choice.finish_reason) {
                  return;
                }
              }

              if (data.usage) {
                totalUsage = {
                  promptTokenCount: data.usage.input_tokens,
                  candidatesTokenCount: data.usage.output_tokens,
                  totalTokenCount: data.usage.total_tokens,
                };
              }
            } catch (e) {
              console.warn('Failed to parse Aliyun stream chunk:', line);
            }
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }
}
