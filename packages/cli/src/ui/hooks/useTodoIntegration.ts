/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { useCallback } from 'react';
import { useTodo } from '../contexts/TodoContext.js';
import { TodoParser } from '../utils/todoParser.js';
import { TodoCommand } from '../types/todo.js';

/**
 * TODO集成Hook - 处理AI响应中的TODO命令
 */
export function useTodoIntegration() {
  const { createTodo, updateTodo, finishTodo } = useTodo();

  const executeCommand = useCallback((command: TodoCommand) => {
    if (!TodoParser.validateCommand(command)) {
      return;
    }

    try {
      switch (command.type) {
        case 'create_todo':
          if (command.content) {
            createTodo(command.content, command.id);
          }
          break;
        
        case 'update_todo':
          if (command.id && command.content) {
            updateTodo(command.id, command.content);
          }
          break;
        
        case 'finish_todo':
          if (command.id) {
            finishTodo(command.id);
          }
          break;
      }
    } catch (error) {
      console.error('Error executing TODO command:', error);
    }
  }, [createTodo, updateTodo, finishTodo]);

  /**
   * 增量处理AI响应内容，解析并执行新发现的TODO命令
   * @param content AI响应的累积内容
   * @param processedCommands 一组已经处理过的命令源字符串
   * @returns 返回一个新的包含所有已处理命令源字符串的Set
   */
  const processIncrementalAIResponse = useCallback((
    content: string, 
    processedCommands: Set<string>
  ): Set<string> => {
    const newProcessedCommands = new Set(processedCommands);
    const { commands, sources } = TodoParser.parseResponse(content);
    
    commands.forEach((command, index) => {
      const commandSource = sources[index];
      if (commandSource && !newProcessedCommands.has(commandSource)) {
        executeCommand(command);
        newProcessedCommands.add(commandSource);
      }
    });

    return newProcessedCommands;
  }, [executeCommand]);

  /**
   * 清理最终的AI响应文本，移除TODO语法
   * @param content 最终的AI响应文本
   * @returns 清理后的文本
   */
  const cleanFinalResponse = useCallback((content: string): string => {
    return TodoParser.cleanResponse(content);
  }, []);

  return {
    processIncrementalAIResponse,
    cleanFinalResponse
  };
}