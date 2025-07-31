/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { AIClient, AIMessage, AIResponse, AIStreamEvent, AIClientConfig } from '../aiClient.js';
import { Config } from '../../config/config.js';

interface DeepSeekResponse {
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

interface DeepSeekStreamChunk {
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

interface DeepSeekModelsResponse {
  object: string;
  data: Array<{
    id: string;
    object: string;
    created: number;
    owned_by: string;
  }>;
}

/**
 * DeepSeek API客户端实现
 * 基于OpenAI兼容的API接口
 */
export class DeepSeekClient extends AIClient {
  private readonly baseUrl: string;

  constructor(config: AIClientConfig, coreConfig: Config) {
    super(config, coreConfig);
    this.baseUrl = config.baseUrl || 'https://api.deepseek.com/v1';
  }

  async generateContent(messages: AIMessage[]): Promise<AIResponse> {
    const response = await this.makeRequest('/chat/completions', {
      model: this.config.model,
      messages: messages.map(msg => ({
        role: msg.role,
        content: msg.content,
      })),
      temperature: this.config.temperature || 1.0,
      max_tokens: this.config.maxTokens,
      stream: false,
    });

    const data = await response.json() as DeepSeekResponse;

    if (!response.ok) {
      throw new Error(`DeepSeek API error: ${data}`);
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
      })),
      temperature: this.config.temperature || 1.0,
      max_tokens: this.config.maxTokens,
      stream: true,
    });

    if (!response.ok) {
      const errorText = await response.text();
      yield { type: 'error', error: `DeepSeek API error: ${errorText}` };
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
              const data = JSON.parse(line.slice(6)) as DeepSeekStreamChunk;
              const content = data.choices[0]?.delta?.content;
              if (content) {
                yield { type: 'content', content };
              }
              if (data.choices[0]?.finish_reason) {
                yield { type: 'done' };
                return;
              }
            } catch (e) {
              console.warn('Failed to parse DeepSeek stream chunk:', line);
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
      const data = await response.json() as DeepSeekModelsResponse;

      if (!response.ok) {
        throw new Error(`DeepSeek API error: ${data}`);
      }

      return data.data.map(model => model.id);
    } catch (error) {
      console.warn('Failed to fetch DeepSeek models:', error);
      // 返回已知的DeepSeek模型列表作为后备
      return [
        'deepseek-chat',
        'deepseek-coder',
        'deepseek-reasoner',
        'deepseek-v3',
        'deepseek-r1',
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
      console.warn('DeepSeek connection test failed:', error);
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