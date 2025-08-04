# 自定义工具确认窗口测试指南

## 问题修复说明

### 修复的问题
用户反馈说AI回复中的`<custom_tool_add>`语法能被正确识别并清除，但确认窗口没有显示。

### 根本原因
1. **缺少Provider包装**：App.tsx中没有添加`CustomToolProvider`
2. **缺少状态获取**：App.tsx中没有从`useGeminiStream`获取自定义工具相关状态
3. **缺少UI渲染**：App.tsx中没有渲染`CustomToolAddConfirmationMessage`组件

### 修复内容

#### 1. 添加Provider和导入 (`packages/cli/src/ui/App.tsx`)
```tsx
// 新增导入
import { CustomToolProvider } from './contexts/CustomToolContext.js';
import { CustomToolAddConfirmationMessage } from './components/messages/CustomToolAddConfirmationMessage.js';

// 修改Provider嵌套
export const AppWrapper = (props: AppProps) => (
  <TodoProvider>
    <CustomToolProvider>          // 新增
      <SessionStatsProvider>
        <App {...props} />
      </SessionStatsProvider>
    </CustomToolProvider>         // 新增
  </TodoProvider>
);
```

#### 2. 获取自定义工具状态
```tsx
const {
  streamingState,
  submitQuery,
  initError,
  pendingHistoryItems: pendingGeminiHistoryItems,
  thought,
  // 新增的自定义工具状态
  pendingToolAdd,
  showCustomToolConfirmation,
  handleCustomToolConfirmation,
  cancelCustomToolConfirmation,
} = useGeminiStream(/* ... */);
```

#### 3. 渲染确认窗口
```tsx
{/* 新增的自定义工具确认窗口 */}
{showCustomToolConfirmation && pendingToolAdd && (
  <CustomToolAddConfirmationMessage
    toolDetails={pendingToolAdd}
    isFocused={isFocused}
    terminalWidth={mainAreaWidth}
    onConfirm={handleCustomToolConfirmation}
  />
)}
```

## 测试步骤

### 1. 启动应用
```bash
cd packages/cli
npm run build
npm start
```

### 2. 测试AI创建工具

向AI发送类似这样的请求：

```
请为我创建一个用于分析日志文件的工具
```

AI应该会响应类似这样的内容：

```
我来为你创建一个日志分析工具：

<custom_tool_add>
{
  "name": "Log File Analyzer",
  "description": "专门用于分析各种格式的日志文件，提取关键信息和模式",
  "category": "Analysis",
  "tags": ["logging", "analysis", "debugging"],
  "examples": [
    "分析Apache访问日志",
    "解析应用程序错误日志"
  ],
  "parameters": {
    "logFormat": "日志文件格式类型",
    "timeRange": "分析的时间范围"
  }
}
</custom_tool_add>

这个工具可以帮助你快速分析日志文件...
```

### 3. 验证确认窗口

1. **语法识别**：AI响应中的`<custom_tool_add>`标签应该被识别
2. **内容清理**：最终显示的回复中不应该包含`<custom_tool_add>`语法
3. **确认窗口显示**：应该弹出一个蓝色边框的确认窗口
4. **窗口内容**：确认窗口应该显示：
   - 工具名称：Log File Analyzer  
   - 描述：专门用于分析各种格式的日志文件...
   - 分类：Analysis
   - 标签：logging, analysis, debugging
   - 示例：分析Apache访问日志...
   - 参数：logFormat, timeRange

### 4. 验证交互功能

1. **键盘操作**：
   - ↑↓ 键可以在选项间切换
   - Enter 键确认选择
   - Esc 键取消操作

2. **选项功能**：
   - ✅ **添加到工具注册表**：应该保存工具并关闭窗口
   - ✏️ **修改工具信息**：暂时只是关闭窗口（未实现编辑功能）
   - ❌ **取消添加**：关闭窗口不保存

### 5. 验证工具保存

选择"添加到工具注册表"后：

1. **文件创建**：检查testspace目录是否创建了`custom-tools-registry.json`
2. **内容验证**：文件应该包含刚才添加的工具信息
3. **命令测试**：
   ```bash
   /custom_tools list
   /custom_tools stats
   /custom_tools show <tool_id>
   ```

## 期望的用户体验流程

1. **用户**：请AI创建工具
2. **AI**：响应包含`<custom_tool_add>`语法
3. **系统**：
   - 解析工具定义
   - 清理AI响应中的语法标签
   - 显示确认窗口
4. **用户**：通过键盘操作选择是否添加
5. **系统**：
   - 保存工具到注册表（如果选择添加）
   - 关闭确认窗口
   - 用户可通过命令管理工具

## 常见问题排查

### 确认窗口不显示
1. 检查控制台是否有错误日志
2. 确认`<custom_tool_add>`语法被正确识别（查看日志）
3. 验证`showCustomToolConfirmation`状态是否为true

### 工具保存失败
1. 检查testspace目录权限
2. 确认`getCurrentTestspacePath()`返回正确路径
3. 查看控制台错误信息

### 键盘操作无响应
1. 确认`isFocused`属性正确传递
2. 检查`RadioButtonSelect`组件是否正常工作

## 成功标志

✅ AI响应中的`<custom_tool_add>`语法被正确解析  
✅ 确认窗口正确显示工具信息  
✅ 键盘操作（↑↓Enter Esc）正常工作  
✅ 选择"添加"后工具被保存到注册表  
✅ `/custom_tools`命令可以查看已添加的工具  
✅ AI响应中的语法标签被正确清理

## 测试用例

### 测试用例1：JSON格式工具定义
```
请创建一个代码格式化工具

期望AI响应包含：
<custom_tool_add>
{
  "name": "Code Formatter",
  "description": "自动格式化各种编程语言的代码",
  "category": "Development",
  "tags": ["formatting", "code-quality"]
}
</custom_tool_add>
```

### 测试用例2：简单格式工具定义
```
请创建一个数据转换工具

期望AI响应包含：
<custom_tool_add>
name: Data Converter
description: 在不同数据格式间进行转换
category: Utility
tags: conversion, data
</custom_tool_add>
```

### 测试用例3：复杂工具定义
```
请创建一个性能监控工具

期望AI响应包含完整的参数和示例定义
```

通过这些测试，可以验证自定义工具确认窗口功能是否正常工作。