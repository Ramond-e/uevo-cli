/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { AIClient, AIMessage, AIResponse, AIStreamEvent, AIClientConfig } from '../aiClient.js';
import { Config } from '../../config/config.js';

interface AnthropicMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface AnthropicResponse {
  id: string;
  type: string;
  role: string;
  content: Array<{
    type: string;
    text: string;
  }>;
  model: string;
  stop_reason: string;
  stop_sequence: string | null;
  usage: {
    input_tokens: number;
    output_tokens: number;
  };
}

interface AnthropicStreamEvent {
  type: string;
  message?: {
    id: string;
    type: string;
    role: string;
    content: any[];
    model: string;
    stop_reason: string | null;
    stop_sequence: string | null;
    usage: {
      input_tokens: number;
      output_tokens: number;
    };
  };
  content_block?: {
    type: string;
    text: string;
  };
  delta?: {
    type: string;
    text: string;
  };
  usage?: {
    input_tokens: number;
    output_tokens: number;
  };
}

/**
 * Anthropic Claude API客户端实现
 */
export class AnthropicClient extends AIClient {
  private readonly baseUrl: string;

  constructor(config: AIClientConfig, coreConfig: Config) {
    super(config, coreConfig);
    this.baseUrl = config.baseUrl || 'https://api.anthropic.com/v1';
  }

  async generateContent(messages: AIMessage[]): Promise<AIResponse> {
    const { systemMessage, conversationMessages } = this.prepareMessages(messages);

    const requestBody: any = {
      model: this.config.model,
      max_tokens: this.config.maxTokens || 4096,
      messages: conversationMessages,
      temperature: this.config.temperature || 1.0,
    };

    if (systemMessage) {
      requestBody.system = systemMessage;
    }

    const response = await this.makeRequest('/messages', requestBody);
    const data = await response.json() as AnthropicResponse;

    if (!response.ok) {
      throw new Error(`Anthropic API error: ${JSON.stringify(data)}`);
    }

    return {
      content: data.content.map(c => c.text).join(''),
      usage: {
        promptTokens: data.usage.input_tokens,
        completionTokens: data.usage.output_tokens,
        totalTokens: data.usage.input_tokens + data.usage.output_tokens,
      },
    };
  }

  async *generateContentStream(messages: AIMessage[]): AsyncGenerator<AIStreamEvent> {
    const { systemMessage, conversationMessages } = this.prepareMessages(messages);

    const requestBody: any = {
      model: this.config.model,
      max_tokens: this.config.maxTokens || 4096,
      messages: conversationMessages,
      temperature: this.config.temperature || 1.0,
      stream: true,
    };

    if (systemMessage) {
      requestBody.system = systemMessage;
    }

    const response = await this.makeRequest('/messages', requestBody);

    if (!response.ok) {
      const errorText = await response.text();
      yield { type: 'error', error: `Anthropic API error: ${errorText}` };
      return;
    }

    const reader = response.body?.getReader();
    if (!reader) {
      yield { type: 'error', error: 'Failed to get response stream' };
      return;
    }

    const decoder = new TextDecoder();
    let buffer = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.trim() === '') continue;

          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6)) as AnthropicStreamEvent;
              
              if (data.type === 'content_block_delta' && data.delta?.text) {
                yield { type: 'content', content: data.delta.text };
              } else if (data.type === 'message_stop') {
                yield { type: 'done' };
                return;
              }
            } catch (e) {
              console.warn('Failed to parse Anthropic stream chunk:', line);
            }
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }

  async getAvailableModels(): Promise<string[]> {
    // Anthropic不提供公开的模型列表API，返回已知模型
    return [
      'claude-3-5-sonnet-20241022',
      'claude-3-5-sonnet-20240620',
      'claude-3-5-haiku-20241022',
      'claude-3-opus-20240229',
      'claude-3-sonnet-20240229',
      'claude-3-haiku-20240307',
      'claude-2.1',
      'claude-2.0',
      'claude-instant-1.2',
    ];
  }

  async testConnection(): Promise<boolean> {
    try {
      const response = await this.generateContent([
        { role: 'user', content: 'Hello' }
      ]);
      return response.content.length > 0;
    } catch (error) {
      console.warn('Anthropic connection test failed:', error);
      return false;
    }
  }

  private prepareMessages(messages: AIMessage[]): {
    systemMessage?: string;
    conversationMessages: AnthropicMessage[];
  } {
    let systemMessage: string | undefined;
    const conversationMessages: AnthropicMessage[] = [];

    for (const message of messages) {
      if (message.role === 'system') {
        systemMessage = message.content;
      } else if (message.role === 'user' || message.role === 'assistant') {
        conversationMessages.push({
          role: message.role,
          content: message.content,
        });
      }
    }

    return { systemMessage, conversationMessages };
  }

  private async makeRequest(endpoint: string, body?: any): Promise<Response> {
    const url = `${this.baseUrl}${endpoint}`;
    const options: RequestInit = {
      method: body ? 'POST' : 'GET',
      headers: {
        'x-api-key': this.config.apiKey,
        'Content-Type': 'application/json',
        'anthropic-version': '2023-06-01',
        'User-Agent': 'uEVO-CLI/1.0',
      },
    };

    if (body) {
      options.body = JSON.stringify(body);
    }

    return fetch(url, options);
  }
}