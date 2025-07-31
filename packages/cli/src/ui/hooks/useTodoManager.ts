/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useCallback } from 'react';
import { TodoItem, TodoList, TodoStatus, TodoAnalysisResult } from '../types/todo.js';
import { Config } from '@uevo/uevo-cli-core';

export interface UseTodoManagerReturn {
  currentTodoList: TodoList | null;
  createTodoList: (userQuery: string, analysisResult: TodoAnalysisResult) => void;
  updateTodoStatus: (todoId: number, status: TodoStatus) => void;
  clearTodoList: () => void;
  analyzeTasks: (query: string, config: Config) => Promise<TodoAnalysisResult | null>;
}

export const useTodoManager = (): UseTodoManagerReturn => {
  const [currentTodoList, setCurrentTodoList] = useState<TodoList | null>(null);

  // 创建新的TODO列表
  const createTodoList = useCallback((userQuery: string, analysisResult: TodoAnalysisResult) => {
    const now = Date.now();
    const todoItems: TodoItem[] = analysisResult.todos.map(todo => ({
      id: todo.id,
      status: TodoStatus.PENDING,
      description: todo.description,
      createdAt: now,
    }));

    setCurrentTodoList({
      id: `todo-${now}`,
      items: todoItems,
      createdAt: now,
      userQuery,
    });
  }, []);

  // 更新TODO状�?
  const updateTodoStatus = useCallback((todoId: number, status: TodoStatus) => {
    setCurrentTodoList(prev => {
      if (!prev) return null;
      
      return {
        ...prev,
        items: prev.items.map(item => {
          if (item.id === todoId) {
            return {
              ...item,
              status,
              completedAt: status === TodoStatus.COMPLETED ? Date.now() : undefined,
            };
          }
          return item;
        }),
      };
    });
  }, []);

  // 清空TODO列表
  const clearTodoList = useCallback(() => {
    setCurrentTodoList(null);
  }, []);

  // 分析任务并生成TODO列表
  const analyzeTasks = useCallback(async (query: string, config: Config): Promise<TodoAnalysisResult | null> => {
    console.log('🔬 开始TODO任务分析 - 查询:', query);
    try {
      const client = config.getAIClient();
      if (!client) {
        console.log('❌ Gemini客户端未配置');
        return null;
      }
      console.log('✅ Gemini客户端已获取');

      // 构建任务分析的提示词
      const prompt = `You are a task analyzer. Analyze the following user request and break it down into concrete, actionable TODO items.

User Request: "${query}"

Instructions:
1. Break down the task into 3-7 concrete, sequential steps
2. Each step should be specific and actionable
3. Steps should be ordered logically
4. Keep descriptions concise but clear (10-20 words each)
5. Focus on implementation steps, not planning or research

Return ONLY a valid JSON object in this exact format:
{
  "todos": [
    {
      "id": 1,
      "description": "First specific action to take"
    },
    {
      "id": 2,
      "description": "Second specific action to take"
    }
  ]
}

Examples:
- Bad: "Research the best approach" 
- Good: "Create user authentication endpoint with JWT"

- Bad: "Fix the bug"
- Good: "Add null check for user input in handleSubmit function"

Remember: Return ONLY the JSON object, no markdown, no explanation.`;

      console.log('📡 调用Gemini API进行任务分析...');
      // 调用Gemini API进行任务分析
      const result = await client.generateContent(
        [{
          role: 'user',
          parts: [{ text: prompt }],
        }],
        {
          temperature: 0.3,
          maxOutputTokens: 1000,
        },
        new AbortController().signal,
      );

      console.log('📦 API调用完成，处理响应...');
      // 从响应中提取文本
      const responseText = result.candidates?.[0]?.content?.parts
        ?.map((part: any) => part.text)
        .filter((text: any) => text)
        .join('') || '';
      
      console.log('📄 原始响应:', responseText);
      
      // 清理响应文本，移除可能的markdown标记
      const cleanedResponse = responseText
        .replace(/```json\n?/g, '')
        .replace(/```\n?/g, '')
        .trim();

      console.log('🧹 清理后的响应:', cleanedResponse);

      // 解析JSON响应
      const analysisResult = JSON.parse(cleanedResponse) as TodoAnalysisResult;
      
      console.log('📋 解析的TODO结果:', analysisResult);
      
      // 验证返回的数据格�?
      if (!analysisResult.todos || !Array.isArray(analysisResult.todos)) {
        throw new Error('Invalid response format');
      }

      return analysisResult;
    } catch (error) {
      console.error('Failed to analyze tasks:', error);
      return null;
    }
  }, []);

  return {
    currentTodoList,
    createTodoList,
    updateTodoStatus,
    clearTodoList,
    analyzeTasks,
  };
}; 