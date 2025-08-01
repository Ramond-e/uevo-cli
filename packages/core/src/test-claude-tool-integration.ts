/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { Config } from './config/config.js';
import { AnthropicClient } from './core/anthropicClient.js';
import { ToolRegistry } from './tools/tool-registry.js';
import { LSTool } from './tools/ls.js';
import { ReadFileTool } from './tools/read-file.js';
import { WriteFileTool } from './tools/write-file.js';
import path from 'path';
import os from 'os';

/**
 * 测试Claude模型的工具调用功能
 */
async function testClaudeToolIntegration() {
  console.log('🧪 开始测试Claude模型工具调用集成...');

  try {
    // 创建配置
    const config = new Config({
      sessionId: 'claude-tool-test',
      debugMode: false,
      cwd: process.cwd(),
      targetDir: process.cwd(),
      model: 'claude-3-5-sonnet-20241022',
      anthropicApiKey: process.env.ANTHROPIC_API_KEY,
    });

    if (!config.getAnthropicApiKey?.()) {
      throw new Error('请设置 ANTHROPIC_API_KEY 环境变量');
    }

    // 创建Claude客户端 (工具注册表会在initialize时自动创建)
    const claudeClient = new AnthropicClient(config);
    await claudeClient.initialize();

    console.log('✅ Claude客户端初始化成功');

    // 测试1: 简单的工具调用 - 列出当前目录
    console.log('\n📁 测试1: 列出当前目录');
    
    const testMessage1 = `请帮我列出当前目录 ${process.cwd()} 的内容`;
    
    try {
      const response1 = await claudeClient.sendMessage(testMessage1, AnthropicClient.CLAUDE_MODELS.SONNET_3_5, {
        maxTokens: 2048,
        temperature: 0.1,
      });
      
      console.log('✅ 目录列表工具调用成功');
      console.log('📄 响应内容:', response1.content.substring(0, 200) + '...');
      
      if (response1.toolCalls && response1.toolCalls.length > 0) {
        console.log(`🔧 工具调用次数: ${response1.toolCalls.length}`);
        response1.toolCalls.forEach((call, index) => {
          console.log(`   ${index + 1}. ${call.name}: ${call.status}`);
        });
      }
    } catch (error) {
      console.error('❌ 目录列表工具调用失败:', error);
    }

    // 测试2: 读取文件
    console.log('\n📖 测试2: 读取package.json文件');
    
    const packageJsonPath = path.join(process.cwd(), 'package.json');
    const testMessage2 = `请帮我读取文件 ${packageJsonPath} 的内容，并告诉我项目的名称和版本`;
    
    try {
      const response2 = await claudeClient.sendMessage(testMessage2, AnthropicClient.CLAUDE_MODELS.SONNET_3_5, {
        maxTokens: 2048,
        temperature: 0.1,
      });
      
      console.log('✅ 文件读取工具调用成功');
      console.log('📄 响应内容:', response2.content.substring(0, 300) + '...');
      
      if (response2.toolCalls && response2.toolCalls.length > 0) {
        console.log(`🔧 工具调用次数: ${response2.toolCalls.length}`);
      }
    } catch (error) {
      console.error('❌ 文件读取工具调用失败:', error);
    }

    // 测试3: 创建一个测试文件
    console.log('\n✏️ 测试3: 创建测试文件');
    
    const testFilePath = path.join(os.tmpdir(), 'claude-test.txt');
    const testMessage3 = `请帮我在 ${testFilePath} 创建一个测试文件，内容为 "Hello from Claude! This is a test file created by Claude AI assistant."`;
    
    try {
      const response3 = await claudeClient.sendMessage(testMessage3, AnthropicClient.CLAUDE_MODELS.SONNET_3_5, {
        maxTokens: 2048,
        temperature: 0.1,
      });
      
      console.log('✅ 文件创建工具调用成功');
      console.log('📄 响应内容:', response3.content.substring(0, 200) + '...');
      
      if (response3.toolCalls && response3.toolCalls.length > 0) {
        console.log(`🔧 工具调用次数: ${response3.toolCalls.length}`);
      }
    } catch (error) {
      console.error('❌ 文件创建工具调用失败:', error);
    }

    console.log('\n🎉 Claude工具调用集成测试完成！');

  } catch (error) {
    console.error('💥 测试过程中发生错误:', error);
    process.exit(1);
  }
}

// 运行测试
if (import.meta.url === `file://${process.argv[1]}`) {
  testClaudeToolIntegration().catch(console.error);
}

export { testClaudeToolIntegration };