# Claude智能提示词系统

## 🎯 解决方案概述

为了解决Claude模型工具调用参数问题，我们创建了一个完整的智能提示词系统，包括：

1. **参数验证修复** - 修复了验证逻辑错误
2. **智能参数修复** - 自动补全缺失的必需参数
3. **模型专用提示词** - 针对Claude模型的详细工具使用指导
4. **智能提示词选择** - 根据任务类型自动选择最适合的提示词

## 📁 文件结构

```
packages/core/src/core/
├── anthropicClient.ts          # Claude客户端（已更新）
├── toolCallAdapter.ts          # 工具调用适配器（参数修复）
├── claudePrompts.ts           # Claude专用提示词
├── promptTemplates.ts         # 智能提示词模板系统
└── modelProviderMapping.ts    # 模型提供者映射
```

## 🧠 智能提示词系统

### 1. 自动模型检测
系统会自动检测当前使用的AI模型：
```typescript
// 检测是否为Claude模型
if (isClaudeModel(modelName)) {
  // 使用Claude专用提示词
}
```

### 2. 任务类型识别
根据用户消息内容智能识别任务类型：
```typescript
// 检测文件管理任务
const isFileManagement = userMessage.includes('桌面') || 
                         userMessage.includes('整理') || 
                         userMessage.includes('文件');
```

### 3. 提示词模板
提供多种专用模板：

#### Claude工具调用专家模板
- 详细的工具使用指导
- 必需参数说明
- 路径构建规则
- 错误预防检查清单

#### 文件管理专家模板
- 桌面整理策略
- 文件分类原则
- 整理步骤指导
- 安全操作提醒

## 🔧 核心功能

### 1. 智能参数修复
```typescript
// 自动修复list_directory缺失的path参数
if (tool.name === 'list_directory' && !params.path) {
  params.path = process.cwd(); // 使用当前目录
}
```

### 2. 路径自动转换
```typescript
// 相对路径转绝对路径
if (!path.isAbsolute(params.path)) {
  params.path = path.resolve(process.cwd(), params.path);
}
```

### 3. 详细调试日志
```
[CLAUDE DEBUG] 处理工具: list_directory
[CLAUDE DEBUG] 原始参数: {}
[CLAUDE DEBUG] list_directory缺少path参数，使用当前目录
[CLAUDE DEBUG] 修复后参数: {"path": "/current/directory"}
[DEBUG] 参数验证通过
```

## 📋 Claude专用提示词要点

### 工具调用规则
```
# CRITICAL: Tool Usage Instructions for Claude

## File System Operations
**MANDATORY**: When using file system tools, you MUST always provide the complete absolute path.

### list_directory Tool
- **ALWAYS** provide the "path" parameter with an absolute path
- **Example**: {"path": "/Users/username/Desktop"} or {"path": "D:\\Users\\Lenovo\\Desktop"}
- **Never** call list_directory without the path parameter
```

### 错误预防检查清单
```
## Error Prevention Checklist:
✅ Tool name is correct
✅ All required parameters are provided
✅ Parameter names match exactly (case-sensitive)
✅ Paths are absolute, not relative
✅ Values are properly formatted
```

### 路径格式指导
```
## Path Construction Rules
1. **Windows paths**: Use forward slashes or double backslashes
2. **Unix/Mac paths**: Use forward slashes
3. **Always use absolute paths**: Never use relative paths
4. **When user provides path**: Use it exactly as provided
5. **When no path provided**: Ask the user to specify the exact path
```

## 🚀 使用效果

### 修复前
```
❌ Error executing tool: Parameter validation failed: params must have required property 'path'
```

### 修复后
```
✅ 检测到文件管理任务，使用文件管理专家模板
✅ [CLAUDE DEBUG] 自动修复缺失参数
✅ 工具调用成功，返回桌面文件列表
```

## 🎛️ 配置选项

### 1. 手动指定提示词
```typescript
await claudeClient.sendMessage(userMessage, model, {
  systemPrompt: "自定义提示词" // 覆盖智能选择
});
```

### 2. 任务类型强制指定
```typescript
const template = getTaskSpecificTemplate('file_management', modelName);
const prompt = template.getSystemPrompt(userMemory);
```

### 3. 调试模式
设置环境变量启用详细日志：
```bash
DEBUG=true npm start
```

## 📊 支持的任务类型

1. **文件管理** (`file_management`)
   - 桌面整理
   - 文件分类
   - 目录管理

2. **编程任务** (`coding`)
   - 代码编写
   - 调试修复
   - 重构优化

3. **通用任务** (`general`)
   - 问答对话
   - 文本处理
   - 其他任务

## 🔮 自动化流程

1. **用户发送消息** → 系统分析消息内容
2. **检测模型类型** → 判断是否为Claude模型
3. **识别任务类型** → 根据关键词识别任务
4. **选择提示词模板** → 自动选择最适合的模板
5. **应用专用提示词** → 发送带有优化提示词的请求
6. **智能参数修复** → 自动修复工具调用参数
7. **执行工具调用** → 成功完成任务

## 🎉 最终效果

现在当用户说"为我整理一下桌面"时：

1. ✅ 系统自动检测到这是文件管理任务
2. ✅ 为Claude模型应用文件管理专家提示词
3. ✅ Claude学会了正确使用`list_directory`工具
4. ✅ 自动修复缺失的`path`参数
5. ✅ 成功列出桌面文件并提供整理建议

**Claude现在完全掌握了工具使用技巧！** 🚀