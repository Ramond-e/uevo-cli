/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { CustomToolCommand } from '../types/customTool.js';

/**
 * 解析AI响应中的自定义工具添加语法
 */
export class CustomToolParser {
  private static readonly CUSTOM_TOOL_PATTERN = /<custom_tool_add>([\s\S]*?)<\/custom_tool_add>/g;
  private static readonly SEARCH_CUSTOM_TOOLS_PATTERN = /<search_custom_tools\s*\/?>/g;

  /**
   * 解析AI响应文本，提取所有自定义工具命令
   * @param text AI的响应文本
   * @returns 解析出的自定义工具命令数组和搜索请求标志
   */
  static parseResponse(text: string): { commands: CustomToolCommand[], hasSearchRequest: boolean } {
    const commands: CustomToolCommand[] = [];
    
    // 检查是否有搜索请求
    const hasSearchRequest = this.SEARCH_CUSTOM_TOOLS_PATTERN.test(text);
    
    const matches = [...text.matchAll(this.CUSTOM_TOOL_PATTERN)];
    for (const match of matches) {
      const content = match[1].trim();
      if (content) {
        try {
          const parsed = this.parseToolContent(content);
          if (parsed) {
            commands.push(parsed);
          }
        } catch (error) {
          console.warn('Failed to parse custom tool command:', error);
        }
      }
    }

    return { commands, hasSearchRequest };
  }

  /**
   * 解析工具内容
   * @param content 工具定义内容
   * @returns 解析出的工具命令
   */
  private static parseToolContent(content: string): CustomToolCommand | null {
    // 尝试解析为JSON格式
    if (content.trim().startsWith('{')) {
      try {
        const jsonData = JSON.parse(content);
        return {
          type: 'custom_tool_add',
          name: jsonData.name || 'Unnamed Tool',
          description: jsonData.description || 'No description provided',
          category: jsonData.category || 'General',
          tags: Array.isArray(jsonData.tags) ? jsonData.tags : [],
          examples: Array.isArray(jsonData.examples) ? jsonData.examples : [],
          parameters: jsonData.parameters
        };
      } catch {
        // 如果JSON解析失败，继续尝试其他格式
      }
    }

    // 尝试解析为简单的键值对格式
    const lines = content.split('\n').map(line => line.trim()).filter(line => line);
    const tool: Partial<CustomToolCommand> = {
      type: 'custom_tool_add',
      tags: [],
      examples: []
    };

    for (const line of lines) {
      const colonIndex = line.indexOf(':');
      if (colonIndex === -1) continue;

      const key = line.substring(0, colonIndex).trim().toLowerCase();
      const value = line.substring(colonIndex + 1).trim();

      switch (key) {
        case 'name':
        case '名称':
          tool.name = value;
          break;
        case 'description':
        case '描述':
          tool.description = value;
          break;
        case 'category':
        case '分类':
          tool.category = value;
          break;
        case 'tags':
        case '标签':
          tool.tags = value.split(',').map(tag => tag.trim()).filter(tag => tag);
          break;
        case 'examples':
        case '示例':
          tool.examples = [value];
          break;
        case 'example':
        case '示例':
          if (!tool.examples) tool.examples = [];
          tool.examples.push(value);
          break;
      }
    }

    // 验证必需字段
    if (!tool.name || !tool.description) {
      return null;
    }

    return tool as CustomToolCommand;
  }

  /**
   * 清理AI响应文本，移除自定义工具语法标签
   * @param text 原始文本
   * @returns 清理后的文本
   */
  static cleanResponse(text: string): string {
    return text
      .replace(this.CUSTOM_TOOL_PATTERN, '')
      .replace(this.SEARCH_CUSTOM_TOOLS_PATTERN, '')
      .replace(/\n\s*\n\s*\n/g, '\n\n') // 移除多余的空行
      .trim();
  }

  /**
   * 验证自定义工具命令的有效性
   * @param command 自定义工具命令
   * @returns 是否有效
   */
  static validateCommand(command: CustomToolCommand): boolean {
    return !!(
      command.name && 
      command.name.trim().length > 0 &&
      command.description && 
      command.description.trim().length > 0
    );
  }

  /**
   * 格式化自定义工具命令为调试字符串
   * @param command 自定义工具命令
   * @returns 格式化的字符串
   */
  static formatCommandForDebug(command: CustomToolCommand): string {
    return `ADD CUSTOM TOOL [${command.name}]: ${command.description} (Category: ${command.category || 'General'})`;
  }
}