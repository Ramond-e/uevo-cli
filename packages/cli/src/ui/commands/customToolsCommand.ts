/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { MessageType } from '../types.js';
import {
  CommandKind,
  SlashCommand,
  SlashCommandActionReturn,
  CommandContext,
  MessageActionReturn,
} from './types.js';
import { CustomToolRegistryManager } from '../services/customToolRegistry.js';
import { CustomToolInfo } from '../types/customTool.js';

/**
 * 显示自定义工具帮助信息
 */
const showCustomToolsHelpAction = async (context: CommandContext): Promise<SlashCommandActionReturn> => {
  const helpText = `
## 自定义工具管理指南

自定义工具功能允许AI创建和管理自己的工具集，实现自我进化能力。

### AI自动使用语法：
当AI判断需要创建新工具时，会自动使用以下语法：

\`\`\`
<custom_tool_add>
{
  "name": "工具名称",
  "description": "工具描述",
  "category": "工具分类",
  "tags": ["标签1", "标签2"],
  "examples": ["使用示例1", "使用示例2"],
  "parameters": {
    "param1": "参数描述"
  }
}
</custom_tool_add>
\`\`\`

### 手动命令：
- \`/custom_tools\` - 显示所有自定义工具
- \`/custom_tools list\` - 列出所有工具  
- \`/custom_tools stats\` - 显示统计信息
- \`/custom_tools show <id>\` - 显示特定工具详情
- \`/custom_tools remove <id>\` - 删除工具
- \`/custom_tools status <id> <status>\` - 更新工具状态
- \`/custom_tools export\` - 导出工具注册表
- \`/custom_tools category\` - 按分类显示工具

### 工具状态：
- **active** - 激活状态，可正常使用
- **inactive** - 非激活状态，暂时停用
- **deprecated** - 已弃用，不推荐使用

### 注意事项：
- 工具注册表存储在testspace目录下
- 每个工具都有唯一的ID标识
- 支持JSON和简单键值对两种格式
- 确认窗口允许用户控制工具添加过程
`;

  return {
    type: 'message',
    messageType: 'info',
    content: helpText.trim()
  };
};

/**
 * 列出所有自定义工具
 */
const listCustomToolsAction = async (context: CommandContext): Promise<MessageActionReturn> => {
  try {
    const tools = CustomToolRegistryManager.getAllTools();
    
    if (tools.length === 0) {
      return {
        type: 'message',
        messageType: 'info',
        content: '📭 暂无自定义工具\n\n💡 AI可以通过 `<custom_tool_add>` 语法创建新工具'
      };
    }

    let content = `🔧 **自定义工具列表** (共 ${tools.length} 个)\n\n`;
    
    // 按分类分组显示
    const categories = CustomToolRegistryManager.getToolsByCategory();
    
    for (const [category, categoryTools] of Object.entries(categories)) {
      content += `### 📁 ${category}\n`;
      
      for (const tool of categoryTools) {
        const statusIcon = tool.status === 'active' ? '🟢' : 
                          tool.status === 'inactive' ? '🟡' : '🔴';
        const tagsText = tool.tags.length > 0 ? `[${tool.tags.join(', ')}]` : '';
        
        content += `- ${statusIcon} **${tool.name}** (${tool.id})\n`;
        content += `  ${tool.description} ${tagsText}\n`;
        content += `  📅 ${new Date(tool.createdAt).toLocaleDateString()}\n\n`;
      }
    }
    
    content += `\n💡 使用 \`/custom_tools show <id>\` 查看详细信息`;

    return {
      type: 'message',
      messageType: 'info',
      content: content.trim()
    };
  } catch (error) {
    return {
      type: 'message',
      messageType: 'error',
      content: `❌ 获取工具列表失败: ${error instanceof Error ? error.message : String(error)}`
    };
  }
};

/**
 * 显示工具统计信息
 */
const showStatsAction = async (context: CommandContext): Promise<MessageActionReturn> => {
  try {
    const stats = CustomToolRegistryManager.getStats();
    const categories = CustomToolRegistryManager.getToolsByCategory();
    
    let content = `📊 **自定义工具统计**\n\n`;
    content += `🔧 **总数量**: ${stats.total}\n`;
    content += `🟢 **激活**: ${stats.active}\n`;
    content += `🟡 **非激活**: ${stats.inactive}\n`;
    content += `🔴 **已弃用**: ${stats.deprecated}\n\n`;
    
    if (Object.keys(categories).length > 0) {
      content += `📁 **分类分布**:\n`;
      for (const [category, tools] of Object.entries(categories)) {
        content += `- ${category}: ${tools.length} 个\n`;
      }
    }

    return {
      type: 'message',
      messageType: 'info',
      content: content.trim()
    };
  } catch (error) {
    return {
      type: 'message',
      messageType: 'error',
      content: `❌ 获取统计信息失败: ${error instanceof Error ? error.message : String(error)}`
    };
  }
};

/**
 * 显示特定工具详情
 */
const showToolDetailsAction = async (context: CommandContext, args: string): Promise<MessageActionReturn> => {
  const toolId = args.trim();
  
  if (!toolId) {
    return {
      type: 'message',
      messageType: 'error',
      content: '❌ 请提供工具ID\n\n💡 使用: `/custom_tools show <tool_id>`'
    };
  }

  try {
    const tool = CustomToolRegistryManager.getToolById(toolId);
    
    if (!tool) {
      return {
        type: 'message',
        messageType: 'error',
        content: `❌ 工具ID "${toolId}" 不存在\n\n💡 使用 \`/custom_tools list\` 查看所有工具`
      };
    }

    const statusIcon = tool.status === 'active' ? '🟢' : 
                      tool.status === 'inactive' ? '🟡' : '🔴';
    
    let content = `🔧 **工具详情**\n\n`;
    content += `**名称**: ${tool.name}\n`;
    content += `**ID**: ${tool.id}\n`;
    content += `**状态**: ${statusIcon} ${tool.status}\n`;
    content += `**分类**: 📁 ${tool.category}\n`;
    content += `**描述**: ${tool.description}\n`;
    content += `**作者**: ${tool.author}\n`;
    content += `**版本**: ${tool.version}\n`;
    content += `**创建时间**: 📅 ${new Date(tool.createdAt).toLocaleString()}\n`;
    content += `**最后修改**: 📅 ${new Date(tool.lastModified).toLocaleString()}\n`;
    
    if (tool.tags.length > 0) {
      content += `**标签**: ${tool.tags.map(tag => `\`${tag}\``).join(' ')}\n`;
    }
    
    if (tool.examples && tool.examples.length > 0) {
      content += `\n**使用示例**:\n`;
      tool.examples.forEach((example, index) => {
        content += `${index + 1}. ${example}\n`;
      });
    }
    
    if (tool.parameters && Object.keys(tool.parameters).length > 0) {
      content += `\n**参数**:\n`;
      for (const [key, value] of Object.entries(tool.parameters)) {
        content += `- \`${key}\`: ${JSON.stringify(value)}\n`;
      }
    }
    
    if (tool.dependencies && tool.dependencies.length > 0) {
      content += `\n**依赖**:\n`;
      tool.dependencies.forEach(dep => {
        content += `- ${dep}\n`;
      });
    }

    return {
      type: 'message',
      messageType: 'info',
      content: content.trim()
    };
  } catch (error) {
    return {
      type: 'message',
      messageType: 'error',
      content: `❌ 获取工具详情失败: ${error instanceof Error ? error.message : String(error)}`
    };
  }
};

/**
 * 删除工具
 */
const removeToolAction = async (context: CommandContext, args: string): Promise<MessageActionReturn> => {
  const toolId = args.trim();
  
  if (!toolId) {
    return {
      type: 'message',
      messageType: 'error',
      content: '❌ 请提供工具ID\n\n💡 使用: `/custom_tools remove <tool_id>`'
    };
  }

  try {
    const tool = CustomToolRegistryManager.getToolById(toolId);
    
    if (!tool) {
      return {
        type: 'message',
        messageType: 'error',
        content: `❌ 工具ID "${toolId}" 不存在`
      };
    }

    const success = CustomToolRegistryManager.removeTool(toolId);
    
    if (success) {
      return {
        type: 'message',
        messageType: 'info',
        content: `✅ 成功删除工具 "${tool.name}" (${toolId})`
      };
    } else {
      return {
        type: 'message',
        messageType: 'error',
        content: `❌ 删除工具失败`
      };
    }
  } catch (error) {
    return {
      type: 'message',
      messageType: 'error',
      content: `❌ 删除工具失败: ${error instanceof Error ? error.message : String(error)}`
    };
  }
};

/**
 * 更新工具状态
 */
const updateToolStatusAction = async (context: CommandContext, args: string): Promise<MessageActionReturn> => {
  const parts = args.trim().split(/\s+/);
  
  if (parts.length !== 2) {
    return {
      type: 'message',
      messageType: 'error',
      content: '❌ 参数格式错误\n\n💡 使用: `/custom_tools status <tool_id> <status>`\n\n**状态选项**: active, inactive, deprecated'
    };
  }

  const [toolId, newStatus] = parts;
  
  if (!['active', 'inactive', 'deprecated'].includes(newStatus)) {
    return {
      type: 'message',
      messageType: 'error',
      content: '❌ 无效的状态值\n\n**有效状态**: active, inactive, deprecated'
    };
  }

  try {
    const tool = CustomToolRegistryManager.getToolById(toolId);
    
    if (!tool) {
      return {
        type: 'message',
        messageType: 'error',
        content: `❌ 工具ID "${toolId}" 不存在`
      };
    }

    const success = CustomToolRegistryManager.updateToolStatus(toolId, newStatus as CustomToolInfo['status']);
    
    if (success) {
      const statusIcon = newStatus === 'active' ? '🟢' : 
                        newStatus === 'inactive' ? '🟡' : '🔴';
      return {
        type: 'message',
        messageType: 'info',
        content: `✅ 工具 "${tool.name}" 状态已更新为 ${statusIcon} ${newStatus}`
      };
    } else {
      return {
        type: 'message',
        messageType: 'error',
        content: `❌ 更新工具状态失败`
      };
    }
  } catch (error) {
    return {
      type: 'message',
      messageType: 'error',
      content: `❌ 更新工具状态失败: ${error instanceof Error ? error.message : String(error)}`
    };
  }
};

/**
 * 按分类显示工具
 */
const showByCategoryAction = async (context: CommandContext): Promise<MessageActionReturn> => {
  try {
    const categories = CustomToolRegistryManager.getToolsByCategory();
    
    if (Object.keys(categories).length === 0) {
      return {
        type: 'message',
        messageType: 'info',
        content: '📭 暂无自定义工具'
      };
    }

    let content = `🗂️ **按分类显示工具**\n\n`;
    
    for (const [category, tools] of Object.entries(categories)) {
      content += `### 📁 ${category} (${tools.length} 个)\n\n`;
      
      for (const tool of tools) {
        const statusIcon = tool.status === 'active' ? '🟢' : 
                          tool.status === 'inactive' ? '🟡' : '🔴';
        content += `- ${statusIcon} **${tool.name}**\n`;
        content += `  📝 ${tool.description}\n`;
        content += `  🆔 ${tool.id}\n\n`;
      }
    }

    return {
      type: 'message',
      messageType: 'info',
      content: content.trim()
    };
  } catch (error) {
    return {
      type: 'message',
      messageType: 'error',
      content: `❌ 获取分类信息失败: ${error instanceof Error ? error.message : String(error)}`
    };
  }
};

/**
 * 导出工具注册表
 */
const exportRegistryAction = async (context: CommandContext): Promise<MessageActionReturn> => {
  try {
    const registry = CustomToolRegistryManager.loadRegistry();
    const exportData = JSON.stringify(registry, null, 2);
    
    let content = `📤 **工具注册表导出**\n\n`;
    content += `**版本**: ${registry.version}\n`;
    content += `**最后更新**: ${new Date(registry.lastUpdated).toLocaleString()}\n`;
    content += `**工具数量**: ${registry.tools.length}\n\n`;
    content += `\`\`\`json\n${exportData}\n\`\`\`\n\n`;
    content += `💾 注册表文件位置: testspace/custom-tools-registry.json`;

    return {
      type: 'message',
      messageType: 'info',
      content
    };
  } catch (error) {
    return {
      type: 'message',
      messageType: 'error',
      content: `❌ 导出注册表失败: ${error instanceof Error ? error.message : String(error)}`
    };
  }
};

/**
 * 主自定义工具命令
 */
export const customToolsCommand: SlashCommand = {
  name: 'custom_tools',
  altNames: ['ct', 'tools', 'custom'],
  description: '管理AI创建的自定义工具',
  kind: CommandKind.BUILT_IN,
  action: listCustomToolsAction,
  subCommands: [
    {
      name: 'help',
      altNames: ['h'],
      description: '显示自定义工具帮助信息',
      kind: CommandKind.BUILT_IN,
      action: showCustomToolsHelpAction,
    },
    {
      name: 'list',
      altNames: ['ls', 'show'],
      description: '列出所有自定义工具',
      kind: CommandKind.BUILT_IN,
      action: listCustomToolsAction,
    },
    {
      name: 'stats',
      altNames: ['stat', 'info'],
      description: '显示工具统计信息',
      kind: CommandKind.BUILT_IN,
      action: showStatsAction,
    },
    {
      name: 'show',
      altNames: ['details', 'detail'],
      description: '显示特定工具详情',
      kind: CommandKind.BUILT_IN,
      action: showToolDetailsAction,
    },
    {
      name: 'remove',
      altNames: ['rm', 'delete', 'del'],
      description: '删除工具',
      kind: CommandKind.BUILT_IN,
      action: removeToolAction,
    },
    {
      name: 'status',
      altNames: ['state'],
      description: '更新工具状态',
      kind: CommandKind.BUILT_IN,
      action: updateToolStatusAction,
    },
    {
      name: 'category',
      altNames: ['cat', 'categories'],
      description: '按分类显示工具',
      kind: CommandKind.BUILT_IN,
      action: showByCategoryAction,
    },
    {
      name: 'export',
      altNames: ['backup'],
      description: '导出工具注册表',
      kind: CommandKind.BUILT_IN,
      action: exportRegistryAction,
    },
  ],
};