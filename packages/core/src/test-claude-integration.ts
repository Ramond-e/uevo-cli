/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { Config, ConfigParameters } from './config/config.js';
import { AnthropicClient } from './core/anthropicClient.js';

/**
 * 测试Claude集成的简单脚本
 */
async function testClaudeIntegration() {
  console.log('🧪 开始测试Claude集成...\n');

  // 检查API密钥
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error('❌ 错误: 未找到ANTHROPIC_API_KEY环境变量');
    console.log('请设置您的Anthropic API密钥:');
    console.log('export ANTHROPIC_API_KEY="your-api-key-here"');
    return;
  }

  try {
    // 创建配置
    const configParams: ConfigParameters = {
      sessionId: 'test-claude-integration',
      targetDir: process.cwd(),
      debugMode: true,
      cwd: process.cwd(),
      model: AnthropicClient.CLAUDE_MODELS.SONNET_3_5,
      anthropicApiKey: apiKey,
    };

    const config = new Config(configParams);
    await config.initialize();

    console.log('✅ 配置初始化成功');

    // 创建AnthropicClient
    const anthropicClient = new AnthropicClient(config);
    await anthropicClient.initialize();

    console.log('✅ AnthropicClient初始化成功');

    // 测试基本消息发送
    console.log('\n📤 测试基本消息发送...');
    const response = await anthropicClient.sendMessage(
      '你好！请简单介绍一下你自己。',
      AnthropicClient.CLAUDE_MODELS.SONNET_3_5,
      {
        maxTokens: 500,
        temperature: 0.1,
      }
    );

    console.log('📥 Claude响应:');
    console.log(response.content);
    
    if (response.usage) {
      console.log(`\n📊 Token使用情况:`);
      console.log(`  输入: ${response.usage.input_tokens} tokens`);
      console.log(`  输出: ${response.usage.output_tokens} tokens`);
    }

    // 测试工具调用功能
    console.log('\n🔧 测试工具调用功能...');
    const toolResponse = await anthropicClient.sendMessage(
      '请帮我列出当前目录下的文件。',
      AnthropicClient.CLAUDE_MODELS.SONNET_3_5,
      {
        maxTokens: 1000,
        temperature: 0.1,
      }
    );

    console.log('📥 Claude工具调用响应:');
    console.log(toolResponse.content);

    if (toolResponse.toolCalls && toolResponse.toolCalls.length > 0) {
      console.log(`\n🛠️ 执行的工具调用:`);
      toolResponse.toolCalls.forEach((call, index) => {
        console.log(`  ${index + 1}. ${call.name}`);
        console.log(`     参数: ${JSON.stringify(call.input, null, 2)}`);
      });
    }

    // 测试流式响应
    console.log('\n🌊 测试流式响应...');
    console.log('Claude流式响应:');
    
    const streamGenerator = anthropicClient.streamMessage(
      '请用简洁的语言解释什么是人工智能。',
      AnthropicClient.CLAUDE_MODELS.SONNET_3_5,
      {
        maxTokens: 300,
        temperature: 0.1,
      }
    );

    for await (const event of streamGenerator) {
      if (event.type === 'content' && event.value) {
        process.stdout.write(event.value);
      }
    }

    console.log('\n\n✅ 所有测试完成！Claude集成工作正常。');

  } catch (error) {
    console.error('❌ 测试失败:', error);
    
    if (error instanceof Error) {
      console.error('错误详情:', error.message);
      if (error.stack) {
        console.error('堆栈跟踪:', error.stack);
      }
    }
  }
}

// 运行测试
if (require.main === module) {
  testClaudeIntegration()
    .then(() => {
      console.log('\n🎉 测试脚本执行完成');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 测试脚本执行失败:', error);
      process.exit(1);
    });
}

export { testClaudeIntegration };