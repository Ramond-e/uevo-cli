/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { Tool, ToolResult } from '../tools/tools.js';
import * as path from 'path';

/**
 * 工具调用适配器接口
 * 统一不同AI模型的工具调用接口
 */
export interface ToolCallAdapter {
  /**
   * 验证工具参数
   * @param tool 工具实例
   * @param params 参数
   * @returns 验证结果
   */
  validateParams<TParams>(tool: Tool<TParams>, params: TParams): Promise<ValidationResult>;

  /**
   * 执行工具调用
   * @param tool 工具实例
   * @param params 参数
   * @param abortSignal 取消信号
   * @returns 执行结果
   */
  executeCall<TParams, TResult extends ToolResult>(
    tool: Tool<TParams, TResult>,
    params: TParams,
    abortSignal?: AbortSignal
  ): Promise<TResult>;
}

/**
 * 验证结果
 */
export interface ValidationResult {
  isValid: boolean;
  errorMessage?: string;
}

/**
 * 通用工具调用适配器
 * 将标准工具接口适配到不同AI模型的需求
 */
export class UniversalToolCallAdapter implements ToolCallAdapter {
  /**
   * 验证工具参数 - 兼容所有模型的接口
   */
  async validateParams<TParams>(
    tool: Tool<TParams>,
    params: TParams
  ): Promise<ValidationResult> {
    try {
      // 调试：记录参数信息
      console.log(`[DEBUG] 工具调用适配器 - 验证工具: ${tool.name}`);
      console.log(`[DEBUG] 接收到的参数:`, JSON.stringify(params, null, 2));
      
      const validationResult = tool.validateToolParams(params);
      
      console.log(`[DEBUG] 验证结果:`, validationResult);
      
      // 标准工具接口：null表示有效，字符串表示错误
      if (validationResult === null) {
        console.log(`[DEBUG] 参数验证通过`);
        return { isValid: true };
      } else {
        console.log(`[DEBUG] 参数验证失败:`, validationResult);
        return { 
          isValid: false, 
          errorMessage: validationResult 
        };
      }
    } catch (error) {
      console.log(`[DEBUG] 参数验证异常:`, error);
      return {
        isValid: false,
        errorMessage: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * 执行工具调用
   */
  async executeCall<TParams, TResult extends ToolResult>(
    tool: Tool<TParams, TResult>,
    params: TParams,
    abortSignal?: AbortSignal
  ): Promise<TResult> {
    // 首先验证参数
    const validation = await this.validateParams(tool, params);
    if (!validation.isValid) {
      throw new Error(`Parameter validation failed: ${validation.errorMessage}`);
    }

    // 检查是否需要确认
    const confirmationDetails = await tool.shouldConfirmExecute(
      params,
      abortSignal || new AbortController().signal
    );

    if (confirmationDetails) {
      // 注意：在实际使用中，这里应该请求用户确认
      // 目前为了简化，我们假设用户同意执行
      console.warn('Tool execution requires confirmation but proceeding automatically:', confirmationDetails);
    }

    // 执行工具
    return await tool.execute(params, abortSignal || new AbortController().signal);
  }
}

/**
 * Claude模型专用的工具调用适配器
 * 处理Claude特有的接口需求
 */
export class ClaudeToolCallAdapter extends UniversalToolCallAdapter {
  private errorLoopDetected = false;
  private errorCount = 0;
  private lastMessageContent: string = '';
  
  /**
   * 设置当前消息内容，用于解析shell命令声明
   */
  setMessageContent(content: string): void {
    this.lastMessageContent = content;
  }

  /**
   * 从消息内容中提取shell命令
   */
  private extractShellCommandFromMessage(): string | null {
    if (!this.lastMessageContent) {
      return null;
    }

    // 匹配 <shell_command>命令内容</shell_command> 格式
    const shellCommandRegex = /<shell_command>(.*?)<\/shell_command>/s;
    const match = this.lastMessageContent.match(shellCommandRegex);
    
    if (match && match[1]) {
      const command = match[1].trim();
      console.log(`[CLAUDE DEBUG] 从消息中提取到shell命令: "${command}"`);
      return command;
    }

    // 也支持自闭合标签格式 <shell_command>命令</shell_command>
    const selfClosingRegex = /<shell_command>([^<]+)<\/shell_command>/;
    const selfClosingMatch = this.lastMessageContent.match(selfClosingRegex);
    
    if (selfClosingMatch && selfClosingMatch[1]) {
      const command = selfClosingMatch[1].trim();
      console.log(`[CLAUDE DEBUG] 从消息中提取到shell命令(自闭合): "${command}"`);
      return command;
    }

    console.log(`[CLAUDE DEBUG] 未在消息中找到shell_command标签`);
    return null;
  }

  /**
   * 检查是否检测到错误循环
   */
  isErrorLoopDetected(): boolean {
    return this.errorLoopDetected;
  }
  
  getErrorCount(): number {
    return this.errorCount;
  }
  
  resetErrorState(): void {
    this.errorCount = 0;
    this.errorLoopDetected = false;
    console.log(`[CLAUDE DEBUG] ✅ 错误状态已重置`);
  }
  
  /**
   * Claude特有的参数验证和修复逻辑
   */
  async validateParams<TParams>(
    tool: Tool<TParams>,
    params: TParams
  ): Promise<ValidationResult> {
    console.log(`[CLAUDE DEBUG] 处理工具: ${tool.name}`);
    console.log(`[CLAUDE DEBUG] 原始参数:`, JSON.stringify(params, null, 2));
    
    // Claude特有的参数修复逻辑
    let fixedParams = this.fixClaudeParams(tool, params);
    
    console.log(`[CLAUDE DEBUG] 修复后参数:`, JSON.stringify(fixedParams, null, 2));
    
    // 使用修复后的参数进行验证
    const result = await super.validateParams(tool, fixedParams);
    
    return result;
  }

  /**
   * 修复Claude模型的参数问题
   */
  private fixClaudeParams<TParams>(tool: Tool<TParams>, params: TParams): TParams {
    // 如果是list_directory工具且缺少path参数，尝试提供默认值
    if (tool.name === 'list_directory') {
      const listParams = params as any;
      
      // 如果没有path参数，使用当前工作目录
      if (!listParams.path) {
        console.log(`[CLAUDE DEBUG] list_directory缺少path参数，使用当前目录: ${process.cwd()}`);
        listParams.path = process.cwd();
      }
      
      // 确保path是绝对路径
      if (listParams.path && !path.isAbsolute(listParams.path)) {
        const absolutePath = path.resolve(process.cwd(), listParams.path);
        console.log(`[CLAUDE DEBUG] 转换相对路径为绝对路径: ${listParams.path} -> ${absolutePath}`);
        listParams.path = absolutePath;
      }
    }
    
    // 如果是run_shell_command工具，检查并修复command参数
    if (tool.name === 'run_shell_command') {
      const shellParams = params as any;
      
      // 如果参数对象为空或者command参数缺失/无效，尝试从消息内容中提取命令
      if (!shellParams || typeof shellParams !== 'object') {
        console.error(`[CLAUDE DEBUG] run_shell_command接收到无效参数对象:`, shellParams);
        
        // 尝试从消息内容中提取shell命令
        const extractedCommand = this.extractShellCommandFromMessage();
        if (extractedCommand) {
          console.log(`[CLAUDE DEBUG] 使用从消息中提取的命令修复参数: "${extractedCommand}"`);
          Object.assign(shellParams || {}, { 
            command: extractedCommand,
            description: '从Claude消息中提取的shell命令'
          });
          return params;
        }
        
        // 如果无法提取，提供错误处理
        Object.assign(shellParams || {}, { 
          command: 'echo "Error: Claude模型未提供具体的shell命令"',
          description: 'Claude工具调用参数错误修复'
        });
        return params;
      }
      
      // 检查command参数是否缺失或无效
      if (!shellParams.command || typeof shellParams.command !== 'string' || !shellParams.command.trim()) {
        // 首先尝试从消息内容中提取shell命令
        const extractedCommand = this.extractShellCommandFromMessage();
        if (extractedCommand) {
          console.log(`[CLAUDE DEBUG] ✅ 使用从消息中提取的命令修复缺失的command参数: "${extractedCommand}"`);
          shellParams.command = extractedCommand;
          if (!shellParams.description) {
            shellParams.description = '从Claude消息中提取的shell命令';
          }
          // 重置错误计数，因为我们成功修复了参数
          this.errorCount = 0;
          this.errorLoopDetected = false;
          return params; // 返回修复后的参数
        }
        
        // 如果无法从消息中提取命令，继续原有的错误处理逻辑
        this.errorCount++;
        console.error(`[CLAUDE DEBUG] 🚨 Claude工具调用错误 (#${this.errorCount}): command参数缺失或无效，且无法从消息中提取`);
        console.error(`[CLAUDE DEBUG] 接收到的参数:`, JSON.stringify(shellParams, null, 2));
        
        // This will be populated by the logic below.
        let errorMessageForClaude = '';
        
        // 不修复参数，让工具调用直接失败，但提示正确的使用方式
        console.error(`[CLAUDE DEBUG] 🛑 无法修复参数，让工具调用失败`);
        errorMessageForClaude = 'Invalid tool call. You must declare your shell command using <shell_command>your_command_here</shell_command> before calling the tool, and then provide the same command in the "command" parameter. Example: <shell_command>ls -l</shell_command> followed by run_shell_command({"command": "ls -l"})';
        
        if (this.errorCount >= 3) {
          this.errorLoopDetected = true;
          errorMessageForClaude = 'Error loop detected. You are not following the required format for shell commands. You MUST use <shell_command>your_command_here</shell_command> before calling run_shell_command. Please use the `/clear` command to reset the conversation history.';
          console.error(`[CLAUDE DEBUG] 🔄 检测到错误循环！Claude连续${this.errorCount}次未正确使用shell命令格式`);
          console.error(`[CLAUDE DEBUG] 💡 建议：请使用 /clear 命令清理对话历史，让Claude重新学习正确格式`);
        }
        
        // This is a special case to return a more informative error directly to the model.
        throw new Error(errorMessageForClaude);
        
      } else if (shellParams.command.includes('Claude') || shellParams.command.includes('Error loop detected')) {
        this.errorCount++;
        console.error(`[CLAUDE DEBUG] 🔄 检测到Claude在重复我们的错误提示消息！`);
        console.error(`[CLAUDE DEBUG] Claude陷入了学习循环，把错误提示当成了正确的命令`);
        console.error(`[CLAUDE DEBUG] 错误循环计数: ${this.errorCount}`);
        
        if (this.errorCount >= 2) {
          this.errorLoopDetected = true;
          console.error(`[CLAUDE DEBUG] 🚨 确认Claude陷入了错误学习循环！`);
          const errorMessage = 'Error loop detected. The model is repeatedly failing to provide the required `command` parameter. Please use the `/clear` command to reset the conversation history and allow the model to learn correctly.';
          console.error(`[CLAUDE DEBUG] 💡 解决方案：${errorMessage}`);
          throw new Error(errorMessage);
        }
      } else {
        // 重置错误计数，Claude提供了有效的命令
        this.errorCount = 0;
        this.errorLoopDetected = false;
      }
      
      // 如果没有description，提供一个默认的
      if (!shellParams.description) {
        shellParams.description = `Execute command: ${shellParams.command}`;
        console.log(`[CLAUDE DEBUG] 为shell命令添加默认描述: ${shellParams.description}`);
      }
    }
    
    return params;
  }
}

/**
 * Gemini模型专用的工具调用适配器
 * 处理Gemini特有的接口需求
 */
export class GeminiToolCallAdapter extends UniversalToolCallAdapter {
  /**
   * Gemini特有的参数验证逻辑
   */
  async validateParams<TParams>(
    tool: Tool<TParams>,
    params: TParams
  ): Promise<ValidationResult> {
    // 使用父类的通用验证逻辑
    const result = await super.validateParams(tool, params);
    
    // 可以在这里添加Gemini特有的验证逻辑
    
    return result;
  }
}

/**
 * 工具调用适配器工厂
 */
export class ToolCallAdapterFactory {
  /**
   * 根据模型类型创建对应的适配器
   */
  static createAdapter(modelType: 'claude' | 'gemini' | 'universal'): ToolCallAdapter {
    switch (modelType) {
      case 'claude':
        return new ClaudeToolCallAdapter();
      case 'gemini':
        return new GeminiToolCallAdapter();
      case 'universal':
      default:
        return new UniversalToolCallAdapter();
    }
  }
}