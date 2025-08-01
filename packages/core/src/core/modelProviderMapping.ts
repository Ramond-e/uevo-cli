/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { AIProvider } from './aiClient.js';

// 重新导出AIProvider以便其他模块使用
export { AIProvider };

/**
 * 模型名称到提供商的映射
 * 用于根据模型名称自动确定应该使用哪个AI提供商
 */
export const MODEL_PROVIDER_MAPPING: Record<string, AIProvider> = {
  // Gemini 模型
  'gemini-1.5-pro': AIProvider.GEMINI,
  'gemini-1.5-flash': AIProvider.GEMINI,
  'gemini-1.5-pro-002': AIProvider.GEMINI,
  'gemini-1.5-flash-002': AIProvider.GEMINI,
  'gemini-2.0-flash-exp': AIProvider.GEMINI,
  'gemini-2.5-pro': AIProvider.GEMINI,
  'gemini-pro': AIProvider.GEMINI,
  'gemini-pro-vision': AIProvider.GEMINI,

  // DeepSeek 模型
  'deepseek-chat': AIProvider.DEEPSEEK,
  'deepseek-coder': AIProvider.DEEPSEEK,
  'deepseek-reasoner': AIProvider.DEEPSEEK,
  'deepseek-v3': AIProvider.DEEPSEEK,
  'deepseek-r1': AIProvider.DEEPSEEK,

  // Anthropic 模型
  'claude-3-5-sonnet-20241022': AIProvider.ANTHROPIC,
  'claude-3-5-sonnet-20240620': AIProvider.ANTHROPIC,
  'claude-3-5-haiku-20241022': AIProvider.ANTHROPIC,
  'claude-3-opus-20240229': AIProvider.ANTHROPIC,
  'claude-3-sonnet-20240229': AIProvider.ANTHROPIC,
  'claude-3-haiku-20240307': AIProvider.ANTHROPIC,
  'claude-2.1': AIProvider.ANTHROPIC,
  'claude-2.0': AIProvider.ANTHROPIC,
  'claude-instant-1.2': AIProvider.ANTHROPIC,

  // OpenAI 模型
  'gpt-4o': AIProvider.OPENAI,
  'gpt-4o-mini': AIProvider.OPENAI,
  'gpt-4-turbo': AIProvider.OPENAI,
  'gpt-4': AIProvider.OPENAI,
  'gpt-3.5-turbo': AIProvider.OPENAI,
  'o1-preview': AIProvider.OPENAI,
  'o1-mini': AIProvider.OPENAI,

  // 阿里云通义千问模型
  'qwen-turbo': AIProvider.ALIYUN,
  'qwen-plus': AIProvider.ALIYUN,
  'qwen-max': AIProvider.ALIYUN,
  'qwen-long': AIProvider.ALIYUN,
  'qwen-max-longcontext': AIProvider.ALIYUN,
  'qwen-vl-plus': AIProvider.ALIYUN,
  'qwen-vl-max': AIProvider.ALIYUN,
  'qwen-audio-turbo': AIProvider.ALIYUN,
  'qwen-audio-chat': AIProvider.ALIYUN,
  
  // Qwen2.5 系列模型
  'qwen2.5-72b-instruct': AIProvider.ALIYUN,
  'qwen2.5-32b-instruct': AIProvider.ALIYUN,
  'qwen2.5-14b-instruct': AIProvider.ALIYUN,
  'qwen2.5-7b-instruct': AIProvider.ALIYUN,
  'qwen2.5-3b-instruct': AIProvider.ALIYUN,
  'qwen2.5-1.5b-instruct': AIProvider.ALIYUN,
  'qwen2.5-0.5b-instruct': AIProvider.ALIYUN,
  
  // Qwen Coder 系列模型
  'qwen-coder-turbo': AIProvider.ALIYUN,
  'qwen-coder-plus': AIProvider.ALIYUN,
  'qwen2.5-coder-32b-instruct': AIProvider.ALIYUN,
  'qwen2.5-coder-14b-instruct': AIProvider.ALIYUN,
  'qwen2.5-coder-7b-instruct': AIProvider.ALIYUN,
  'qwen2.5-coder-3b-instruct': AIProvider.ALIYUN,
  'qwen2.5-coder-1.5b-instruct': AIProvider.ALIYUN,
  
  // Qwen Math 系列模型
  'qwen2.5-math-72b-instruct': AIProvider.ALIYUN,
  'qwen2.5-math-7b-instruct': AIProvider.ALIYUN,
  'qwen2.5-math-1.5b-instruct': AIProvider.ALIYUN,

  // OpenRouter 模型 (通常带有提供商前缀)
  'openai/gpt-4o': AIProvider.OPENROUTER,
  'openai/gpt-4o-mini': AIProvider.OPENROUTER,
  'openai/gpt-3.5-turbo': AIProvider.OPENROUTER,
  'anthropic/claude-3.5-sonnet': AIProvider.OPENROUTER,
  'anthropic/claude-3-opus': AIProvider.OPENROUTER,
  'deepseek/deepseek-chat': AIProvider.OPENROUTER,
  'google/gemini-pro': AIProvider.OPENROUTER,
  'meta-llama/llama-3.1-405b-instruct': AIProvider.OPENROUTER,
  'meta-llama/llama-3.1-70b-instruct': AIProvider.OPENROUTER,
  'meta-llama/llama-3.1-8b-instruct': AIProvider.OPENROUTER,
};

/**
 * 根据模型名称获取对应的AI提供商
 * @param modelName 模型名称
 * @returns AI提供商，如果未找到映射则返回GEMINI作为默认值
 */
export function getProviderForModel(modelName: string): AIProvider {
  // 直接查找映射
  if (MODEL_PROVIDER_MAPPING[modelName]) {
    return MODEL_PROVIDER_MAPPING[modelName];
  }

  // 模糊匹配：基于模型名称前缀或关键词
  const lowerModelName = modelName.toLowerCase();

  if (lowerModelName.includes('gemini') || lowerModelName.includes('bison')) {
    return AIProvider.GEMINI;
  }

  if (lowerModelName.includes('deepseek')) {
    return AIProvider.DEEPSEEK;
  }

  if (lowerModelName.includes('claude')) {
    return AIProvider.ANTHROPIC;
  }

  if (lowerModelName.includes('gpt') || lowerModelName.includes('o1')) {
    return AIProvider.OPENAI;
  }

  if (lowerModelName.includes('qwen') || lowerModelName.includes('tongyi')) {
    return AIProvider.ALIYUN;
  }

  // 如果包含 '/' 符号，可能是OpenRouter格式
  if (lowerModelName.includes('/')) {
    return AIProvider.OPENROUTER;
  }

  // 默认返回GEMINI
  return AIProvider.GEMINI;
}

/**
 * 获取指定提供商的环境变量名称
 * @param provider AI提供商
 * @returns 环境变量名称
 */
export function getEnvVarForProvider(provider: AIProvider): string {
  const envVarMap: Record<AIProvider, string> = {
    [AIProvider.GEMINI]: 'GEMINI_API_KEY',
    [AIProvider.DEEPSEEK]: 'DEEPSEEK_API_KEY',
    [AIProvider.ANTHROPIC]: 'ANTHROPIC_API_KEY',
    [AIProvider.OPENAI]: 'OPENAI_API_KEY',
    [AIProvider.OPENROUTER]: 'OPENROUTER_API_KEY',
    [AIProvider.ALIYUN]: 'DASHSCOPE_API_KEY',
  };
  return envVarMap[provider];
}

/**
 * 检查指定提供商的API密钥是否已配置
 * @param provider AI提供商
 * @returns 是否已配置API密钥
 */
export function isProviderConfigured(provider: AIProvider): boolean {
  const envVar = getEnvVarForProvider(provider);
  return !!process.env[envVar];
}

/**
 * 获取模型的推荐配置信息
 * @param modelName 模型名称
 * @returns 配置信息对象
 */
export function getModelInfo(modelName: string): {
  provider: AIProvider;
  envVar: string;
  isConfigured: boolean;
  providerName: string;
} {
  const provider = getProviderForModel(modelName);
  const envVar = getEnvVarForProvider(provider);
  const isConfigured = isProviderConfigured(provider);
  
  const providerNames: Record<AIProvider, string> = {
    [AIProvider.GEMINI]: 'Google Gemini',
    [AIProvider.DEEPSEEK]: 'DeepSeek',
    [AIProvider.ANTHROPIC]: 'Anthropic Claude',
    [AIProvider.OPENAI]: 'OpenAI',
    [AIProvider.OPENROUTER]: 'OpenRouter',
    [AIProvider.ALIYUN]: 'Alibaba Cloud (阿里云)',
  };

  return {
    provider,
    envVar,
    isConfigured,
    providerName: providerNames[provider],
  };
}