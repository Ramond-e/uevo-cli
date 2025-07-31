/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { AIClient, AIMessage, AIResponse, AIStreamEvent, AIClientConfig } from '../aiClient.js';
import { Config } from '../../config/config.js';
import { GeminiClient } from '../client.js';

/**
 * Gemini AI客户端实现
 * 这是一个适配器，将现有的GeminiClient包装为AIClient接口
 */
export class GeminiAIClient extends AIClient {
  private geminiClient: GeminiClient;

  constructor(config: AIClientConfig, coreConfig: Config) {
    super(config, coreConfig);
    this.geminiClient = new GeminiClient(coreConfig);
  }

  async generateContent(messages: AIMessage[]): Promise<AIResponse> {
    // 确保GeminiClient已初始化
    if (!this.geminiClient.isInitialized()) {
      const contentGeneratorConfig = this.coreConfig.getContentGeneratorConfig();
      if (!contentGeneratorConfig) {
        throw new Error('Content generator config not available');
      }
      await this.geminiClient.initialize(contentGeneratorConfig);
    }

    // 转换消息格式
    const geminiContents = this.convertToGeminiContent(messages);
    
    // 清空历史并设置新的对话内容
    this.geminiClient.setHistory([]);
    for (const content of geminiContents) {
      await this.geminiClient.addHistory(content);
    }

    // 生成响应
    const response = await this.geminiClient.generateContent(
      geminiContents,
      {
        temperature: this.config.temperature || 0,
        maxOutputTokens: this.config.maxTokens,
      },
      new AbortController().signal,
      this.config.model
    );

    const responseText = response.candidates?.[0]?.content?.parts?.[0];
    const content = typeof responseText === 'string' ? responseText : (responseText as any)?.text || '';

    return {
      content,
      usage: {
        promptTokens: response.usageMetadata?.promptTokenCount || 0,
        completionTokens: response.usageMetadata?.candidatesTokenCount || 0,
        totalTokens: response.usageMetadata?.totalTokenCount || 0,
      },
    };
  }

  async *generateContentStream(messages: AIMessage[]): AsyncGenerator<AIStreamEvent> {
    // 确保GeminiClient已初始化
    if (!this.geminiClient.isInitialized()) {
      const contentGeneratorConfig = this.coreConfig.getContentGeneratorConfig();
      if (!contentGeneratorConfig) {
        yield { type: 'error', error: 'Content generator config not available' };
        return;
      }
      await this.geminiClient.initialize(contentGeneratorConfig);
    }

    try {
      // 转换消息格式并发送流式请求
      const request = messages[messages.length - 1]?.content || '';
      const promptId = `stream-${Date.now()}`;
      
      const streamGenerator = this.geminiClient.sendMessageStream(
        [{ text: request }],
        new AbortController().signal,
        promptId
      );

      for await (const event of streamGenerator) {
        switch (event.type) {
          case 'content':
            if ('value' in event && event.value) {
              yield { type: 'content', content: event.value };
            }
            break;
          case 'finished':
            yield { type: 'done' };
            return;
          case 'error':
            if ('value' in event && event.value) {
              yield { type: 'error', error: event.value.error?.message || 'Unknown error' };
            } else {
              yield { type: 'error', error: 'Unknown error' };
            }
            return;
        }
      }
    } catch (error) {
      yield { type: 'error', error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  async getAvailableModels(): Promise<string[]> {
    // 返回Gemini支持的模型列表
    return [
      'gemini-1.5-pro',
      'gemini-1.5-flash',
      'gemini-1.0-pro',
      'gemini-pro-vision',
      'gemini-2.0-flash-exp',
    ];
  }

  async testConnection(): Promise<boolean> {
    try {
      const response = await this.generateContent([
        { role: 'user', content: 'Hello' }
      ]);
      return response.content.length > 0;
    } catch (error) {
      console.warn('Gemini connection test failed:', error);
      return false;
    }
  }
}