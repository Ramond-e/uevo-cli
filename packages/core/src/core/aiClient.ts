/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { Content, GenerateContentResponse, Part } from '@google/genai';
import { Config } from '../config/config.js';

export interface AIMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface AIStreamEvent {
  type: 'content' | 'done' | 'error';
  content?: string;
  error?: string;
}

export interface AIResponse {
  content: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

export enum AIProvider {
  GEMINI = 'gemini',
  DEEPSEEK = 'deepseek',
  ANTHROPIC = 'anthropic',
  OPENAI = 'openai',
  OPENROUTER = 'openrouter',
  ALIYUN = 'aliyun',
}

export interface AIClientConfig {
  provider: AIProvider;
  apiKey: string;
  model: string;
  baseUrl?: string;
  temperature?: number;
  maxTokens?: number;
}

/**
 * 统一的AI客户端接口，支持多个AI提供商
 */
export abstract class AIClient {
  protected config: AIClientConfig;
  protected coreConfig: Config;

  constructor(config: AIClientConfig, coreConfig: Config) {
    this.config = config;
    this.coreConfig = coreConfig;
  }

  /**
   * 发送单次请求并获取完整响应
   */
  abstract generateContent(messages: AIMessage[]): Promise<AIResponse>;

  /**
   * 发送流式请求
   */
  abstract generateContentStream(messages: AIMessage[]): AsyncGenerator<AIStreamEvent>;

  /**
   * 获取支持的模型列表
   */
  abstract getAvailableModels(): Promise<string[]>;

  /**
   * 测试API连接
   */
  abstract testConnection(): Promise<boolean>;

  /**
   * 获取当前配置信息
   */
  getConfig(): AIClientConfig {
    return { ...this.config };
  }

  /**
   * 更新配置
   */
  updateConfig(updates: Partial<AIClientConfig>): void {
    this.config = { ...this.config, ...updates };
  }

  /**
   * 将AIMessage转换为Gemini Content格式（用于兼容现有系统）
   */
  protected convertToGeminiContent(messages: AIMessage[]): Content[] {
    return messages.map(message => ({
      role: message.role === 'assistant' ? 'model' : message.role,
      parts: [{ text: message.content }] as Part[],
    }));
  }

  /**
   * 将Gemini Content转换为AIMessage格式
   */
  protected convertFromGeminiContent(contents: Content[]): AIMessage[] {
    return contents.map(content => ({
      role: content.role === 'model' ? 'assistant' : content.role as 'user' | 'system',
      content: (content.parts || []).map(part => 
        typeof part === 'string' ? part : (part as any).text || ''
      ).join(''),
    }));
  }
}

