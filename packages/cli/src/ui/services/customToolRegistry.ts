/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import fs from 'node:fs';
import path from 'node:path';
import { CustomToolInfo, CustomToolRegistry, CustomToolAddDetails } from '../types/customTool.js';
import { getCurrentTestspacePath } from '../commands/testspaceCommand.js';

/**
 * 自定义工具注册表管理器
 */
export class CustomToolRegistryManager {
  private static readonly REGISTRY_FILENAME = 'custom-tools-registry.json';
  
  /**
   * 获取注册表文件路径
   */
  private static getRegistryPath(): string {
    const testspacePath = getCurrentTestspacePath();
    return path.join(testspacePath, this.REGISTRY_FILENAME);
  }

  /**
   * 确保testspace目录存在
   */
  private static ensureTestspaceExists(): void {
    const testspacePath = getCurrentTestspacePath();
    if (!fs.existsSync(testspacePath)) {
      fs.mkdirSync(testspacePath, { recursive: true });
    }
  }

  /**
   * 加载工具注册表
   */
  static loadRegistry(): CustomToolRegistry {
    const registryPath = this.getRegistryPath();
    
    if (!fs.existsSync(registryPath)) {
      return this.createDefaultRegistry();
    }

    try {
      const content = fs.readFileSync(registryPath, 'utf-8');
      const registry = JSON.parse(content) as CustomToolRegistry;
      
      // 验证注册表结构
      if (!registry.version || !Array.isArray(registry.tools)) {
        console.warn('Invalid registry format, creating new one');
        return this.createDefaultRegistry();
      }
      
      return registry;
    } catch (error) {
      console.error('Failed to load custom tool registry:', error);
      return this.createDefaultRegistry();
    }
  }

  /**
   * 保存工具注册表
   */
  static saveRegistry(registry: CustomToolRegistry): boolean {
    try {
      this.ensureTestspaceExists();
      const registryPath = this.getRegistryPath();
      
      registry.lastUpdated = new Date().toISOString();
      
      const content = JSON.stringify(registry, null, 2);
      fs.writeFileSync(registryPath, content, 'utf-8');
      
      return true;
    } catch (error) {
      console.error('Failed to save custom tool registry:', error);
      return false;
    }
  }

  /**
   * 创建默认注册表
   */
  private static createDefaultRegistry(): CustomToolRegistry {
    return {
      version: '1.0.0',
      lastUpdated: new Date().toISOString(),
      tools: []
    };
  }

  /**
   * 添加新工具到注册表
   */
  static addTool(toolDetails: CustomToolAddDetails): { success: boolean; id?: string; error?: string } {
    try {
      const registry = this.loadRegistry();
      
      // 检查是否已存在同名工具
      const existingTool = registry.tools.find(tool => tool.name === toolDetails.name);
      if (existingTool) {
        return {
          success: false,
          error: `工具 "${toolDetails.name}" 已存在于注册表中`
        };
      }

      // 生成唯一ID
      const id = this.generateToolId(toolDetails.name);
      
      // 创建工具信息
      const toolInfo: CustomToolInfo = {
        id,
        name: toolDetails.name,
        description: toolDetails.description,
        author: 'AI Assistant',
        createdAt: new Date().toISOString(),
        lastModified: new Date().toISOString(),
        version: '1.0.0',
        category: toolDetails.category || 'General',
        tags: toolDetails.tags || [],
        parameters: toolDetails.parameters,
        examples: toolDetails.examples || [],
        dependencies: [],
        status: 'active'
      };

      // 添加到注册表
      registry.tools.push(toolInfo);
      
      // 保存注册表
      const saved = this.saveRegistry(registry);
      
      if (saved) {
        return { success: true, id };
      } else {
        return { success: false, error: '保存注册表失败' };
      }
    } catch (error) {
      return {
        success: false,
        error: `添加工具失败: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }

  /**
   * 生成工具ID
   */
  private static generateToolId(name: string): string {
    const timestamp = Date.now().toString(36);
    const nameHash = name.toLowerCase().replace(/[^a-z0-9]/g, '').substring(0, 8);
    return `tool_${nameHash}_${timestamp}`;
  }

  /**
   * 获取所有工具
   */
  static getAllTools(): CustomToolInfo[] {
    const registry = this.loadRegistry();
    return registry.tools;
  }

  /**
   * 根据ID获取工具
   */
  static getToolById(id: string): CustomToolInfo | null {
    const registry = this.loadRegistry();
    return registry.tools.find(tool => tool.id === id) || null;
  }

  /**
   * 删除工具
   */
  static removeTool(id: string): boolean {
    try {
      const registry = this.loadRegistry();
      const index = registry.tools.findIndex(tool => tool.id === id);
      
      if (index === -1) {
        return false;
      }

      registry.tools.splice(index, 1);
      return this.saveRegistry(registry);
    } catch (error) {
      console.error('Failed to remove tool:', error);
      return false;
    }
  }

  /**
   * 更新工具状态
   */
  static updateToolStatus(id: string, status: CustomToolInfo['status']): boolean {
    try {
      const registry = this.loadRegistry();
      const tool = registry.tools.find(tool => tool.id === id);
      
      if (!tool) {
        return false;
      }

      tool.status = status;
      tool.lastModified = new Date().toISOString();
      
      return this.saveRegistry(registry);
    } catch (error) {
      console.error('Failed to update tool status:', error);
      return false;
    }
  }

  /**
   * 获取注册表统计信息
   */
  static getStats(): { total: number; active: number; inactive: number; deprecated: number } {
    const tools = this.getAllTools();
    return {
      total: tools.length,
      active: tools.filter(tool => tool.status === 'active').length,
      inactive: tools.filter(tool => tool.status === 'inactive').length,
      deprecated: tools.filter(tool => tool.status === 'deprecated').length
    };
  }

  /**
   * 按分类获取工具
   */
  static getToolsByCategory(): Record<string, CustomToolInfo[]> {
    const tools = this.getAllTools();
    const categories: Record<string, CustomToolInfo[]> = {};
    
    for (const tool of tools) {
      if (!categories[tool.category]) {
        categories[tool.category] = [];
      }
      categories[tool.category].push(tool);
    }
    
    return categories;
  }

  /**
   * 格式化工具列表为AI可读的文本
   * @param includeInactive 是否包含非活跃状态的工具
   * @returns 格式化的工具列表文本
   */
  static formatToolsForAI(includeInactive: boolean = false): string {
    const tools = this.getAllTools();
    const activeTools = includeInactive ? tools : tools.filter(tool => tool.status === 'active');
    
    if (activeTools.length === 0) {
      return '当前没有已注册的自定义工具。';
    }

    const categorizedTools = this.categorizeToolsForFormat(activeTools);
    let output = `# 可用的自定义工具列表 (共${activeTools.length}个)\n\n`;
    
    for (const [category, toolList] of Object.entries(categorizedTools)) {
      output += `## ${category}\n`;
      for (const tool of toolList) {
        output += `- **${tool.name}**: ${tool.description}`;
        if (tool.tags && tool.tags.length > 0) {
          output += ` [标签: ${tool.tags.join(', ')}]`;
        }
        if (tool.examples && tool.examples.length > 0) {
          output += ` [示例: ${tool.examples[0]}]`;
        }
        output += `\n`;
      }
      output += `\n`;
    }
    
    output += `\n**使用建议**: 在解决问题时，请优先考虑使用上述已存在的自定义工具，避免重复创建相似功能的工具。`;
    
    return output;
  }

  /**
   * 为格式化分类工具
   */
  private static categorizeToolsForFormat(tools: CustomToolInfo[]): Record<string, CustomToolInfo[]> {
    const categories: Record<string, CustomToolInfo[]> = {};
    
    for (const tool of tools) {
      const category = tool.category || 'General';
      if (!categories[category]) {
        categories[category] = [];
      }
      categories[category].push(tool);
    }
    
    return categories;
  }

  /**
   * 搜索工具
   * @param query 搜索关键词
   * @param includeInactive 是否包含非活跃状态的工具
   * @returns 匹配的工具列表
   */
  static searchTools(query: string, includeInactive: boolean = false): CustomToolInfo[] {
    const tools = this.getAllTools();
    const activeTools = includeInactive ? tools : tools.filter(tool => tool.status === 'active');
    
    if (!query || query.trim().length === 0) {
      return activeTools;
    }
    
    const searchTerm = query.toLowerCase().trim();
    
    return activeTools.filter(tool => {
      // 搜索名称、描述、分类和标签
      return (
        tool.name.toLowerCase().includes(searchTerm) ||
        tool.description.toLowerCase().includes(searchTerm) ||
        tool.category.toLowerCase().includes(searchTerm) ||
        tool.tags.some(tag => tag.toLowerCase().includes(searchTerm))
      );
    });
  }
}