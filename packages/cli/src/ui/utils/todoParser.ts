/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { TodoCommand } from '../types/todo.js';

/**
 * 解析AI响应中的TODO语法
 */
export class TodoParser {
  private static readonly TODO_PATTERNS = {
    // 匹配 <create_todo>序号:内容</create_todo>
    CREATE: /<create_todo>(\d+):(.+?)<\/create_todo>/g,
    // 匹配 <update_todo>序号:内容</update_todo>
    UPDATE: /<update_todo>(\d+):(.+?)<\/update_todo>/g,
    // 匹配 <finish_todo>序号</finish_todo>
    FINISH: /<finish_todo>(\d+)<\/finish_todo>/g
  };

  /**
   * 解析AI响应文本，提取所有TODO命令
   * @param text AI的响应文本
   * @returns 解析出的TODO命令数组和对应的源字符串数组
   */
  static parseResponse(text: string): { commands: TodoCommand[], sources: string[] } {
    const commands: TodoCommand[] = [];
    const sources: string[] = [];
    
    // 解析创建TODO命令
    const createMatches = [...text.matchAll(this.TODO_PATTERNS.CREATE)];
    for (const match of createMatches) {
      const id = parseInt(match[1], 10);
      const content = match[2].trim();
      if (content) {
        commands.push({
          type: 'create_todo',
          id,
          content
        });
        sources.push(match[0]);
      }
    }

    // 解析更新TODO命令
    const updateMatches = [...text.matchAll(this.TODO_PATTERNS.UPDATE)];
    for (const match of updateMatches) {
      const id = parseInt(match[1], 10);
      const content = match[2].trim();
      if (content) {
        commands.push({
          type: 'update_todo',
          id,
          content
        });
        sources.push(match[0]);
      }
    }

    // 解析完成TODO命令
    const finishMatches = [...text.matchAll(this.TODO_PATTERNS.FINISH)];
    for (const match of finishMatches) {
      const id = parseInt(match[1], 10);
      commands.push({
        type: 'finish_todo',
        id
      });
      sources.push(match[0]);
    }

    return { commands, sources };
  }

  /**
   * 清理AI响应文本，移除TODO语法标签
   * @param text 原始文本
   * @returns 清理后的文本
   */
  static cleanResponse(text: string): string {
    return text
      .replace(this.TODO_PATTERNS.CREATE, '')
      .replace(this.TODO_PATTERNS.UPDATE, '')
      .replace(this.TODO_PATTERNS.FINISH, '')
      .replace(/\n\s*\n\s*\n/g, '\n\n') // 移除多余的空行
      .trim();
  }

  /**
   * 验证TODO命令的有效性
   * @param command TODO命令
   * @returns 是否有效
   */
  static validateCommand(command: TodoCommand): boolean {
    switch (command.type) {
      case 'create_todo':
        return !!(command.content && command.content.trim().length > 0);
      case 'update_todo':
        return !!(command.id && command.id > 0 && command.content && command.content.trim().length > 0);
      case 'finish_todo':
        return !!(command.id && command.id > 0);
      default:
        return false;
    }
  }

  /**
   * 格式化TODO命令为调试字符串
   * @param command TODO命令
   * @returns 格式化的字符串
   */
  static formatCommandForDebug(command: TodoCommand): string {
    switch (command.type) {
      case 'create_todo':
        return `CREATE TODO [${command.id}]: ${command.content}`;
      case 'update_todo':
        return `UPDATE TODO [${command.id}]: ${command.content}`;
      case 'finish_todo':
        return `FINISH TODO [${command.id}]`;
      default:
        return `UNKNOWN COMMAND: ${JSON.stringify(command)}`;
    }
  }
}