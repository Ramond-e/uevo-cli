# Claude Prompt 更新总结

## 📝 更新概述

为了配合 `run_shell_command` 工具的错误修复，我们更新了提供给 Claude 大模型的系统提示词，以防止类似问题再次发生。

## 🔄 更新内容

### 1. 新增规则
在 **Essential Rules** 部分添加了：
```
4. **NEVER** call run_shell_command without the "command" parameter
```

### 2. 改进工具参数示例
更新了 `run_shell_command` 的参数示例：
```
// 更新前
- run_shell_command: {"command": "command to run"}

// 更新后  
- run_shell_command: {"command": "command to run", "description": "what the command does"}
```

### 3. 新增专门的 Shell 命令指导
添加了完整的 **Shell Command Guidelines** 部分：

```markdown
## Shell Command Guidelines:
For run_shell_command tool:
- **ALWAYS** provide the "command" parameter with actual command text
- **NEVER** call run_shell_command with empty parameters {}
- **RECOMMENDED** provide "description" parameter explaining what the command does
- Examples of correct usage:
  - run_shell_command({"command": "ls -la", "description": "List all files"})
  - run_shell_command({"command": "mkdir folder", "description": "Create folder"})
  - run_shell_command({"command": "echo 'hello'", "description": "Print hello"})
```

### 4. 更新错误预防检查清单
在 **Error Prevention Checklist** 中添加了：
```
✅ Shell commands have actual command text, not empty strings
```

## 🎯 更新目的

1. **预防错误**：明确告诉 Claude 必须提供 `command` 参数
2. **提供示例**：给出正确的工具调用示例
3. **强调重要性**：多次强调不能使用空参数调用工具
4. **改善用户体验**：鼓励提供 `description` 参数以提高可读性

## 📁 修改的文件

- `packages/core/src/core/claudePrompts.ts` - Claude 系统提示词文件

## 🔧 技术实现

更新了以下函数：
- `getClaudeToolGuidance()` - 添加了新的指导规则和示例
- `getClaudeCompleteSystemPrompt()` - 自动包含更新后的工具指导

## 🎉 预期效果

通过这些 prompt 更新，Claude 模型将：

1. **更少出错**：明确知道必须提供 `command` 参数
2. **更好的工具调用**：提供更完整的参数信息
3. **更清晰的意图**：通过 `description` 参数说明命令目的
4. **更一致的行为**：遵循明确的工具调用规范

## 🚀 使用建议

现在 Claude 模型应该能够：
- 正确调用 `run_shell_command` 工具
- 提供必要的参数
- 避免空参数调用
- 生成更有意义的命令描述

---

**更新时间**: 2025年1月27日  
**版本**: v1.0  
**状态**: ✅ 已应用并构建