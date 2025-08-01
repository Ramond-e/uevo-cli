# Claude 调试日志系统

## 概述

为了解决Claude模型在使用agent的shell工具时遇到的工具解析问题，我们实现了一个简单可靠的日志系统，将Claude模型的原始回复保存到本地文件，方便后期调试。

## 功能特点

- **简单可靠**: 最小化依赖，专注于核心功能
- **自动记录**: 无需手动干预，自动记录所有Claude响应
- **结构化输出**: 使用易读的文本格式，包含时间戳和上下文信息
- **错误处理**: 即使日志记录失败也不会影响主要功能

## 日志文件位置

所有日志文件保存在用户主目录下的 `claude-debug-logs` 文件夹中：

**Windows**: `C:\Users\[用户名]\claude-debug-logs\`
**macOS/Linux**: `~/claude-debug-logs/`

## 日志文件类型

### 1. Claude完整交互日志（推荐）
- **文件名格式**: `claude-interaction-YYYY-MM-DDTHH-MM-SS-sssZ.txt`
- **内容包含**:
  - 时间戳和模型信息
  - 用户消息
  - **发送给Claude的完整请求**（包括系统提示、对话历史、工具定义等）
  - **Claude的原始响应**（包括所有工具调用）
  - 完整的对话历史记录

### 2. 工具调用详细日志
- **文件名格式**: `claude-tool-[工具名]-YYYY-MM-DDTHH-MM-SS-sssZ.txt`
- **内容包含**:
  - 时间戳和工具名称
  - **Claude发送的原始工具调用对象**
  - 解析后的输入参数
  - 工具执行结果
  - 错误信息（如果有）

### 3. Claude响应日志（兼容性）
- **文件名格式**: `claude-response-YYYY-MM-DDTHH-MM-SS-sssZ.txt`
- **内容包含**:
  - 时间戳
  - 使用的模型
  - 用户消息
  - Claude的原始响应（JSON格式）
  - 工具调用信息

## 实现细节

### ClaudeResponseLogger 类

位于 `packages/core/src/core/anthropicClient.ts` 中，提供以下方法：

#### `logInteraction(request, response, context)` ✨ 新增
记录完整的Claude交互（请求+响应）
- `request`: 发送给Claude的完整请求参数
- `response`: Claude API返回的原始响应对象
- `context`: 上下文信息（用户消息、模型、对话历史等）

#### `logResponse(response, context)`
记录Claude API的原始响应（保持向后兼容）
- `response`: Claude API返回的原始响应对象
- `context`: 上下文信息（用户消息、模型、工具调用等）

#### `logToolCall(toolName, toolInput, toolResult, error, originalToolUse)` ✨ 增强
记录工具调用的详细信息
- `toolName`: 工具名称
- `toolInput`: 解析后的工具输入参数
- `toolResult`: 工具执行结果
- `error`: 错误信息（可选）
- `originalToolUse`: Claude发送的原始工具调用对象 ✨ 新增

### 集成位置

日志记录已集成到以下关键位置：

1. **完整交互记录**: 在 `sendMessage` 方法中，使用 `logInteraction` 记录完整的请求和响应 ✨
2. **工具调用执行**: 在 `executeToolCall` 方法中，记录每次工具调用的详细信息（包括原始工具调用对象）✨
3. **错误处理**: 在工具调用失败时记录完整的错误详情和上下文

## 使用示例

### 启用日志记录

日志记录功能已默认启用，无需额外配置。每次Claude模型响应或工具调用时，都会自动生成相应的日志文件。

### 查看日志

1. 打开日志目录：
   ```bash
   # Windows
   explorer %USERPROFILE%\claude-debug-logs
   
   # macOS
   open ~/claude-debug-logs
   
   # Linux
   ls ~/claude-debug-logs
   ```

2. 日志文件按时间戳排序，最新的文件在最前面

### 日志文件示例

#### Claude完整交互日志示例（新格式）✨
```
================================================================================
时间: 2025/1/15 21:52:39
模型: claude-3-5-sonnet-20241022
================================================================================

用户消息:
现在对你的shell工具进行测试，尝试cd到packages文件夹

========================================
发送给Claude的请求:
========================================
{
  "model": "claude-3-5-sonnet-20241022",
  "max_tokens": 4096,
  "temperature": 0.1,
  "messages": [
    {
      "role": "user",
      "content": "现在对你的shell工具进行测试，尝试cd到packages文件夹"
    }
  ],
  "tools": [
    {
      "name": "run_shell_command",
      "description": "This tool executes a given shell command...",
      "input_schema": {
        "type": "object",
        "properties": {
          "command": {
            "type": "string",
            "description": "Exact bash command to execute as `bash -c <command>`"
          },
          "description": {
            "type": "string",
            "description": "Brief description of the command for the user..."
          }
        },
        "required": ["command"]
      }
    }
  ],
  "system": "You are an AI coding assistant..."
}

========================================
Claude的原始响应:
========================================
{
  "id": "msg_123456",
  "type": "message",
  "role": "assistant",
  "content": [
    {
      "type": "text",
      "text": "我来帮你执行 cd 命令切换到 packages 文件夹。我会使用 run_shell_command 工具来执行这个操作。"
    },
    {
      "type": "tool_use",
      "id": "toolu_123",
      "name": "run_shell_command",
      "input": {}  // ← 这里是问题所在！Claude发送了空对象
    }
  ],
  "usage": {
    "input_tokens": 150,
    "output_tokens": 75
  }
}

========================================
对话历史记录:
========================================
[
  {
    "role": "user",
    "content": "现在对你的shell工具进行测试，尝试cd到packages文件夹"
  }
]

================================================================================
```

#### 工具调用详细日志示例（新格式）✨
```
================================================================================
时间: 2025/1/15 21:52:39
工具: run_shell_command
================================================================================

Claude发送的原始工具调用:
{
  "type": "tool_use",
  "id": "toolu_123",
  "name": "run_shell_command",
  "input": {}  // ← 问题根源：Claude发送了空的input对象
}

解析后的输入参数:
{}

执行结果:
N/A

错误信息:
"Command must be a non-empty string"

================================================================================
```

#### Claude响应日志示例（旧格式）
```
================================================================================
时间: 2025/1/15 21:44:31
模型: claude-3-5-sonnet-20241022
================================================================================

用户消息:
请列出当前目录的文件

========================================
原始Claude响应:
========================================
{
  "id": "msg_123456",
  "type": "message",
  "role": "assistant",
  "content": [
    {
      "type": "text",
      "text": "我将为您列出当前目录的文件。"
    },
    {
      "type": "tool_use",
      "id": "toolu_123",
      "name": "run_shell_command",
      "input": {
        "command": "ls -la",
        "description": "列出当前目录的详细信息"
      }
    }
  ],
  "usage": {
    "input_tokens": 150,
    "output_tokens": 75
  }
}

========================================
工具调用信息:
========================================
[
  {
    "id": "toolu_123",
    "name": "run_shell_command",
    "input": {
      "command": "ls -la",
      "description": "列出当前目录的详细信息"
    }
  }
]

================================================================================
```

#### 工具调用日志示例
```
================================================================================
时间: 2025/1/15 21:44:32
工具: run_shell_command
================================================================================

输入参数:
{
  "command": "ls -la",
  "description": "列出当前目录的详细信息"
}

执行结果:
{
  "llmContent": "total 24\ndrwxr-xr-x 5 user user 4096 Jan 15 10:30 .\ndrwxr-xr-x 3 user user 4096 Jan 15 10:00 ..\n-rw-r--r-- 1 user user 1024 Jan 15 10:30 test.txt",
  "isError": false
}

错误信息:
N/A

================================================================================
```

## 故障排除

### 常见问题

1. **日志目录不存在**
   - 系统会自动创建目录，如果失败会在控制台显示错误信息

2. **权限问题**
   - 确保应用程序有权限写入用户主目录

3. **磁盘空间不足**
   - 定期清理旧的日志文件，或移动到其他位置

### 禁用日志记录

如果需要临时禁用日志记录，可以注释掉相关的日志调用：

```typescript
// ClaudeResponseLogger.logResponse(response, context);
// ClaudeResponseLogger.logToolCall(toolName, toolInput, toolResult, error);
```

## 性能影响

- 日志记录采用同步写入，对性能影响最小
- 每个日志文件通常小于10KB
- 错误处理确保日志失败不会影响主要功能

## 维护建议

1. **定期清理**: 建议定期清理超过30天的日志文件
2. **监控大小**: 如果日志文件过大，考虑实现日志轮转
3. **备份重要日志**: 对于重要的调试信息，建议备份到其他位置

## 总结

这个简单可靠的日志系统专门为解决Claude模型工具解析问题而设计，提供了完整的调试信息，帮助开发者快速定位和解决问题。