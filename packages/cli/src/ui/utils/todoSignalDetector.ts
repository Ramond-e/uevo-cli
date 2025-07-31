/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { TodoStatus } from '../types/todo.js';

// TODO完成信号的正则表达式模式
const TODO_COMPLETE_PATTERNS = [
  /todo事项\s*(\d+)\s*已经完成/i,
  /TODO\s*(\d+)\s*completed/i,
  /✅\s*TODO\s*(\d+)/i,
  /完成了?TODO\s*(\d+)/i,
  /Task\s*(\d+)\s*completed/i,
  /任务\s*(\d+)\s*已完成/i,
];

// TODO开始信号的正则表达式模式
const TODO_START_PATTERNS = [
  /开始执行todo事项\s*(\d+)/i,
  /开始处理任务\s*(\d+)/i,
  /Starting\s*TODO\s*(\d+)/i,
  /开始TODO\s*(\d+)/i,
  /执行任务\s*(\d+)/i,
];

export interface TodoSignal {
  todoId: number;
  status: TodoStatus;
  matchedText: string;
}

/**
 * 从文本中检测TODO相关的信号
 * @param text AI输出的文本
 * @returns 检测到的TODO信号数组
 */
export function detectTodoSignals(text: string): TodoSignal[] {
  const signals: TodoSignal[] = [];

  // 检测完成信号
  for (const pattern of TODO_COMPLETE_PATTERNS) {
    const matches = text.matchAll(new RegExp(pattern, 'g'));
    for (const match of matches) {
      const todoId = parseInt(match[1], 10);
      if (!isNaN(todoId)) {
        signals.push({
          todoId,
          status: TodoStatus.COMPLETED,
          matchedText: match[0],
        });
      }
    }
  }

  // 检测开始信号
  for (const pattern of TODO_START_PATTERNS) {
    const matches = text.matchAll(new RegExp(pattern, 'g'));
    for (const match of matches) {
      const todoId = parseInt(match[1], 10);
      if (!isNaN(todoId)) {
        signals.push({
          todoId,
          status: TodoStatus.IN_PROGRESS,
          matchedText: match[0],
        });
      }
    }
  }

  // 去重，如果同一个TODO有多个信号，保留最新的状态
  const uniqueSignals = new Map<number, TodoSignal>();
  for (const signal of signals) {
    const existing = uniqueSignals.get(signal.todoId);
    if (!existing || 
        (signal.status === TodoStatus.COMPLETED && existing.status !== TodoStatus.COMPLETED)) {
      uniqueSignals.set(signal.todoId, signal);
    }
  }

  return Array.from(uniqueSignals.values());
}

/**
 * 生成TODO状态更新的提示文本
 * @param todoId TODO的ID
 * @param status 新的状态
 * @returns 格式化的提示文本
 */
export function generateTodoSignal(todoId: number, status: TodoStatus): string {
  switch (status) {
    case TodoStatus.IN_PROGRESS:
      return `开始执行todo事项${todoId}`;
    case TodoStatus.COMPLETED:
      return `todo事项${todoId}已经完成`;
    default:
      return '';
  }
} 