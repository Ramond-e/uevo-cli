/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import * as path from 'path';
import * as fs from 'fs';
import {
  SlashCommand,
  SlashCommandActionReturn,
  CommandContext,
  CommandKind,
} from './types.js';
import { TrustedDirsConfig } from '@uevo/uevo-cli-core';
import { updateUserSettings } from '../../config/settings.js';

const COLOR_GREEN = '\u001b[32m';
const COLOR_YELLOW = '\u001b[33m';
const COLOR_RED = '\u001b[31m';
const COLOR_CYAN = '\u001b[36m';
const COLOR_GREY = '\u001b[90m';
const RESET_COLOR = '\u001b[0m';

/**
 * 显示当前可信目录状态
 */
const showTrustStatus = async (
  context: CommandContext,
  args: string
): Promise<SlashCommandActionReturn> => {
  const { config } = context.services;
  if (!config) {
    return {
      type: 'message',
      messageType: 'error',
      content: 'Configuration not available.',
    };
  }

  const trustedDirs = config.getTrustedDirs();
  const isCurrentDirTrusted = config.isCurrentDirTrusted();
  const currentDir = config.getWorkingDir();

  let message = `${COLOR_CYAN}Trusted Directories Status${RESET_COLOR}\n\n`;

  // 显示当前目录状态
  const status = isCurrentDirTrusted ? `${COLOR_GREEN}✓ TRUSTED${RESET_COLOR}` : `${COLOR_YELLOW}⚠ NOT TRUSTED${RESET_COLOR}`;
  message += `Current Directory: ${status}\n`;
  message += `${COLOR_GREY}${currentDir}${RESET_COLOR}\n\n`;

  // 显示配置的可信目录
  if (trustedDirs && trustedDirs.directories.length > 0) {
    message += `${COLOR_CYAN}Configured Trusted Directories:${RESET_COLOR}\n`;
    message += `Recursive: ${trustedDirs.recursive !== false ? `${COLOR_GREEN}Yes${RESET_COLOR}` : `${COLOR_RED}No${RESET_COLOR}`}\n`;
    if (trustedDirs.description) {
      message += `Description: ${COLOR_GREY}${trustedDirs.description}${RESET_COLOR}\n`;
    }
    message += '\n';

    for (let i = 0; i < trustedDirs.directories.length; i++) {
      const dir = trustedDirs.directories[i];
      const exists = fs.existsSync(dir);
      const existsStatus = exists ? `${COLOR_GREEN}✓${RESET_COLOR}` : `${COLOR_RED}✗${RESET_COLOR}`;
      message += `${i + 1}. ${existsStatus} ${dir}\n`;
    }
  } else {
    message += `${COLOR_YELLOW}No trusted directories configured.${RESET_COLOR}\n`;
  }

  // 显示环境变量
  const envTrustedDirs = process.env.UEVO_TRUSTED_DIRS;
  if (envTrustedDirs) {
    message += `\n${COLOR_CYAN}Environment Variable (UEVO_TRUSTED_DIRS):${RESET_COLOR}\n`;
    message += `${COLOR_GREY}${envTrustedDirs}${RESET_COLOR}\n`;
  }

  message += `\n${COLOR_GREY}Use '/trust add <path>' to add a trusted directory${RESET_COLOR}`;
  message += `\n${COLOR_GREY}Use '/trust list' to see all trusted directories${RESET_COLOR}`;

  return {
    type: 'message',
    messageType: 'info',
    content: message,
  };
};

/**
 * 添加可信目录
 */
const addTrustedDir = async (
  context: CommandContext,
  args: string
): Promise<SlashCommandActionReturn> => {
  const { config, settings } = context.services;
  if (!config) {
    return {
      type: 'message',
      messageType: 'error',
      content: 'Configuration not available.',
    };
  }

  const dirPath = args.trim();
  if (!dirPath) {
    return {
      type: 'message',
      messageType: 'error',
      content: 'Please specify a directory path. Example: /trust add /path/to/directory',
    };
  }

  // 转换为绝对路径
  const absolutePath = path.resolve(dirPath);

  // 检查路径是否存在
  if (!fs.existsSync(absolutePath)) {
    return {
      type: 'message',
      messageType: 'error',
      content: `Directory does not exist: ${absolutePath}`,
    };
  }

  // 检查是否是目录
  const stats = fs.statSync(absolutePath);
  if (!stats.isDirectory()) {
    return {
      type: 'message',
      messageType: 'error',
      content: `Path is not a directory: ${absolutePath}`,
    };
  }

  // 获取当前配置
  const currentTrustedDirs = config.getTrustedDirs();
  let newTrustedDirs: TrustedDirsConfig;

  if (currentTrustedDirs) {
    // 检查是否已经存在
    if (currentTrustedDirs.directories.includes(absolutePath)) {
      return {
        type: 'message',
        messageType: 'info',
        content: `Directory is already trusted: ${absolutePath}`,
      };
    }

    // 添加到现有配置
    newTrustedDirs = {
      ...currentTrustedDirs,
      directories: [...currentTrustedDirs.directories, absolutePath],
    };
  } else {
    // 创建新配置
    newTrustedDirs = {
      directories: [absolutePath],
      recursive: true,
      description: 'Managed via /trust command',
    };
  }

  try {
    // 更新settings.json
    await updateUserSettings({
      trustedDirs: newTrustedDirs,
    });

    return {
      type: 'message',
      messageType: 'info',
      content: `${COLOR_GREEN}✓${RESET_COLOR} Added trusted directory: ${absolutePath}\n\n${COLOR_YELLOW}Note:${RESET_COLOR} Restart the CLI for changes to take effect.`,
    };
  } catch (error) {
    return {
      type: 'message',
      messageType: 'error',
      content: `Failed to update settings: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
};

/**
 * 移除可信目录
 */
const removeTrustedDir = async (
  context: CommandContext,
  args: string
): Promise<SlashCommandActionReturn> => {
  const { config, settings } = context.services;
  if (!config) {
    return {
      type: 'message',
      messageType: 'error',
      content: 'Configuration not available.',
    };
  }

  const currentTrustedDirs = config.getTrustedDirs();
  if (!currentTrustedDirs || currentTrustedDirs.directories.length === 0) {
    return {
      type: 'message',
      messageType: 'info',
      content: 'No trusted directories configured.',
    };
  }

  const input = args.trim();
  if (!input) {
    return {
      type: 'message',
      messageType: 'error',
      content: 'Please specify a directory path or index. Example: /trust remove /path/to/directory or /trust remove 1',
    };
  }

  let dirToRemove: string;
  
  // 检查是否是数字索引
  const index = parseInt(input, 10);
  if (!isNaN(index) && index >= 1 && index <= currentTrustedDirs.directories.length) {
    dirToRemove = currentTrustedDirs.directories[index - 1];
  } else {
    // 尝试作为路径处理
    const absolutePath = path.resolve(input);
    if (currentTrustedDirs.directories.includes(absolutePath)) {
      dirToRemove = absolutePath;
    } else {
      return {
        type: 'message',
        messageType: 'error',
        content: `Directory not found in trusted list: ${absolutePath}\nUse '/trust list' to see current trusted directories.`,
      };
    }
  }

  // 移除目录
  const newDirectories = currentTrustedDirs.directories.filter(dir => dir !== dirToRemove);
  
  let newTrustedDirs: TrustedDirsConfig | undefined;
  if (newDirectories.length === 0) {
    // 如果没有剩余目录，移除整个配置
    newTrustedDirs = undefined;
  } else {
    newTrustedDirs = {
      ...currentTrustedDirs,
      directories: newDirectories,
    };
  }

  try {
    // 更新settings.json
    await updateUserSettings({
      trustedDirs: newTrustedDirs,
    });

    return {
      type: 'message',
      messageType: 'info',
      content: `${COLOR_GREEN}✓${RESET_COLOR} Removed trusted directory: ${dirToRemove}\n\n${COLOR_YELLOW}Note:${RESET_COLOR} Restart the CLI for changes to take effect.`,
    };
  } catch (error) {
    return {
      type: 'message',
      messageType: 'error',
      content: `Failed to update settings: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
};

/**
 * 列出所有可信目录
 */
const listTrustedDirs = async (
  context: CommandContext,
  args: string
): Promise<SlashCommandActionReturn> => {
  const { config } = context.services;
  if (!config) {
    return {
      type: 'message',
      messageType: 'error',
      content: 'Configuration not available.',
    };
  }

  const trustedDirs = config.getTrustedDirs();
  
  let message = `${COLOR_CYAN}Trusted Directories${RESET_COLOR}\n\n`;

  if (!trustedDirs || trustedDirs.directories.length === 0) {
    message += `${COLOR_YELLOW}No trusted directories configured.${RESET_COLOR}\n\n`;
    message += `${COLOR_GREY}Use '/trust add <path>' to add a trusted directory${RESET_COLOR}`;
  } else {
    message += `Recursive: ${trustedDirs.recursive !== false ? `${COLOR_GREEN}Yes${RESET_COLOR}` : `${COLOR_RED}No${RESET_COLOR}`}\n`;
    if (trustedDirs.description) {
      message += `Description: ${COLOR_GREY}${trustedDirs.description}${RESET_COLOR}\n`;
    }
    message += '\n';

    for (let i = 0; i < trustedDirs.directories.length; i++) {
      const dir = trustedDirs.directories[i];
      const exists = fs.existsSync(dir);
      const existsStatus = exists ? `${COLOR_GREEN}✓${RESET_COLOR}` : `${COLOR_RED}✗${RESET_COLOR}`;
      message += `${i + 1}. ${existsStatus} ${dir}\n`;
    }

    message += `\n${COLOR_GREY}Legend: ${COLOR_GREEN}✓${RESET_COLOR} Directory exists, ${COLOR_RED}✗${RESET_COLOR} Directory not found${RESET_COLOR}`;
  }

  // 显示环境变量
  const envTrustedDirs = process.env.UEVO_TRUSTED_DIRS;
  if (envTrustedDirs) {
    message += `\n\n${COLOR_CYAN}Environment Variable (UEVO_TRUSTED_DIRS):${RESET_COLOR}\n`;
    const envDirs = envTrustedDirs.split(path.delimiter).filter(dir => dir.trim());
    for (let i = 0; i < envDirs.length; i++) {
      const dir = envDirs[i].trim();
      const exists = fs.existsSync(dir);
      const existsStatus = exists ? `${COLOR_GREEN}✓${RESET_COLOR}` : `${COLOR_RED}✗${RESET_COLOR}`;
      message += `E${i + 1}. ${existsStatus} ${dir}\n`;
    }
    message += `${COLOR_GREY}Note: Environment variables override settings.json configuration${RESET_COLOR}`;
  }

  return {
    type: 'message',
    messageType: 'info',
    content: message,
  };
};

/**
 * 清除所有可信目录
 */
const clearTrustedDirs = async (
  context: CommandContext,
  args: string
): Promise<SlashCommandActionReturn> => {
  const { config, settings } = context.services;
  if (!config) {
    return {
      type: 'message',
      messageType: 'error',
      content: 'Configuration not available.',
    };
  }

  const currentTrustedDirs = config.getTrustedDirs();
  if (!currentTrustedDirs || currentTrustedDirs.directories.length === 0) {
    return {
      type: 'message',
      messageType: 'info',
      content: 'No trusted directories configured.',
    };
  }

  try {
    // 移除整个trustedDirs配置
    await updateUserSettings({
      trustedDirs: undefined,
    });

    return {
      type: 'message',
      messageType: 'info',
      content: `${COLOR_GREEN}✓${RESET_COLOR} Cleared all trusted directories.\n\n${COLOR_YELLOW}Note:${RESET_COLOR} Restart the CLI for changes to take effect.`,
    };
  } catch (error) {
    return {
      type: 'message',
      messageType: 'error',
      content: `Failed to update settings: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
};

/**
 * 检查指定路径是否可信
 */
const checkTrustedPath = async (
  context: CommandContext,
  args: string
): Promise<SlashCommandActionReturn> => {
  const { config } = context.services;
  if (!config) {
    return {
      type: 'message',
      messageType: 'error',
      content: 'Configuration not available.',
    };
  }

  const pathToCheck = args.trim();
  if (!pathToCheck) {
    return {
      type: 'message',
      messageType: 'error',
      content: 'Please specify a path to check. Example: /trust check /path/to/directory',
    };
  }

  const absolutePath = path.resolve(pathToCheck);
  const isTrusted = config.isPathInTrustedDirs(absolutePath);
  
  let message = `${COLOR_CYAN}Trust Check${RESET_COLOR}\n\n`;
  message += `Path: ${COLOR_GREY}${absolutePath}${RESET_COLOR}\n`;
  
  if (isTrusted) {
    message += `Status: ${COLOR_GREEN}✓ TRUSTED${RESET_COLOR}\n\n`;
    message += `${COLOR_GREEN}This path is in a trusted directory. All tool operations here will bypass permission checks.${RESET_COLOR}`;
  } else {
    message += `Status: ${COLOR_YELLOW}⚠ NOT TRUSTED${RESET_COLOR}\n\n`;
    message += `${COLOR_YELLOW}This path is not in a trusted directory. Tool operations here will require permission checks.${RESET_COLOR}\n\n`;
    message += `${COLOR_GREY}Use '/trust add ${absolutePath}' to add this directory as trusted.${RESET_COLOR}`;
  }

  return {
    type: 'message',
    messageType: 'info',
    content: message,
  };
};

/**
 * 主要的trust命令
 */
export const trustCommand: SlashCommand = {
  name: 'trust',
  description: 'Manage trusted directories for unrestricted tool access',
  kind: CommandKind.BUILT_IN,
  action: showTrustStatus,
  subCommands: [
    {
      name: 'status',
      altNames: ['show', 'current'],
      description: 'Show current trust status and configuration',
      kind: CommandKind.BUILT_IN,
      action: showTrustStatus,
    },
    {
      name: 'add',
      altNames: ['trust'],
      description: 'Add a directory to the trusted list',
      kind: CommandKind.BUILT_IN,
      action: addTrustedDir,
    },
    {
      name: 'remove',
      altNames: ['rm', 'delete', 'untrust'],
      description: 'Remove a directory from the trusted list',
      kind: CommandKind.BUILT_IN,
      action: removeTrustedDir,
    },
    {
      name: 'list',
      altNames: ['ls', 'all'],
      description: 'List all trusted directories',
      kind: CommandKind.BUILT_IN,
      action: listTrustedDirs,
    },
    {
      name: 'clear',
      altNames: ['reset', 'clean'],
      description: 'Clear all trusted directories',
      kind: CommandKind.BUILT_IN,
      action: clearTrustedDirs,
    },
    {
      name: 'check',
      altNames: ['test', 'verify'],
      description: 'Check if a path is trusted',
      kind: CommandKind.BUILT_IN,
      action: checkTrustedPath,
    },
  ],
};