/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { createContext, useContext, useReducer, useCallback, ReactNode } from 'react';
import { TodoState, TodoAction, TodoActionType, TodoStatus, TodoTask } from '../types/todo.js';

/**
 * TODO上下文接口
 */
interface TodoContextType {
  state: TodoState;
  createTodo: (content: string) => number;
  updateTodo: (id: number, content: string) => void;
  finishTodo: (id: number) => void;
  toggleVisibility: () => void;
  clearAll: () => void;
  getTodoList: () => TodoTask[];
  getSystemPromptTodos: () => string;
}

/**
 * 初始状态
 */
const initialState: TodoState = {
  tasks: [],
  nextId: 1,
  isVisible: false
};

/**
 * TODO reducer
 */
function todoReducer(state: TodoState, action: TodoAction): TodoState {
  switch (action.type) {
    case TodoActionType.CREATE_TODO:
      if (!action.payload?.content) return state;
      
      const newTask: TodoTask = {
        id: state.nextId,
        content: action.payload.content,
        status: TodoStatus.PENDING,
        createdAt: new Date()
      };
      
      console.log('Reducer - Creating TODO:', { newTask, oldState: state });
      
      const newState = {
        ...state,
        tasks: [...state.tasks, newTask],
        nextId: state.nextId + 1,
        isVisible: true
      };
      
      console.log('Reducer - New state after TODO creation:', newState);
      return newState;

    case TodoActionType.UPDATE_TODO:
      if (!action.payload?.id || !action.payload?.content) return state;
      
      return {
        ...state,
        tasks: state.tasks.map(task =>
          task.id === action.payload!.id
            ? { ...task, content: action.payload!.content! }
            : task
        )
      };

    case TodoActionType.FINISH_TODO:
      if (!action.payload?.id) return state;
      
      return {
        ...state,
        tasks: state.tasks.map(task =>
          task.id === action.payload!.id
            ? { ...task, status: TodoStatus.COMPLETED, completedAt: new Date() }
            : task
        )
      };

    case TodoActionType.TOGGLE_VISIBILITY:
      return {
        ...state,
        isVisible: !state.isVisible
      };

    case TodoActionType.CLEAR_ALL:
      return {
        ...state,
        tasks: [],
        nextId: 1
      };

    default:
      return state;
  }
}

/**
 * TODO上下文
 */
const TodoContext = createContext<TodoContextType | null>(null);

/**
 * TODO Provider组件
 */
interface TodoProviderProps {
  children: ReactNode;
}

export function TodoProvider({ children }: TodoProviderProps) {
  const [state, dispatch] = useReducer(todoReducer, initialState);

  const createTodo = useCallback((content: string): number => {
    const id = state.nextId;
    console.log('Creating TODO function called:', { content, id, currentStateTasksLength: state.tasks.length, currentStateVisible: state.isVisible });
    dispatch({ type: TodoActionType.CREATE_TODO, payload: { content } });
    console.log('Dispatch called for CREATE_TODO');
    return id;
  }, [state.nextId]);

  const updateTodo = useCallback((id: number, content: string) => {
    dispatch({ type: TodoActionType.UPDATE_TODO, payload: { id, content } });
  }, []);

  const finishTodo = useCallback((id: number) => {
    console.log('Finishing TODO:', { id, currentState: state });
    dispatch({ type: TodoActionType.FINISH_TODO, payload: { id } });
  }, []);

  const toggleVisibility = useCallback(() => {
    dispatch({ type: TodoActionType.TOGGLE_VISIBILITY });
  }, []);

  const clearAll = useCallback(() => {
    dispatch({ type: TodoActionType.CLEAR_ALL });
  }, []);

  const getTodoList = useCallback((): TodoTask[] => {
    return state.tasks;
  }, [state.tasks]);

  const getSystemPromptTodos = useCallback((): string => {
    if (state.tasks.length === 0) return '';
    
    const todoList = state.tasks.map(task => {
      const status = task.status === TodoStatus.COMPLETED ? '✓' : '○';
      return `${task.id}+${status}+${task.content}`;
    }).join('\n');
    
    return `
## 当前TODO任务清单
${todoList}

## TODO工具语法教学
当你判断当前任务过于复杂需要分解为多个子任务时，请使用以下语法：

1. 创建新任务：<create_todo>序号:任务内容</create_todo>
   - 示例：<create_todo>1:实现用户登录功能</create_todo>

2. 更新任务：<update_todo>序号:更新后的任务内容</update_todo>
   - 示例：<update_todo>1:实现用户登录和注册功能</update_todo>

3. 完成任务：<finish_todo>序号</finish_todo>
   - 示例：<finish_todo>1</finish_todo>

注意：
- 序号必须是已存在的任务序号
- 任务内容要具体明确
- 完成任务后会自动标记为已完成状态
`;
  }, [state.tasks]);

  const contextValue: TodoContextType = {
    state,
    createTodo,
    updateTodo,
    finishTodo,
    toggleVisibility,
    clearAll,
    getTodoList,
    getSystemPromptTodos
  };

  return (
    <TodoContext.Provider value={contextValue}>
      {children}
    </TodoContext.Provider>
  );
}

/**
 * 使用TODO上下文的Hook
 */
export function useTodo(): TodoContextType {
  const context = useContext(TodoContext);
  if (!context) {
    throw new Error('useTodo must be used within a TodoProvider');
  }
  return context;
}