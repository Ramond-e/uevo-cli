/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { useCallback, useEffect } from 'react';
import { useGeminiStream } from './useGeminiStream.js';
import { useTodoIntegration } from './useTodoIntegration.js';
import { UseTodoManagerReturn } from './useTodoManager.js';
import { GeminiClient, Config } from '@uevo/uevo-cli-core';
import { HistoryItem, StreamingState } from '../types.js';
import { UseHistoryManagerReturn } from './useHistoryManager.js';
import { SlashCommandProcessorResult } from '../types.js';
import { PartListUnion } from '@google/genai';
import { EditorType } from '@uevo/uevo-cli-core';

interface UseGeminiStreamWithTodoProps {
  geminiClient: GeminiClient;
  history: HistoryItem[];
  addItem: UseHistoryManagerReturn['addItem'];
  setShowHelp: React.Dispatch<React.SetStateAction<boolean>>;
  config: Config;
  onDebugMessage: (message: string) => void;
  handleSlashCommand: (
    cmd: PartListUnion,
  ) => Promise<SlashCommandProcessorResult | false>;
  shellModeActive: boolean;
  getPreferredEditor: () => EditorType | undefined;
  onAuthError: () => void;
  performMemoryRefresh: () => Promise<void>;
  modelSwitchedFromQuotaError: boolean;
  setModelSwitchedFromQuotaError: React.Dispatch<React.SetStateAction<boolean>>;
  todoManager: UseTodoManagerReturn;
}

export function useGeminiStreamWithTodo({
  geminiClient,
  history,
  addItem,
  setShowHelp,
  config,
  onDebugMessage,
  handleSlashCommand,
  shellModeActive,
  getPreferredEditor,
  onAuthError,
  performMemoryRefresh,
  modelSwitchedFromQuotaError,
  setModelSwitchedFromQuotaError,
  todoManager,
}: UseGeminiStreamWithTodoProps) {
  // 使用原始的useGeminiStream
  const geminiStreamResult = useGeminiStream(
    geminiClient,
    history,
    addItem,
    setShowHelp,
    config,
    onDebugMessage,
    handleSlashCommand,
    shellModeActive,
    getPreferredEditor,
    onAuthError,
    performMemoryRefresh,
    modelSwitchedFromQuotaError,
    setModelSwitchedFromQuotaError,
  );

  const {
    submitQuery: originalSubmitQuery,
    streamingState,
    pendingHistoryItems,
  } = geminiStreamResult;

  // TODO集成
  const todoIntegration = useTodoIntegration({
    todoManager,
    config,
    addItem,
    onDebugMessage,
  });

  // 扩展submitQuery以包含TODO分析
  const submitQuery = useCallback(
    async (
      query: PartListUnion,
      options?: { isContinuation: boolean },
      prompt_id?: string,
    ) => {
      // 如果是字符串查询，进行TODO分析
      if (typeof query === 'string' && !options?.isContinuation) {
        await todoIntegration.analyzeUserQuery(query);
      }

      // 调用原始的submitQuery
      return originalSubmitQuery(query, options, prompt_id);
    },
    [originalSubmitQuery, todoIntegration],
  );

  // 监听pendingHistoryItems中的Gemini响应，检测TODO信号
  useEffect(() => {
    const geminiItems = pendingHistoryItems.filter(
      item => item && (item.type === 'gemini' || item.type === 'gemini_content')
    );
    
    // 处理当前pending的gemini文本
    geminiItems.forEach(item => {
      if ('text' in item && typeof item.text === 'string' && item.text.trim()) {
        // 对完整文本进行信号检测，而不是增量处理
        todoIntegration.processGeminiResponse(item.text);
      }
    });
  }, [pendingHistoryItems, todoIntegration]);

  // 当流完成时重置TODO处理状�?
  useEffect(() => {
    if (streamingState === StreamingState.Idle) {
      todoIntegration.resetProcessing();
    }
  }, [streamingState, todoIntegration]);

  return {
    ...geminiStreamResult,
    submitQuery, // 使用扩展的submitQuery
  };
} 