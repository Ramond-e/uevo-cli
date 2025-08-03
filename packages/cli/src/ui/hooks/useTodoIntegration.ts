/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { useCallback } from 'react';
import { useTodo } from '../contexts/TodoContext.js';
import { TodoParser } from '../utils/todoParser.js';

/**
 * TODO集成Hook - 处理AI响应中的TODO命令
 */
export function useTodoIntegration() {
  const { createTodo, updateTodo, finishTodo } = useTodo();

  /**
   * 处理AI响应内容，解析并执行TODO命令
   * @param content AI响应内容
   * @returns 处理后的内容（移除TODO语法）
   */
  const processAIResponse = useCallback((content: string): string => {
    // 解析TODO命令
    const commands = TodoParser.parseResponse(content);
    
    console.log('TODO Integration - Processing AI response:', {
      contentLength: content.length,
      commandsFound: commands.length,
      commands: commands
    });
    
    // 执行TODO命令
    commands.forEach(command => {
      if (!TodoParser.validateCommand(command)) {
        console.warn('Invalid TODO command:', TodoParser.formatCommandForDebug(command));
        return;
      }

      try {
        switch (command.type) {
          case 'create_todo':
            if (command.content) {
              console.log('About to create TODO:', command.content);
              const id = createTodo(command.content);
              console.log(`TODO created with ID: [${id}] content: ${command.content}`);
            }
            break;
          
          case 'update_todo':
            if (command.id && command.content) {
              updateTodo(command.id, command.content);
              console.log(`TODO updated: [${command.id}] ${command.content}`);
            }
            break;
          
          case 'finish_todo':
            if (command.id) {
              finishTodo(command.id);
              console.log(`TODO finished: [${command.id}]`);
            }
            break;
        }
      } catch (error) {
        console.error('Error executing TODO command:', error);
      }
    });

    // 返回清理后的内容
    return TodoParser.cleanResponse(content);
  }, [createTodo, updateTodo, finishTodo]);

  return {
    processAIResponse
  };
}