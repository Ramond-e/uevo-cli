# Claude Shell Command Fix Implementation Summary

## 问题描述

Claude模型系列的shell命令工具有一些问题，是不支持输入input参数导致的。需要通过提示词告知Claude想要运行shell命令时，需要在工具调用前先按照特定格式标明想要运行的shell命令。

## 解决方案

### 1. 修改Claude提示词系统 ✅

**文件**: `packages/core/src/core/claudePrompts.ts`

**修改内容**:
- 在系统提示词中添加了shell命令声明格式要求：`<shell_command>命令内容</shell_command>`
- 更新了所有shell命令相关的指导说明
- 提供了正确和错误的使用示例

**关键修改**:
```typescript
## run_shell_command Tool - MANDATORY RULES:
- **CRITICAL**: Before calling run_shell_command, you MUST declare your shell command using this exact format: <shell_command>your_actual_command_here</shell_command>
- **ALWAYS** provide the "command" parameter with actual command text
- **NEVER** call run_shell_command with empty object: run_shell_command({}) ❌
- **EXAMPLE**: For "cd到packages文件夹" → First write: <shell_command>ls packages</shell_command>, then call: run_shell_command({"command": "ls packages"})
```

### 2. 增强ClaudeToolCallAdapter ✅

**文件**: `packages/core/src/core/toolCallAdapter.ts`

**新增功能**:
1. **消息内容存储**: 添加了 `lastMessageContent` 属性用于存储当前处理的消息内容
2. **消息内容设置方法**: 新增 `setMessageContent(content: string)` 方法
3. **Shell命令提取功能**: 实现了 `extractShellCommandFromMessage()` 私有方法，支持两种格式：
   - 标准格式: `<shell_command>命令内容</shell_command>`
   - 自闭合格式: `<shell_command>命令</shell_command>`

**关键代码**:
```typescript
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

  // 也支持自闭合标签格式
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
```

### 3. 更新参数修复逻辑 ✅

**修改的核心逻辑**:
- 当检测到 `run_shell_command` 工具调用参数缺失或无效时
- 首先尝试从消息内容中提取shell命令
- 如果成功提取，自动修复参数并重置错误计数
- 如果无法提取，提供更有针对性的错误消息，指导Claude使用正确格式

**关键修复代码**:
```typescript
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
```

### 4. 集成到AnthropicClient ✅

**文件**: `packages/core/src/core/anthropicClient.ts`

**修改内容**:
- 在工具调用执行前，将用户消息内容传递给 `ClaudeToolCallAdapter`
- 支持普通消息发送和流式消息发送两种场景

**关键集成代码**:
```typescript
// 设置消息内容到工具调用适配器（用于shell命令提取）
if (this.toolCallAdapter instanceof ClaudeToolCallAdapter) {
  this.toolCallAdapter.setMessageContent(userMessage);
}

// 执行工具调用并收集结果
const toolResult = await this.executeToolCall(contentBlock);
```

## 工作流程

1. **用户发送消息**: 包含 `<shell_command>具体命令</shell_command>` 格式的shell命令声明
2. **消息内容传递**: `AnthropicClient` 将用户消息传递给 `ClaudeToolCallAdapter`
3. **Claude调用工具**: Claude发起 `run_shell_command` 工具调用（可能参数缺失）
4. **参数修复**: `ClaudeToolCallAdapter` 检测到参数问题，从消息内容中提取shell命令
5. **执行命令**: 使用修复后的参数正常执行shell命令

## 支持的格式

### 标准格式
```
<shell_command>ls -la</shell_command>
```

### 多行命令格式
```
<shell_command>
pwd && ls -la
</shell_command>
```

### 复杂命令格式
```
<shell_command>find . -name "*.js" | head -10</shell_command>
```

## 错误处理增强

- **智能修复**: 优先尝试从消息内容中提取命令来修复参数
- **错误循环检测**: 继续监控Claude的调用模式，防止无限循环
- **更好的错误消息**: 提供具体的格式使用指导
- **错误计数重置**: 成功修复后重置错误计数，避免误判

## 构建验证 ✅

项目已成功构建，没有编译错误，确认所有修改都是语法正确的。

## 总结

通过这个实现，我们解决了Claude模型在使用shell命令工具时的input参数问题：

1. **提示词指导**: 明确告诉Claude需要使用特定格式声明命令
2. **智能解析**: 系统能够从消息内容中提取shell命令
3. **自动修复**: 当工具调用参数缺失时，自动使用提取的命令进行修复
4. **错误恢复**: 改善了错误处理和循环检测机制

这个解决方案既保持了与现有代码的兼容性，又为Claude模型提供了一个可靠的shell命令执行机制。