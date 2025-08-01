#!/usr/bin/env node

/**
 * 测试 Anthropic API 认证功能
 * 验证认证配置是否正确工作
 */

import { validateAuthMethod } from './packages/cli/src/config/auth.js';
import { AuthType } from './packages/core/src/core/contentGenerator.js';

async function testAnthropicAuth() {
  console.log('🧪 测试 Anthropic API 认证功能...\n');

  // 测试1: 检查 AuthType 是否包含 USE_ANTHROPIC
  console.log('📋 测试1: 检查 AuthType 枚举');
  if (AuthType.USE_ANTHROPIC) {
    console.log(`✅ AuthType.USE_ANTHROPIC 存在: ${AuthType.USE_ANTHROPIC}`);
  } else {
    console.log('❌ AuthType.USE_ANTHROPIC 不存在');
    return false;
  }

  // 测试2: 测试没有 API 密钥时的验证
  console.log('\n📋 测试2: 验证缺少 API 密钥时的错误处理');
  const originalKey = process.env.ANTHROPIC_API_KEY;
  delete process.env.ANTHROPIC_API_KEY;
  
  const errorResult = validateAuthMethod(AuthType.USE_ANTHROPIC);
  if (errorResult && errorResult.includes('ANTHROPIC_API_KEY environment variable not found')) {
    console.log('✅ 正确返回缺少 API 密钥的错误信息');
    console.log(`   错误信息: ${errorResult}`);
  } else {
    console.log('❌ 未正确处理缺少 API 密钥的情况');
    console.log(`   实际结果: ${errorResult}`);
    return false;
  }

  // 测试3: 测试有 API 密钥时的验证
  console.log('\n📋 测试3: 验证有 API 密钥时的成功情况');
  process.env.ANTHROPIC_API_KEY = 'sk-ant-test-key-12345';
  
  const successResult = validateAuthMethod(AuthType.USE_ANTHROPIC);
  if (successResult === null) {
    console.log('✅ 有 API 密钥时验证成功');
  } else {
    console.log('❌ 有 API 密钥时验证失败');
    console.log(`   错误信息: ${successResult}`);
    return false;
  }

  // 测试4: 测试环境变量检测
  console.log('\n📋 测试4: 测试环境变量检测功能');
  
  // 模拟不同的环境变量设置情况
  const testCases = [
    { key: 'sk-ant-api01-1234567890abcdef', expected: true },
    { key: 'invalid-key', expected: true }, // 格式验证在 API 调用时进行
    { key: '', expected: false },
    { key: null, expected: false },
  ];

  for (const testCase of testCases) {
    if (testCase.key === null) {
      delete process.env.ANTHROPIC_API_KEY;
    } else {
      process.env.ANTHROPIC_API_KEY = testCase.key;
    }

    const result = validateAuthMethod(AuthType.USE_ANTHROPIC);
    const isValid = result === null;

    if (isValid === testCase.expected) {
      console.log(`✅ 测试密钥 "${testCase.key || 'null'}" - 期望: ${testCase.expected ? '有效' : '无效'}, 实际: ${isValid ? '有效' : '无效'}`);
    } else {
      console.log(`❌ 测试密钥 "${testCase.key || 'null'}" - 期望: ${testCase.expected ? '有效' : '无效'}, 实际: ${isValid ? '有效' : '无效'}`);
      return false;
    }
  }

  // 恢复原始环境变量
  if (originalKey) {
    process.env.ANTHROPIC_API_KEY = originalKey;
  } else {
    delete process.env.ANTHROPIC_API_KEY;
  }

  console.log('\n🎉 所有 Anthropic 认证测试通过！');
  return true;
}

async function testAuthMethodsSupport() {
  console.log('\n📋 测试所有支持的认证方法');
  
  const supportedMethods = [
    AuthType.LOGIN_WITH_GOOGLE,
    AuthType.USE_GEMINI,
    AuthType.USE_VERTEX_AI,
    AuthType.CLOUD_SHELL,
    AuthType.USE_ANTHROPIC,
    AuthType.USE_ALIYUN,
  ];

  console.log('支持的认证方法:');
  supportedMethods.forEach((method, index) => {
    console.log(`  ${index + 1}. ${method}`);
  });

  // 测试不支持的方法
  const unsupportedMethods = [
    AuthType.USE_DEEPSEEK,
    AuthType.USE_OPENAI,
    AuthType.USE_OPENROUTER,
  ];

  console.log('\n不支持作为主要认证方法的类型:');
  unsupportedMethods.forEach((method, index) => {
    const result = validateAuthMethod(method);
    if (result && result.includes('not supported for primary CLI authentication')) {
      console.log(`  ✅ ${index + 1}. ${method} - 正确拒绝`);
    } else {
      console.log(`  ❌ ${index + 1}. ${method} - 处理不正确`);
    }
  });
}

async function main() {
  console.log('🚀 开始 Anthropic 认证功能测试\n');

  try {
    const authTestResult = await testAnthropicAuth();
    if (!authTestResult) {
      console.log('\n❌ Anthropic 认证测试失败');
      process.exit(1);
    }

    await testAuthMethodsSupport();

    console.log('\n✅ 所有测试完成！');
    console.log('\n📝 使用说明:');
    console.log('1. 设置环境变量: export ANTHROPIC_API_KEY="your-api-key"');
    console.log('2. 启动 CLI: npm start');
    console.log('3. 在认证对话框中选择 "Use Anthropic API Key"');
    console.log('4. 开始使用 Claude 模型！');

  } catch (error) {
    console.error('\n❌ 测试过程中发生错误:', error.message);
    console.error('详细错误:', error);
    process.exit(1);
  }
}

// 运行测试
main().catch(error => {
  console.error('❌ 测试失败:', error);
  process.exit(1);
});