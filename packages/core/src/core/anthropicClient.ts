/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import Anthropic from '@anthropic-ai/sdk';
import { Config } from '../config/config.js';
import { ToolRegistry } from '../tools/tool-registry.js';
import { reportError } from '../utils/errorReporting.js';
import { getErrorMessage } from '../utils/errors.js';
import { retryWithBackoff } from '../utils/retry.js';
import { ProxyAgent, setGlobalDispatcher } from 'undici';
import { Turn, ServerGeminiStreamEvent, GeminiEventType, ToolCallRequestInfo, ToolCallResponseInfo } from './turn.js';
import { LoopDetectionService } from '../services/loopDetectionService.js';
import { ToolCallAdapterFactory, type ToolCallAdapter, ClaudeToolCallAdapter } from './toolCallAdapter.js';
import { getSimpleSystemPrompt } from './promptTemplates.js';
import fs from 'fs';
import path from 'path';
import os from 'os';

/**
 * 简单的Claude响应日志记录器
 * 将Claude的原始请求和响应保存到本地文件，方便调试
 */
class ClaudeResponseLogger {
  private static logDir: string = path.join(os.homedir(), 'claude-debug-logs');

  /**
   * 确保日志目录存在
   */
  private static ensureLogDir(): void {
    try {
      if (!fs.existsSync(this.logDir)) {
        fs.mkdirSync(this.logDir, { recursive: true });
      }
    } catch (error) {
      console.error('[Claude Logger] 创建日志目录失败:', error);
    }
  }

  /**
   * 记录完整的Claude交互（请求+响应）
   * @param request 发送给Claude的请求参数
   * @param response Claude API的原始响应
   * @param context 上下文信息
   */
  static logInteraction(request: any, response: any, context: { userMessage?: string; model?: string; conversationHistory?: any[] } = {}): void {
    try {
      this.ensureLogDir();
      
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `claude-interaction-${timestamp}.txt`;
      const filepath = path.join(this.logDir, filename);
      
      const logContent = [
        '='.repeat(80),
        `时间: ${new Date().toLocaleString('zh-CN')}`,
        `模型: ${context.model || 'unknown'}`,
        '='.repeat(80),
        '',
        '用户消息:',
        context.userMessage || 'N/A',
        '',
        '='.repeat(40),
        '发送给Claude的请求:',
        '='.repeat(40),
        JSON.stringify(request, null, 2),
        '',
        '='.repeat(40),
        'Claude的原始响应:',
        '='.repeat(40),
        JSON.stringify(response, null, 2),
        '',
        '='.repeat(40),
        '对话历史记录:',
        '='.repeat(40),
        context.conversationHistory ? JSON.stringify(context.conversationHistory, null, 2) : 'N/A',
        '',
        '='.repeat(80),
        ''
      ].join('\n');
      
      fs.writeFileSync(filepath, logContent, { encoding: 'utf8' });
      console.log(`[Claude Logger] 完整交互已保存到: ${filepath}`);
    } catch (error) {
      console.error('[Claude Logger] 保存交互日志失败:', error);
    }
  }

  /**
   * 记录Claude的原始响应（保持向后兼容）
   * @param response Claude API的原始响应
   * @param context 上下文信息（如工具调用、用户消息等）
   */
  static logResponse(response: any, context: { userMessage?: string; toolCalls?: any[]; model?: string } = {}): void {
    try {
      this.ensureLogDir();
      
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `claude-response-${timestamp}.txt`;
      const filepath = path.join(this.logDir, filename);
      
      const logContent = [
        '='.repeat(80),
        `时间: ${new Date().toLocaleString('zh-CN')}`,
        `模型: ${context.model || 'unknown'}`,
        '='.repeat(80),
        '',
        '用户消息:',
        context.userMessage || 'N/A',
        '',
        '='.repeat(40),
        '原始Claude响应:',
        '='.repeat(40),
        JSON.stringify(response, null, 2),
        '',
        '='.repeat(40),
        '工具调用信息:',
        '='.repeat(40),
        context.toolCalls ? JSON.stringify(context.toolCalls, null, 2) : 'N/A',
        '',
        '='.repeat(80),
        ''
      ].join('\n');
      
      fs.writeFileSync(filepath, logContent, { encoding: 'utf8' });
      console.log(`[Claude Logger] 响应已保存到: ${filepath}`);
    } catch (error) {
      console.error('[Claude Logger] 保存日志失败:', error);
    }
  }

  /**
   * 记录工具调用相关的调试信息
   * @param toolName 工具名称
   * @param toolInput 工具输入参数
   * @param toolResult 工具执行结果
   * @param error 错误信息（如果有）
   * @param originalToolUse Claude发送的原始工具调用对象
   */
  static logToolCall(toolName: string, toolInput: any, toolResult?: any, error?: any, originalToolUse?: any): void {
    try {
      this.ensureLogDir();
      
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `claude-tool-${toolName}-${timestamp}.txt`;
      const filepath = path.join(this.logDir, filename);
      
      const logContent = [
        '='.repeat(80),
        `时间: ${new Date().toLocaleString('zh-CN')}`,
        `工具: ${toolName}`,
        '='.repeat(80),
        '',
        'Claude发送的原始工具调用:',
        originalToolUse ? JSON.stringify(originalToolUse, null, 2) : 'N/A',
        '',
        '解析后的输入参数:',
        JSON.stringify(toolInput, null, 2),
        '',
        '执行结果:',
        toolResult ? JSON.stringify(toolResult, null, 2) : 'N/A',
        '',
        '错误信息:',
        error ? (typeof error === 'string' ? error : JSON.stringify(error, Object.getOwnPropertyNames(error), 2)) : 'N/A',
        '',
        '='.repeat(80),
        ''
      ].join('\n');
      
      fs.writeFileSync(filepath, logContent, { encoding: 'utf8' });
      console.log(`[Claude Logger] 工具调用日志已保存到: ${filepath}`);
    } catch (logError) {
      console.error('[Claude Logger] 保存工具调用日志失败:', logError);
    }
  }
}

// Anthropic API 相关类型定义
interface AnthropicToolDefinition {
  name: string;
  description: string;
  input_schema: {
    type: 'object';
    properties: Record<string, any>;
    required?: string[];
  };
}

interface AnthropicMessage {
  role: 'user' | 'assistant';
  content: string | Anthropic.MessageParam['content'];
}

interface AnthropicToolUse {
  type: 'tool_use';
  id: string;
  name: string;
  input: any;
}

interface AnthropicToolResult {
  type: 'tool_result';
  tool_use_id: string;
  content: string;
  is_error?: boolean;
}

export interface AnthropicStreamEvent {
  type: 'content_block_start' | 'content_block_delta' | 'content_block_stop' | 'message_start' | 'message_delta' | 'message_stop';
  index?: number;
  content_block?: {
    type: 'text' | 'tool_use';
    text?: string;
    id?: string;
    name?: string;
    input?: any;
  };
  delta?: {
    type: 'text_delta' | 'input_json_delta';
    text?: string;
    partial_json?: string;
  };
  message?: {
    id: string;
    type: 'message';
    role: 'assistant';
    content: any[];
    model: string;
    stop_reason: string | null;
    stop_sequence: string | null;
    usage: {
      input_tokens: number;
      output_tokens: number;
    };
  };
  usage?: {
    input_tokens: number;
    output_tokens: number;
  };
}

/**
 * Anthropic Claude API客户端
 * 支持Claude系列模型的工具调用功能
 */
export class AnthropicClient {
  private client: Anthropic;
  private toolRegistry?: ToolRegistry;
  private readonly loopDetector: LoopDetectionService;
  private conversationHistory: AnthropicMessage[] = [];
  private readonly toolCallAdapter: ToolCallAdapter;

  // Claude模型列表
  public static readonly CLAUDE_MODELS = {
    // Claude 4 Models (Latest Generation)
    OPUS_4: 'claude-opus-4-20250514',
    SONNET_4: 'claude-sonnet-4-20250514',
    
    // Claude 4 Aliases
    OPUS_4_LATEST: 'claude-opus-4-0',
    SONNET_4_LATEST: 'claude-sonnet-4-0',
    
    // Claude 3.7 Models
    SONNET_3_7: 'claude-3-7-sonnet-20250219',
    
    // Claude 3.5 Models  
    SONNET_3_5: 'claude-3-5-sonnet-20241022',
    HAIKU_3_5: 'claude-3-5-haiku-20241022',
    
    // Claude 3 Models
    OPUS_3: 'claude-3-opus-20240229',
    SONNET_3: 'claude-3-sonnet-20240229',
    HAIKU_3: 'claude-3-haiku-20240307',
  } as const;

  constructor(private config: Config) {
    // 设置代理
    if (config.getProxy()) {
      setGlobalDispatcher(new ProxyAgent(config.getProxy() as string));
    }

    // 初始化Anthropic客户端
    const apiKey = this.getAnthropicApiKey();
    this.client = new Anthropic({
      apiKey,
      maxRetries: 3,
      timeout: 60000, // 60秒超时
      // 添加默认头部来确保正确的权限设置
      defaultHeaders: {
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
    });

    this.loopDetector = new LoopDetectionService(config);
    this.toolCallAdapter = ToolCallAdapterFactory.createAdapter('claude');
    
    console.log('[AnthropicClient] ✅ Anthropic客户端初始化完成');
  }

  /**
   * 获取Anthropic API密钥
   */
  private getAnthropicApiKey(): string {
    // 从环境变量或配置中获取API密钥
    const apiKey = this.config.getAnthropicApiKey() || process.env.ANTHROPIC_API_KEY;
    
    if (!apiKey) {
      throw new Error(
        'Anthropic API密钥未配置。请设置ANTHROPIC_API_KEY环境变量或在配置中指定。'
      );
    }
    
    console.log(`[AnthropicClient] ✅ API密钥已加载，长度: ${apiKey.length}`);
    return apiKey;
  }

  /**
   * 初始化工具注册表
   */
  async initialize(): Promise<void> {
    this.toolRegistry = await this.config.getToolRegistry();
  }

  /**
   * 检查是否已初始化
   */
  isInitialized(): boolean {
    return this.toolRegistry !== undefined;
  }

  /**
   * 将内部工具转换为Anthropic工具定义
   */
  private convertToolsToAnthropicFormat(): AnthropicToolDefinition[] {
    if (!this.toolRegistry) {
      return [];
    }

    const tools: AnthropicToolDefinition[] = [];
    
    for (const [index, tool] of this.toolRegistry.getAllTools().entries()) {
      try {
        const schema = tool.schema;
        
        // 调试日志：输出原始schema
        if (this.config.getDebugMode()) {
          console.log(`\n=== 工具 ${index}: ${tool.name} ===`);
          console.log('原始schema:', JSON.stringify(schema, null, 2));
        }
        
        // 转换为Anthropic工具格式
        const convertedSchema = this.convertGeminiSchemaToAnthropicSchema(schema.parameters || {});
        
        // 调试日志：输出转换后的schema
        if (this.config.getDebugMode()) {
          console.log('转换后schema:', JSON.stringify(convertedSchema, null, 2));
        }
        
        const anthropicTool: AnthropicToolDefinition = {
          name: tool.name,
          description: schema.description || `Execute ${tool.name} tool`,
          input_schema: convertedSchema,
        };
        
        // 验证转换后的schema
        this.validateAnthropicSchema(anthropicTool.input_schema, tool.name, index);
        
        tools.push(anthropicTool);
        
        if (this.config.getDebugMode()) {
          console.log(`✓ 工具 ${tool.name} schema转换成功`);
        }
      } catch (error) {
        console.error(`❌ 工具 ${tool.name} (索引${index}) schema转换失败:`, error);
        // 跳过有问题的工具，继续处理其他工具
        continue;
      }
    }
    
    console.log(`📊 成功转换 ${tools.length} 个工具的schema`);
    return tools;
  }

  /**
   * 将Gemini schema格式转换为Anthropic JSON Schema格式
   */
  private convertGeminiSchemaToAnthropicSchema(geminiSchema: any): any {
    if (!geminiSchema || typeof geminiSchema !== 'object') {
      return geminiSchema;
    }

    const result: any = {};

    // 确保schema有type字段（JSON Schema draft 2020-12要求）
    if (geminiSchema.type !== undefined) {
      if (typeof geminiSchema.type === 'string') {
        result.type = geminiSchema.type.toLowerCase();
      } else {
        // 处理Gemini的Type枚举值，转换为符合JSON Schema的字符串
        const typeMap: Record<string, string> = {
          'OBJECT': 'object',
          'STRING': 'string', 
          'NUMBER': 'number',
          'INTEGER': 'integer',
          'BOOLEAN': 'boolean',
          'ARRAY': 'array',
          'NULL': 'null'
        };
        result.type = typeMap[String(geminiSchema.type)] || 'object';
      }
    } else {
      // 如果没有type，根据其他属性推断
      if (geminiSchema.properties) {
        result.type = 'object';
      } else if (geminiSchema.items) {
        result.type = 'array';
      } else {
        result.type = 'object'; // 默认
      }
    }

    // 处理properties（对象类型）
    if (geminiSchema.properties && typeof geminiSchema.properties === 'object') {
      result.properties = {};
      for (const [propKey, propValue] of Object.entries(geminiSchema.properties)) {
        result.properties[propKey] = this.convertGeminiSchemaToAnthropicSchema(propValue);
      }
    }

    // 处理required字段
    if (Array.isArray(geminiSchema.required)) {
      result.required = [...geminiSchema.required];
    }

    // 处理数组items
    if (geminiSchema.items) {
      result.items = this.convertGeminiSchemaToAnthropicSchema(geminiSchema.items);
    }

    // 处理enum
    if (Array.isArray(geminiSchema.enum)) {
      result.enum = [...geminiSchema.enum];
    }

    // 处理数值约束
    if (typeof geminiSchema.minimum === 'number') {
      result.minimum = geminiSchema.minimum;
    }
    if (typeof geminiSchema.maximum === 'number') {
      result.maximum = geminiSchema.maximum;
    }

    // 处理字符串约束
    if (typeof geminiSchema.minLength === 'number') {
      result.minLength = geminiSchema.minLength;
    }
    if (typeof geminiSchema.maxLength === 'number') {
      result.maxLength = geminiSchema.maxLength;
    }
    if (typeof geminiSchema.pattern === 'string') {
      result.pattern = geminiSchema.pattern;
    }

    // 处理数组约束
    if (typeof geminiSchema.minItems === 'number') {
      result.minItems = geminiSchema.minItems;
    }
    if (typeof geminiSchema.maxItems === 'number') {
      result.maxItems = geminiSchema.maxItems;
    }
    if (typeof geminiSchema.uniqueItems === 'boolean') {
      result.uniqueItems = geminiSchema.uniqueItems;
    }

    // 处理描述和其他元数据
    if (typeof geminiSchema.description === 'string') {
      result.description = geminiSchema.description;
    }
    if (typeof geminiSchema.title === 'string') {
      result.title = geminiSchema.title;
    }
    if (geminiSchema.default !== undefined) {
      result.default = geminiSchema.default;
    }

    // 处理组合schemas
    if (Array.isArray(geminiSchema.anyOf)) {
      result.anyOf = geminiSchema.anyOf.map((item: any) => this.convertGeminiSchemaToAnthropicSchema(item));
    }
    if (Array.isArray(geminiSchema.oneOf)) {
      result.oneOf = geminiSchema.oneOf.map((item: any) => this.convertGeminiSchemaToAnthropicSchema(item));
    }
    if (Array.isArray(geminiSchema.allOf)) {
      result.allOf = geminiSchema.allOf.map((item: any) => this.convertGeminiSchemaToAnthropicSchema(item));
    }

    // 处理format字段（只保留标准格式）
    if (typeof geminiSchema.format === 'string') {
      const supportedFormats = new Set([
        'date-time', 'date', 'time', 'email', 'hostname', 'ipv4', 'ipv6', 'uri', 'uuid'
      ]);
      if (supportedFormats.has(geminiSchema.format)) {
        result.format = geminiSchema.format;
      }
    }

    // 确保schema至少有type字段
    if (!result.type) {
      result.type = 'object';
    }

    return result;
  }

  /**
   * 验证Anthropic schema格式
   */
  private validateAnthropicSchema(schema: any, toolName: string, index: number): void {
    if (!schema || typeof schema !== 'object') {
      throw new Error(`Schema不是有效的对象: ${typeof schema}`);
    }

    // 检查必需的字段
    if (!schema.type) {
      throw new Error('缺少type字段');
    }

    // 检查type是否是有效的JSON Schema类型
    const validTypes = ['object', 'array', 'string', 'number', 'integer', 'boolean', 'null'];
    if (!validTypes.includes(schema.type)) {
      throw new Error(`无效的type值: ${schema.type}`);
    }

    // 递归验证properties
    if (schema.properties) {
      if (typeof schema.properties !== 'object') {
        throw new Error('properties必须是对象');
      }
      
      for (const [propName, propSchema] of Object.entries(schema.properties)) {
        try {
          this.validateAnthropicSchema(propSchema, `${toolName}.${propName}`, index);
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          throw new Error(`属性 ${propName} 验证失败: ${errorMessage}`);
        }
      }
    }

    // 验证required字段
    if (schema.required && !Array.isArray(schema.required)) {
      throw new Error('required必须是数组');
    }

    // 验证items（用于数组类型）
    if (schema.items) {
      try {
        this.validateAnthropicSchema(schema.items, `${toolName}[]`, index);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        throw new Error(`数组items验证失败: ${errorMessage}`);
      }
    }

    // 检查不支持的字段
    const unsupportedFields = [];
    for (const key of Object.keys(schema)) {
      const supportedFields = new Set([
        'type', 'properties', 'required', 'items', 'enum', 'const',
        'minimum', 'maximum', 'minLength', 'maxLength', 'pattern',
        'minItems', 'maxItems', 'uniqueItems', 'anyOf', 'oneOf', 'allOf',
        'description', 'title', 'default', 'examples',
        'additionalProperties', 'patternProperties', 'format'
      ]);
      
      if (!supportedFields.has(key)) {
        unsupportedFields.push(key);
      }
    }

    if (unsupportedFields.length > 0) {
      throw new Error(`包含不支持的字段: ${unsupportedFields.join(', ')}`);
    }
  }

  /**
   * 处理工具调用
   */
  private async executeToolCall(
    toolUse: AnthropicToolUse,
    abortSignal?: AbortSignal
  ): Promise<AnthropicToolResult> {
    if (!this.toolRegistry) {
      const errorResult: AnthropicToolResult = {
        type: 'tool_result' as const,
        tool_use_id: toolUse.id,
        content: 'Error: Tool registry not initialized',
        is_error: true,
      };
      
      // 记录工具调用失败
      ClaudeResponseLogger.logToolCall(toolUse.name, toolUse.input, null, 'Tool registry not initialized', toolUse);
      
      return errorResult;
    }

    try {
      const tool = this.toolRegistry.getTool(toolUse.name);
      if (!tool) {
        const errorResult: AnthropicToolResult = {
          type: 'tool_result' as const,
          tool_use_id: toolUse.id,
          content: `Error: Tool "${toolUse.name}" not found`,
          is_error: true,
        };
        
        // 记录工具调用失败
        ClaudeResponseLogger.logToolCall(toolUse.name, toolUse.input, null, `Tool "${toolUse.name}" not found`, toolUse);
        
        return errorResult;
      }

      // 使用工具调用适配器执行工具 - 统一处理验证、确认和执行
      const result = await this.toolCallAdapter.executeCall(tool, toolUse.input, abortSignal);
      
      const successResult: AnthropicToolResult = {
        type: 'tool_result' as const,
        tool_use_id: toolUse.id,
        content: typeof result.llmContent === 'string' 
          ? result.llmContent 
          : JSON.stringify(result.llmContent) || 'Tool executed successfully',
        is_error: false,
      };
      
      // 记录成功的工具调用
      ClaudeResponseLogger.logToolCall(toolUse.name, toolUse.input, result, null, toolUse);
      
      return successResult;

    } catch (error) {
      const errorMessage = getErrorMessage(error);
      reportError(error, `Tool execution failed for ${toolUse.name}`);
      
      const errorResult: AnthropicToolResult = {
        type: 'tool_result' as const,
        tool_use_id: toolUse.id,
        content: `Error executing tool: ${errorMessage}`,
        is_error: true,
      };
      
      // 记录工具调用错误
      ClaudeResponseLogger.logToolCall(toolUse.name, toolUse.input, null, error, toolUse);
      
      return errorResult;
    }
  }

  /**
   * 发送消息并处理工具调用
   */
  async sendMessage(
    userMessage: string,
    model: string = AnthropicClient.CLAUDE_MODELS.SONNET_3_5,
    options: {
      maxTokens?: number;
      temperature?: number;
      stream?: boolean;
      systemPrompt?: string;
      maxToolCalls?: number;
    } = {}
  ): Promise<{
    content: string;
    toolCalls?: any[];
    usage?: { input_tokens: number; output_tokens: number };
  }> {
    if (!this.isInitialized()) {
      await this.initialize();
    }

    const {
      maxTokens = 4096,
      temperature = 0.1,
      stream = false,
      systemPrompt,
      maxToolCalls = 10,
    } = options;

    // 添加用户消息到历史记录
    this.conversationHistory.push({
      role: 'user',
      content: userMessage,
    });

    const tools = this.convertToolsToAnthropicFormat();
    let toolCallCount = 0;
    let finalResponse = '';
    const allToolCalls: any[] = [];

    try {
      while (toolCallCount < maxToolCalls) {
        console.log(`[CLAUDE DEBUG] 开始第${toolCallCount + 1}轮对话，历史记录长度: ${this.conversationHistory.length}`);
        
        // 验证和清理消息历史
        const cleanedHistory = this.validateAndCleanHistory();
        console.log(`[CLAUDE DEBUG] 清理后的历史记录长度: ${cleanedHistory.length}`);
        
        // 暂时禁用工具以测试基础功能
        const requestParams: Anthropic.MessageCreateParams = {
          model,
          max_tokens: maxTokens,
          temperature,
          messages: cleanedHistory as Anthropic.MessageParam[],
          // tools: tools.length > 0 ? tools : undefined,  // 暂时注释掉
        };

        // 使用简化的提示词选择器，根据模型类型选择对应的提示词
        const smartPrompt = systemPrompt || getSimpleSystemPrompt(model, this.config.getUserMemory());
        if (smartPrompt) {
          requestParams.system = smartPrompt;
          
          // 强制日志记录系统提示词
          console.log('='.repeat(80));
          console.log('🔴🔴🔴 [FORCE DEBUG] SENDING SYSTEM PROMPT TO CLAUDE 🔴🔴🔴');
          console.log('='.repeat(80));
          console.log(smartPrompt);
          console.log('='.repeat(80));
          console.log(`[CLAUDE DEBUG] ✅ 系统提示词已设置，长度: ${smartPrompt.length} 字符`);
          console.log(`[CLAUDE DEBUG] 提示词预览: ${smartPrompt.substring(0, 200)}...`);
        } else {
          console.warn(`[CLAUDE DEBUG] ⚠️ 没有设置系统提示词！`);
        }

        console.log(`[CLAUDE DEBUG] 发送请求到Anthropic API，工具数量: ${tools.length}`);
        
        // 发送请求到Anthropic API
        const response = await retryWithBackoff(
          () => this.client.messages.create(requestParams)
        );
        
        console.log(`[CLAUDE DEBUG] 收到响应，内容块数量: ${(response as Anthropic.Message).content.length}`);
        
        // 记录完整的Claude交互（请求+响应）到本地文件
        ClaudeResponseLogger.logInteraction(requestParams, response, {
          userMessage: userMessage,
          model: model,
          conversationHistory: this.conversationHistory
        });

        // 处理响应
        let hasToolUse = false;
        const assistantContent: any[] = [];
        let currentResponse = '';
        const toolResults: any[] = [];
        
        for (const contentBlock of (response as Anthropic.Message).content) {
          if (contentBlock.type === 'text') {
            currentResponse += contentBlock.text;
            assistantContent.push(contentBlock);
          } else if (contentBlock.type === 'tool_use') {
            hasToolUse = true;
            assistantContent.push(contentBlock);
            allToolCalls.push({
              id: contentBlock.id,
              name: contentBlock.name,
              input: contentBlock.input,
            });

            // Pass the assistant's response content to the adapter for parsing
            if (this.toolCallAdapter instanceof ClaudeToolCallAdapter) {
              this.toolCallAdapter.setMessageContent(currentResponse);
            }

            // 执行工具调用并收集结果
            const toolResult = await this.executeToolCall(contentBlock);
            toolResults.push(toolResult);
            toolCallCount++;
          }
        }

        // 如果有工具调用，添加助手消息和工具结果到历史记录，然后继续循环
        if (hasToolUse) {
          console.log(`[CLAUDE DEBUG] 检测到工具调用，工具数量: ${toolResults.length}`);
          
          this.conversationHistory.push({
            role: 'assistant',
            content: assistantContent,
          });
          
          this.conversationHistory.push({
            role: 'user',
            content: toolResults,
          });
          
          console.log(`[CLAUDE DEBUG] 工具结果已添加到历史记录，继续循环获取Claude的响应`);
          // 继续循环让Claude基于工具结果生成响应
          continue;
        } else {
          // 没有工具调用，累积最终响应
          console.log(`[CLAUDE DEBUG] 没有工具调用，最终响应: ${currentResponse.substring(0, 100)}...`);
          finalResponse += currentResponse;
        }

        // 如果没有工具调用，结束循环
        if (!hasToolUse) {
          // 添加最终的助手响应到历史记录
          this.conversationHistory.push({
            role: 'assistant',
            content: finalResponse,
          });
          
          return {
            content: finalResponse,
            toolCalls: allToolCalls.length > 0 ? allToolCalls : undefined,
            usage: (response as Anthropic.Message).usage,
          };
        }
      }

      // 如果达到最大工具调用次数
      return {
        content: finalResponse + '\n\n[注意：已达到最大工具调用次数限制]',
        toolCalls: allToolCalls,
      };

    } catch (error: any) {
      console.error(`[AnthropicClient] ❌ API调用失败:`, error);
      
      // 详细错误信息记录
      if (error?.status) {
        console.error(`[AnthropicClient] HTTP状态码: ${error.status}`);
      }
      if (error?.error) {
        console.error(`[AnthropicClient] API错误详情:`, error.error);
      }
      
      const errorMessage = getErrorMessage(error);
      reportError(error, 'Anthropic API call failed');
      
      // 为403错误提供特殊处理
      if (error?.status === 403) {
        throw new Error(`权限被拒绝 (403): 请检查您的Anthropic API密钥是否有效，以及是否有足够的权限访问所请求的模型 "${model}"。可能的原因：1. API密钥无效或过期 2. 没有访问该模型的权限 3. 账户配额不足`);
      } else if (error?.status === 401) {
        throw new Error(`认证失败 (401): 请检查您的Anthropic API密钥是否正确设置。当前API密钥长度: ${this.getAnthropicApiKey().length}`);
      } else {
        throw new Error(`Anthropic API调用失败: ${errorMessage}`);
      }
    }
  }

  /**
   * 流式发送消息
   */
  async *streamMessage(
    userMessage: string,
    model: string = AnthropicClient.CLAUDE_MODELS.SONNET_3_5,
    options: {
      maxTokens?: number;
      temperature?: number;
      systemPrompt?: string;
      prompt_id?: string;
    } = {}
  ): AsyncGenerator<ServerGeminiStreamEvent, void, unknown> {
    if (!this.isInitialized()) {
      await this.initialize();
    }

    const {
      maxTokens = 4096,
      temperature = 0.1,
      systemPrompt,
      prompt_id = 'claude-stream',
    } = options;

    // 添加用户消息到历史记录
    this.conversationHistory.push({
      role: 'user',
      content: userMessage,
    });

    const tools = this.convertToolsToAnthropicFormat();

    try {
      console.log(`[AnthropicClient] 🚀 准备发送流式请求到Claude API`);
      console.log(`[AnthropicClient] 模型: ${model}, 工具数量: ${tools.length}`);
      console.log(`[AnthropicClient] API密钥长度: ${this.getAnthropicApiKey().length}`);
      
      // 验证和清理消息历史
      const cleanedHistory = this.validateAndCleanHistory();
      console.log(`[AnthropicClient] 流式请求 - 清理后的历史记录长度: ${cleanedHistory.length}`);
      
      // 暂时禁用工具以测试基础功能
      const requestParams: Anthropic.MessageCreateParams = {
        model,
        max_tokens: maxTokens,
        temperature,
        messages: cleanedHistory as Anthropic.MessageParam[],
        // tools: tools.length > 0 ? tools : undefined,  // 暂时注释掉
        stream: true,
      };

      // Use the smart prompt selector for streaming as well
      const smartPrompt = systemPrompt || getSimpleSystemPrompt(model, this.config.getUserMemory());
      if (smartPrompt) {
        requestParams.system = smartPrompt;
        console.log(`[AnthropicClient] ✅ 系统提示词已设置，长度: ${smartPrompt.length}`);
      }

      console.log(`[AnthropicClient] 📤 发送请求参数:`, {
        model: requestParams.model,
        max_tokens: requestParams.max_tokens,
        temperature: requestParams.temperature,
        messages_count: requestParams.messages?.length || 0,
        tools_count: requestParams.tools?.length || 0,
        has_system: !!requestParams.system,
        stream: requestParams.stream,
      });

      const stream = await this.client.messages.create(requestParams) as AsyncIterable<Anthropic.MessageStreamEvent>;
      
      console.log(`[AnthropicClient] ✅ 流式连接已建立`);
      
      // 记录完整的Claude交互（请求）- 流式版本
      // 注意：流式响应需要在结束时记录完整响应
      console.log(`[Claude Logger] 开始流式请求，将在完成时记录完整交互`);
      
      let currentContent = '';
      let toolUses: AnthropicToolUse[] = [];
      let streamResponse: any = null;  // 用于记录完整的流式响应

      for await (const event of stream) {
        switch (event.type) {
          case 'message_start':
            // 记录消息开始事件，构建响应对象
            streamResponse = {
              id: event.message?.id || 'stream_msg',
              type: 'message',
              role: 'assistant',
              content: [],
              usage: event.message?.usage || {}
            };
            
            yield {
              type: GeminiEventType.Content,
              value: '',
            };
            break;

          case 'content_block_start':
            if (event.content_block?.type === 'text') {
              // 开始文本内容块
            } else if (event.content_block?.type === 'tool_use') {
              // 开始工具使用块
              toolUses.push({
                type: 'tool_use',
                id: event.content_block.id!,
                name: event.content_block.name!,
                input: event.content_block.input || {},
              });
            }
            break;

          case 'content_block_delta':
            if (event.delta?.type === 'text_delta' && event.delta.text) {
              currentContent += event.delta.text;
              yield {
                type: GeminiEventType.Content,
                value: event.delta.text,
              };
            }
            break;

          case 'content_block_stop':
            // 内容块结束
            break;

          case 'message_stop':
            // 1. Construct the assistant's message from the content blocks received
            const assistantMessageContent: (Anthropic.TextBlockParam | Anthropic.ToolUseBlockParam)[] = [];
            if (currentContent) {
                assistantMessageContent.push({ type: 'text', text: currentContent });
            }
            if (toolUses.length > 0) {
                assistantMessageContent.push(...toolUses);
            }

            // 2. Add the assistant's turn to history, if it's not empty
            if (assistantMessageContent.length > 0) {
                this.conversationHistory.push({
                    role: 'assistant',
                    content: assistantMessageContent,
                });
            }

            // 3. If there were tools to use, execute them and add their results to history
            if (toolUses.length > 0) {
                const toolResults = [];
                for (const toolUse of toolUses) {
                    // Yield the request event to the UI
                    yield {
                      type: GeminiEventType.ToolCallRequest,
                      value: {
                        callId: toolUse.id,
                        name: toolUse.name,
                        args: toolUse.input,
                        isClientInitiated: false,
                        prompt_id: prompt_id,
                      },
                    };

                    // Set content for our shell command fix
                    if (this.toolCallAdapter instanceof ClaudeToolCallAdapter) {
                      this.toolCallAdapter.setMessageContent(currentContent);
                    }

                    // Execute the tool and collect the result for history
                    const toolResult = await this.executeToolCall(toolUse);
                    toolResults.push(toolResult);
                    
                    // Yield the response event to the UI
                    yield {
                      type: GeminiEventType.ToolCallResponse,
                      value: {
                        callId: toolUse.id,
                        responseParts: [{
                          functionResponse: {
                            id: toolUse.id,
                            name: toolUse.name,
                            response: { content: toolResult.content },
                          },
                        }],
                        resultDisplay: toolResult.content,
                        error: toolResult.is_error ? new Error(toolResult.content) : undefined,
                      },
                    };
                }
                
                // Add the tool results as a user message to the conversation history
                this.conversationHistory.push({
                    role: 'user',
                    content: toolResults as any,
                });
            }
            
            // Reconstruct the logging logic
            if (streamResponse) {
                streamResponse.content = assistantMessageContent;
                ClaudeResponseLogger.logInteraction(requestParams, streamResponse, {
                  userMessage: userMessage,
                  model: model,
                  conversationHistory: this.conversationHistory
                });
            }

            // 4. Signal that the turn is finished
            yield {
              type: GeminiEventType.Finished,
              value: 'STOP' as any,
            };
            break;
        }
      }

    } catch (error: any) {
      console.error(`[AnthropicClient] ❌ 流式调用失败:`, error);
      
      // 详细错误信息记录
      if (error?.status) {
        console.error(`[AnthropicClient] HTTP状态码: ${error.status}`);
      }
      if (error?.error) {
        console.error(`[AnthropicClient] API错误详情:`, error.error);
      }
      if (error?.headers) {
        console.error(`[AnthropicClient] 响应头:`, error.headers);
      }
      
      const errorMessage = getErrorMessage(error);
      reportError(error, 'Anthropic streaming failed');
      
      // 为403错误提供特殊处理
      let userFriendlyMessage = `Anthropic流式调用失败: ${errorMessage}`;
      if (error?.status === 403) {
        userFriendlyMessage = `权限被拒绝 (403): 请检查您的Anthropic API密钥是否有效，以及是否有足够的权限访问所请求的模型。`;
      } else if (error?.status === 401) {
        userFriendlyMessage = `认证失败 (401): 请检查您的Anthropic API密钥是否正确设置。`;
      }
      
      yield {
        type: GeminiEventType.Error,
        value: {
          error: {
            message: userFriendlyMessage,
          },
        },
      };
    }
  }

  /**
   * 清除对话历史
   */
  clearHistory(): void {
    this.conversationHistory = [];
    
    // 如果使用了Claude适配器，重置其错误状态
    if (this.toolCallAdapter instanceof ClaudeToolCallAdapter) {
      this.toolCallAdapter.resetErrorState();
      console.log(`[CLAUDE DEBUG] 🔄 对话历史已清理，Claude适配器错误状态已重置`);
    }
  }

  /**
   * 验证和清理消息历史，确保符合Anthropic API要求
   */
  private validateAndCleanHistory(): AnthropicMessage[] {
    if (this.conversationHistory.length === 0) {
      return [];
    }

    const cleanedHistory: AnthropicMessage[] = [];
    let lastRole: 'user' | 'assistant' | null = null;

    for (const message of this.conversationHistory) {
      // 跳过连续的相同角色消息
      if (message.role !== lastRole) {
        // 确保消息内容是字符串格式
        const content = typeof message.content === 'string' 
          ? message.content 
          : JSON.stringify(message.content);
        
        cleanedHistory.push({
          role: message.role,
          content: content,
        });
        lastRole = message.role;
      } else {
        console.log(`[AnthropicClient] 跳过连续的 ${message.role} 消息`);
      }
    }

    // 确保历史以用户消息开始
    while (cleanedHistory.length > 0) {
      const firstMessage = cleanedHistory[0];
      if (firstMessage && firstMessage.role !== 'user') {
        console.log(`[AnthropicClient] 移除开头的非用户消息: ${firstMessage.role}`);
        cleanedHistory.shift();
      } else {
        break;
      }
    }

    return cleanedHistory;
  }

  /**
   * 获取对话历史
   */
  getHistory(): AnthropicMessage[] {
    return [...this.conversationHistory];
  }

  /**
   * 检查模型是否为Claude模型
   */
  static isClaudeModel(model: string): boolean {
    return model.startsWith('claude-');
  }

  /**
   * 获取推荐的Claude模型
   */
  static getRecommendedModel(task: 'general' | 'coding' | 'analysis' | 'creative'): string {
    switch (task) {
      case 'coding':
        return AnthropicClient.CLAUDE_MODELS.SONNET_3_5;
      case 'analysis':
        return AnthropicClient.CLAUDE_MODELS.OPUS_3;
      case 'creative':
        return AnthropicClient.CLAUDE_MODELS.SONNET_3_5;
      default:
        return AnthropicClient.CLAUDE_MODELS.SONNET_3_5;
    }
  }
}