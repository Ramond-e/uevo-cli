# 阿里云 API 集成指南

本指南介绍如何在 uEVO 项目中使用阿里云 DashScope API 和 Qwen 系列模型。

## 功能特性

✅ **完全集成到现有 GeminiClient 中** - 无需创建新的客户端类  
✅ **支持流式和非流式生成** - 完整的 API 兼容性  
✅ **自动模型路由** - 根据模型名称自动选择 API 提供商  
✅ **丰富的 Qwen 模型支持** - 包含最新的 Qwen2.5 系列模型  

## 支持的模型

### 基础模型
- `qwen-turbo` - 快速响应，适合日常对话
- `qwen-plus` - 平衡性能和质量
- `qwen-max` - 最强性能模型
- `qwen-long` - 长文本处理
- `qwen-max-longcontext` - 超长上下文支持

### Qwen2.5 系列
- `qwen2.5-72b-instruct` - 72B 参数指令模型
- `qwen2.5-32b-instruct` - 32B 参数指令模型
- `qwen2.5-14b-instruct` - 14B 参数指令模型
- `qwen2.5-7b-instruct` - 7B 参数指令模型
- `qwen2.5-3b-instruct` - 3B 参数指令模型
- `qwen2.5-1.5b-instruct` - 1.5B 参数指令模型
- `qwen2.5-0.5b-instruct` - 0.5B 参数指令模型

### 代码专用模型
- `qwen-coder-turbo` - 代码生成快速版
- `qwen-coder-plus` - 代码生成增强版
- `qwen2.5-coder-32b-instruct` - 32B 代码模型
- `qwen2.5-coder-14b-instruct` - 14B 代码模型
- `qwen2.5-coder-7b-instruct` - 7B 代码模型
- `qwen2.5-coder-3b-instruct` - 3B 代码模型
- `qwen2.5-coder-1.5b-instruct` - 1.5B 代码模型

### 数学专用模型
- `qwen2.5-math-72b-instruct` - 72B 数学推理模型
- `qwen2.5-math-7b-instruct` - 7B 数学推理模型
- `qwen2.5-math-1.5b-instruct` - 1.5B 数学推理模型

### 多模态模型
- `qwen-vl-plus` - 视觉理解增强版
- `qwen-vl-max` - 视觉理解最强版
- `qwen-audio-turbo` - 音频处理快速版
- `qwen-audio-chat` - 音频对话模型

## 快速开始

### 1. 获取 API 密钥

访问 [阿里云 DashScope 控制台](https://dashscope.console.aliyun.com/) 获取 API 密钥。

### 2. 设置环境变量

```bash
export DASHSCOPE_API_KEY="your-dashscope-api-key"
```

### 3. 配置认证方式

在 uEVO CLI 启动时，选择 "Use Aliyun DashScope API Key" 认证选项，或者通过命令行设置：

```bash
uevo auth aliyun-api-key
```

### 4. 使用示例

#### 命令行使用
```bash
# 设置模型为 qwen-turbo
uevo config model qwen-turbo

# 开始对话
uevo
```

#### 编程使用
```javascript
import { GeminiClient } from './packages/core/src/core/client.js';
import { Config } from './packages/core/src/config/config.js';

const config = new Config();
config.setModel('qwen-plus');

const client = new GeminiClient(config);

// 初始化
await client.initialize({
  authType: 'USE_ALIYUN',
  apiKey: process.env.DASHSCOPE_API_KEY,
  model: 'qwen-plus'
});

// 生成内容
const response = await client.generateContent(
  [{ role: 'user', parts: [{ text: '你好！' }] }],
  { temperature: 0.7 },
  new AbortController().signal
);

console.log(response.candidates[0].content.parts[0].text);
```

## 实现细节

### 自动路由机制

系统会根据模型名称自动判断是否使用阿里云 API：

```javascript
// 在 GeminiClient 中
if (this.shouldUseAliyunAPI(modelToUse)) {
  // 使用阿里云 API
  return this.callAliyunAPI(modelToUse, messages, config, abortSignal);
} else {
  // 使用原有的 Gemini API
  return this.getContentGenerator().generateContent(...);
}
```

### 消息格式转换

系统会自动将 Gemini 的 Content 格式转换为阿里云的消息格式：

```javascript
// Gemini 格式
{ role: 'user', parts: [{ text: 'Hello' }] }

// 转换为阿里云格式
{ role: 'user', content: 'Hello' }
```

### 响应格式统一

阿里云 API 的响应会被转换为标准的 GenerateContentResponse 格式，确保与现有代码的完全兼容。

## 测试

运行集成测试：

```bash
node test-aliyun-integration.js
```

## 注意事项

1. **API 密钥安全**: 请妥善保管您的 DashScope API 密钥，不要提交到代码仓库中
2. **模型可用性**: 不同模型可能有不同的可用性和计费方式，请查看阿里云文档
3. **速率限制**: 请注意阿里云 API 的调用频率限制
4. **错误处理**: 系统会自动处理网络错误和 API 错误，并提供详细的错误信息

## 故障排除

### 常见问题

**Q: 出现 "DASHSCOPE_API_KEY environment variable is required" 错误**  
A: 请确保正确设置了环境变量：`export DASHSCOPE_API_KEY="your-api-key"`

**Q: 模型无法识别**  
A: 请检查模型名称是否正确，参考上面的支持模型列表

**Q: API 调用失败**  
A: 请检查网络连接和 API 密钥是否有效，查看错误日志获取详细信息

### 调试模式

启用调试日志：

```bash
export DEBUG=1
uevo
```

## 更新日志

- **v1.0.0**: 初始版本，支持基础的阿里云 API 集成
- **v1.1.0**: 添加 Qwen2.5 系列模型支持
- **v1.2.0**: 添加代码和数学专用模型支持
- **v1.3.0**: 添加多模态模型支持（视觉、音频）

## 贡献

如果您发现问题或有改进建议，请提交 Issue 或 Pull Request。