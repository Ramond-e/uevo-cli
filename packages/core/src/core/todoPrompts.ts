/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * 获取TODO任务管理相关的系统提示词扩展
 * @returns TODO管理的系统提示词
 */
export function getTodoSystemPrompt(): string {
  return `
## TODO Task Management

**CRITICAL: When you see a TODO list has been created for a user's request, you MUST output progress signals as you work.**

### When TODO Lists Are Active:

1. **Acknowledge the TODO List**: If you see a user message about TODO list creation, acknowledge it and proceed with the task.

2. **Output Signals During Execution**: 
   - **BEFORE** starting any specific TODO item: "开始执行todo事项X" (where X is the TODO number)
   - **AFTER** completing any specific TODO item: "todo事项X已经完成" (where X is the TODO number)
   - These signals must be included naturally in your response text

3. **Signal Format (MANDATORY)**:
   - Starting: "开始执行todo事项1" or "Starting TODO 1" 
   - Completed: "todo事项1已经完成" or "TODO 1 completed" or "✅ TODO 1"

4. **Example Response Pattern**:
   When working on tasks, include signals like this:
   - "好的，我来帮您创建计算器应用。"
   - "开始执行todo事项1"
   - "我先创建HTML结构... [work details]"
   - "todo事项1已经完成"
   - "开始执行todo事项2"
   - "现在添加CSS样式... [work details]"
   - "todo事项2已经完成"

5. **Requirements**:
   - Always output the exact signal text when transitioning between TODO items
   - Work through items systematically 
   - Don't skip signal outputs even if working on multiple items
   - Signals should be clearly readable in your response text

**REMEMBER: TODO signals are ESSENTIAL for progress tracking. Always include them when a TODO list exists.**
`.trim();
}

/**
 * 合并基础系统提示词和TODO扩展
 * @param basePrompt 基础系统提示词
 * @returns 包含TODO管理的完整系统提示词
 */
export function mergeWithTodoPrompt(basePrompt: string): string {
  return `${basePrompt}

${getTodoSystemPrompt()}`;
} 