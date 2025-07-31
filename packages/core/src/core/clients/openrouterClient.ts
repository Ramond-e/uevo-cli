/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { AIClient, AIMessage, AIResponse, AIStreamEvent, AIClientConfig } from '../aiClient.js';
import { Config } from '../../config/config.js';

interface OpenRouterMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface OpenRouterResponse {
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

interface OpenRouterStreamChunk {
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

interface OpenRouterModelsResponse {
  data: Array<{
    id: string;
    name: string;
    created: number;
    description: string;
    pricing: {
      prompt: string;
      completion: string;
    };
    context_length: number;
    architecture: {
      tokenizer: string;
      instruct_type?: string;
    };
    top_provider: {
      context_length: number;
      max_completion_tokens: number;
    };
  }>;
}

/**
 * OpenRouter API客户端实现
 * OpenRouter提供统一接口访问多个AI模型提供商
 */
export class OpenRouterClient extends AIClient {
  private readonly baseUrl: string;

  constructor(config: AIClientConfig, coreConfig: Config) {
    super(config, coreConfig);
    this.baseUrl = config.baseUrl || 'https://openrouter.ai/api/v1';
  }

  async generateContent(messages: AIMessage[]): Promise<AIResponse> {
    const response = await this.makeRequest('/chat/completions', {
      model: this.config.model,
      messages: messages.map(msg => ({
        role: msg.role,
        content: msg.content,
      } as OpenRouterMessage)),
      temperature: this.config.temperature || 1.0,
      max_tokens: this.config.maxTokens,
      stream: false,
    });

    const data = await response.json() as OpenRouterResponse;

    if (!response.ok) {
      throw new Error(`OpenRouter API error: ${JSON.stringify(data)}`);
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
      } as OpenRouterMessage)),
      temperature: this.config.temperature || 1.0,
      max_tokens: this.config.maxTokens,
      stream: true,
    });

    if (!response.ok) {
      const errorText = await response.text();
      yield { type: 'error', error: `OpenRouter API error: ${errorText}` };
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
              const data = JSON.parse(line.slice(6)) as OpenRouterStreamChunk;
              const content = data.choices[0]?.delta?.content;
              if (content) {
                yield { type: 'content', content };
              }
              if (data.choices[0]?.finish_reason) {
                yield { type: 'done' };
                return;
              }
            } catch (e) {
              console.warn('Failed to parse OpenRouter stream chunk:', line);
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
      const data = await response.json() as OpenRouterModelsResponse;

      if (!response.ok) {
        throw new Error(`OpenRouter API error: ${JSON.stringify(data)}`);
      }

      return data.data.map(model => model.id).sort();
    } catch (error) {
      console.warn('Failed to fetch OpenRouter models:', error);
      // 返回一些流行的OpenRouter模型作为后备
      return [
        'anthropic/claude-3.5-sonnet',
        'anthropic/claude-3-haiku',
        'openai/gpt-4o',
        'openai/gpt-4o-mini',
        'openai/gpt-3.5-turbo',
        'google/gemini-pro',
        'meta-llama/llama-3.1-70b-instruct',
        'mistralai/mixtral-8x7b-instruct',
        'deepseek/deepseek-chat',
        'qwen/qwen-2.5-72b-instruct',
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
      console.warn('OpenRouter connection test failed:', error);
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
        'HTTP-Referer': 'https://uevo-cli.com',
        'X-Title': 'uEVO CLI',
        'User-Agent': 'uEVO-CLI/1.0',
      },
    };

    if (body) {
      options.body = JSON.stringify(body);
    }

    return fetch(url, options);
  }
}