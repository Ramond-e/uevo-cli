# Claude API 集成指南

本文档介绍如何在uevo系统中使用Anthropic Claude API，包括Claude系列模型的工具调用功能。

## 🚀 功能特性

- ✅ **完整的Claude模型支持**: 支持Claude 4、Claude 3.7、Claude 3.5和Claude 3系列模型
- ✅ **工具调用集成**: Claude模型可以使用系统中的所有工具（文件操作、shell命令、网络搜索等）
- ✅ **流式响应**: 支持实时流式输出
- ✅ **无缝集成**: 与现有的GeminiClient完全集成，自动检测模型类型
- ✅ **错误处理**: 完善的错误处理和重试机制
- ✅ **类型安全**: 完整的TypeScript类型定义

## 📋 支持的Claude模型

### Claude 4 系列 (最新)
- `claude-opus-4-20250514` - 最强大的Claude 4模型
- `claude-sonnet-4-20250514` - 平衡性能和成本的Claude 4模型

### Claude 3.7 系列
- `claude-3-7-sonnet-20250219` - Claude 3.7 Sonnet

### Claude 3.5 系列 (推荐)
- `claude-3-5-sonnet-20241022` - 最新的Claude 3.5 Sonnet
- `claude-3-5-haiku-20241022` - 快速轻量的Claude 3.5模型

### Claude 3 系列
- `claude-3-opus-20240229` - 最强大的Claude 3模型
- `claude-3-sonnet-20240229` - 平衡的Claude 3模型
- `claude-3-haiku-20240307` - 快速的Claude 3模型

## ⚙️ 配置设置

### 1. 设置API密钥

```bash
# 设置环境变量
export ANTHROPIC_API_KEY="sk-ant-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
```

或者在配置中直接指定：

```typescript
const config = new Config({
  // ... 其他配置
  anthropicApiKey: "your-anthropic-api-key-here"
});
```

### 2. 选择Claude模型

```bash
# 使用uevo命令行工具切换到Claude模型
uevo --model claude-3-5-sonnet-20241022

# 或者使用模型别名
uevo --model claude-sonnet-4-20250514
```

## 🛠️ 使用方法

### 基本使用

当您选择Claude模型时，系统会自动使用AnthropicClient处理请求：

```bash
# 设置Claude模型
export ANTHROPIC_API_KEY="your-key"
uevo --model claude-3-5-sonnet-20241022

# 正常使用，系统会自动检测并使用Claude API
uevo "请帮我分析这个项目的结构"
```

### 编程接口

```typescript
import { Config, AnthropicClient } from '@uevo/uevo-cli-core';

// 创建配置
const config = new Config({
  sessionId: 'my-session',
  targetDir: process.cwd(),
  cwd: process.cwd(),
  model: 'claude-3-5-sonnet-20241022',
  anthropicApiKey: process.env.ANTHROPIC_API_KEY,
});

await config.initialize();

// 获取AI客户端（自动检测Claude模型）
const client = config.getAIClient();

// 或者直接使用AnthropicClient
const anthropicClient = new AnthropicClient(config);
await anthropicClient.initialize();

// 发送消息
const response = await anthropicClient.sendMessage(
  "你好，请介绍一下你自己",
  'claude-3-5-sonnet-20241022',
  {
    maxTokens: 1000,
    temperature: 0.1,
  }
);

console.log(response.content);
```

### 工具调用示例

Claude模型可以自动使用系统中的所有工具：

```bash
# Claude会自动调用ls工具列出文件
uevo "请列出当前目录下的所有文件"

# Claude会自动调用grep工具搜索内容
uevo "在项目中搜索包含'TODO'的文件"

# Claude会自动调用edit工具修改文件
uevo "请在README.md文件中添加一个新的章节"

# Claude会自动调用web-search工具搜索信息
uevo "搜索最新的TypeScript 5.0新特性"
```

### 流式响应

```typescript
// 使用流式响应获得实时输出
const streamGenerator = anthropicClient.streamMessage(
  "请详细解释机器学习的基本概念",
  'claude-3-5-sonnet-20241022'
);

for await (const event of streamGenerator) {
  if (event.type === 'content' && event.value) {
    process.stdout.write(event.value);
  }
}
```

## 🔧 高级配置

### 模型推荐

根据不同的使用场景选择最适合的Claude模型：

```typescript
// 获取推荐模型
const codingModel = AnthropicClient.getRecommendedModel('coding');
// 返回: claude-3-5-sonnet-20241022

const analysisModel = AnthropicClient.getRecommendedModel('analysis');  
// 返回: claude-3-opus-20240229

const generalModel = AnthropicClient.getRecommendedModel('general');
// 返回: claude-3-5-sonnet-20241022
```

### 自定义配置

```typescript
const response = await anthropicClient.sendMessage(
  "你的问题",
  'claude-3-5-sonnet-20241022',
  {
    maxTokens: 4096,        // 最大输出token数
    temperature: 0.1,       // 创造性控制 (0-1)
    systemPrompt: "你是一个专业的编程助手", // 系统提示
    maxToolCalls: 10,       // 最大工具调用次数
  }
);
```

## 🧪 测试集成

运行测试脚本验证Claude集成是否正常工作：

```bash
cd packages/core
npm run test:claude-integration
```

或者直接运行测试文件：

```bash
cd packages/core
npx ts-node src/test-claude-integration.ts
```

## 🐛 故障排除

### 常见问题

1. **API密钥未配置**
   ```
   错误: Claude模型已选择，但Anthropic API密钥未配置
   解决: 设置ANTHROPIC_API_KEY环境变量
   ```

2. **模型不支持**
   ```
   错误: 模型 'claude-xxx' 不被支持
   解决: 检查模型名称是否正确，参考支持的模型列表
   ```

3. **工具调用失败**
   ```
   错误: Tool execution failed
   解决: 检查工具权限和参数是否正确
   ```

### 调试模式

启用调试模式获取更详细的日志：

```bash
uevo --debug --model claude-3-5-sonnet-20241022 "你的问题"
```

## 📊 性能对比

| 模型 | 速度 | 质量 | 成本 | 推荐用途 |
|------|------|------|------|----------|
| Claude Opus 4 | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐ | 复杂分析、创作 |
| Claude Sonnet 4 | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐ | 通用任务 |
| Claude 3.5 Sonnet | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐ | 编程、分析 |
| Claude 3.5 Haiku | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐⭐ | 快速响应 |

## 🔗 相关链接

- [Anthropic API 官方文档](https://docs.anthropic.com/)
- [Claude 模型对比](https://docs.anthropic.com/claude/docs/models-overview)
- [工具调用指南](https://docs.anthropic.com/claude/docs/tool-use)

## 💡 最佳实践

1. **选择合适的模型**: 根据任务复杂度选择模型
2. **合理设置参数**: 调整temperature和maxTokens以获得最佳效果
3. **利用工具调用**: 让Claude自动使用系统工具提高效率
4. **使用流式响应**: 对于长文本生成使用流式响应改善用户体验
5. **错误处理**: 始终处理API调用可能出现的错误

---

🎉 现在您已经可以在uevo中充分利用Claude的强大功能了！如有问题，请查看故障排除部分或提交issue。