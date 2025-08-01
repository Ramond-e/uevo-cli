# 🚀 qwen-turbo 模型配置指南

## 问题描述
你遇到的404错误是因为CLI尝试使用Gemini API调用`qwen-turbo`模型，但`qwen-turbo`是阿里云的模型，需要使用阿里云的API。

## 解决方案

### 1. 获取阿里云API密钥
1. 访问 [阿里云控制台](https://dashscope.console.aliyun.com/)
2. 登录你的阿里云账号
3. 开通DashScope服务
4. 获取API Key

### 2. 设置环境变量

**Windows PowerShell:**
```powershell
$env:DASHSCOPE_API_KEY="your-aliyun-api-key-here"
```

**Windows CMD:**
```cmd
set DASHSCOPE_API_KEY=your-aliyun-api-key-here
```

**Linux/macOS:**
```bash
export DASHSCOPE_API_KEY="your-aliyun-api-key-here"
```

### 3. 验证配置

启动uEVO CLI并运行以下命令：

```bash
uevo
```

在交互式界面中输入：
```
/api status
```

应该显示阿里云API已配置。

### 4. 切换到qwen-turbo模型

在交互式界面中输入：
```
/model switch qwen-turbo
```

### 5. 测试模型

现在你可以正常使用qwen-turbo模型了：
```
你好，请介绍一下你自己
```

## 智能路由功能

我已经为CLI添加了智能模型路由功能：

- **自动检测**: 根据模型名称自动选择正确的API提供商
- **回退机制**: 如果目标提供商未配置，自动回退到Gemini
- **无缝切换**: 保持原有接口兼容性

### 支持的模型映射

| 模型名称 | 提供商 | 环境变量 |
|---------|-------|----------|
| qwen-turbo, qwen-plus, qwen-max | 阿里云 | DASHSCOPE_API_KEY |
| deepseek-chat, deepseek-reasoner | DeepSeek | DEEPSEEK_API_KEY |
| claude-3-5-sonnet-* | Anthropic | ANTHROPIC_API_KEY |
| gpt-4o, gpt-3.5-turbo | OpenAI | OPENAI_API_KEY |
| gemini-1.5-pro, gemini-2.5-pro | Google | GEMINI_API_KEY |

## 故障排除

### 问题1: 仍然出现404错误
**解决**: 确保环境变量设置正确，重启终端后再试

### 问题2: API密钥无效
**解决**: 检查API密钥是否正确，是否有足够的配额

### 问题3: 网络连接问题
**解决**: 检查网络连接，如果在中国大陆，可能需要配置代理

## 完整示例

```powershell
# 1. 设置API密钥
$env:DASHSCOPE_API_KEY="sk-your-api-key"

# 2. 启动CLI
uevo

# 3. 在交互界面中执行
/api status
/model switch qwen-turbo
你好，请用中文回复我
```

现在你的CLI应该能够正确路由到阿里云API来处理qwen-turbo模型的请求了！🎉