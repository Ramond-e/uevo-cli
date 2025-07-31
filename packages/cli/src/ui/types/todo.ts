/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

// TODO事项的状态
export enum TodoStatus {
  PENDING = 'pending',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
}

// 单个TODO事项
export interface TodoItem {
  id: number;
  status: TodoStatus;
  description: string;
  createdAt: number;
  completedAt?: number;
}

// TODO列表
export interface TodoList {
  id: string;
  items: TodoItem[];
  createdAt: number;
  userQuery: string;
}

// AI分析返回的TODO格式
export interface TodoAnalysisResult {
  todos: Array<{
    id: number;
    description: string;
  }>;
} 