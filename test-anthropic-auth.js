#!/usr/bin/env node

/**
 * Anthropic 认证测试脚本
 * 用于验证仅使用 Anthropic API 的认证和消息发送功能
 */

import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// 加载环境变量
config({ path: join(__dirname, '.env') });

// 简单的 Anthropic API 测试
async function testAnthropicAPI() {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  
  if (!apiKey) {
    console.error('❌ 错误: ANTHROPIC_API_KEY 环境变量未设置');
    console.log('请在 .env 文件中设置: ANTHROPIC_API_KEY=your-api-key-here');
    process.exit(1);
  }
  
  console.log('🔍 测试 Anthropic API 连接...');
  console.log(`API 密钥长度: ${apiKey.length}`);
  console.log(`API 密钥格式: ${apiKey.startsWith('sk-ant-') ? '✅ 正确' : '❌ 错误'}`);
  
  try {
    // 使用 fetch 直接测试 Anthropic API
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'anthropic-version': '2023-06-01',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 100,
        messages: [
          {
            role: 'user',
            content: '你好，请简单回答这是一个测试。'
          }
        ]
      })
    });
    
    console.log(`📡 HTTP 状态码: ${response.status}`);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ API 调用失败:');
      console.error('响应状态:', response.status, response.statusText);
      console.error('错误内容:', errorText);
      
      if (response.status === 403) {
        console.log('\n💡 403 错误解决方案:');
        console.log('1. 检查 API 密钥是否有效且未过期');
        console.log('2. 确认账户有足够的配额');
        console.log('3. 验证是否有访问所选模型的权限');
        console.log('4. 检查 API 密钥是否有正确的权限范围');
      }
      
      return false;
    }
    
    const result = await response.json();
    console.log('✅ API 调用成功!');
    console.log('响应:', result.content?.[0]?.text || '无内容');
    return true;
    
  } catch (error) {
    console.error('❌ 网络或其他错误:', error.message);
    return false;
  }
}

// 测试 uEVO CLI 的 Anthropic 集成
async function testUevoAnthropicIntegration() {
  console.log('\n🧪 测试 uEVO CLI Anthropic 集成...');
  
  try {
    // 动态导入 ESM 模块
    const { AuthType } = await import('./packages/core/dist/index.js');
    const { validateAuthMethod } = await import('./packages/cli/dist/config/auth.js');
    
    console.log('📦 模块加载成功');
    
    // 测试认证验证
    const validationResult = validateAuthMethod(AuthType.USE_ANTHROPIC);
    if (validationResult) {
      console.error('❌ 认证验证失败:', validationResult);
      return false;
    }
    
    console.log('✅ 认证验证通过');
    return true;
    
  } catch (error) {
    console.error('❌ 模块导入或测试失败:', error.message);
    console.log('💡 请确保已运行: npm run build');
    return false;
  }
}

async function main() {
  console.log('🚀 开始 Anthropic 认证测试\n');
  
  const apiTestResult = await testAnthropicAPI();
  const integrationTestResult = await testUevoAnthropicIntegration();
  
  console.log('\n📋 测试结果总结:');
  console.log(`API 连接测试: ${apiTestResult ? '✅ 通过' : '❌ 失败'}`);
  console.log(`集成测试: ${integrationTestResult ? '✅ 通过' : '❌ 失败'}`);
  
  if (apiTestResult && integrationTestResult) {
    console.log('\n🎉 所有测试通过! uEVO CLI 应该可以正常使用 Anthropic API 了。');
    console.log('可以运行以下命令开始使用:');
    console.log('npm start');
    console.log('然后选择 "Use Anthropic API Key" 选项');
  } else {
    console.log('\n⚠️  部分测试失败，请检查上述错误信息并修复问题。');
    process.exit(1);
  }
}

main().catch(console.error);
