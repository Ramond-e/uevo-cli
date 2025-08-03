# 搜索结果缓存管理器 (SearchResultManager)

## 概述

SearchResultManager 是一个智能缓存系统，用于存储和管理 WebSearchTool 的搜索结果，避免重复搜索相同内容，节省时间和 API 调用次数。

## 核心功能

### 🎯 **主要目标**
- **缓存 WebSearchTool 搜索结果** - 将搜索到的工具信息保存到本地
- **智能检索** - 快速查找之前搜索过的相关内容
- **避免重复搜索** - 减少 API 调用，提高响应速度
- **工具信息提取** - 从搜索结果中自动提取结构化的工具信息

### ✨ **核心特性**

1. **智能缓存匹配**
   - 基于关键词的模糊匹配
   - 相关性评分算法
   - 使用频率权重

2. **自动工具提取**
   - 从搜索文本中识别工具名称
   - 自动分类（formatter, testing, bundler等）
   - 提取工具描述和特性

3. **持久化存储**
   - 搜索结果保存到 `.uevo/search-cache/`
   - 跨会话数据恢复
   - 过期清理机制

4. **使用统计**
   - 跟踪搜索频率
   - 记录最后使用时间
   - 基于使用情况优化排序

## 使用场景

### 场景 1：用户询问工具推荐

```
用户: "推荐一些好用的代码格式化工具"

第一次:
1. SearchResultManager 检查缓存 → 未找到
2. 调用 WebSearchTool 搜索
3. 返回搜索结果并缓存
4. 提取工具信息: Prettier, ESLint, StandardJS...

第二次 (相同或类似问题):
1. SearchResultManager 检查缓存 → 找到匹配结果
2. 直接返回缓存结果 (无需 API 调用)
3. 更新使用统计
```

### 场景 2：工具特定查询

```
用户: "如何使用 Prettier 格式化代码？"

系统:
1. 在缓存中搜索包含 "Prettier" 的结果
2. 返回之前缓存的相关信息
3. 提供工具详细信息和使用方法
```

## 数据结构

### CachedSearchResult
```typescript
interface CachedSearchResult {
  id: string;                    // 唯一标识
  originalQuery: string;         // 原始查询
  keywords: string[];            // 提取的关键词
  timestamp: Date;               // 搜索时间
  searchResult: WebSearchToolResult;  // 原始搜索结果
  summary: string;               // 结果摘要
  extractedTools: ExtractedToolInfo[];  // 提取的工具信息
  usageCount: number;            // 使用次数
  lastUsed?: Date;              // 最后使用时间
  relevanceScore: number;        // 相关性评分
}
```

### ExtractedToolInfo
```typescript
interface ExtractedToolInfo {
  name: string;                  // 工具名称
  description: string;           // 工具描述
  category: string;              // 分类
  urls: string[];               // 相关链接
  usage?: string;               // 使用方法
  installation?: string;        // 安装方法
  features: string[];           // 功能特性
  supportedLanguages: string[]; // 支持的语言
}
```

## API 使用

### 基本使用

```typescript
import { SearchResultManager } from '@uevo/core/tools/search-cache';

const manager = new SearchResultManager(config);
await manager.initialize();

// 搜索工具（自动检查缓存）
const result = await manager.searchTools({
  query: "best JavaScript testing frameworks",
  cacheExpiryDays: 7,
  maxResults: 10
});

console.log(`Found ${result.results.length} results`);
console.log(`From cache: ${result.fromCache}`);
```

### 高级搜索选项

```typescript
const result = await manager.searchTools({
  query: "code formatter tools",
  forceRefresh: false,        // 是否强制重新搜索
  cacheExpiryDays: 30,       // 缓存有效期
  maxResults: 5,             // 最大结果数
  relevanceThreshold: 0.5    // 相关性阈值
});
```

### 特定工具搜索

```typescript
// 按工具名搜索
const prettierResults = manager.searchByToolName('prettier');

// 按类别搜索
const formatterTools = manager.searchByCategory('formatter');

// 获取缓存统计
const stats = manager.getCacheStats();
console.log(`Total tools: ${stats.totalTools}`);
```

## 工具分类系统

SearchResultManager 自动将发现的工具分类：

- **formatter** - 代码格式化工具 (Prettier, ESLint)
- **testing** - 测试框架 (Jest, Mocha, Cypress)  
- **bundler** - 打包工具 (Webpack, Rollup, Vite)
- **compiler** - 编译器 (Babel, TypeScript)
- **package_manager** - 包管理器 (npm, yarn, pnpm)
- **build_tool** - 构建工具 (Gulp, Grunt)
- **linter** - 代码检查工具 (ESLint, JSHint)
- **other** - 其他工具

## 缓存策略

### 匹配算法

相关性评分基于：
1. **精确关键词匹配** (+10分)
2. **部分关键词匹配** (+5分)  
3. **工具名匹配** (+15分)
4. **使用频率权重** (对数缩放)
5. **时间衰减** (新结果权重更高)

### 过期管理

- 默认缓存有效期：7天
- 自动清理过期缓存
- 可配置清理策略

### 存储位置

```
<targetDir>/.uevo/search-cache/
├── search_formatter_123456.json
├── search_testing_789012.json
└── ...
```

## 性能优化

1. **内存索引** - 关键词到结果ID的快速映射
2. **延迟加载** - 按需加载缓存文件
3. **批量操作** - 减少磁盘I/O
4. **压缩存储** - JSON格式优化

## 集成示例

### 与 AI Agent 集成

```typescript
// 在 AI 对话中使用
async function handleToolRequest(userQuery: string) {
  const manager = new SearchResultManager(config);
  
  // 首先检查缓存
  const cachedResults = await manager.searchTools({
    query: userQuery,
    relevanceThreshold: 0.4
  });
  
  if (cachedResults.fromCache && cachedResults.results.length > 0) {
    // 使用缓存结果
    return formatToolRecommendations(cachedResults.results[0].extractedTools);
  } else {
    // 新搜索结果已自动缓存
    return formatToolRecommendations(cachedResults.results[0].extractedTools);
  }
}
```

### 与 WebSearchTool 扩展

```typescript
class EnhancedWebSearchTool extends BaseTool {
  constructor(config: Config) {
    super(/* ... */);
    this.searchManager = new SearchResultManager(config);
  }

  async execute(params: WebSearchToolParams) {
    // 使用 SearchResultManager 而不是直接搜索
    const result = await this.searchManager.searchTools({
      query: params.query
    });
    
    return this.formatResults(result);
  }
}
```

## 维护和监控

### 缓存统计

```typescript
const stats = manager.getCacheStats();
console.log('Cache Statistics:', {
  totalResults: stats.totalResults,
  totalTools: stats.totalTools,
  averageUsage: stats.averageUsage,
  oldestResult: stats.oldestResult,
  newestResult: stats.newestResult
});
```

### 清理过期缓存

```typescript
// 清理30天前的缓存
const cleanedCount = await manager.cleanupExpiredCache(30);
console.log(`Cleaned ${cleanedCount} expired cache entries`);
```

## 注意事项

1. **缓存一致性** - 搜索结果可能随时间变化
2. **存储空间** - 长期使用需要定期清理
3. **隐私考虑** - 搜索历史存储在本地
4. **API 限制** - 缓存有助于避免频率限制

## 故障排除

### 常见问题

1. **缓存未生效**
   - 检查 `.uevo/search-cache/` 目录权限
   - 确认缓存未过期
   - 验证关键词匹配逻辑

2. **搜索结果不准确**
   - 调整相关性阈值
   - 检查工具提取逻辑
   - 更新关键词算法

3. **性能问题**
   - 定期清理过期缓存
   - 检查索引大小
   - 优化搜索算法

通过 SearchResultManager，uevo agent 可以提供更快速、更智能的工具推荐服务，同时减少对外部搜索API的依赖。
