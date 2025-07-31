/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { useCallback, useEffect, useRef } from 'react';
import { Config } from '@uevo/uevo-cli-core';
import { TodoStatus } from '../types/todo.js';
import { detectTodoSignals } from '../utils/todoSignalDetector.js';
import { UseTodoManagerReturn } from './useTodoManager.js';

interface UseTodoIntegrationProps {
  todoManager: UseTodoManagerReturn;
  config: Config;
  addItem: (item: any, timestamp: number) => void;
  onDebugMessage: (message: string) => void;
}

export function useTodoIntegration({
  todoManager,
  config,
  addItem,
  onDebugMessage,
}: UseTodoIntegrationProps) {
  const lastProcessedTextRef = useRef<string>('');
  const isAnalyzingRef = useRef<boolean>(false);

  // 在用户提交查询时分析TODO任务
  const analyzeUserQuery = useCallback(
    async (query: string): Promise<void> => {
      // 防止重复分析
      if (isAnalyzingRef.current) return;
      
      // 只对非命令的普通查询进行TODO分析
      if (query.startsWith('/') || query.startsWith('@') || query.startsWith('?')) {
        onDebugMessage('跳过命令类型查询的TODO分析');
        return;
      }

      // 检查查询是否包含具体的任务关键词
      const taskKeywords = [
        '创建', '添加', '修改', '更新', '删除', '实现', '完成', '优化', '修复', '制作', '开发', '构建', '设计', '编写',
        'create', 'add', 'modify', 'update', 'delete', 'implement', 'complete', 'optimize', 'fix', 'make', 'develop', 'build', 'design', 'write',
        '帮我', '为我', '请', '需要', '想要', '希望', 'help', 'please', 'need', 'want', 'would like'
      ];
      
      const matchedKeywords = taskKeywords.filter(keyword => 
        query.toLowerCase().includes(keyword.toLowerCase())
      );
      
      onDebugMessage(`查询关键词检查 - 查询: "${query}", 匹配的关键词: [${matchedKeywords.join(', ')}]`);
      
      if (matchedKeywords.length === 0) {
        onDebugMessage('没有找到任务关键词，跳过TODO分析');
        return;
      }

      isAnalyzingRef.current = true;
      onDebugMessage(`🔍 正在分析任务，生成TODO列表... (匹配关键词: ${matchedKeywords.join(', ')})`);

      try {
        const analysisResult = await todoManager.analyzeTasks(query, config);
        
        if (analysisResult && analysisResult.todos.length > 0) {
          // 创建TODO列表
          todoManager.createTodoList(query, analysisResult);
          
          // 添加一个信息消息，显示TODO列表已创建
          addItem(
            {
              type: 'info',
              text: `📋 已创建TODO列表，共 ${analysisResult.todos.length} 个任务`,
            },
            Date.now(),
          );

          // 添加AI指导消息，告诉AI如何使用TODO信号
          addItem(
            {
              type: 'user',
              text: `📋 重要提醒：我已经为您的任务创建了TODO列表。请在执行过程中：
1. 开始执行某个TODO时，输出："开始执行todo事项X"（X是TODO编号）
2. 完成某个TODO时，输出："todo事项X已经完成"（X是TODO编号）

这样我就能实时看到您的进度了！现在请开始执行任务。`,
            },
            Date.now(),
          );
          
          onDebugMessage(`✅ TODO列表已创建，包含 ${analysisResult.todos.length} 个任务`);
        } else {
          onDebugMessage('❌ TODO分析未返回有效结果');
        }
      } catch (error) {
        onDebugMessage(`❌ TODO分析失败: ${error}`);
        console.error('TODO analysis error:', error);
      } finally {
        isAnalyzingRef.current = false;
      }
    },
    [todoManager, config, addItem, onDebugMessage],
  );

  // 处理Gemini响应中的TODO信号
  const processGeminiResponse = useCallback(
    (text: string): void => {
      // 如果文本比之前的长，说明有新内容
      if (text.length <= lastProcessedTextRef.current.length) {
        return;
      }
      
      // 只处理新增的文本内容
      const newText = text.slice(lastProcessedTextRef.current.length);
      if (!newText.trim()) return;
      
      onDebugMessage(`🔍 TODO信号检测 - 新增文本: "${newText.slice(0, 50)}${newText.length > 50 ? '...' : ''}"`);
      
      lastProcessedTextRef.current = text;
      
      // 检测TODO信号
      const signals = detectTodoSignals(newText);
      
      if (signals.length > 0) {
        onDebugMessage(`✅ 发现 ${signals.length} 个TODO信号: ${signals.map(s => `${s.todoId}:${s.status}`).join(', ')}`);
        
        signals.forEach(signal => {
          // 更新TODO状态
          todoManager.updateTodoStatus(signal.todoId, signal.status);
          
          // 调试信息
          onDebugMessage(`🔄 TODO ${signal.todoId} 状态更新: ${signal.matchedText} -> ${signal.status}`);
        });
      } else {
        // 只在有TODO列表时显示未检测到信号的调试信息
        if (todoManager.currentTodoList && newText.length > 10) {
          onDebugMessage(`⚪ 本次响应未检测到TODO信号 (文本: "${newText.slice(0, 30)}...")`);
        }
      }
    },
    [todoManager, onDebugMessage],
  );

  // 重置处理状�?
  const resetProcessing = useCallback(() => {
    lastProcessedTextRef.current = '';
  }, []);

  // 当TODO列表被清空时，重置状�?
  useEffect(() => {
    if (!todoManager.currentTodoList) {
      resetProcessing();
    }
  }, [todoManager.currentTodoList, resetProcessing]);

  return {
    analyzeUserQuery,
    processGeminiResponse,
    resetProcessing,
  };
} 