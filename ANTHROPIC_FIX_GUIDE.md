# Anthropic API 认证修复指南

## 🐛 问题描述

原问题：当仅使用 Anthropic API 验证登录后，在发送消息时遇到 403 错误，但通过 Google 登录后再切换到 Anthropic API 就能正常使用。

## 🔧 修复内容

### 1. 核心认证逻辑修复

**文件**: `packages/core/src/config/config.ts`
- 修复了 `refreshAuth` 方法中 Anthropic API 密钥的设置逻辑
- 确保 API 密钥被正确存储和验证
- 添加了详细的日志输出用于调试

**关键修复**:
```typescript
if (authMethod === AuthType.USE_ANTHROPIC) {
  const anthropicApiKey = process.env.ANTHROPIC_API_KEY;
  if (anthropicApiKey) {
    this.anthropicApiKey = anthropicApiKey;
    console.log(`[Config] ✅ Anthropic API密钥已配置，长度: ${anthropicApiKey.length}`);
  } else {
    throw new Error('ANTHROPIC_API_KEY environment variable not found');
  }
}
```

### 2. 认证验证增强

**文件**: `packages/cli/src/config/auth.ts`
- 添加了 API 密钥格式验证
- 确保密钥以 `sk-ant-` 开头
- 增强了错误信息的详细程度

**关键修复**:
```typescript
// 验证 API 密钥格式
if (!anthropicApiKey.startsWith('sk-ant-')) {
  return 'Invalid ANTHROPIC_API_KEY format. The key should start with "sk-ant-".';
}
```

### 3. AnthropicClient 初始化优化

**文件**: `packages/core/src/core/anthropicClient.ts`
- 改进了 API 密钥获取逻辑的优先级
- 添加了正确的 HTTP 头部设置
- 增强了错误处理，特别是 403 和 401 错误

**关键修复**:
```typescript
this.client = new Anthropic({
  apiKey,
  maxRetries: 3,
  timeout: 60000,
  // 添加默认头部来确保正确的权限设置
  defaultHeaders: {
    'anthropic-version': '2023-06-01',
    'content-type': 'application/json',
  },
});
```

### 4. 错误处理增强

**文件**: `packages/core/src/core/anthropicClient.ts`
- 为 403 和 401 错误提供了详细的用户友好错误信息
- 添加了 API 调用的详细日志记录
- 改进了流式调用的错误处理

**关键修复**:
```typescript
// 为403错误提供特殊处理
if (error?.status === 403) {
  userFriendlyMessage = `权限被拒绝 (403): 请检查您的Anthropic API密钥是否有效，以及是否有足够的权限访问所请求的模型。`;
} else if (error?.status === 401) {
  userFriendlyMessage = `认证失败 (401): 请检查您的Anthropic API密钥是否正确设置。`;
}
```

### 5. GeminiClient 集成改进

**文件**: `packages/core/src/core/client.ts`
- 确保在初始化时正确检测并初始化 AnthropicClient
- 添加了认证类型检查逻辑

**关键修复**:
```typescript
// 初始化AnthropicClient（如果使用Anthropic认证或配置了API密钥）
if (contentGeneratorConfig.authType === AuthType.USE_ANTHROPIC || this.config.getAnthropicApiKey()) {
  this.anthropicClient = new AnthropicClient(this.config);
  await this.anthropicClient.initialize();
  console.log('[GeminiClient] ✅ AnthropicClient已初始化');
}
```

## 🧪 测试验证

### 使用测试脚本

运行提供的测试脚本来验证修复：

```bash
node test-anthropic-auth.js
```

该脚本会：
1. 验证 Anthropic API 密钥格式
2. 直接测试 API 连接
3. 测试 uEVO CLI 集成

### 手动测试步骤

1. **设置环境变量**:
   ```bash
   export ANTHROPIC_API_KEY="sk-ant-your-api-key-here"
   ```

2. **构建项目**:
   ```bash
   npm run build
   ```

3. **启动 CLI**:
   ```bash
   npm start
   ```

4. **选择认证方式**:
   - 选择 "Use Anthropic API Key"
   - 确保看到认证成功的日志

5. **设置模型**:
   ```
   /model set claude-3-5-sonnet-20241022
   ```

6. **测试消息发送**:
   ```
   你好，请介绍一下你自己
   ```

## 📋 故障排除

### 常见问题

1. **403 权限错误**:
   - 检查 API 密钥是否有效
   - 确认账户有足够配额
   - 验证是否有访问所选模型的权限

2. **401 认证错误**:
   - 确认 API 密钥格式正确（以 `sk-ant-` 开头）
   - 检查 API 密钥是否输入正确

3. **模块加载错误**:
   - 确保运行了 `npm run build`
   - 检查 Node.js 版本兼容性

### 调试日志

修复后的版本包含详细的调试日志：
- `[Config]` - 配置相关日志
- `[AnthropicClient]` - Anthropic 客户端日志
- `[GeminiClient]` - 主客户端日志
- `[useAuthCommand]` - 认证命令日志

启用调试模式：
```bash
DEBUG=1 npm start
```

## 🎯 预期结果

修复后，您应该能够：
1. ✅ 仅使用 Anthropic API 密钥完成认证
2. ✅ 正常发送消息而不出现 403 错误
3. ✅ 使用所有工具调用功能
4. ✅ 获得详细的错误信息（如果出现问题）

## 🚀 完成

此修复解决了 Anthropic API 认证的核心问题，确保仅使用 Anthropic API 就能正常使用所有功能，无需依赖 Google 认证作为回退方案。
