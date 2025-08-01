/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { Config } from '../config/config.js';
import { ToolRegistry } from '../tools/tool-registry.js';

/**
 * AI提供者适配器接口
 * 统一不同AI模型提供者的接口
 */
export interface AIProviderAdapter {
  /**
   * 初始化提供者
   * @param toolRegistry 工具注册表
   */
  initialize(toolRegistry: ToolRegistry): Promise<void>;

  /**
   * 发送消息
   * @param message 用户消息
   * @param options 选项
   */
  sendMessage(message: string, options?: SendMessageOptions): Promise<AIResponse>;

  /**
   * 流式发送消息
   * @param message 用户消息
   * @param options 选项
   */
  streamMessage(message: string, options?: SendMessageOptions): AsyncGenerator<AIStreamEvent, void, unknown>;

  /**
   * 获取支持的模型列表
   */
  getSupportedModels(): string[];

  /**
   * 检查是否已初始化
   */
  isInitialized(): boolean;
}

/**
 * 发送消息选项
 */
export interface SendMessageOptions {
  model?: string;
  maxTokens?: number;
  temperature?: number;
  systemPrompt?: string;
  maxToolCalls?: number;
  stream?: boolean;
}

/**
 * AI响应
 */
export interface AIResponse {
  content: string;
  toolCalls?: ToolCallInfo[];
  usage?: TokenUsage;
}

/**
 * AI流事件
 */
export interface AIStreamEvent {
  type: 'text' | 'tool_call' | 'tool_result' | 'error' | 'done';
  content?: string;
  toolCall?: ToolCallInfo;
  error?: string;
}

/**
 * 工具调用信息
 */
export interface ToolCallInfo {
  id: string;
  name: string;
  parameters: Record<string, unknown>;
  status: 'pending' | 'executing' | 'completed' | 'error';
  result?: string;
  error?: string;
}

/**
 * Token使用统计
 */
export interface TokenUsage {
  input_tokens: number;
  output_tokens: number;
  total_tokens?: number;
}

/**
 * AI提供者工厂
 */
export class AIProviderFactory {
  /**
   * 创建AI提供者适配器
   * @param provider 提供者类型
   * @param config 配置
   */
  static async createProvider(
    provider: 'claude' | 'gemini' | 'openai' | 'deepseek',
    config: Config
  ): Promise<AIProviderAdapter> {
    switch (provider) {
      case 'claude': {
        const { ClaudeProviderAdapter } = await import('./providers/claudeProviderAdapter.js');
        return new ClaudeProviderAdapter(config);
      }
      case 'gemini': {
        const { GeminiProviderAdapter } = await import('./providers/geminiProviderAdapter.js');
        return new GeminiProviderAdapter(config);
      }
      case 'openai': {
        // 未来实现
        throw new Error('OpenAI provider not implemented yet');
      }
      case 'deepseek': {
        // 未来实现
        throw new Error('DeepSeek provider not implemented yet');
      }
      default:
        throw new Error(`Unsupported AI provider: ${provider}`);
    }
  }

  /**
   * 根据配置自动选择最佳提供者
   * @param config 配置
   */
  static async createBestProvider(config: Config): Promise<AIProviderAdapter> {
    // 检查可用的API密钥，选择最佳提供者
    if (config.getAnthropicApiKey?.()) {
      return this.createProvider('claude', config);
    }
    
    // TODO: 添加Gemini API密钥检查
    // if (config.getGeminiApiKey?.()) {
    //   return this.createProvider('gemini', config);
    // }

    throw new Error('No AI provider API key found. Please set ANTHROPIC_API_KEY or GEMINI_API_KEY environment variable.');
  }
}