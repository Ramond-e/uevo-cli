/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { useCallback, useState } from 'react';
import { CustomToolParser } from '../utils/customToolParser.js';
import { CustomToolAddDetails } from '../types/customTool.js';
import { CustomToolRegistryManager } from '../services/customToolRegistry.js';
import { CustomToolConfirmationOutcome } from '../components/messages/CustomToolAddConfirmationMessage.js';

/**
 * 自定义工具集成Hook - 处理AI响应中的自定义工具添加命令
 */
export function useCustomToolIntegration() {
  const [pendingToolAdd, setPendingToolAdd] = useState<CustomToolAddDetails | null>(null);
  const [showConfirmation, setShowConfirmation] = useState(false);

  /**
   * 处理AI响应内容，解析并执行自定义工具命令
   * @param content AI响应内容
   * @returns 处理后的内容（移除自定义工具语法，可能包含搜索结果）
   */
  const processAIResponse = useCallback((content: string): string => {
    // 解析自定义工具命令和搜索请求
    const parseResult = CustomToolParser.parseResponse(content);
    const { commands, hasSearchRequest } = parseResult;
    
    console.log('Custom Tool Integration - Processing AI response:', {
      contentLength: content.length,
      commandsFound: commands.length,
      hasSearchRequest: hasSearchRequest,
      commands: commands
    });
    
    // 处理搜索请求
    let processedContent = content;
    if (hasSearchRequest) {
      console.log('Custom tool search request detected');
      const toolsInfo = CustomToolRegistryManager.formatToolsForAI();
      // 在原内容中插入工具列表信息
      processedContent = processedContent.replace(
        /<search_custom_tools\s*\/?>/g, 
        `\n\n${toolsInfo}\n\n`
      );
      console.log('Inserted custom tools information into response');
    }
    
    // 处理自定义工具命令
    commands.forEach(command => {
      if (!CustomToolParser.validateCommand(command)) {
        console.warn('Invalid custom tool command:', CustomToolParser.formatCommandForDebug(command));
        return;
      }

      try {
        // 创建工具详情对象
        const toolDetails: CustomToolAddDetails = {
          name: command.name,
          description: command.description,
          category: command.category || 'General',
          tags: command.tags || [],
          examples: command.examples || [],
          parameters: command.parameters
        };

        console.log('About to show custom tool confirmation:', toolDetails);
        
        // 设置待确认的工具
        setPendingToolAdd(toolDetails);
        setShowConfirmation(true);
        
      } catch (error) {
        console.error('Error processing custom tool command:', error);
      }
    });

    // 返回清理后的内容（如果有搜索请求则返回包含搜索结果的内容）
    return CustomToolParser.cleanResponse(processedContent);
  }, []);

  /**
   * 处理用户确认结果
   */
  const handleConfirmation = useCallback((outcome: CustomToolConfirmationOutcome) => {
    if (!pendingToolAdd) {
      console.warn('No pending tool add to confirm');
      return;
    }

    console.log('Custom tool confirmation outcome:', outcome);

    switch (outcome) {
      case CustomToolConfirmationOutcome.Add:
        // 添加工具到注册表
        const result = CustomToolRegistryManager.addTool(pendingToolAdd);
        if (result.success) {
          console.log(`Custom tool added successfully with ID: ${result.id}`);
          // TODO: 显示成功消息给用户
        } else {
          console.error(`Failed to add custom tool: ${result.error}`);
          // TODO: 显示错误消息给用户
        }
        break;
      
      case CustomToolConfirmationOutcome.Modify:
        // TODO: 实现修改功能 - 目前暂时取消
        console.log('Tool modification requested (not implemented yet)');
        break;
      
      case CustomToolConfirmationOutcome.Cancel:
        console.log('Custom tool add cancelled by user');
        break;
    }

    // 清理状态
    setPendingToolAdd(null);
    setShowConfirmation(false);
  }, [pendingToolAdd]);

  /**
   * 手动取消确认
   */
  const cancelConfirmation = useCallback(() => {
    setPendingToolAdd(null);
    setShowConfirmation(false);
  }, []);

  return {
    processAIResponse,
    pendingToolAdd,
    showConfirmation,
    handleConfirmation,
    cancelConfirmation
  };
}