/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { SlashCommand, MessageActionReturn, CommandKind } from './types.js';

const testTodoAction = async (): Promise<MessageActionReturn> => ({
    type: 'message',
    messageType: 'info',
    content: `🧪 测试TODO信号功能

如果您当前有TODO列表，请复制并发送以下测试信号：

📋 测试完成信号：
- todo事项1已经完成
- TODO 2 completed
- ✅ TODO 3

📋 测试开始信号：
- 开始执行todo事项1
- Starting TODO 2
- 开始TODO 3

📋 中文完整测试示例：
"我正在开始执行todo事项1，现在创建项目结构... todo事项1已经完成。接下来开始执行todo事项2..."

📋 英文完整测试示例：
"Starting TODO 1 to set up the project structure... TODO 1 completed. Now Starting TODO 2 for implementing features..."

注意：
1. 确保您当前有活跃的TODO列表
2. 信号检测会在底部显示调试信息
3. TODO列表应该实时更新状态圆圈`
  });

export const testTodoCommand: SlashCommand = {
  name: 'test-todo',
  description: '测试TODO信号检测功能',
  kind: CommandKind.BUILT_IN,
  action: testTodoAction,
}; 