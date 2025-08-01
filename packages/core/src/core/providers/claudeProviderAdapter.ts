/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { Config } from '../../config/config.js';
import { ToolRegistry } from '../../tools/tool-registry.js';
import { AnthropicClient } from '../anthropicClient.js';
import {
  AIProviderAdapter,
  SendMessageOptions,
  AIResponse,
  AIStreamEvent,
  ToolCallInfo,
} from '../aiProviderAdapter.js';

/**
 * Claude提供者适配器
 * 将AnthropicClient适配到统一的AIProviderAdapter接口
 */
export class ClaudeProviderAdapter implements AIProviderAdapter {
  private claudeClient: AnthropicClient;
  private initialized = false;

  constructor(private config: Config) {
    this.claudeClient = new AnthropicClient(config);
  }

  /**
   * 初始化Claude客户端
   */
  async initialize(toolRegistry: ToolRegistry): Promise<void> {
    await this.claudeClient.initialize();
    this.initialized = true;
  }

  /**
   * 发送消息
   */
  async sendMessage(message: string, options: SendMessageOptions = {}): Promise<AIResponse> {
    if (!this.initialized) {
      throw new Error('ClaudeProviderAdapter not initialized. Call initialize() first.');
    }

    const {
      model = AnthropicClient.CLAUDE_MODELS.SONNET_3_5,
      maxTokens = 4096,
      temperature = 0.1,
      systemPrompt,
      maxToolCalls = 10,
    } = options;

    const response = await this.claudeClient.sendMessage(message, model, {
      maxTokens,
      temperature,
      systemPrompt,
      maxToolCalls,
      stream: false,
    });

    // 转换工具调用格式
    const toolCalls: ToolCallInfo[] = response.toolCalls?.map(call => ({
      id: call.id || `tool_${Date.now()}`,
      name: call.name,
      parameters: call.parameters || {},
      status: call.status || 'completed',
      result: call.result,
      error: call.error,
    })) || [];

    return {
      content: response.content,
      toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
      usage: response.usage,
    };
  }

  /**
   * 流式发送消息
   * 注意：目前使用非流式API模拟流式响应
   */
  async *streamMessage(message: string, options: SendMessageOptions = {}): AsyncGenerator<AIStreamEvent, void, unknown> {
    if (!this.initialized) {
      throw new Error('ClaudeProviderAdapter not initialized. Call initialize() first.');
    }

    try {
      // 目前使用非流式API，将响应分块发送以模拟流式效果
      const response = await this.sendMessage(message, options);
      
      // 如果有工具调用，先发送工具调用事件
      if (response.toolCalls) {
        for (const toolCall of response.toolCalls) {
          yield {
            type: 'tool_call',
            toolCall,
          };
          
          yield {
            type: 'tool_result',
            toolCall,
          };
        }
      }

      // 分块发送文本内容
      const chunkSize = 50; // 每次发送50个字符
      const content = response.content;
      
      for (let i = 0; i < content.length; i += chunkSize) {
        const chunk = content.slice(i, i + chunkSize);
        yield {
          type: 'text',
          content: chunk,
        };
        
        // 添加小延迟以模拟流式效果
        await new Promise(resolve => setTimeout(resolve, 10));
      }

      yield {
        type: 'done',
      };

    } catch (error) {
      yield {
        type: 'error',
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * 获取支持的模型列表
   */
  getSupportedModels(): string[] {
    return Object.values(AnthropicClient.CLAUDE_MODELS);
  }

  /**
   * 检查是否已初始化
   */
  isInitialized(): boolean {
    return this.initialized && this.claudeClient.isInitialized();
  }
}