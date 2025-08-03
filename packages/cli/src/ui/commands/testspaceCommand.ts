/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  CommandKind,
  MessageActionReturn,
  SlashCommand,
  CommandContext,
} from './types.js';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

// 环境变量配置文件
const ENV_FILE = '.uevo-env';
const CONFIG_DIR = '.uevo';

// 获取环境配置文件路径
function getEnvFilePath(): string {
  const homeDir = os.homedir();
  return path.join(homeDir, CONFIG_DIR, ENV_FILE);
}

// 确保配置目录存在
function ensureConfigDir(): void {
  const homeDir = os.homedir();
  const configDir = path.join(homeDir, CONFIG_DIR);
  if (!fs.existsSync(configDir)) {
    fs.mkdirSync(configDir, { recursive: true });
  }
}

// 获取当前测试空间路径
function getCurrentTestspacePath(): string {
  const envVar = process.env.UEVO_TESTSPACE;
  if (envVar) {
    if (envVar.startsWith('~/')) {
      return path.join(os.homedir(), envVar.slice(2));
    } else if (envVar === '~') {
      return os.homedir();
    }
    return path.resolve(envVar);
  }
  // 默认路径
  return path.join(os.homedir(), 'uevo', 'testspace');
}

// 读取存储的环境变量配置
function getStoredEnvConfig(): Record<string, string> {
  try {
    const filePath = getEnvFilePath();
    if (!fs.existsSync(filePath)) {
      return {};
    }
    const content = fs.readFileSync(filePath, 'utf-8');
    if (!content.trim()) {
      return {};
    }
    return JSON.parse(content);
  } catch {
    return {};
  }
}

// 保存环境变量配置
function saveEnvConfig(config: Record<string, string>): void {
  try {
    ensureConfigDir();
    const filePath = getEnvFilePath();
    fs.writeFileSync(filePath, JSON.stringify(config, null, 2), 'utf-8');
  } catch (error) {
    console.error('Failed to save environment config:', error);
  }
}

// 设置测试空间路径
function setTestspacePath(newPath: string): void {
  const config = getStoredEnvConfig();
  
  // 处理波浪号路径
  let resolvedPath = newPath;
  if (newPath.startsWith('~/')) {
    resolvedPath = path.join(os.homedir(), newPath.slice(2));
  } else if (newPath === '~') {
    resolvedPath = os.homedir();
  } else {
    resolvedPath = path.resolve(newPath);
  }
  
  config.UEVO_TESTSPACE = newPath; // 存储原始路径（可能包含~）
  saveEnvConfig(config);
  
  // 设置当前进程的环境变量
  process.env.UEVO_TESTSPACE = newPath;
}

// 移除测试空间配置
function removeTestspaceConfig(): void {
  const config = getStoredEnvConfig();
  delete config.UEVO_TESTSPACE;
  saveEnvConfig(config);
  delete process.env.UEVO_TESTSPACE;
}

// 显示当前测试空间配置
const showTestspaceAction = async (context: CommandContext, args: string): Promise<MessageActionReturn> => {
  const currentPath = getCurrentTestspacePath();
  const envVar = process.env.UEVO_TESTSPACE;
  const storedConfig = getStoredEnvConfig();
  
  let content = '# 🛠️ 测试空间配置\n\n';
  content += `**当前路径:** \`${currentPath}\`\n\n`;
  
  if (envVar) {
    content += `**环境变量:** \`UEVO_TESTSPACE=${envVar}\`\n`;
  } else {
    content += `**环境变量:** 未设置（使用默认值）\n`;
  }
  
  if (storedConfig.UEVO_TESTSPACE) {
    content += `**存储的配置:** \`${storedConfig.UEVO_TESTSPACE}\`\n`;
  } else {
    content += `**存储的配置:** 无\n`;
  }
  
  content += '\n---\n\n';
  content += '**可用命令:**\n';
  content += '- `/testspace set <path>` - 设置测试空间路径\n';
  content += '- `/testspace create` - 创建测试空间目录\n';
  content += '- `/testspace reset` - 重置为默认配置\n';
  content += '- `/testspace remove` - 移除自定义配置\n';
  
  return {
    type: 'message',
    messageType: 'info',
    content,
  };
};

// 设置测试空间路径
const setTestspaceAction = async (context: CommandContext, args: string): Promise<MessageActionReturn> => {
  const trimmedArgs = args?.trim();
  if (!trimmedArgs) {
    return {
      type: 'message',
      messageType: 'error',
      content: '❌ 请提供测试空间路径\n\n**用法:** `/testspace set <path>`\n\n**示例:**\n- `/testspace set ~/my-tools`\n- `/testspace set /opt/uevo-workspace`\n- `/testspace set C:\\Tools\\uevo`',
    };
  }
  
  try {
    setTestspacePath(trimmedArgs);
    const resolvedPath = getCurrentTestspacePath();
    
    return {
      type: 'message',
      messageType: 'info',
      content: `✅ 测试空间路径已设置\n\n**新路径:** \`${resolvedPath}\`\n\n💡 **提示:** 重启应用后此配置将自动生效，或使用 \`/testspace create\` 立即创建目录。`,
    };
  } catch (error) {
    return {
      type: 'message',
      messageType: 'error',
      content: `❌ 设置测试空间路径失败: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
};

// 创建测试空间目录
const createTestspaceAction = async (context: CommandContext, args: string): Promise<MessageActionReturn> => {
  try {
    const testspacePath = getCurrentTestspacePath();
    
    if (fs.existsSync(testspacePath)) {
      return {
        type: 'message',
        messageType: 'info',
        content: `📁 测试空间目录已存在: \`${testspacePath}\``,
      };
    }
    
    fs.mkdirSync(testspacePath, { recursive: true });
    
    // 创建基本的子目录结构
    const docsDir = path.join(testspacePath, 'docs');
    fs.mkdirSync(docsDir, { recursive: true });
    
    // 创建README文件
    const readmeContent = `# uEVO 测试空间

这是您的 uEVO 工具测试空间目录。

## 目录结构

- \`docs/\` - 工具文档和说明文件
- 各个项目目录 - 从 GitHub 克隆的工具项目

## 使用说明

1. 工具会自动下载到此目录
2. 改造后的工具以 \`uevoTools_\` 开头
3. 相关文档保存在 \`docs/\` 目录下

---
*此目录由 uEVO CLI 自动创建于 ${new Date().toISOString()}*
`;
    
    fs.writeFileSync(path.join(testspacePath, 'README.md'), readmeContent, 'utf-8');
    
    return {
      type: 'message',
      messageType: 'info',
      content: `✅ 测试空间目录创建成功\n\n**路径:** \`${testspacePath}\`\n\n📁 **已创建:**\n- 主目录\n- \`docs/\` 子目录\n- \`README.md\` 说明文件`,
    };
  } catch (error) {
    return {
      type: 'message',
      messageType: 'error',
      content: `❌ 创建测试空间目录失败: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
};

// 重置测试空间配置
const resetTestspaceAction = async (context: CommandContext, args: string): Promise<MessageActionReturn> => {
  try {
    removeTestspaceConfig();
    const defaultPath = path.join(os.homedir(), 'uevo', 'testspace');
    
    return {
      type: 'message',
      messageType: 'info',
      content: `✅ 测试空间配置已重置\n\n**默认路径:** \`${defaultPath}\`\n\n💡 **提示:** 使用 \`/testspace create\` 创建默认目录。`,
    };
  } catch (error) {
    return {
      type: 'message',
      messageType: 'error',
      content: `❌ 重置测试空间配置失败: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
};

// 移除测试空间配置
const removeTestspaceAction = async (context: CommandContext, args: string): Promise<MessageActionReturn> => {
  try {
    const storedConfig = getStoredEnvConfig();
    if (!storedConfig.UEVO_TESTSPACE) {
      return {
        type: 'message',
        messageType: 'info',
        content: '📋 当前未设置自定义测试空间配置',
      };
    }
    
    removeTestspaceConfig();
    const defaultPath = path.join(os.homedir(), 'uevo', 'testspace');
    
    return {
      type: 'message',
      messageType: 'info',
      content: `✅ 自定义测试空间配置已移除\n\n**现在使用默认路径:** \`${defaultPath}\``,
    };
  } catch (error) {
    return {
      type: 'message',
      messageType: 'error',
      content: `❌ 移除测试空间配置失败: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
};

// 主测试空间命令
export const testspaceCommand: SlashCommand = {
  name: 'testspace',
  altNames: ['ts', 'workspace'],
  description: '管理工具测试空间配置',
  kind: CommandKind.BUILT_IN,
  action: showTestspaceAction,
  subCommands: [
    {
      name: 'set',
      altNames: ['config', 'path'],
      description: '设置测试空间路径',
      kind: CommandKind.BUILT_IN,
      action: setTestspaceAction,
    },
    {
      name: 'create',
      altNames: ['init', 'mkdir'],
      description: '创建测试空间目录',
      kind: CommandKind.BUILT_IN,
      action: createTestspaceAction,
    },
    {
      name: 'reset',
      altNames: ['default'],
      description: '重置为默认配置',
      kind: CommandKind.BUILT_IN,
      action: resetTestspaceAction,
    },
    {
      name: 'remove',
      altNames: ['rm', 'delete', 'del'],
      description: '移除自定义配置',
      kind: CommandKind.BUILT_IN,
      action: removeTestspaceAction,
    },
  ],
};

// 导出工具函数供其他模块使用
export { getCurrentTestspacePath, setTestspacePath };
