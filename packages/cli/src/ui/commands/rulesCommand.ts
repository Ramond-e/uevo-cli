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
import { SystemInfoTool } from '@uevo/uevo-cli-core';

// 规则存储文件配置
const RULES_FILE = 'uevo-rules.json';
const CONFIG_DIR = '.uevo';

// 规则存储结构
interface RulesData {
  systemRule: string | null; // 规则0：系统信息规则
  userRules: string[];       // 用户自定义规则
}

// 获取规则文件路径
function getRulesFilePath(): string {
  const homeDir = os.homedir();
  return path.join(homeDir, CONFIG_DIR, RULES_FILE);
}

// 确保配置目录存在
function ensureConfigDir(): void {
  const homeDir = os.homedir();
  const configDir = path.join(homeDir, CONFIG_DIR);
  if (!fs.existsSync(configDir)) {
    fs.mkdirSync(configDir, { recursive: true });
  }
}

// 获取存储的规则数据
function getRulesData(): RulesData {
  try {
    const filePath = getRulesFilePath();
    if (!fs.existsSync(filePath)) {
      return { systemRule: null, userRules: [] };
    }
    const content = fs.readFileSync(filePath, 'utf-8');
    if (!content.trim()) {
      return { systemRule: null, userRules: [] };
    }
    
    const data = JSON.parse(content);
    
    // 兼容旧格式：如果是数组，转换为新格式
    if (Array.isArray(data)) {
      return { systemRule: null, userRules: data };
    }
    
    // 新格式
    return {
      systemRule: data.systemRule || null,
      userRules: data.userRules || []
    };
  } catch {
    return { systemRule: null, userRules: [] };
  }
}

// 保存规则数据
function saveRulesData(rulesData: RulesData): void {
  try {
    ensureConfigDir();
    const filePath = getRulesFilePath();
    fs.writeFileSync(filePath, JSON.stringify(rulesData, null, 2), 'utf-8');
  } catch (error) {
    console.error('Failed to save rules:', error);
  }
}

// 获取存储的用户自定义规则（向后兼容）
function getRules(): string[] {
  return getRulesData().userRules;
}

// 保存用户自定义规则（向后兼容）
function saveRules(rules: string[]): void {
  const rulesData = getRulesData();
  rulesData.userRules = rules;
  saveRulesData(rulesData);
}

// 更新系统信息规则（规则0）
export async function updateSystemInfoRule(): Promise<void> {
  try {
    const systemInfo = await SystemInfoTool.getSystemInfo();
    const systemRule = SystemInfoTool.formatSystemInfoAsRule(systemInfo);
    
    const rulesData = getRulesData();
    rulesData.systemRule = systemRule;
    saveRulesData(rulesData);
  } catch (error) {
    console.error('Failed to update system info rule:', error);
  }
}

// 获取所有规则（包括系统规则和用户规则）
export function getAllRules(): { systemRule: string | null; userRules: string[] } {
  return getRulesData();
}

// 导出系统规则供prompt使用
export function getSystemRule(): string | null {
  return getRulesData().systemRule;
}

// 显示所有规则
const listRulesAction = async (
  context: CommandContext,
  _args: string,
): Promise<MessageActionReturn> => {
  const rulesData = getRulesData();
  
  let content = '📋 **当前规则配置：**\n\n';
  
  // 显示系统规则
  if (rulesData.systemRule) {
    content += '**规则 0 (系统信息)：**\n';
    content += `${rulesData.systemRule}\n\n`;
  } else {
    content += '**规则 0 (系统信息)：** 未设置\n\n';
  }
  
  // 显示用户自定义规则
  if (rulesData.userRules.length === 0) {
    content += '**用户自定义规则：** 暂无\n\n';
  } else {
    content += '**用户自定义规则：**\n';
    rulesData.userRules.forEach((rule, index) => {
      content += `**${index + 1}.** ${rule}\n`;
    });
    content += '\n';
  }
  
  content += '💡 **可用命令：**\n';
  content += '• `/rules add <规则>` - 添加新的用户自定义规则\n';
  content += '• `/rules remove <序号>` - 删除指定的用户自定义规则\n';
  content += '• `/rules edit <序号> <新规则>` - 编辑指定的用户自定义规则\n';
  content += '• `/rules clear` - 清空所有用户自定义规则\n';
  content += '• `/rules update-system` - 手动更新系统信息规则';

  return {
    type: 'message',
    messageType: 'info',
    content,
  };
};

// 添加规则
const addRuleAction = async (
  context: CommandContext,
  args: string,
): Promise<MessageActionReturn> => {
  const rule = args.trim();
  
  if (!rule) {
    return {
      type: 'message',
      messageType: 'error',
      content: '❌ 请提供要添加的规则内容。\n\n示例：`/rules add 总是以友好的语气回复`',
    };
  }

  const rules = getRules();
  rules.push(rule);
  saveRules(rules);

  return {
    type: 'message',
    messageType: 'info',
    content: `✅ 规则已添加：\n**${rules.length}.** ${rule}\n\n现在共有 ${rules.length} 条自定义规则。`,
  };
};

// 删除规则
const removeRuleAction = async (
  context: CommandContext,
  args: string,
): Promise<MessageActionReturn> => {
  const indexStr = args.trim();
  const index = parseInt(indexStr, 10);
  
  if (!indexStr || isNaN(index)) {
    return {
      type: 'message',
      messageType: 'error',
      content: '❌ 请提供有效的规则序号。\n\n示例：`/rules remove 2`',
    };
  }

  const rules = getRules();
  
  if (index < 1 || index > rules.length) {
    return {
      type: 'message',
      messageType: 'error',
      content: `❌ 规则序号 ${index} 不存在。当前共有 ${rules.length} 条规则。`,
    };
  }

  const removedRule = rules[index - 1];
  rules.splice(index - 1, 1);
  saveRules(rules);

  return {
    type: 'message',
    messageType: 'info',
    content: `✅ 已删除规则：\n**${index}.** ${removedRule}\n\n现在共有 ${rules.length} 条自定义规则。`,
  };
};

// 编辑规则
const editRuleAction = async (
  context: CommandContext,
  args: string,
): Promise<MessageActionReturn> => {
  const parts = args.trim().split(' ');
  const indexStr = parts[0];
  const newRule = parts.slice(1).join(' ');
  
  const index = parseInt(indexStr, 10);
  
  if (!indexStr || isNaN(index) || !newRule) {
    return {
      type: 'message',
      messageType: 'error',
      content: '❌ 请提供有效的格式。\n\n示例：`/rules edit 2 新的规则内容`',
    };
  }

  const rules = getRules();
  
  if (index < 1 || index > rules.length) {
    return {
      type: 'message',
      messageType: 'error',
      content: `❌ 规则序号 ${index} 不存在。当前共有 ${rules.length} 条规则。`,
    };
  }

  const oldRule = rules[index - 1];
  rules[index - 1] = newRule;
  saveRules(rules);

  return {
    type: 'message',
    messageType: 'info',
    content: `✅ 规则已更新：\n**${index}.** ~~${oldRule}~~ → ${newRule}`,
  };
};

// 清空所有规则
const clearRulesAction = async (
  context: CommandContext,
  _args: string,
): Promise<MessageActionReturn> => {
  const rules = getRules();
  
  if (rules.length === 0) {
    return {
      type: 'message',
      messageType: 'info',
      content: '📝 当前没有任何自定义规则需要清空。',
    };
  }

  const count = rules.length;
  saveRules([]);

  return {
    type: 'message',
    messageType: 'info',
    content: `✅ 已清空所有 ${count} 条自定义规则。`,
  };
};

// 手动更新系统信息规则
const updateSystemRuleAction = async (
  context: CommandContext,
  _args: string,
): Promise<MessageActionReturn> => {
  try {
    await updateSystemInfoRule();
    return {
      type: 'message',
      messageType: 'info',
      content: '✅ 系统信息规则已更新。\n\n使用 `/rules` 查看更新后的规则。',
    };
  } catch (error) {
    return {
      type: 'message',
      messageType: 'error',
      content: `❌ 更新系统信息规则失败: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
};

// 主规则命令
export const rulesCommand: SlashCommand = {
  name: 'rules',
  altNames: ['rule'],
  description: '管理用户自定义规则',
  kind: CommandKind.BUILT_IN,
  action: listRulesAction,
  subCommands: [
    {
      name: 'add',
      description: '添加新规则',
      kind: CommandKind.BUILT_IN,
      action: addRuleAction,
    },
    {
      name: 'remove',
      altNames: ['rm', 'delete', 'del'],
      description: '删除指定规则',
      kind: CommandKind.BUILT_IN,
      action: removeRuleAction,
    },
    {
      name: 'edit',
      altNames: ['update', 'modify'],
      description: '编辑指定规则',
      kind: CommandKind.BUILT_IN,
      action: editRuleAction,
    },
    {
      name: 'clear',
      altNames: ['clean', 'reset'],
      description: '清空所有规则',
      kind: CommandKind.BUILT_IN,
      action: clearRulesAction,
    },
    {
      name: 'update-system',
      altNames: ['update-sys', 'update-info'],
      description: '手动更新系统信息规则',
      kind: CommandKind.BUILT_IN,
      action: updateSystemRuleAction,
    },
  ],
};

// 导出获取规则的函数，供其他模块使用
export { getRules }; 