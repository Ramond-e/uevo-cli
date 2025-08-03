/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { BaseTool, Icon, ToolResult } from './tools.js';
import { Type } from '@google/genai';
import { Config } from '../config/config.js';
import { WebSearchTool, WebSearchToolParams } from './web-search.js';
import { SearchResultManager } from './search-cache/index.js';

/**
 * 增强版 WebSearchTool 参数
 */
export interface EnhancedWebSearchToolParams extends WebSearchToolParams {
  /**
   * 是否强制重新搜索（忽略缓存）
   */
  forceRefresh?: boolean;
  
  /**
   * 缓存过期时间（天）
   */
  cacheExpiryDays?: number;
}

/**
 * 增强版搜索结果
 */
export interface EnhancedWebSearchToolResult extends ToolResult {
  /** 是否来自缓存 */
  fromCache: boolean;
  /** 缓存命中率 */
  cacheHitRate: number;
  /** 提取的工具信息数量 */
  extractedToolsCount: number;
  /** 搜索性能信息 */
  performanceInfo: {
    searchTimeMs: number;
    cacheCheckTimeMs: number;
  };
}

/**
 * 增强版 Web 搜索工具
 * 集成了 SearchResultManager，支持智能缓存和工具信息提取
 */
export class EnhancedWebSearchTool extends BaseTool<
  EnhancedWebSearchToolParams,
  EnhancedWebSearchToolResult
> {
  static readonly Name: string = 'enhanced_web_search';
  
  private searchManager: SearchResultManager;
  private originalWebSearchTool: WebSearchTool;

  constructor(private readonly config: Config) {
    super(
      EnhancedWebSearchTool.Name,
      'Enhanced Web Search',
      'Performs intelligent web searches with caching and tool extraction. Automatically caches search results to avoid redundant searches and extracts structured tool information.',
      Icon.Globe,
      {
        type: Type.OBJECT,
        properties: {
          query: {
            type: Type.STRING,
            description: 'The search query to find information on the web.',
          },
          forceRefresh: {
            type: Type.BOOLEAN,
            description: 'Force a new search, ignoring cached results. Default: false',
          },
          cacheExpiryDays: {
            type: Type.NUMBER,
            description: 'Number of days before cached results expire. Default: 7',
          },
        },
        required: ['query'],
      },
    );

    this.searchManager = new SearchResultManager(config);
    this.originalWebSearchTool = new WebSearchTool(config);
  }

  /**
   * 验证参数
   */
  validateToolParams(params: EnhancedWebSearchToolParams): string | null {
    // 复用原始 WebSearchTool 的验证逻辑
    const baseValidation = this.originalWebSearchTool.validateToolParams(params);
    if (baseValidation) {
      return baseValidation;
    }

    // 验证增强参数
    if (params.cacheExpiryDays !== undefined && params.cacheExpiryDays < 0) {
      return 'cacheExpiryDays must be a positive number';
    }

    return null;
  }

  getDescription(params: EnhancedWebSearchToolParams): string {
    const cacheInfo = params.forceRefresh 
      ? ' (强制刷新缓存)' 
      : params.cacheExpiryDays 
        ? ` (缓存${params.cacheExpiryDays}天)` 
        : '';
    
    return `Enhanced web search for: "${params.query}"${cacheInfo}`;
  }

  async execute(
    params: EnhancedWebSearchToolParams,
    signal: AbortSignal,
  ): Promise<EnhancedWebSearchToolResult> {
    const startTime = Date.now();
    
    try {
      // 验证参数
      const validationError = this.validateToolParams(params);
      if (validationError) {
        return this.createErrorResult(validationError, startTime);
      }

      // 初始化搜索管理器
      await this.searchManager.initialize();
      const cacheCheckStart = Date.now();

      // 使用搜索管理器进行智能搜索
      const searchResult = await this.searchManager.searchTools({
        query: params.query,
        forceRefresh: params.forceRefresh || false,
        cacheExpiryDays: params.cacheExpiryDays || 7,
        maxResults: 1,
        relevanceThreshold: 0.3,
      });

      const cacheCheckTimeMs = Date.now() - cacheCheckStart;
      const totalTimeMs = Date.now() - startTime;

      if (searchResult.results.length === 0) {
        return this.createErrorResult('No search results found', startTime);
      }

      const cachedResult = searchResult.results[0];
      const extractedTools = cachedResult.extractedTools || [];

      // 格式化返回内容
      const displayContent = this.formatDisplayContent(cachedResult, searchResult.fromCache);
      const llmContent = this.formatLLMContent(cachedResult, searchResult.fromCache);

      return {
        summary: `Enhanced search completed: ${extractedTools.length} tools found`,
        llmContent,
        returnDisplay: displayContent,
        fromCache: searchResult.fromCache,
        cacheHitRate: searchResult.cacheHitRate,
        extractedToolsCount: extractedTools.length,
        performanceInfo: {
          searchTimeMs: totalTimeMs,
          cacheCheckTimeMs,
        },
      };

    } catch (error) {
      console.error('Enhanced web search error:', error);
      return this.createErrorResult(`Search failed: ${error}`, startTime);
    }
  }

  /**
   * 格式化显示内容
   */
  private formatDisplayContent(cachedResult: any, fromCache: boolean): string {
    const cacheIndicator = fromCache ? '📋 [从缓存获取]' : '🔍 [新搜索结果]';
    const tools = cachedResult.extractedTools || [];
    
    let content = `${cacheIndicator} 搜索完成\n\n`;
    content += `**查询**: ${cachedResult.originalQuery}\n`;
    content += `**摘要**: ${cachedResult.summary}\n\n`;

    if (tools.length > 0) {
      content += `**发现的工具** (${tools.length}个):\n`;
      for (const tool of tools) {
        content += `• **${tool.name}** (${tool.category})\n`;
        content += `  ${tool.description}\n`;
        if (tool.supportedLanguages.length > 0) {
          content += `  支持: ${tool.supportedLanguages.join(', ')}\n`;
        }
        content += '\n';
      }
    }

    // 显示原始搜索内容摘要
    if (cachedResult.searchResult?.llmContent) {
      content += `**详细信息**:\n${cachedResult.searchResult.llmContent}\n`;
    }

    return content;
  }

  /**
   * 格式化 LLM 内容
   */
  private formatLLMContent(cachedResult: any, fromCache: boolean): string {
    const tools = cachedResult.extractedTools || [];
    const cacheInfo = fromCache ? ' (from cache)' : ' (new search)';
    
    let content = `Enhanced web search results for "${cachedResult.originalQuery}"${cacheInfo}:\n\n`;
    
    // 添加工具信息
    if (tools.length > 0) {
      content += 'EXTRACTED TOOLS:\n';
      for (const tool of tools) {
        content += `- ${tool.name} (${tool.category}): ${tool.description}\n`;
      }
      content += '\n';
    }

    // 添加原始内容
    if (cachedResult.searchResult?.llmContent) {
      content += 'SEARCH CONTENT:\n';
      content += cachedResult.searchResult.llmContent;
    }

    return content;
  }

  /**
   * 创建错误结果
   */
  private createErrorResult(error: string, startTime: number): EnhancedWebSearchToolResult {
    return {
      summary: 'Enhanced search failed',
      llmContent: `Error: ${error}`,
      returnDisplay: `❌ 搜索失败: ${error}`,
      fromCache: false,
      cacheHitRate: 0,
      extractedToolsCount: 0,
      performanceInfo: {
        searchTimeMs: Date.now() - startTime,
        cacheCheckTimeMs: 0,
      },
    };
  }

  /**
   * 获取搜索管理器实例（供其他组件使用）
   */
  getSearchManager(): SearchResultManager {
    return this.searchManager;
  }

  /**
   * 获取缓存统计信息
   */
  async getCacheStats(): Promise<any> {
    await this.searchManager.initialize();
    return this.searchManager.getCacheStats();
  }

  /**
   * 清理过期缓存
   */
  async cleanupCache(expiryDays: number = 30): Promise<number> {
    await this.searchManager.initialize();
    return this.searchManager.cleanupExpiredCache(expiryDays);
  }

  /**
   * 按工具名搜索缓存
   */
  async searchCachedToolsByName(toolName: string): Promise<any[]> {
    await this.searchManager.initialize();
    return this.searchManager.searchByToolName(toolName);
  }

  /**
   * 按类别搜索缓存
   */
  async searchCachedToolsByCategory(category: string): Promise<any[]> {
    await this.searchManager.initialize();
    return this.searchManager.searchByCategory(category);
  }
}
