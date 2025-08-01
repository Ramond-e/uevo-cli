/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { AIClient, AIMessage, AIResponse, AIStreamEvent, AIClientConfig } from '../aiClient.js';
import { Config } from '../../config/config.js';

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
 * 阿里云DashScope API客户端实现
 * 支持通义千问等模型
 */
export class AliyunClient extends AIClient {
  private readonly baseUrl: string;

  constructor(config: AIClientConfig, coreConfig: Config) {
    super(config, coreConfig);
    this.baseUrl = config.baseUrl || 'https://dashscope.aliyuncs.com/api/v1';
  }

  async generateContent(messages: AIMessage[]): Promise<AIResponse> {
    // 使用OpenAI兼容模式
    const response = await this.makeRequest('/services/aigc/text-generation/generation', {
      model: this.config.model,
      input: {
        messages: messages.map(msg => ({
          role: msg.role,
          content: msg.content,
        } as AliyunMessage)),
      },
      parameters: {
        result_format: 'message',
        temperature: this.config.temperature || 1.0,
        max_tokens: this.config.maxTokens,
      },
    });

    const data = await response.json() as AliyunResponse;

    if (!response.ok) {
      throw new Error(`Aliyun DashScope API error: ${JSON.stringify(data)}`);
    }

    let content = '';
    if (data.output.choices && data.output.choices.length > 0) {
      content = data.output.choices[0].message.content;
    } else if (data.output.text) {
      content = data.output.text;
    }

    return {
      content,
      usage: {
        promptTokens: data.usage.input_tokens,
        completionTokens: data.usage.output_tokens,
        totalTokens: data.usage.total_tokens,
      },
    };
  }

  async *generateContentStream(messages: AIMessage[]): AsyncGenerator<AIStreamEvent> {
    const response = await this.makeRequest('/services/aigc/text-generation/generation', {
      model: this.config.model,
      input: {
        messages: messages.map(msg => ({
          role: msg.role,
          content: msg.content,
        } as AliyunMessage)),
      },
      parameters: {
        result_format: 'message',
        temperature: this.config.temperature || 1.0,
        max_tokens: this.config.maxTokens,
        incremental_output: false,  // 修复：设置为false以避免增量输出问题
      },
    }, true);

    if (!response.ok) {
      const errorText = await response.text();
      yield { type: 'error', error: `Aliyun DashScope API error: ${errorText}` };
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

          if (line.startsWith('data:')) {
            try {
              const jsonStr = line.slice(5).trim();
              if (jsonStr === '[DONE]') {
                yield { type: 'done' };
                return;
              }

              const data = JSON.parse(jsonStr) as AliyunStreamChunk;
              
              if (data.output?.choices && data.output.choices.length > 0) {
                const choice = data.output.choices[0];
                if (choice.message?.content) {
                  // 修复：确保内容不为空且有意义
                  const content = choice.message.content.trim();
                  if (content.length > 0) {
                    yield { type: 'content', content };
                  }
                }
                if (choice.finish_reason && choice.finish_reason !== 'null') {
                  yield { type: 'done' };
                  return;
                }
              }
            } catch (e) {
              console.warn('Failed to parse Aliyun stream chunk:', line, 'Error:', e);
              // 继续处理下一个chunk，不要中断流
            }
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }

  async getAvailableModels(): Promise<string[]> {
    // 阿里云DashScope支持的主要模型
    return [
      'qwen-turbo',
      'qwen-plus',
      'qwen-max',
      'qwen-max-longcontext',
      'qwen-vl-plus',
      'qwen-vl-max',
      'qwen-audio-turbo',
      'qwen-audio-chat',
      'qwen2.5-72b-instruct',
      'qwen2.5-32b-instruct',
      'qwen2.5-14b-instruct',
      'qwen2.5-7b-instruct',
      'qwen2.5-3b-instruct',
      'qwen2.5-1.5b-instruct',
      'qwen2.5-0.5b-instruct',
      'qwen-coder-turbo',
      'qwen-coder-plus',
      'qwen2.5-coder-32b-instruct',
      'qwen2.5-coder-14b-instruct',
      'qwen2.5-coder-7b-instruct',
    ];
  }

  async testConnection(): Promise<boolean> {
    try {
      const response = await this.generateContent([
        { role: 'user', content: 'Hello' }
      ]);
      return response.content.length > 0;
    } catch (error) {
      console.warn('Aliyun DashScope connection test failed:', error);
      return false;
    }
  }

  private async makeRequest(endpoint: string, body?: any, stream = false): Promise<Response> {
    const url = `${this.baseUrl}${endpoint}`;
    const headers: Record<string, string> = {
      'Authorization': `Bearer ${this.config.apiKey}`,
      'Content-Type': 'application/json',
      'User-Agent': 'uEVO-CLI/1.0',
    };

    if (stream) {
      headers['Accept'] = 'text/event-stream';
      headers['Cache-Control'] = 'no-cache';
      headers['Connection'] = 'keep-alive';
    }

    const options: RequestInit = {
      method: body ? 'POST' : 'GET',
      headers,
      // 添加超时控制
      signal: AbortSignal.timeout(stream ? 60000 : 30000), // 流式60秒，非流式30秒
    };

    if (body) {
      options.body = JSON.stringify(body);
    }

    try {
      const response = await fetch(url, options);
      
      // 检查API密钥是否有效
      if (response.status === 401) {
        throw new Error('Invalid API key. Please check your DASHSCOPE_API_KEY.');
      }
      
      // 检查模型是否支持
      if (response.status === 400) {
        const errorText = await response.text();
        if (errorText.includes('model')) {
          throw new Error(`Model ${this.config.model} is not supported or available.`);
        }
      }
      
      return response;
    } catch (error) {
      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          throw new Error('Request timeout. The API response took too long.');
        }
        throw error;
      }
      throw new Error('Unknown error occurred while making request.');
    }
  }
}