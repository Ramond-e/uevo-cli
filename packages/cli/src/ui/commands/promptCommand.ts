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
  MessageActionReturn,
} from './types.js';
import {
  getCoreSystemPrompt,
  getCompressionPrompt,
  getProviderForModel,
  AIProvider,
} from '@uevo/uevo-cli-core';
import {
  getRecommendedTemplate,
  getSimpleSystemPrompt,
  getAllTemplates,
  PROMPT_TEMPLATES,
  type PromptTemplate,
} from '../../../../core/src/core/promptTemplates.js';

const COLOR_GREEN = '\u001b[32m';
const COLOR_YELLOW = '\u001b[33m';
const COLOR_RED = '\u001b[31m';
const COLOR_CYAN = '\u001b[36m';
const COLOR_BLUE = '\u001b[34m';
const COLOR_MAGENTA = '\u001b[35m';
const COLOR_GREY = '\u001b[90m';
const RESET_COLOR = '\u001b[0m';

/**
 * 显示当前系统提示词
 */
const showSystemPrompt = async (context: CommandContext): Promise<MessageActionReturn> => {
  const { config } = context.services;
  if (!config) {
    return {
      type: 'message',
      messageType: 'error',
      content: 'Configuration not available.',
    };
  }

  const currentModel = config.getModel();
  if (!currentModel) {
    return {
      type: 'message',
      messageType: 'error',
      content: 'No model currently set. Use "/model set <model-name>" to set a model first.',
    };
  }

  const userMemory = config.getUserMemory();
  const systemPrompt = getSimpleSystemPrompt(currentModel, userMemory);
  const provider = getProviderForModel(currentModel);
  
  let content = `${COLOR_CYAN}# 当前系统提示词${RESET_COLOR}\n\n`;
  content += `${COLOR_BLUE}模型:${RESET_COLOR} ${COLOR_GREEN}${currentModel}${RESET_COLOR}\n`;
  content += `${COLOR_BLUE}提供者:${RESET_COLOR} ${COLOR_GREEN}${provider}${RESET_COLOR}\n`;
  content += `${COLOR_BLUE}长度:${RESET_COLOR} ${COLOR_YELLOW}${systemPrompt.length.toLocaleString()}${RESET_COLOR} 字符\n\n`;
  
  content += `${COLOR_CYAN}## 提示词内容${RESET_COLOR}\n\n`;
  content += '```\n';
  content += systemPrompt;
  content += '\n```\n\n';
  
  content += `${COLOR_GREY}提示: 使用 "/prompt template" 查看模板信息${RESET_COLOR}`;

  return {
    type: 'message',
    messageType: 'info',
    content,
  };
};

/**
 * 显示对话历史信息
 */
const showHistory = async (context: CommandContext, args: string): Promise<MessageActionReturn> => {
  // Note: 实际的对话历史需要从UI层获取，这里暂时提供框架
  // 在实际实现中，我们可能需要从更高层的组件传递历史数据
  
  const showDetailed = args.trim().includes('--detailed') || args.trim().includes('-d');
  
  let content = `${COLOR_CYAN}# 对话历史信息${RESET_COLOR}\n\n`;
  
  // 从 session 统计信息获取一些基本信息
  const stats = context.session.stats;
  const metrics = stats.metrics;
  
  // 计算所有模型的总token数
  let totalPromptTokens = 0;
  let totalCandidateTokens = 0;
  let totalTokens = 0;
  let totalCachedTokens = 0;
  
  Object.values(metrics.models).forEach(modelMetrics => {
    totalPromptTokens += modelMetrics.tokens.prompt;
    totalCandidateTokens += modelMetrics.tokens.candidates;
    totalTokens += modelMetrics.tokens.total;
    totalCachedTokens += modelMetrics.tokens.cached;
  });
  
  content += `${COLOR_BLUE}当前会话统计:${RESET_COLOR}\n`;
  content += `- 总输入token: ${COLOR_YELLOW}${totalPromptTokens.toLocaleString()}${RESET_COLOR}\n`;
  content += `- 总输出token: ${COLOR_YELLOW}${totalCandidateTokens.toLocaleString()}${RESET_COLOR}\n`;
  content += `- 总计算token: ${COLOR_YELLOW}${totalTokens.toLocaleString()}${RESET_COLOR}\n`;
  content += `- 缓存token: ${COLOR_YELLOW}${totalCachedTokens.toLocaleString()}${RESET_COLOR}\n\n`;
  
  content += `${COLOR_YELLOW}注意:${RESET_COLOR} 详细的对话历史查看功能正在开发中。\n`;
  content += `当前可以使用以下替代方案:\n`;
  content += `- 使用 ${COLOR_GREEN}/chat save <tag>${RESET_COLOR} 保存当前对话\n`;
  content += `- 使用 ${COLOR_GREEN}/chat resume <tag>${RESET_COLOR} 加载已保存的对话\n`;
  content += `- 查看终端输出以获取调试信息\n\n`;
  
  content += `${COLOR_GREY}提示: 使用 "/prompt current" 查看完整的prompt构建${RESET_COLOR}`;

  return {
    type: 'message',
    messageType: 'info',
    content,
  };
};

/**
 * 显示当前完整的prompt构建信息
 */
const showCurrentPrompt = async (context: CommandContext): Promise<MessageActionReturn> => {
  const { config } = context.services;
  if (!config) {
    return {
      type: 'message',
      messageType: 'error',
      content: 'Configuration not available.',
    };
  }

  const currentModel = config.getModel();
  if (!currentModel) {
    return {
      type: 'message',
      messageType: 'error',
      content: 'No model currently set. Use "/model set <model-name>" to set a model first.',
    };
  }

  const userMemory = config.getUserMemory();
  const systemPrompt = getSimpleSystemPrompt(currentModel, userMemory);
  const provider = getProviderForModel(currentModel);
  const template = getRecommendedTemplate(currentModel);
  const stats = context.session.stats;
  
  let content = `${COLOR_CYAN}# 当前Prompt构建信息${RESET_COLOR}\n\n`;
  
  // 基本信息
  content += `${COLOR_BLUE}## 基本配置${RESET_COLOR}\n`;
  content += `- 模型: ${COLOR_GREEN}${currentModel}${RESET_COLOR}\n`;
  content += `- 提供者: ${COLOR_GREEN}${provider}${RESET_COLOR}\n`;
  content += `- 模板: ${COLOR_GREEN}${template.name}${RESET_COLOR}\n`;
  content += `- 模板描述: ${template.description}\n\n`;
  
  // 系统提示词信息
  content += `${COLOR_BLUE}## 系统提示词${RESET_COLOR}\n`;
  content += `- 长度: ${COLOR_YELLOW}${systemPrompt.length.toLocaleString()}${RESET_COLOR} 字符\n`;
  content += `- 预览: ${systemPrompt.substring(0, 150).replace(/\n/g, ' ')}...\n\n`;
  
  // 用户记忆信息
  if (userMemory) {
    content += `${COLOR_BLUE}## 用户记忆${RESET_COLOR}\n`;
    content += `- 长度: ${COLOR_YELLOW}${userMemory.length.toLocaleString()}${RESET_COLOR} 字符\n`;
    content += `- 预览: ${userMemory.substring(0, 100).replace(/\n/g, ' ')}...\n\n`;
  } else {
    content += `${COLOR_BLUE}## 用户记忆${RESET_COLOR}\n`;
    content += `- ${COLOR_GREY}未设置${RESET_COLOR}\n\n`;
  }
  
  // 会话统计
  const metrics = stats.metrics;
  
  // 计算所有模型的总token数
  let totalPromptTokens = 0;
  let totalCandidateTokens = 0;
  let totalTokens = 0;
  let totalCachedTokens = 0;
  
  Object.values(metrics.models).forEach(modelMetrics => {
    totalPromptTokens += modelMetrics.tokens.prompt;
    totalCandidateTokens += modelMetrics.tokens.candidates;
    totalTokens += modelMetrics.tokens.total;
    totalCachedTokens += modelMetrics.tokens.cached;
  });
  
  content += `${COLOR_BLUE}## 当前会话${RESET_COLOR}\n`;
  content += `- 输入token: ${COLOR_YELLOW}${totalPromptTokens.toLocaleString()}${RESET_COLOR}\n`;
  content += `- 输出token: ${COLOR_YELLOW}${totalCandidateTokens.toLocaleString()}${RESET_COLOR}\n`;
  content += `- 总计算token: ${COLOR_YELLOW}${totalTokens.toLocaleString()}${RESET_COLOR}\n`;
  content += `- 缓存token: ${COLOR_YELLOW}${totalCachedTokens.toLocaleString()}${RESET_COLOR}\n\n`;
  
  content += `${COLOR_GREY}提示: 使用 "/prompt system" 查看完整系统提示词${RESET_COLOR}`;

  return {
    type: 'message',
    messageType: 'info',
    content,
  };
};

/**
 * 显示提示词模板信息
 */
const showTemplate = async (context: CommandContext): Promise<MessageActionReturn> => {
  const { config } = context.services;
  if (!config) {
    return {
      type: 'message',
      messageType: 'error',
      content: 'Configuration not available.',
    };
  }

  const currentModel = config.getModel();
  let content = `${COLOR_CYAN}# 提示词模板信息${RESET_COLOR}\n\n`;
  
  if (currentModel) {
    const template = getRecommendedTemplate(currentModel);
    const provider = getProviderForModel(currentModel);
    
    content += `${COLOR_BLUE}## 当前使用的模板${RESET_COLOR}\n`;
    content += `- 模型: ${COLOR_GREEN}${currentModel}${RESET_COLOR}\n`;
    content += `- 模板名: ${COLOR_GREEN}${template.name}${RESET_COLOR}\n`;
    content += `- 描述: ${template.description}\n`;
    content += `- 提供者: ${COLOR_GREEN}${provider}${RESET_COLOR}\n\n`;
  }
  
  content += `${COLOR_BLUE}## 所有可用模板${RESET_COLOR}\n`;
  const allTemplates = getAllTemplates();
  
  Object.entries(PROMPT_TEMPLATES).forEach(([key, template]: [string, PromptTemplate]) => {
    const isActive = currentModel && getRecommendedTemplate(currentModel).name === template.name;
    const statusIcon = isActive ? `${COLOR_GREEN}●${RESET_COLOR}` : `${COLOR_GREY}○${RESET_COLOR}`;
    
    content += `${statusIcon} **${template.name}** (${key})\n`;
    content += `   ${template.description}\n`;
    content += `   提供者: ${template.provider}\n\n`;
  });
  
  content += `${COLOR_GREY}说明: ● 表示当前使用的模板，○ 表示可用但未使用的模板${RESET_COLOR}`;

  return {
    type: 'message',
    messageType: 'info',
    content,
  };
};

/**
 * 显示压缩提示词
 */
const showCompressionPrompt = async (context: CommandContext): Promise<MessageActionReturn> => {
  const compressionPrompt = getCompressionPrompt();
  
  let content = `${COLOR_CYAN}# 历史压缩提示词${RESET_COLOR}\n\n`;
  content += `${COLOR_BLUE}用途:${RESET_COLOR} 用于压缩对话历史，保留关键信息\n`;
  content += `${COLOR_BLUE}长度:${RESET_COLOR} ${COLOR_YELLOW}${compressionPrompt.length.toLocaleString()}${RESET_COLOR} 字符\n\n`;
  
  content += `${COLOR_CYAN}## 压缩提示词内容${RESET_COLOR}\n\n`;
  content += '```\n';
  content += compressionPrompt;
  content += '\n```\n\n';
  
  content += `${COLOR_GREY}说明: 此提示词在对话历史过长时用于生成状态快照${RESET_COLOR}`;

  return {
    type: 'message',
    messageType: 'info',
    content,
  };
};

/**
 * 显示prompt命令的帮助信息
 */
const showPromptHelp = async (context: CommandContext): Promise<MessageActionReturn> => {
  let content = `${COLOR_CYAN}# /prompt 命令帮助${RESET_COLOR}\n\n`;
  content += `查看AI实际收到的prompt信息\n\n`;
  
  content += `${COLOR_BLUE}## 可用子命令${RESET_COLOR}\n\n`;
  content += `${COLOR_GREEN}/prompt${RESET_COLOR} 或 ${COLOR_GREEN}/prompt current${RESET_COLOR}\n`;
  content += `   显示当前完整的prompt构建信息\n\n`;
  
  content += `${COLOR_GREEN}/prompt system${RESET_COLOR}\n`;
  content += `   显示完整的系统提示词内容\n\n`;
  
  content += `${COLOR_GREEN}/prompt template${RESET_COLOR}\n`;
  content += `   显示当前使用的提示词模板信息\n\n`;
  
  content += `${COLOR_GREEN}/prompt history${RESET_COLOR} [--detailed]\n`;
  content += `   显示对话历史信息（开发中）\n\n`;
  
  content += `${COLOR_GREEN}/prompt compression${RESET_COLOR}\n`;
  content += `   显示历史压缩提示词\n\n`;
  
  content += `${COLOR_BLUE}## 示例用法${RESET_COLOR}\n`;
  content += `- \`/prompt\` - 查看当前prompt概览\n`;
  content += `- \`/prompt system\` - 查看完整系统提示词\n`;
  content += `- \`/prompt template\` - 查看模板信息\n`;
  content += `- \`/prompt history --detailed\` - 查看详细历史\n\n`;
  
  content += `${COLOR_GREY}提示: 这些命令可以帮助你理解AI实际接收到的指令内容${RESET_COLOR}`;

  return {
    type: 'message',
    messageType: 'info',
    content,
  };
};

/**
 * 主要的prompt命令
 */
export const promptCommand: SlashCommand = {
  name: 'prompt',
  altNames: ['p'],
  description: '查看AI实际收到的prompt信息',
  kind: CommandKind.BUILT_IN,
  action: showCurrentPrompt,
  subCommands: [
    {
      name: 'current',
      altNames: ['show', 'info'],
      description: '显示当前完整的prompt构建信息',
      kind: CommandKind.BUILT_IN,
      action: showCurrentPrompt,
    },
    {
      name: 'system',
      altNames: ['sys'],
      description: '显示完整的系统提示词内容',
      kind: CommandKind.BUILT_IN,
      action: showSystemPrompt,
    },
    {
      name: 'template',
      altNames: ['tpl', 'templates'],
      description: '显示当前使用的提示词模板信息',
      kind: CommandKind.BUILT_IN,
      action: showTemplate,
    },
    {
      name: 'history',
      altNames: ['hist', 'h'],
      description: '显示对话历史信息',
      kind: CommandKind.BUILT_IN,
      action: showHistory,
    },
    {
      name: 'compression',
      altNames: ['compress', 'comp'],
      description: '显示历史压缩提示词',
      kind: CommandKind.BUILT_IN,
      action: showCompressionPrompt,
    },
    {
      name: 'help',
      altNames: ['?'],
      description: '显示prompt命令的帮助信息',
      kind: CommandKind.BUILT_IN,
      action: showPromptHelp,
    },
  ],
};