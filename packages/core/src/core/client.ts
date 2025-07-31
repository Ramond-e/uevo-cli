/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  EmbedContentParameters,
  GenerateContentConfig,
  Part,
  SchemaUnion,
  PartListUnion,
  Content,
  Tool,
  GenerateContentResponse,
  FinishReason,
} from '@google/genai';
import { getFolderStructure } from '../utils/getFolderStructure.js';
import {
  Turn,
  ServerGeminiStreamEvent,
  GeminiEventType,
  ChatCompressionInfo,
} from './turn.js';
import { Config } from '../config/config.js';
import { UserTierId } from '../code_assist/types.js';
import { getCoreSystemPrompt, getCompressionPrompt } from './prompts.js';
import { ReadManyFilesTool } from '../tools/read-many-files.js';
import { getResponseText } from '../utils/generateContentResponseUtilities.js';
import { checkNextSpeaker } from '../utils/nextSpeakerChecker.js';
import { reportError } from '../utils/errorReporting.js';
import { GeminiChat } from './uevoChat.js';
import { retryWithBackoff } from '../utils/retry.js';
import { getErrorMessage } from '../utils/errors.js';
import { isFunctionResponse } from '../utils/messageInspectors.js';
import { tokenLimit } from './tokenLimits.js';
import {
  AuthType,
  ContentGenerator,
  ContentGeneratorConfig,
  createContentGenerator,
} from './contentGenerator.js';
import { ProxyAgent, setGlobalDispatcher } from 'undici';
import { DEFAULT_UEVO_FLASH_MODEL } from '../config/models.js';
import { LoopDetectionService } from '../services/loopDetectionService.js';
import { ideContext } from '../services/ideContext.js';
import { logFlashDecidedToContinue } from '../telemetry/loggers.js';
import { FlashDecidedToContinueEvent } from '../telemetry/types.js';
import { getProviderForModel, AIProvider } from './modelProviderMapping.js';

function isThinkingSupported(model: string) {
  if (model.startsWith('gemini-2.5')) return true;
  return false;
}

// 阿里云 API 相关接口定义
interface AliyunMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface AliyunResponse {
  output: {
    text?: string;
    choices?: Array<{
      finish_reason: string;
      message: {
        role: string;
        content: string;
      };
    }>;
  };
  usage: {
    input_tokens: number;
    output_tokens: number;
    total_tokens: number;
  };
  request_id: string;
}

interface AliyunStreamChunk {
  output?: {
    choices?: Array<{
      finish_reason?: string;
      message?: {
        role: string;
        content: string;
      };
    }>;
  };
  usage?: {
    input_tokens: number;
    output_tokens: number;
    total_tokens: number;
  };
}

/**
 * Returns the index of the content after the fraction of the total characters in the history.
 *
 * Exported for testing purposes.
 */
export function findIndexAfterFraction(
  history: Content[],
  fraction: number,
): number {
  if (fraction <= 0 || fraction >= 1) {
    throw new Error('Fraction must be between 0 and 1');
  }

  const contentLengths = history.map(
    (content) => JSON.stringify(content).length,
  );

  const totalCharacters = contentLengths.reduce(
    (sum, length) => sum + length,
    0,
  );
  const targetCharacters = totalCharacters * fraction;

  let charactersSoFar = 0;
  for (let i = 0; i < contentLengths.length; i++) {
    charactersSoFar += contentLengths[i];
    if (charactersSoFar >= targetCharacters) {
      return i;
    }
  }
  return contentLengths.length;
}

export class GeminiClient {
  private chat?: GeminiChat;
  private contentGenerator?: ContentGenerator;
  private embeddingModel: string;
  private generateContentConfig: GenerateContentConfig = {
    temperature: 0,
    topP: 1,
  };
  private sessionTurnCount = 0;
  private readonly MAX_TURNS = 100;
  /**
   * Threshold for compression token count as a fraction of the model's token limit.
   * If the chat history exceeds this threshold, it will be compressed.
   */
  private readonly COMPRESSION_TOKEN_THRESHOLD = 0.7;
  /**
   * The fraction of the latest chat history to keep. A value of 0.3
   * means that only the last 30% of the chat history will be kept after compression.
   */
  private readonly COMPRESSION_PRESERVE_THRESHOLD = 0.3;

  private readonly loopDetector: LoopDetectionService;
  private lastPromptId?: string;

  constructor(private config: Config) {
    if (config.getProxy()) {
      setGlobalDispatcher(new ProxyAgent(config.getProxy() as string));
    }

    this.embeddingModel = config.getEmbeddingModel();
    this.loopDetector = new LoopDetectionService(config);
  }

  async initialize(contentGeneratorConfig: ContentGeneratorConfig) {
    this.contentGenerator = await createContentGenerator(
      contentGeneratorConfig,
      this.config,
      this.config.getSessionId(),
    );
    this.chat = await this.startChat();
  }

  getContentGenerator(): ContentGenerator {
    if (!this.contentGenerator) {
      throw new Error('Content generator not initialized');
    }
    return this.contentGenerator;
  }

  getUserTier(): UserTierId | undefined {
    return this.contentGenerator?.userTier;
  }

  async addHistory(content: Content) {
    this.getChat().addHistory(content);
  }

  getChat(): GeminiChat {
    if (!this.chat) {
      throw new Error('Chat not initialized');
    }
    return this.chat;
  }

  isInitialized(): boolean {
    return this.chat !== undefined && this.contentGenerator !== undefined;
  }

  getHistory(): Content[] {
    return this.getChat().getHistory();
  }

  setHistory(history: Content[]) {
    this.getChat().setHistory(history);
  }

  async setTools(): Promise<void> {
    const toolRegistry = await this.config.getToolRegistry();
    const toolDeclarations = toolRegistry.getFunctionDeclarations();
    const tools: Tool[] = [{ functionDeclarations: toolDeclarations }];
    this.getChat().setTools(tools);
  }

  async resetChat(): Promise<void> {
    this.chat = await this.startChat();
  }

  private async getEnvironment(): Promise<Part[]> {
    const cwd = this.config.getWorkingDir();
    const today = new Date().toLocaleDateString(undefined, {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
    const platform = process.platform;
    const folderStructure = await getFolderStructure(cwd, {
      fileService: this.config.getFileService(),
    });
    const context = `
  This is the uEVO CLI. We are setting up the context for our chat.
  Today's date is ${today}.
  My operating system is: ${platform}
  I'm currently working in the directory: ${cwd}
  ${folderStructure}
          `.trim();

    const initialParts: Part[] = [{ text: context }];
    const toolRegistry = await this.config.getToolRegistry();

    // Add full file context if the flag is set
    if (this.config.getFullContext()) {
      try {
        const readManyFilesTool = toolRegistry.getTool(
          'read_many_files',
        ) as ReadManyFilesTool;
        if (readManyFilesTool) {
          // Read all files in the target directory
          const result = await readManyFilesTool.execute(
            {
              paths: ['**/*'], // Read everything recursively
              useDefaultExcludes: true, // Use default excludes
            },
            AbortSignal.timeout(30000),
          );
          if (result.llmContent) {
            initialParts.push({
              text: `\n--- Full File Context ---\n${result.llmContent}`,
            });
          } else {
            console.warn(
              'Full context requested, but read_many_files returned no content.',
            );
          }
        } else {
          console.warn(
            'Full context requested, but read_many_files tool not found.',
          );
        }
      } catch (error) {
        // Not using reportError here as it's a startup/config phase, not a chat/generation phase error.
        console.error('Error reading full file context:', error);
        initialParts.push({
          text: '\n--- Error reading full file context ---',
        });
      }
    }

    return initialParts;
  }

  async startChat(extraHistory?: Content[]): Promise<GeminiChat> {
    const envParts = await this.getEnvironment();
    const toolRegistry = await this.config.getToolRegistry();
    const toolDeclarations = toolRegistry.getFunctionDeclarations();
    const tools: Tool[] = [{ functionDeclarations: toolDeclarations }];
    const history: Content[] = [
      {
        role: 'user',
        parts: envParts,
      },
      {
        role: 'model',
        parts: [{ text: 'Got it. Thanks for the context!' }],
      },
      ...(extraHistory ?? []),
    ];
    try {
      const userMemory = this.config.getUserMemory();
      const systemInstruction = getCoreSystemPrompt(userMemory);
      const generateContentConfigWithThinking = isThinkingSupported(
        this.config.getModel(),
      )
        ? {
            ...this.generateContentConfig,
            thinkingConfig: {
              includeThoughts: true,
            },
          }
        : this.generateContentConfig;
      return new GeminiChat(
        this.config,
        this.getContentGenerator(),
        {
          systemInstruction,
          ...generateContentConfigWithThinking,
          tools,
        },
        history,
      );
    } catch (error) {
      await reportError(
        error,
        'Error initializing Gemini chat session.',
        history,
        'startChat',
      );
      throw new Error(`Failed to initialize chat: ${getErrorMessage(error)}`);
    }
  }

  async *sendMessageStream(
    request: PartListUnion,
    signal: AbortSignal,
    prompt_id: string,
    turns: number = this.MAX_TURNS,
    originalModel?: string,
  ): AsyncGenerator<ServerGeminiStreamEvent, Turn> {
    if (this.lastPromptId !== prompt_id) {
      this.loopDetector.reset(prompt_id);
      this.lastPromptId = prompt_id;
    }
    this.sessionTurnCount++;
    if (
      this.config.getMaxSessionTurns() > 0 &&
      this.sessionTurnCount > this.config.getMaxSessionTurns()
    ) {
      yield { type: GeminiEventType.MaxSessionTurns };
      return new Turn(this.getChat(), prompt_id);
    }
    // Ensure turns never exceeds MAX_TURNS to prevent infinite loops
    const boundedTurns = Math.min(turns, this.MAX_TURNS);
    if (!boundedTurns) {
      return new Turn(this.getChat(), prompt_id);
    }

    // Track the original model from the first call to detect model switching
    const initialModel = originalModel || this.config.getModel();

    const compressed = await this.tryCompressChat(prompt_id);

    if (compressed) {
      yield { type: GeminiEventType.ChatCompressed, value: compressed };
    }

    if (this.config.getIdeMode()) {
      const openFiles = ideContext.getOpenFilesContext();
      if (openFiles) {
        const contextParts: string[] = [];
        if (openFiles.activeFile) {
          contextParts.push(
            `This is the file that the user was most recently looking at:\n- Path: ${openFiles.activeFile}`,
          );
          if (openFiles.cursor) {
            contextParts.push(
              `This is the cursor position in the file:\n- Cursor Position: Line ${openFiles.cursor.line}, Character ${openFiles.cursor.character}`,
            );
          }
          if (openFiles.selectedText) {
            contextParts.push(
              `This is the selected text in the active file:\n- ${openFiles.selectedText}`,
            );
          }
        }

        if (openFiles.recentOpenFiles && openFiles.recentOpenFiles.length > 0) {
          const recentFiles = openFiles.recentOpenFiles
            .map((file) => `- ${file.filePath}`)
            .join('\n');
          contextParts.push(
            `Here are files the user has recently opened, with the most recent at the top:\n${recentFiles}`,
          );
        }

        if (contextParts.length > 0) {
          request = [
            { text: contextParts.join('\n') },
            ...(Array.isArray(request) ? request : [request]),
          ];
        }
      }
    }

    const turn = new Turn(this.getChat(), prompt_id);

    const loopDetected = await this.loopDetector.turnStarted(signal);
    if (loopDetected) {
      yield { type: GeminiEventType.LoopDetected };
      return turn;
    }

    const resultStream = turn.run(request, signal);
    for await (const event of resultStream) {
      if (this.loopDetector.addAndCheck(event)) {
        yield { type: GeminiEventType.LoopDetected };
        return turn;
      }
      yield event;
    }
    if (!turn.pendingToolCalls.length && signal && !signal.aborted) {
      // Check if model was switched during the call (likely due to quota error)
      const currentModel = this.config.getModel();
      if (currentModel !== initialModel) {
        // Model was switched (likely due to quota error fallback)
        // Don't continue with recursive call to prevent unwanted Flash execution
        return turn;
      }

      const nextSpeakerCheck = await checkNextSpeaker(
        this.getChat(),
        this,
        signal,
      );
      if (nextSpeakerCheck?.next_speaker === 'model') {
        logFlashDecidedToContinue(
          this.config,
          new FlashDecidedToContinueEvent(prompt_id),
        );
        const nextRequest = [{ text: 'Please continue.' }];
        // This recursive call's events will be yielded out, but the final
        // turn object will be from the top-level call.
        yield* this.sendMessageStream(
          nextRequest,
          signal,
          prompt_id,
          boundedTurns - 1,
          initialModel,
        );
      }
    }
    return turn;
  }

  async generateJson(
    contents: Content[],
    schema: SchemaUnion,
    abortSignal: AbortSignal,
    model?: string,
    config: GenerateContentConfig = {},
  ): Promise<Record<string, unknown>> {
    // Use current model from config instead of hardcoded Flash model
    const modelToUse =
      model || this.config.getModel() || DEFAULT_UEVO_FLASH_MODEL;
    try {
      const userMemory = this.config.getUserMemory();
      const systemInstruction = getCoreSystemPrompt(userMemory);
      const requestConfig = {
        abortSignal,
        ...this.generateContentConfig,
        ...config,
      };

      const apiCall = () =>
        this.getContentGenerator().generateContent({
          model: modelToUse,
          config: {
            ...requestConfig,
            systemInstruction,
            responseSchema: schema,
            responseMimeType: 'application/json',
          },
          contents,
        });

      const result = await retryWithBackoff(apiCall, {
        onPersistent429: async (authType?: string, error?: unknown) =>
          await this.handleFlashFallback(authType, error),
        authType: this.config.getContentGeneratorConfig()?.authType,
      });

      const text = getResponseText(result);
      if (!text) {
        const error = new Error(
          'API returned an empty response for generateJson.',
        );
        await reportError(
          error,
          'Error in generateJson: API returned an empty response.',
          contents,
          'generateJson-empty-response',
        );
        throw error;
      }
      try {
        return JSON.parse(text);
      } catch (parseError) {
        await reportError(
          parseError,
          'Failed to parse JSON response from generateJson.',
          {
            responseTextFailedToParse: text,
            originalRequestContents: contents,
          },
          'generateJson-parse',
        );
        throw new Error(
          `Failed to parse API response as JSON: ${getErrorMessage(parseError)}`,
        );
      }
    } catch (error) {
      if (abortSignal.aborted) {
        throw error;
      }

      // Avoid double reporting for the empty response case handled above
      if (
        error instanceof Error &&
        error.message === 'API returned an empty response for generateJson.'
      ) {
        throw error;
      }

      await reportError(
        error,
        'Error generating JSON content via API.',
        contents,
        'generateJson-api',
      );
      throw new Error(
        `Failed to generate JSON content: ${getErrorMessage(error)}`,
      );
    }
  }

  async generateContent(
    contents: Content[],
    generationConfig: GenerateContentConfig,
    abortSignal: AbortSignal,
    model?: string,
  ): Promise<GenerateContentResponse> {
    const modelToUse = model ?? this.config.getModel();
    const configToUse: GenerateContentConfig = {
      ...this.generateContentConfig,
      ...generationConfig,
    };

    try {
      // 检查是否需要使用阿里云 API
      if (this.shouldUseAliyunAPI(modelToUse)) {
        const userMemory = this.config.getUserMemory();
        const systemInstruction = getCoreSystemPrompt(userMemory);
        
        // 添加系统指令到内容中
        const contentsWithSystem = systemInstruction 
          ? [{ role: 'user' as const, parts: [{ text: systemInstruction }] }, ...contents]
          : contents;
        
        const messages = this.convertToAliyunMessages(contentsWithSystem);
        
        const apiCall = () => this.callAliyunAPI(modelToUse, messages, configToUse, abortSignal);
        
        const result = await retryWithBackoff(apiCall, {
          onPersistent429: async (authType?: string, error?: unknown) =>
            await this.handleFlashFallback(authType, error),
          authType: this.config.getContentGeneratorConfig()?.authType,
        });
        return result;
      }

      // 使用原有的 Gemini API 逻辑
      const userMemory = this.config.getUserMemory();
      const systemInstruction = getCoreSystemPrompt(userMemory);

      const requestConfig = {
        abortSignal,
        ...configToUse,
        systemInstruction,
      };

      const apiCall = () =>
        this.getContentGenerator().generateContent({
          model: modelToUse,
          config: requestConfig,
          contents,
        });

      const result = await retryWithBackoff(apiCall, {
        onPersistent429: async (authType?: string, error?: unknown) =>
          await this.handleFlashFallback(authType, error),
        authType: this.config.getContentGeneratorConfig()?.authType,
      });
      return result;
    } catch (error: unknown) {
      if (abortSignal.aborted) {
        throw error;
      }

      await reportError(
        error,
        `Error generating content via API with model ${modelToUse}.`,
        {
          requestContents: contents,
          requestConfig: configToUse,
        },
        'generateContent-api',
      );
      throw new Error(
        `Failed to generate content with model ${modelToUse}: ${getErrorMessage(error)}`,
      );
    }
  }

  async generateEmbedding(texts: string[]): Promise<number[][]> {
    if (!texts || texts.length === 0) {
      return [];
    }
    const embedModelParams: EmbedContentParameters = {
      model: this.embeddingModel,
      contents: texts,
    };

    const embedContentResponse =
      await this.getContentGenerator().embedContent(embedModelParams);
    if (
      !embedContentResponse.embeddings ||
      embedContentResponse.embeddings.length === 0
    ) {
      throw new Error('No embeddings found in API response.');
    }

    if (embedContentResponse.embeddings.length !== texts.length) {
      throw new Error(
        `API returned a mismatched number of embeddings. Expected ${texts.length}, got ${embedContentResponse.embeddings.length}.`,
      );
    }

    return embedContentResponse.embeddings.map((embedding, index) => {
      const values = embedding.values;
      if (!values || values.length === 0) {
        throw new Error(
          `API returned an empty embedding for input text at index ${index}: "${texts[index]}"`,
        );
      }
      return values;
    });
  }

  async tryCompressChat(
    prompt_id: string,
    force: boolean = false,
  ): Promise<ChatCompressionInfo | null> {
    const curatedHistory = this.getChat().getHistory(true);

    // Regardless of `force`, don't do anything if the history is empty.
    if (curatedHistory.length === 0) {
      return null;
    }

    const model = this.config.getModel();

    const { totalTokens: originalTokenCount } =
      await this.getContentGenerator().countTokens({
        model,
        contents: curatedHistory,
      });
    if (originalTokenCount === undefined) {
      console.warn(`Could not determine token count for model ${model}.`);
      return null;
    }

    // Don't compress if not forced and we are under the limit.
    if (
      !force &&
      originalTokenCount < this.COMPRESSION_TOKEN_THRESHOLD * tokenLimit(model)
    ) {
      return null;
    }

    let compressBeforeIndex = findIndexAfterFraction(
      curatedHistory,
      1 - this.COMPRESSION_PRESERVE_THRESHOLD,
    );
    // Find the first user message after the index. This is the start of the next turn.
    while (
      compressBeforeIndex < curatedHistory.length &&
      (curatedHistory[compressBeforeIndex]?.role === 'model' ||
        isFunctionResponse(curatedHistory[compressBeforeIndex]))
    ) {
      compressBeforeIndex++;
    }

    const historyToCompress = curatedHistory.slice(0, compressBeforeIndex);
    const historyToKeep = curatedHistory.slice(compressBeforeIndex);

    this.getChat().setHistory(historyToCompress);

    const { text: summary } = await this.getChat().sendMessage(
      {
        message: {
          text: 'First, reason in your scratchpad. Then, generate the <state_snapshot>.',
        },
        config: {
          systemInstruction: { text: getCompressionPrompt() },
        },
      },
      prompt_id,
    );
    this.chat = await this.startChat([
      {
        role: 'user',
        parts: [{ text: summary }],
      },
      {
        role: 'model',
        parts: [{ text: 'Got it. Thanks for the additional context!' }],
      },
      ...historyToKeep,
    ]);

    const { totalTokens: newTokenCount } =
      await this.getContentGenerator().countTokens({
        // model might change after calling `sendMessage`, so we get the newest value from config
        model: this.config.getModel(),
        contents: this.getChat().getHistory(),
      });
    if (newTokenCount === undefined) {
      console.warn('Could not determine compressed history token count.');
      return null;
    }

    return {
      originalTokenCount,
      newTokenCount,
    };
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
   * 转换 Gemini Content 格式到阿里云消息格式
   */
  private convertToAliyunMessages(contents: Content[]): AliyunMessage[] {
    const messages: AliyunMessage[] = [];
    
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
   * 调用阿里云 DashScope API
   */
  private async callAliyunAPI(
    model: string,
    messages: AliyunMessage[],
    config: GenerateContentConfig,
    abortSignal: AbortSignal
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
      signal: abortSignal,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Aliyun DashScope API error: ${errorText}`);
    }

    const data = await response.json() as AliyunResponse;

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
    messages: AliyunMessage[],
    config: GenerateContentConfig,
    abortSignal: AbortSignal
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
      signal: abortSignal,
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

              const data = JSON.parse(jsonStr) as AliyunStreamChunk;
              
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
