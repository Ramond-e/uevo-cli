/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { SlashCommand, MessageActionReturn, CommandKind, CommandContext } from './types.js';
import { TodoStatus } from '../types/todo.js';

const todoCompleteAction = async (context: CommandContext, args: string): Promise<MessageActionReturn> => {
  const todoId = parseInt(args.trim(), 10);
  
  if (isNaN(todoId)) {
    return {
      type: 'message',
      messageType: 'error',
      content: '请提供有效的TODO编号，例如：/todo complete 1'
    };
  }

  // 这里需要访问TODO管理器，但它在UI层，我们需要通过context传递
  // 暂时返回指导信息
  return {
    type: 'message',
    messageType: 'info',
    content: `手动更新TODO功能开发中...

当前可用的测试方法：
1. 发送测试信号："todo事项${todoId}已经完成"
2. 或者："开始执行todo事项${todoId}"
3. 使用 /test-todo 查看更多测试示例

您也可以等待AI自动输出这些信号。`
  };
};

const todoShowAction = async (): Promise<MessageActionReturn> => {
  return {
    type: 'message',
    messageType: 'info',
    content: `📋 TODO管理命令

可用子命令：
• /todo complete <编号> - 手动标记TODO为完成（开发中）
• /todo show - 显示当前TODO列表状态

测试功能：
• /test-todo - 测试TODO信号检测
• /debug-todo - 显示TODO调试信息

信号格式：
• 完成："todo事项1已经完成" 或 "TODO 1 completed"  
• 开始："开始执行todo事项1" 或 "Starting TODO 1"`
  };
};

export const todoCommand: SlashCommand = {
  name: 'todo',
  description: '管理TODO列表状态',
  kind: CommandKind.BUILT_IN,
  action: todoShowAction,
  subCommands: [
    {
      name: 'complete',
      description: '标记TODO为完成',
      kind: CommandKind.BUILT_IN,
      action: todoCompleteAction,
    },
    {
      name: 'show',
      description: '显示TODO状态',
      kind: CommandKind.BUILT_IN,
      action: todoShowAction,
    },
  ],
}; 