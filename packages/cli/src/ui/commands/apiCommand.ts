/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  SlashCommand,
  SlashCommandActionReturn,
  CommandContext,
  CommandKind,
} from './types.js';

const COLOR_GREEN = '\u001b[32m';
const COLOR_YELLOW = '\u001b[33m';
const COLOR_RED = '\u001b[31m';
const COLOR_CYAN = '\u001b[36m';
const COLOR_GREY = '\u001b[90m';
const RESET_COLOR = '\u001b[0m';

/**
 * API 提供商配置信息
 */
const API_PROVIDERS = {
  gemini: {
    name: 'Gemini',
          envVar: 'GEMINI_API_KEY',
    description: 'Google Gemini API',
    setupUrl: 'https://ai.google.dev/api',
  },
  deepseek: {
    name: 'DeepSeek',
    envVar: 'DEEPSEEK_API_KEY',
    description: 'DeepSeek API',
    setupUrl: 'https://platform.deepseek.com/',
  },
  anthropic: {
    name: 'Anthropic',
    envVar: 'ANTHROPIC_API_KEY',
    description: 'Anthropic Claude API',
    setupUrl: 'https://console.anthropic.com/',
  },
  openai: {
    name: 'OpenAI',
    envVar: 'OPENAI_API_KEY',
    description: 'OpenAI GPT API',
    setupUrl: 'https://platform.openai.com/',
  },
  openrouter: {
    name: 'OpenRouter',
    envVar: 'OPENROUTER_API_KEY',
    description: 'OpenRouter API',
    setupUrl: 'https://openrouter.ai/',
  },
  aliyun: {
    name: 'Aliyun',
    envVar: 'DASHSCOPE_API_KEY',
    description: 'Aliyun DashScope API (Qwen models)',
    setupUrl: 'https://dashscope.console.aliyun.com/',
  },
} as const;

/**
 * 显示 API 配置状态
 */
const showApiStatus = async (context: CommandContext): Promise<SlashCommandActionReturn> => {
  const { config } = context.services;
  if (!config) {
    return {
      type: 'message',
      messageType: 'error',
      content: 'Configuration not available.',
    };
  }

  let message = `${COLOR_CYAN}API Configuration Status${RESET_COLOR}\n\n`;

  // 显示当前活动配置
  const currentModel = config.getModel();
  const contentGeneratorConfig = config.getContentGeneratorConfig();
  
  message += `${COLOR_CYAN}Current Configuration:${RESET_COLOR}\n`;
  message += `  Model: ${COLOR_GREEN}${currentModel || 'Not set'}${RESET_COLOR}\n`;
  message += `  Auth Type: ${COLOR_GREEN}${contentGeneratorConfig?.authType || 'Not set'}${RESET_COLOR}\n\n`;

  // 显示各个提供商的配置状态
  message += `${COLOR_CYAN}Provider Status:${RESET_COLOR}\n`;

  for (const [key, provider] of Object.entries(API_PROVIDERS)) {
    const apiKey = process.env[provider.envVar];
    const status = apiKey ? `${COLOR_GREEN}✓ Configured${RESET_COLOR}` : `${COLOR_RED}✗ Not configured${RESET_COLOR}`;
    const keyPreview = apiKey ? `(${apiKey.substring(0, 8)}...)` : '';
    
    message += `  ${provider.name}: ${status} ${COLOR_GREY}${keyPreview}${RESET_COLOR}\n`;
  }

  message += `\n${COLOR_GREY}Use '/api config <provider>' to configure a specific provider${RESET_COLOR}`;

  return {
    type: 'message',
    messageType: 'info',
    content: message,
  };
};

/**
 * 显示特定提供商的配置说明
 */
const showProviderConfig = async (
  context: CommandContext,
  args: string
): Promise<SlashCommandActionReturn> => {
  const providerKey = args.trim().toLowerCase();
  
  if (!providerKey) {
    return {
      type: 'message',
      messageType: 'error',
      content: `Please specify a provider. Available: ${Object.keys(API_PROVIDERS).join(', ')}`,
    };
  }

  const provider = API_PROVIDERS[providerKey as keyof typeof API_PROVIDERS];
  if (!provider) {
    return {
      type: 'message',
      messageType: 'error',
      content: `Unknown provider: ${providerKey}. Available: ${Object.keys(API_PROVIDERS).join(', ')}`,
    };
  }

  const apiKey = process.env[provider.envVar];
  const isConfigured = !!apiKey;

  let message = `${COLOR_CYAN}${provider.name} Configuration${RESET_COLOR}\n\n`;
  
  message += `${COLOR_CYAN}Description:${RESET_COLOR} ${provider.description}\n`;
  message += `${COLOR_CYAN}Environment Variable:${RESET_COLOR} ${provider.envVar}\n`;
  message += `${COLOR_CYAN}Setup URL:${RESET_COLOR} ${provider.setupUrl}\n`;
  message += `${COLOR_CYAN}Status:${RESET_COLOR} ${isConfigured ? 
    `${COLOR_GREEN}✓ Configured${RESET_COLOR}` : 
    `${COLOR_RED}✗ Not configured${RESET_COLOR}`}\n\n`;

  if (isConfigured) {
    message += `${COLOR_GREEN}✓ API key is configured${RESET_COLOR}\n`;
    message += `Key preview: ${apiKey.substring(0, 8)}...\n\n`;
    message += `${COLOR_GREY}To update the key, set the environment variable:${RESET_COLOR}\n`;
  } else {
    message += `${COLOR_YELLOW}⚠ API key not found${RESET_COLOR}\n\n`;
    message += `${COLOR_CYAN}To configure:${RESET_COLOR}\n`;
  }
  
  message += `export ${provider.envVar}="your-api-key-here"\n\n`;
  message += `${COLOR_GREY}After setting the environment variable, restart the application.${RESET_COLOR}`;

  return {
    type: 'message',
    messageType: 'info',
    content: message,
  };
};

/**
 * 测试 API 连接
 */
const testApiConnection = async (
  context: CommandContext,
  args: string
): Promise<SlashCommandActionReturn> => {
  const providerKey = args.trim().toLowerCase();
  
  if (!providerKey) {
    return {
      type: 'message',
      messageType: 'error',
      content: `Please specify a provider to test. Available: ${Object.keys(API_PROVIDERS).join(', ')}`,
    };
  }

  const provider = API_PROVIDERS[providerKey as keyof typeof API_PROVIDERS];
  if (!provider) {
    return {
      type: 'message',
      messageType: 'error',
      content: `Unknown provider: ${providerKey}. Available: ${Object.keys(API_PROVIDERS).join(', ')}`,
    };
  }

  const apiKey = process.env[provider.envVar];
  if (!apiKey) {
    return {
      type: 'message',
      messageType: 'error',
      content: `${provider.name} API key not configured. Use '/api config ${providerKey}' for setup instructions.`,
    };
  }

  let message = `${COLOR_CYAN}Testing ${provider.name} API Connection...${RESET_COLOR}\n\n`;
  
  try {
    // 这里可以添加实际的 API 测试逻辑
    // 目前只是验证 API key 是否存在
    message += `${COLOR_GREEN}✓ API key is present${RESET_COLOR}\n`;
    message += `Key format: ${apiKey.length} characters\n`;
    message += `Key preview: ${apiKey.substring(0, 8)}...\n\n`;
    message += `${COLOR_GREY}Note: This is a basic validation. Actual API connectivity depends on network and service status.${RESET_COLOR}`;

    return {
      type: 'message',
      messageType: 'info',
      content: message,
    };
  } catch (error) {
    return {
      type: 'message',
      messageType: 'error',
      content: `Failed to test ${provider.name} API: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
};

/**
 * 列出所有可用的提供商
 */
const listProviders = async (context: CommandContext): Promise<SlashCommandActionReturn> => {
  let message = `${COLOR_CYAN}Available API Providers${RESET_COLOR}\n\n`;

  for (const [key, provider] of Object.entries(API_PROVIDERS)) {
    const apiKey = process.env[provider.envVar];
    const status = apiKey ? `${COLOR_GREEN}✓${RESET_COLOR}` : `${COLOR_RED}✗${RESET_COLOR}`;
    
    message += `${status} ${COLOR_CYAN}${key}${RESET_COLOR} - ${provider.description}\n`;
    message += `    Environment: ${provider.envVar}\n`;
    message += `    Setup: ${provider.setupUrl}\n\n`;
  }

  message += `${COLOR_GREY}Use '/api config <provider>' for detailed configuration instructions${RESET_COLOR}`;

  return {
    type: 'message',
    messageType: 'info',
    content: message,
  };
};

/**
 * 主要的 API 命令
 */
export const apiCommand: SlashCommand = {
  name: 'api',
  description: 'Manage API configurations for different providers',
  kind: CommandKind.BUILT_IN,
  action: showApiStatus,
  subCommands: [
    {
      name: 'status',
      altNames: ['info', 'show'],
      description: 'Show current API configuration status',
      kind: CommandKind.BUILT_IN,
      action: showApiStatus,
    },
    {
      name: 'config',
      altNames: ['configure', 'setup'],
      description: 'Show configuration instructions for a specific provider',
      kind: CommandKind.BUILT_IN,
      action: showProviderConfig,
    },
    {
      name: 'test',
      altNames: ['check', 'verify'],
      description: 'Test API connection for a specific provider',
      kind: CommandKind.BUILT_IN,
      action: testApiConnection,
    },
    {
      name: 'list',
      altNames: ['providers', 'ls'],
      description: 'List all available API providers',
      kind: CommandKind.BUILT_IN,
      action: listProviders,
    },
  ],
};