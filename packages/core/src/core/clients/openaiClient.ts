/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { AIClient, AIMessage, AIResponse, AIStreamEvent, AIClientConfig } from '../aiClient.js';
import { Config } from '../../config/config.js';

interface OpenAIMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface OpenAIResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: {
      role: string;
      content: string;
    };
    finish_reason: string;
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

interface OpenAIStreamChunk {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    delta: {
      role?: string;
      content?: string;
    };
    finish_reason?: string;
  }>;
}

interface OpenAIModelsResponse {
  object: string;
  data: Array<{
    id: string;
    object: string;
    created: number;
    owned_by: string;
  }>;
}

/**
 * OpenAI API客户端实现
 */
export class OpenAIClient extends AIClient {
  private readonly baseUrl: string;

  constructor(config: AIClientConfig, coreConfig: Config) {
    super(config, coreConfig);
    this.baseUrl = config.baseUrl || 'https://api.openai.com/v1';
  }

  async generateContent(messages: AIMessage[]): Promise<AIResponse> {
    const response = await this.makeRequest('/chat/completions', {
      model: this.config.model,
      messages: messages.map(msg => ({
        role: msg.role,
        content: msg.content,
      } as OpenAIMessage)),
      temperature: this.config.temperature || 1.0,
      max_tokens: this.config.maxTokens,
      stream: false,
    });

    const data = await response.json() as OpenAIResponse;

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${JSON.stringify(data)}`);
    }

    return {
      content: data.choices[0]?.message?.content || '',
      usage: {
        promptTokens: data.usage.prompt_tokens,
        completionTokens: data.usage.completion_tokens,
        totalTokens: data.usage.total_tokens,
      },
    };
  }

  async *generateContentStream(messages: AIMessage[]): AsyncGenerator<AIStreamEvent> {
    const response = await this.makeRequest('/chat/completions', {
      model: this.config.model,
      messages: messages.map(msg => ({
        role: msg.role,
        content: msg.content,
      } as OpenAIMessage)),
      temperature: this.config.temperature || 1.0,
      max_tokens: this.config.maxTokens,
      stream: true,
    });

    if (!response.ok) {
      const errorText = await response.text();
      yield { type: 'error', error: `OpenAI API error: ${errorText}` };
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
          if (line.trim() === 'data: [DONE]') {
            yield { type: 'done' };
            return;
          }

          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6)) as OpenAIStreamChunk;
              const content = data.choices[0]?.delta?.content;
              if (content) {
                yield { type: 'content', content };
              }
              if (data.choices[0]?.finish_reason) {
                yield { type: 'done' };
                return;
              }
            } catch (e) {
              console.warn('Failed to parse OpenAI stream chunk:', line);
            }
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }

  async getAvailableModels(): Promise<string[]> {
    try {
      const response = await this.makeRequest('/models');
      const data = await response.json() as OpenAIModelsResponse;

      if (!response.ok) {
        throw new Error(`OpenAI API error: ${JSON.stringify(data)}`);
      }

      return data.data
        .filter(model => model.id.includes('gpt') || model.id.includes('o1'))
        .map(model => model.id)
        .sort();
    } catch (error) {
      console.warn('Failed to fetch OpenAI models:', error);
      // 返回已知的OpenAI模型列表作为后备
      return [
        'gpt-4o',
        'gpt-4o-mini',
        'gpt-4-turbo',
        'gpt-4',
        'gpt-3.5-turbo',
        'o1-preview',
        'o1-mini',
      ];
    }
  }

  async testConnection(): Promise<boolean> {
    try {
      const response = await this.generateContent([
        { role: 'user', content: 'Hello' }
      ]);
      return response.content.length > 0;
    } catch (error) {
      console.warn('OpenAI connection test failed:', error);
      return false;
    }
  }

  private async makeRequest(endpoint: string, body?: any): Promise<Response> {
    const url = `${this.baseUrl}${endpoint}`;
    const options: RequestInit = {
      method: body ? 'POST' : 'GET',
      headers: {
        'Authorization': `Bearer ${this.config.apiKey}`,
        'Content-Type': 'application/json',
        'User-Agent': 'uEVO-CLI/1.0',
      },
    };

    if (body) {
      options.body = JSON.stringify(body);
    }

    return fetch(url, options);
  }
}