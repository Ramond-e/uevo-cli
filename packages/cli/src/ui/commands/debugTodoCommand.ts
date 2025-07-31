/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { SlashCommand, MessageActionReturn, CommandKind } from './types.js';

const debugTodoAction = async (): Promise<MessageActionReturn> => ({
    type: 'message',
    messageType: 'info',
    content: `📋 调试TODO功能

要测试TODO分析功能，请输入包含以下关键词的任务：

• 中文关键词：创建、添加、修改、实现、完成、帮我、请、需要
• 英文关键词：create、add、modify、implement、complete、help、please、need

测试示例：
- "帮我创建一个React组件"
- "请实现用户登录功能"  
- "Create a REST API"

注意：
1. 查询不能以 /、@、? 开头
2. 必须包含上述关键词之一
3. 确保Gemini API已正确配置

如果功能正常，您将看到：
- "正在分析任务，生成TODO列表..."提示
- 蓝绿色渐变的TODO列表框
- 任务项目和进度统计`
  });

export const debugTodoCommand: SlashCommand = {
  name: 'debug-todo',
  description: '调试TODO功能',
  kind: CommandKind.BUILT_IN,
  action: debugTodoAction,
}; 