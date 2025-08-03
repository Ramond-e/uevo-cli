/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import * as crypto from 'crypto';
import { Config } from '../../config/config.js';
import { WebSearchToolResult } from '../web-search.js';

/**
 * 缓存的搜索结果结构
 */
export interface CachedSearchResult {
  /** 唯一ID */
  id: string;
  /** 原始查询 */
  originalQuery: string;
  /** 查询关键词（用于匹配） */
  keywords: string[];
  /** 搜索时间 */
  timestamp: Date;
  /** WebSearchTool 的完整结果 */
  searchResult: WebSearchToolResult;
  /** 搜索结果的摘要 */
  summary: string;
  /** 提取的工具信息 */
  extractedTools: ExtractedToolInfo[];
  /** 使用次数 */
  usageCount: number;
  /** 最后使用时间 */
  lastUsed?: Date;
  /** 相关性评分 */
  relevanceScore: number;
}

/**
 * 从搜索结果中提取的工具信息
 */
export interface ExtractedToolInfo {
  /** 工具名称 */
  name: string;
  /** 工具描述 */
  description: string;
  /** 工具类别（如：formatter, linter, bundler等） */
  category: string;
  /** 相关链接 */
  urls: string[];
  /** 使用方法 */
  usage?: string;
  /** 安装方法 */
  installation?: string;
  /** 工具特性 */
  features: string[];
  /** 支持的语言/框架 */
  supportedLanguages: string[];
}

/**
 * 搜索选项
 */
export interface SearchOptions {
  /** 搜索查询 */
  query: string;
  /** 是否强制重新搜索（忽略缓存） */
  forceRefresh?: boolean;
  /** 缓存过期时间（天） */
  cacheExpiryDays?: number;
  /** 最大返回结果数 */
  maxResults?: number;
  /** 相关性阈值（0-1） */
  relevanceThreshold?: number;
}

/**
 * 搜索结果缓存和管理器
 * 主要功能：
 * 1. 缓存 WebSearchTool 的搜索结果
 * 2. 智能检索已缓存的结果
 * 3. 避免重复搜索，节省时间和API调用
 * 4. 提取和组织工具信息
 */
export class SearchResultManager {
  private cache: Map<string, CachedSearchResult> = new Map();
  private storageDir: string;
  private keywordIndex: Map<string, Set<string>> = new Map(); // keyword -> result IDs
  private initialized = false;

  constructor(private config: Config) {
    this.storageDir = path.join(config.getTargetDir(), '.uevo', 'search-cache');
  }

  /**
   * 初始化管理器
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      // 创建存储目录
      await fs.mkdir(this.storageDir, { recursive: true });

      // 加载已缓存的搜索结果
      await this.loadCachedResults();

      this.initialized = true;
      console.log(`[SearchResultManager] 初始化完成，已加载 ${this.cache.size} 个缓存结果`);
    } catch (error) {
      console.error('Failed to initialize SearchResultManager:', error);
      throw error;
    }
  }

  /**
   * 搜索工具（先查缓存，缓存未命中时使用 WebSearchTool）
   */
  async searchTools(options: SearchOptions): Promise<{
    results: CachedSearchResult[];
    fromCache: boolean;
    cacheHitRate: number;
  }> {
    await this.ensureInitialized();

    const { query, forceRefresh = false, cacheExpiryDays = 7, maxResults = 10, relevanceThreshold = 0.3 } = options;

    // 1. 如果不强制刷新，先查找缓存
    if (!forceRefresh) {
      const cachedResults = await this.searchInCache(query, {
        maxResults,
        relevanceThreshold,
        cacheExpiryDays
      });

      if (cachedResults.length > 0) {
        console.log(`[SearchResultManager] 缓存命中，返回 ${cachedResults.length} 个结果`);
        
        // 更新使用统计
        for (const result of cachedResults) {
          await this.updateUsageStats(result.id);
        }

        return {
          results: cachedResults,
          fromCache: true,
          cacheHitRate: 1.0
        };
      }
    }

    // 2. 缓存未命中，使用 WebSearchTool 搜索
    console.log(`[SearchResultManager] 缓存未命中，执行新搜索: "${query}"`);
    
    const toolRegistry = await this.config.getToolRegistry();
    if (!toolRegistry) {
      throw new Error('ToolRegistry not available');
    }
    
    const webSearchTool = toolRegistry.getTool('google_web_search');
    if (!webSearchTool) {
      throw new Error('WebSearchTool not available');
    }

    try {
      const searchResult = await webSearchTool.execute(
        { query },
        new AbortController().signal
      ) as WebSearchToolResult;

      // 3. 处理和缓存搜索结果
      const cachedResult = await this.cacheSearchResult(query, searchResult);

      return {
        results: [cachedResult],
        fromCache: false,
        cacheHitRate: 0.0
      };

    } catch (error) {
      console.error(`[SearchResultManager] 搜索失败: ${error}`);
      throw error;
    }
  }

  /**
   * 在缓存中搜索
   */
  private async searchInCache(query: string, options: {
    maxResults: number;
    relevanceThreshold: number;
    cacheExpiryDays: number;
  }): Promise<CachedSearchResult[]> {
    const now = new Date();
    const expiryMs = options.cacheExpiryDays * 24 * 60 * 60 * 1000;

    // Layer 1: 精确查询匹配（基于原始查询）
    for (const [id, result] of this.cache.entries()) {
      // 检查是否过期
      if (now.getTime() - result.timestamp.getTime() > expiryMs) {
        continue;
      }
      
      if (result.originalQuery === query) {
        console.log(`[SearchResultManager] 精确查询匹配: ${query}`);
        return [result];
      }
    }

    // Layer 2: 哈希匹配（处理相似查询）
    const currentId = this.generateId(query);
    const currentIdPrefix = currentId.split('_').slice(0, -1).join('_'); // 移除时间戳部分
    
    for (const [id, result] of this.cache.entries()) {
      // 检查是否过期
      if (now.getTime() - result.timestamp.getTime() > expiryMs) {
        continue;
      }
      
      const cachedIdPrefix = id.split('_').slice(0, -1).join('_'); // 移除时间戳部分
      if (cachedIdPrefix === currentIdPrefix) {
        console.log(`[SearchResultManager] 哈希匹配: ${cachedIdPrefix}`);
        return [result];
      }
    }

    // Layer 3: 关键词匹配（原有逻辑）
    const queryKeywords = this.extractKeywords(query);
    const candidates: Array<{ result: CachedSearchResult; score: number }> = [];

    for (const [id, result] of this.cache.entries()) {
      // 检查是否过期
      if (now.getTime() - result.timestamp.getTime() > expiryMs) {
        continue;
      }

      // 计算相关性分数
      const score = this.calculateRelevanceScore(queryKeywords, result);
      
      if (score >= options.relevanceThreshold) {
        candidates.push({ result, score });
      }
    }

    if (candidates.length > 0) {
      console.log(`[SearchResultManager] 关键词匹配分数: ${candidates[0].score}`);
      // 按相关性排序
      candidates.sort((a, b) => b.score - a.score);
      return candidates.slice(0, options.maxResults).map(c => c.result);
    }

    return [];
  }

  /**
   * 缓存搜索结果
   */
  private async cacheSearchResult(query: string, searchResult: WebSearchToolResult): Promise<CachedSearchResult> {
    const id = this.generateId(query);
    const keywords = this.extractKeywords(query);
    
    // 从搜索结果中提取工具信息
    const extractedTools = this.extractToolsFromResult(searchResult);
    
    const cachedResult: CachedSearchResult = {
      id,
      originalQuery: query,
      keywords,
      timestamp: new Date(),
      searchResult,
      summary: this.generateSummary(searchResult),
      extractedTools,
      usageCount: 1,
      lastUsed: new Date(),
      relevanceScore: 1.0 // 新结果默认最高相关性
    };

    // 保存到内存缓存
    this.cache.set(id, cachedResult);

    // 更新关键词索引
    this.updateKeywordIndex(keywords, id);

    // 持久化到磁盘
    await this.persistResult(cachedResult);

    console.log(`[SearchResultManager] 已缓存搜索结果: "${query}" -> ${extractedTools.length} 个工具`);
    
    return cachedResult;
  }

  /**
   * 从搜索结果中提取工具信息
   */
  private extractToolsFromResult(searchResult: WebSearchToolResult): ExtractedToolInfo[] {
    const tools: ExtractedToolInfo[] = [];
    const content = searchResult.llmContent.toString();
    
    // 使用正则表达式和关键词匹配提取工具信息
    // 这是一个简化版本，可以根据需要改进
    
    const toolPatterns = [
      // 匹配常见的工具名称格式
      /(?:^|\n)\s*\d*\.?\s*\*?\s*\*?([A-Z][a-zA-Z0-9\-_]*)\*?\s*[-:]?\s*([^\n\[]+)/gm,
      // 匹配带引号的工具名
      /"([a-zA-Z0-9\-_]+)"/g,
      // 匹配常见工具关键词
      /(prettier|eslint|webpack|babel|typescript|jest|mocha|gulp|grunt|npm|yarn|pnpm)/gi
    ];

    const foundTools = new Set<string>();
    const descriptions = new Map<string, string>();

    for (const pattern of toolPatterns) {
      let match;
      while ((match = pattern.exec(content)) !== null) {
        const toolName = match[1]?.trim().toLowerCase();
        const description = match[2]?.trim() || '';
        
        if (toolName && toolName.length > 1 && !foundTools.has(toolName)) {
          foundTools.add(toolName);
          descriptions.set(toolName, description);
        }
      }
    }

    // 从来源URL中提取附加信息
    const urls = searchResult.sources?.map(source => source.web?.uri || '').filter(Boolean) || [];

    // 创建工具信息对象
    for (const toolName of foundTools) {
      const tool: ExtractedToolInfo = {
        name: toolName,
        description: descriptions.get(toolName) || '',
        category: this.categorizeToolName(toolName),
        urls: urls.filter(url => url.toLowerCase().includes(toolName)),
        features: [],
        supportedLanguages: this.inferSupportedLanguages(content, toolName)
      };

      tools.push(tool);
    }

    return tools;
  }

  /**
   * 工具分类
   */
  private categorizeToolName(toolName: string): string {
    const categories = {
      'formatter': ['prettier', 'eslint', 'standardjs'],
      'bundler': ['webpack', 'rollup', 'parcel', 'vite'],
      'testing': ['jest', 'mocha', 'cypress', 'playwright'],
      'compiler': ['babel', 'typescript', 'tsc'],
      'package_manager': ['npm', 'yarn', 'pnpm'],
      'build_tool': ['gulp', 'grunt', 'make'],
      'linter': ['eslint', 'tslint', 'jshint']
    };

    for (const [category, tools] of Object.entries(categories)) {
      if (tools.some(tool => toolName.includes(tool))) {
        return category;
      }
    }

    return 'other';
  }

  /**
   * 推断支持的编程语言
   */
  private inferSupportedLanguages(content: string, toolName: string): string[] {
    const languages = [];
    const contentLower = content.toLowerCase();

    if (contentLower.includes('javascript') || contentLower.includes('js')) {
      languages.push('javascript');
    }
    if (contentLower.includes('typescript') || contentLower.includes('ts')) {
      languages.push('typescript');
    }
    if (contentLower.includes('python')) {
      languages.push('python');
    }
    if (contentLower.includes('java')) {
      languages.push('java');
    }
    if (contentLower.includes('css')) {
      languages.push('css');
    }
    if (contentLower.includes('html')) {
      languages.push('html');
    }

    return languages;
  }

  /**
   * 生成搜索结果摘要
   */
  private generateSummary(searchResult: WebSearchToolResult): string {
    const content = searchResult.llmContent.toString();
    const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 20);
    return sentences.slice(0, 3).join('. ') + (sentences.length > 3 ? '...' : '');
  }

  /**
   * 提取关键词
   */
  private extractKeywords(text: string): string[] {
    const words = text
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 2);

    // 过滤常见停用词
    const stopWords = new Set([
      'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
      'of', 'with', 'by', 'from', 'as', 'is', 'was', 'are', 'been', 'have',
      'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should',
      'can', 'may', 'might', 'must', 'need', 'want', 'find', 'search', 'tool', 'tools'
    ]);

    return words.filter(word => !stopWords.has(word));
  }

  /**
   * 计算相关性分数
   */
  private calculateRelevanceScore(queryKeywords: string[], cachedResult: CachedSearchResult): number {
    let score = 0;
    const resultKeywords = cachedResult.keywords;
    const toolNames = cachedResult.extractedTools.map(t => t.name.toLowerCase());

    // 关键词匹配
    for (const queryKeyword of queryKeywords) {
      // 精确匹配
      if (resultKeywords.includes(queryKeyword)) {
        score += 10;
      }
      
      // 部分匹配
      for (const resultKeyword of resultKeywords) {
        if (resultKeyword.includes(queryKeyword) || queryKeyword.includes(resultKeyword)) {
          score += 5;
        }
      }

      // 工具名匹配
      for (const toolName of toolNames) {
        if (toolName.includes(queryKeyword) || queryKeyword.includes(toolName)) {
          score += 15;
        }
      }
    }

    // 使用频率权重
    score *= Math.log(cachedResult.usageCount + 1);

    // 时间衰减（新的结果得分更高）
    const daysSinceCreated = (Date.now() - cachedResult.timestamp.getTime()) / (1000 * 60 * 60 * 24);
    score *= Math.exp(-daysSinceCreated * 0.1);

    return score / Math.max(queryKeywords.length, 1);
  }

  /**
   * 更新使用统计
   */
  private async updateUsageStats(resultId: string): Promise<void> {
    const result = this.cache.get(resultId);
    if (result) {
      result.usageCount++;
      result.lastUsed = new Date();
      await this.persistResult(result);
    }
  }

  /**
   * 更新关键词索引
   */
  private updateKeywordIndex(keywords: string[], resultId: string): void {
    for (const keyword of keywords) {
      if (!this.keywordIndex.has(keyword)) {
        this.keywordIndex.set(keyword, new Set());
      }
      this.keywordIndex.get(keyword)!.add(resultId);
    }
  }

  /**
   * 生成唯一ID
   */
  private generateId(query: string): string {
    const timestamp = Date.now();
    const hash = query.toLowerCase().replace(/[^\w]/g, '').slice(0, 20);
    
    // 如果哈希为空（比如纯中文查询），使用MD5哈希的前8位
    if (!hash || hash.length === 0) {
      const md5Hash = crypto.createHash('md5').update(query).digest('hex').slice(0, 8);
      return `search_${md5Hash}_${timestamp}`;
    }
    
    return `search_${hash}_${timestamp}`;
  }

  /**
   * 持久化结果到磁盘
   */
  private async persistResult(result: CachedSearchResult): Promise<void> {
    const filePath = path.join(this.storageDir, `${result.id}.json`);
    await fs.writeFile(filePath, JSON.stringify(result, null, 2));
  }

  /**
   * 加载已缓存的结果
   */
  private async loadCachedResults(): Promise<void> {
    try {
      const files = await fs.readdir(this.storageDir);
      
      for (const file of files) {
        if (file.endsWith('.json')) {
          try {
            const filePath = path.join(this.storageDir, file);
            const content = await fs.readFile(filePath, 'utf-8');
            const result: CachedSearchResult = JSON.parse(content);
            
            // 恢复日期对象
            result.timestamp = new Date(result.timestamp);
            if (result.lastUsed) {
              result.lastUsed = new Date(result.lastUsed);
            }
            
            this.cache.set(result.id, result);
            this.updateKeywordIndex(result.keywords, result.id);
          } catch (error) {
            console.error(`Failed to load cached result from ${file}:`, error);
          }
        }
      }
    } catch (error) {
      // 目录可能不存在，这是正常的
      if ((error as any).code !== 'ENOENT') {
        console.error('Failed to load cached results:', error);
      }
    }
  }

  /**
   * 获取缓存统计信息
   */
  getCacheStats(): {
    totalResults: number;
    totalTools: number;
    totalKeywords: number;
    averageUsage: number;
    oldestResult: Date | null;
    newestResult: Date | null;
  } {
    const results = Array.from(this.cache.values());
    const totalTools = results.reduce((sum, r) => sum + r.extractedTools.length, 0);
    const totalUsage = results.reduce((sum, r) => sum + r.usageCount, 0);
    
    const timestamps = results.map(r => r.timestamp);
    const oldestResult = timestamps.length > 0 ? new Date(Math.min(...timestamps.map(t => t.getTime()))) : null;
    const newestResult = timestamps.length > 0 ? new Date(Math.max(...timestamps.map(t => t.getTime()))) : null;

    return {
      totalResults: results.length,
      totalTools,
      totalKeywords: this.keywordIndex.size,
      averageUsage: results.length > 0 ? totalUsage / results.length : 0,
      oldestResult,
      newestResult
    };
  }

  /**
   * 清理过期缓存
   */
  async cleanupExpiredCache(expiryDays: number = 30): Promise<number> {
    const now = new Date();
    const expiryMs = expiryDays * 24 * 60 * 60 * 1000;
    let cleanedCount = 0;

    for (const [id, result] of this.cache.entries()) {
      if (now.getTime() - result.timestamp.getTime() > expiryMs) {
        // 从内存中删除
        this.cache.delete(id);
        
        // 从关键词索引中删除
        for (const keyword of result.keywords) {
          const idSet = this.keywordIndex.get(keyword);
          if (idSet) {
            idSet.delete(id);
            if (idSet.size === 0) {
              this.keywordIndex.delete(keyword);
            }
          }
        }

        // 从磁盘删除
        try {
          const filePath = path.join(this.storageDir, `${id}.json`);
          await fs.unlink(filePath);
        } catch (error) {
          console.error(`Failed to delete expired cache file for ${id}:`, error);
        }

        cleanedCount++;
      }
    }

    console.log(`[SearchResultManager] 清理了 ${cleanedCount} 个过期缓存`);
    return cleanedCount;
  }

  /**
   * 确保已初始化
   */
  private async ensureInitialized(): Promise<void> {
    if (!this.initialized) {
      await this.initialize();
    }
  }

  /**
   * 获取所有缓存的搜索结果
   */
  getAllCachedResults(): CachedSearchResult[] {
    return Array.from(this.cache.values());
  }

  /**
   * 根据工具名称搜索
   */
  searchByToolName(toolName: string): CachedSearchResult[] {
    const results: CachedSearchResult[] = [];
    
    for (const result of this.cache.values()) {
      if (result.extractedTools.some(tool => 
        tool.name.toLowerCase().includes(toolName.toLowerCase())
      )) {
        results.push(result);
      }
    }

    return results.sort((a, b) => b.relevanceScore - a.relevanceScore);
  }

  /**
   * 根据工具类别搜索
   */
  searchByCategory(category: string): CachedSearchResult[] {
    const results: CachedSearchResult[] = [];
    
    for (const result of this.cache.values()) {
      if (result.extractedTools.some(tool => tool.category === category)) {
        results.push(result);
      }
    }

    return results.sort((a, b) => b.usageCount - a.usageCount);
  }
}
