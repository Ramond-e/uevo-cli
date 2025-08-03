/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * TODO任务的状态枚举
 */
export enum TodoStatus {
  PENDING = 'pending',
  COMPLETED = 'completed'
}

/**
 * TODO任务项接口
 */
export interface TodoTask {
  /** 任务序号 */
  id: number;
  /** 任务内容 */
  content: string;
  /** 完成状态 */
  status: TodoStatus;
  /** 创建时间 */
  createdAt: Date;
  /** 完成时间（如果已完成） */
  completedAt?: Date;
}

/**
 * TODO管理器的状态接口
 */
export interface TodoState {
  /** 任务列表 */
  tasks: TodoTask[];
  /** 下一个任务ID */
  nextId: number;
  /** 是否显示TODO面板 */
  isVisible: boolean;
}

/**
 * TODO操作类型
 */
export enum TodoActionType {
  CREATE_TODO = 'CREATE_TODO',
  UPDATE_TODO = 'UPDATE_TODO',
  FINISH_TODO = 'FINISH_TODO',
  TOGGLE_VISIBILITY = 'TOGGLE_VISIBILITY',
  CLEAR_ALL = 'CLEAR_ALL'
}

/**
 * TODO操作接口
 */
export interface TodoAction {
  type: TodoActionType;
  payload?: {
    id?: number;
    content?: string;
    tasks?: TodoTask[];
  };
}

/**
 * AI TODO语法解析结果
 */
export interface TodoCommand {
  type: 'create_todo' | 'update_todo' | 'finish_todo';
  id?: number;
  content?: string;
}