/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { Config } from '../config/config.js';
import { ToolRegistry } from '../tools/tool-registry.js';
import { LSTool } from '../tools/ls.js';
import { ReadFileTool } from '../tools/read-file.js';
import { AIProviderFactory } from '../core/aiProviderAdapter.js';

/**
 * 统一AI提供者使用示例
 * 展示如何使用兼容层统一调用不同的AI模型
 */
async function unifiedAIProviderExample() {
  console.log('🤖 统一AI提供者使用示例');

  try {
    // 创建配置
    const config = new Config({
      sessionId: 'example-session',
      debugMode: false,
      cwd: process.cwd(),
      targetDir: process.cwd(),
      model: 'claude-3-5-sonnet-20241022',
      anthropicApiKey: process.env.ANTHROPIC_API_KEY,
    });

    // 创建工具注册表
    const toolRegistry = new ToolRegistry(config);
    toolRegistry.registerTool(new LSTool(config));
    toolRegistry.registerTool(new ReadFileTool(config));

    // 自动选择最佳AI提供者
    console.log('🔍 自动选择最佳AI提供者...');
    const aiProvider = await AIProviderFactory.createBestProvider(config);
    
    console.log(`✅ 选择的提供者支持以下模型: ${aiProvider.getSupportedModels().join(', ')}`);

    // 初始化提供者
    await aiProvider.initialize(toolRegistry);
    console.log('✅ AI提供者初始化完成');

    // 发送消息测试
    console.log('\n📤 发送测试消息...');
    const response = await aiProvider.sendMessage(
      '请帮我列出当前目录的内容，并读取package.json文件',
      {
        maxTokens: 2048,
        temperature: 0.1,
      }
    );

    console.log('📥 收到响应:');
    console.log('内容:', response.content.substring(0, 200) + '...');
    
    if (response.toolCalls) {
      console.log(`🔧 工具调用: ${response.toolCalls.length} 次`);
      response.toolCalls.forEach((call, index) => {
        console.log(`   ${index + 1}. ${call.name} - ${call.status}`);
      });
    }

    if (response.usage) {
      console.log(`📊 Token使用: 输入${response.usage.input_tokens}, 输出${response.usage.output_tokens}`);
    }

    // 流式消息测试
    console.log('\n🌊 测试流式响应...');
    const streamMessage = '请简单介绍一下这个项目的结构';
    
    console.log('流式响应内容:');
    for await (const event of aiProvider.streamMessage(streamMessage, { maxTokens: 1024 })) {
      switch (event.type) {
        case 'text':
          process.stdout.write(event.content || '');
          break;
        case 'tool_call':
          console.log(`\n🔧 调用工具: ${event.toolCall?.name}`);
          break;
        case 'tool_result':
          console.log(`✅ 工具执行完成: ${event.toolCall?.name}`);
          break;
        case 'error':
          console.log(`\n❌ 错误: ${event.error}`);
          break;
        case 'done':
          console.log('\n✅ 流式响应完成');
          break;
      }
    }

    console.log('\n🎉 统一AI提供者示例完成！');

  } catch (error) {
    console.error('💥 示例运行失败:', error);
  }
}

/**
 * 手动指定提供者示例
 */
async function manualProviderExample() {
  console.log('\n🎯 手动指定提供者示例');

  const config = new Config({
    sessionId: 'manual-example-session',
    debugMode: false,
    cwd: process.cwd(),
    targetDir: process.cwd(),
    model: 'claude-3-5-sonnet-20241022',
    anthropicApiKey: process.env.ANTHROPIC_API_KEY,
  });

  const toolRegistry = new ToolRegistry(config);
  toolRegistry.registerTool(new LSTool(config));

  try {
    // 手动创建Claude提供者
    const claudeProvider = await AIProviderFactory.createProvider('claude', config);
    await claudeProvider.initialize(toolRegistry);

    console.log('✅ Claude提供者创建成功');
    console.log(`支持的模型: ${claudeProvider.getSupportedModels().slice(0, 3).join(', ')}...`);

    const response = await claudeProvider.sendMessage('请列出当前目录的前5个文件');
    console.log('📥 Claude响应:', response.content.substring(0, 150) + '...');

  } catch (error) {
    console.error('❌ 手动提供者示例失败:', error);
  }
}

// 运行示例
if (import.meta.url === `file://${process.argv[1]}`) {
  (async () => {
    await unifiedAIProviderExample();
    await manualProviderExample();
  })().catch(console.error);
}

export { unifiedAIProviderExample, manualProviderExample };