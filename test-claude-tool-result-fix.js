#!/usr/bin/env node

/**
 * 测试Claude工具调用结果显示修复
 * 这个脚本验证Claude能否正确调用工具并显示结果
 */

import { Config } from './packages/core/src/config/config.js';
import { AnthropicClient } from './packages/core/src/core/anthropicClient.js';
import { GeminiClient } from './packages/core/src/core/client.js';

async function testClaudeToolResultDisplay() {
  console.log('🧪 测试Claude工具调用结果显示修复...\n');

  try {
    // 创建配置
    const config = new Config({
      apiKey: process.env.ANTHROPIC_API_KEY,
      model: 'claude-3-5-sonnet-20241022',
      maxTokens: 1000,
      temperature: 0.1,
    });

    await config.initialize();
    console.log('✅ 配置初始化成功');

    // 创建GeminiClient（它会处理Claude模型）
    const geminiClient = new GeminiClient(config);
    await geminiClient.initialize();
    console.log('✅ GeminiClient初始化成功');

    // 测试消息 - 请求列出当前目录
    const testMessage = '请列出当前目录的内容';
    console.log(`\n📝 发送测试消息: "${testMessage}"`);

    // 使用流式发送消息
    const stream = geminiClient.sendMessageStream(
      testMessage,
      new AbortController().signal,
      `test-${Date.now()}`,
      10
    );

    console.log('\n📡 处理流式响应:');
    let eventCount = 0;
    let toolCallRequestCount = 0;
    let toolCallResponseCount = 0;
    let contentEventCount = 0;

    for await (const event of stream) {
      eventCount++;
      console.log(`[${eventCount}] 事件类型: ${event.type}`);

      switch (event.type) {
        case 'tool_call_request':
          toolCallRequestCount++;
          console.log(`  🔧 工具调用请求: ${event.value.name}`);
          console.log(`  📋 参数:`, JSON.stringify(event.value.args, null, 2));
          break;
        
        case 'tool_call_response':
          toolCallResponseCount++;
          console.log(`  ✅ 工具调用响应: ${event.value.callId}`);
          console.log(`  📄 结果显示: ${event.value.resultDisplay?.substring(0, 100)}...`);
          if (event.value.error) {
            console.log(`  ❌ 错误: ${event.value.error.message}`);
          }
          break;
        
        case 'content':
          contentEventCount++;
          if (event.value && event.value.trim()) {
            console.log(`  📝 内容: ${event.value.substring(0, 50)}...`);
          }
          break;
        
        case 'finished':
          console.log('  🏁 流式响应完成');
          break;
        
        case 'error':
          console.log(`  ❌ 错误: ${event.value.error.message}`);
          break;
        
        default:
          console.log(`  ℹ️  其他事件: ${JSON.stringify(event.value)}`);
      }
    }

    // 输出统计信息
    console.log('\n📊 事件统计:');
    console.log(`  总事件数: ${eventCount}`);
    console.log(`  工具调用请求: ${toolCallRequestCount}`);
    console.log(`  工具调用响应: ${toolCallResponseCount}`);
    console.log(`  内容事件: ${contentEventCount}`);

    // 验证修复是否成功
    if (toolCallRequestCount > 0 && toolCallResponseCount > 0) {
      console.log('\n🎉 修复成功！Claude现在可以正确发送工具调用事件');
      console.log('   - 工具调用请求事件已发送');
      console.log('   - 工具调用响应事件已发送');
      console.log('   - UI应该能够正确显示工具执行结果');
    } else if (toolCallRequestCount === 0 && toolCallResponseCount === 0) {
      console.log('\n⚠️  没有检测到工具调用事件');
      console.log('   这可能意味着：');
      console.log('   1. Claude没有调用任何工具');
      console.log('   2. 工具调用事件格式仍然有问题');
    } else {
      console.log('\n⚠️  工具调用事件不匹配');
      console.log(`   请求事件: ${toolCallRequestCount}, 响应事件: ${toolCallResponseCount}`);
    }

  } catch (error) {
    console.error('\n❌ 测试失败:', error.message);
    console.error('详细错误:', error);
    process.exit(1);
  }
}

// 检查API密钥
if (!process.env.ANTHROPIC_API_KEY) {
  console.error('❌ 错误: 请设置ANTHROPIC_API_KEY环境变量');
  console.error('使用方法: ANTHROPIC_API_KEY=your_key_here node test-claude-tool-result-fix.js');
  process.exit(1);
}

// 运行测试
testClaudeToolResultDisplay()
  .then(() => {
    console.log('\n✅ 测试完成');
    process.exit(0);
  })
  .catch(error => {
    console.error('\n❌ 测试异常:', error);
    process.exit(1);
  });