/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { Config } from '../../config/config.js';
import { ToolRegistry } from '../../tools/tool-registry.js';
import {
  AIProviderAdapter,
  SendMessageOptions,
  AIResponse,
  AIStreamEvent,
} from '../aiProviderAdapter.js';

/**
 * Gemini提供者适配器
 * 将现有的GeminiClient适配到统一的AIProviderAdapter接口
 */
export class GeminiProviderAdapter implements AIProviderAdapter {
  private initialized = false;

  constructor(private config: Config) {
    // 构造函数实现
  }

  /**
   * 初始化Gemini客户端
   */
  async initialize(toolRegistry: ToolRegistry): Promise<void> {
    // TODO: 集成现有的GeminiClient
    this.initialized = true;
  }

  /**
   * 发送消息
   */
  async sendMessage(message: string, options: SendMessageOptions = {}): Promise<AIResponse> {
    if (!this.initialized) {
      throw new Error('GeminiProviderAdapter not initialized. Call initialize() first.');
    }

    // TODO: 实现Gemini消息发送
    throw new Error('GeminiProviderAdapter.sendMessage not implemented yet');
  }

  /**
   * 流式发送消息
   */
  async *streamMessage(message: string, options: SendMessageOptions = {}): AsyncGenerator<AIStreamEvent, void, unknown> {
    if (!this.initialized) {
      throw new Error('GeminiProviderAdapter not initialized. Call initialize() first.');
    }

    // TODO: 实现Gemini流式消息发送
    throw new Error('GeminiProviderAdapter.streamMessage not implemented yet');
  }

  /**
   * 获取支持的模型列表
   */
  getSupportedModels(): string[] {
    // TODO: 返回Gemini支持的模型列表
    return ['gemini-pro', 'gemini-pro-vision'];
  }

  /**
   * 检查是否已初始化
   */
  isInitialized(): boolean {
    return this.initialized;
  }
}