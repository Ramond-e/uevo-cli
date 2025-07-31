/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { AIClient, AIClientConfig, AIProvider } from './aiClient.js';
import { Config } from '../config/config.js';
import { DeepSeekClient } from './clients/deepseekClient.js';
import { AnthropicClient } from './clients/anthropicClient.js';
import { OpenAIClient } from './clients/openaiClient.js';
import { OpenRouterClient } from './clients/openrouterClient.js';
import { AliyunClient } from './clients/aliyunClient.js';
import { GeminiAIClient } from './clients/geminiAIClient.js';

/**
 * AI客户端工厂
 */
export class AIClientFactory {
  static create(config: AIClientConfig, coreConfig: Config): AIClient {
    switch (config.provider) {
      case AIProvider.DEEPSEEK:
        return new DeepSeekClient(config, coreConfig);
      case AIProvider.ANTHROPIC:
        return new AnthropicClient(config, coreConfig);
      case AIProvider.OPENAI:
        return new OpenAIClient(config, coreConfig);
      case AIProvider.OPENROUTER:
        return new OpenRouterClient(config, coreConfig);
      case AIProvider.ALIYUN:
        return new AliyunClient(config, coreConfig);
      case AIProvider.GEMINI:
      default:
        return new GeminiAIClient(config, coreConfig);
    }
  }
}

// 重新导出客户端类
export { DeepSeekClient, AnthropicClient, OpenAIClient, OpenRouterClient, AliyunClient, GeminiAIClient };