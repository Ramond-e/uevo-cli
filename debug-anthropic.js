#!/usr/bin/env node

/**
 * 调试 Anthropic API 连接的最小化测试脚本
 */

import { config } from 'dotenv';
import Anthropic from '@anthropic-ai/sdk';

// 加载环境变量
config();

async function debugAnthropicAPI() {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  
  if (!apiKey) {
    console.error('❌ ANTHROPIC_API_KEY 未设置');
    process.exit(1);
  }

  console.log('🔍 调试 Anthropic API 连接');
  console.log(`API 密钥长度: ${apiKey.length}`);
  console.log(`API 密钥前缀: ${apiKey.substring(0, 10)}...`);
  
  const client = new Anthropic({
    apiKey: apiKey,
  });

  // 测试1: 最简单的消息
  console.log('\n📤 测试1: 基础消息发送');
  try {
    const message = await client.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 50,
      messages: [
        {
          role: 'user',
          content: '你好'
        }
      ]
    });
    
    console.log('✅ 基础消息发送成功');
    console.log('响应:', message.content[0].text);
  } catch (error) {
    console.error('❌ 基础消息发送失败:', error);
    console.error('错误详情:', {
      status: error.status,
      error: error.error,
      headers: error.headers,
      message: error.message
    });
    return;
  }

  // 测试2: 带系统提示的消息
  console.log('\n📤 测试2: 带系统提示的消息');
  try {
    const messageWithSystem = await client.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 50,
      system: '你是一个有用的助手。',
      messages: [
        {
          role: 'user',
          content: '请简单介绍一下自己'
        }
      ]
    });
    
    console.log('✅ 系统提示消息发送成功');
    console.log('响应:', messageWithSystem.content[0].text);
  } catch (error) {
    console.error('❌ 系统提示消息发送失败:', error);
    console.error('错误详情:', {
      status: error.status,
      error: error.error,
      message: error.message
    });
    return;
  }

  // 测试3: 流式消息
  console.log('\n📤 测试3: 流式消息');
  try {
    const stream = await client.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 50,
      messages: [
        {
          role: 'user',
          content: '计数到5'
        }
      ],
      stream: true,
    });

    console.log('✅ 流式消息开始');
    let content = '';
    for await (const chunk of stream) {
      if (chunk.type === 'content_block_delta' && chunk.delta.text) {
        content += chunk.delta.text;
        process.stdout.write(chunk.delta.text);
      }
    }
    console.log('\n✅ 流式消息完成');
  } catch (error) {
    console.error('❌ 流式消息失败:', error);
    console.error('错误详情:', {
      status: error.status,
      error: error.error,
      message: error.message
    });
    return;
  }

  console.log('\n🎉 所有 API 测试通过！');
}

debugAnthropicAPI().catch(console.error);
