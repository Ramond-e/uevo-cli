# API 快速入门指南

## 🚀 三步配置 API

### 第 1 步：设置 API 密钥
选择以下任一方式设置环境变量：

#### 方式 A：创建 .env 文件（推荐）
在项目根目录创建 `.env` 文件：
```
DASHSCOPE_API_KEY=你的阿里云API密钥
```

#### 方式 B：PowerShell 命令
```powershell
$env:DASHSCOPE_API_KEY="你的阿里云API密钥"
```

### 第 2 步：激活 API
```
/api switch
```

### 第 3 步：测试连接
```
/api test
```

✅ 完成！现在可以开始使用了。

---

## 📊 常用命令

| 命令 | 说明 |
|------|------|
| `/api` | 查看当前状态和帮助 |
| `/api status` | 查看详细的 API 状态 |
| `/api list` | 列出所有可用的 API |
| `/api switch` | 激活或切换 API |
| `/api test` | 测试 API 连接 |

---

## 🔧 支持的 API 提供商

### 阿里云通义千问
- 环境变量：`DASHSCOPE_API_KEY`
- 获取密钥：https://dashscope.console.aliyun.com/apiKey

### DeepSeek
- 环境变量：`DEEPSEEK_API_KEY`
- 获取密钥：https://platform.deepseek.com/api_keys

### OpenAI
- 环境变量：`OPENAI_API_KEY`
- 获取密钥：https://platform.openai.com/api-keys

### Anthropic Claude
- 环境变量：`ANTHROPIC_API_KEY`
- 获取密钥：https://console.anthropic.com/

### Gemini
- 环境变量：`UEVO_API_KEY`
- 获取密钥：https://ai.google.dev

### OpenRouter
- 环境变量：`OPENROUTER_API_KEY`
- 获取密钥：https://openrouter.ai/keys

---

## ❓ 常见问题

### 每次重启都要重新配置？
确保环境变量已正确设置：
- 使用 `.env` 文件时，确保文件在项目根目录
- 使用系统环境变量时，需要重启终端

### 如何切换到其他 API？
1. 先设置对应的环境变量
2. 运行 `/api switch` 选择新的 API

### 配置后仍显示未激活？
运行 `/api switch` 激活已配置的 API 