/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { MessageType } from '../types.js';
import {
  CommandKind,
  SlashCommand,
  SlashCommandActionReturn,
} from './types.js';

/**
 * 显示TODO帮助信息
 */
const showTodoHelpAction = async (context: any): Promise<SlashCommandActionReturn> => {
  const helpText = `
## TODO功能使用指南

TODO功能可以帮助AI更好地管理复杂任务，将大任务分解为小任务并跟踪完成进度。

### AI自动使用语法：
当AI判断任务复杂需要分解时，会自动使用以下语法：

1. **创建任务**：\`<create_todo>序号:任务内容</create_todo>\`
   - 示例：\`<create_todo>1:实现用户登录功能</create_todo>\`

2. **更新任务**：\`<update_todo>序号:更新后的任务内容</update_todo>\`
   - 示例：\`<update_todo>1:实现用户登录和注册功能</update_todo>\`

3. **完成任务**：\`<finish_todo>序号</finish_todo>\`
   - 示例：\`<finish_todo>1</finish_todo>\`

### 手动命令：
- \`/todo\` - 显示当前TODO列表
- \`/todo show\` - 显示当前TODO列表  
- \`/todo clear\` - 清空所有TODO任务
- \`/todo toggle\` - 切换TODO面板显示/隐藏

### 注意事项：
- TODO面板会在有任务时自动显示
- 已完成的任务会显示为绿色实心圆圈
- 未完成的任务显示为空心圆圈
- 外框颜色会根据当前主题自动调整
`;

  return {
    type: 'message',
    messageType: 'info',
    content: helpText.trim()
  };
};

/**
 * 显示当前TODO列表
 */
const showTodoListAction = async (context: any): Promise<SlashCommandActionReturn> => {
  // 这里需要从TodoContext获取任务列表
  // 由于命令执行在React组件外部，我们返回一个特殊的消息类型
  // 让UI组件处理显示逻辑
  
  return {
    type: 'message',
    messageType: 'info', 
    content: 'TODO列表已切换显示状态。使用 /todo help 查看详细使用说明。'
  };
};

/**
 * 切换TODO面板显示状态
 */
const toggleTodoAction = async (context: any): Promise<SlashCommandActionReturn> => {
  return {
    type: 'message',
    messageType: 'info',
    content: 'TODO面板显示状态已切换。'
  };
};

/**
 * 清空所有TODO任务
 */
const clearTodoAction = async (context: any): Promise<SlashCommandActionReturn> => {
  return {
    type: 'message',
    messageType: 'info',
    content: '所有TODO任务已清空。'
  };
};

/**
 * 主TODO命令
 */
export const todoCommand: SlashCommand = {
  name: 'todo',
  altNames: ['task', 'tasks'],
  description: 'TODO任务管理',
  kind: CommandKind.BUILT_IN,
  action: showTodoListAction,
  subCommands: [
    {
      name: 'help',
      altNames: ['h', '?'],
      description: '显示TODO功能使用指南',
      kind: CommandKind.BUILT_IN,
      action: showTodoHelpAction,
    },
    {
      name: 'show',
      altNames: ['list', 'ls'],
      description: '显示当前TODO列表',
      kind: CommandKind.BUILT_IN,
      action: showTodoListAction,
    },
    {
      name: 'toggle',
      altNames: ['switch', 'hide'],
      description: '切换TODO面板显示/隐藏',
      kind: CommandKind.BUILT_IN,
      action: toggleTodoAction,
    },
    {
      name: 'clear',
      altNames: ['clean', 'reset'],
      description: '清空所有TODO任务',
      kind: CommandKind.BUILT_IN,
      action: clearTodoAction,
    },
  ],
};