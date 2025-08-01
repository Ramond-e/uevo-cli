# API 配置持久化说明

## 概述

uEVO CLI 的 API 配置采用了混合持久化策略，以确保安全性和易用性之间的平衡。

## 配置存储方式

### 1. 设置文件（持久化）
当您选择一个 API 提供商时，您的选择会保存在设置文件中：
- 文件位置：`~/.gemini/settings.json` (用户级别) 或 `.gemini/settings.json` (项目级别)
- 保存内容：`selectedAuthType` - 记录您选择的 API 提供商类型

### 2. 环境变量（需要手动配置）
出于安全考虑，API 密钥等敏感信息**不会**保存在设置文件中，需要通过环境变量提供：
- `GEMINI_API_KEY` - Gemini API
- `DEEPSEEK_API_KEY` - DeepSeek API
- `DASHSCOPE_API_KEY` - Alibaba Cloud DashScope
- `ANTHROPIC_API_KEY` - Anthropic Claude API
- `OPENAI_API_KEY` - OpenAI API
- `OPENROUTER_API_KEY` - OpenRouter API

## 配置流程

### 初次配置
1. 设置环境变量（例如在 `.env` 文件或系统环境变量中）
2. 启动 uEVO CLI
3. 选择对应的 API 提供商
4. 您的选择会自动保存到设置文件

### 后续使用
1. 确保环境变量仍然存在
2. 启动 uEVO CLI
3. CLI 会自动使用之前保存的 API 选择（如果环境变量存在）

## 环境变量配置方法

### 方法 1：使用 .env 文件（推荐）
在项目根目录创建 `.env` 文件：
```bash
DEEPSEEK_API_KEY=your-api-key-here
DASHSCOPE_API_KEY=your-api-key-here
```

### 方法 2：系统环境变量

#### Windows (PowerShell)
```powershell
# 临时设置（仅当前会话）
$env:DEEPSEEK_API_KEY="your-api-key-here"

# 永久设置（用户级别）
[System.Environment]::SetEnvironmentVariable('DEEPSEEK_API_KEY', 'your-api-key-here', 'User')
```

#### Linux/Mac
```bash
# 临时设置（仅当前会话）
export DEEPSEEK_API_KEY="your-api-key-here"

# 永久设置（添加到 ~/.bashrc 或 ~/.zshrc）
echo 'export DEEPSEEK_API_KEY="your-api-key-here"' >> ~/.bashrc
```

## API 状态说明

使用 `/api list` 命令时，您会看到以下状态：

- 🟢 **Active** - API 正在使用中
- 🟡 **Configured** - 环境变量已设置，可以切换使用
- 🟠 **Selected (Missing Env)** - 之前选择过此 API，但环境变量缺失
- 🔴 **Not Configured** - 未配置

## 常见问题

### Q: 为什么每次重启都需要重新配置？
A: 通常是因为环境变量没有正确设置。请确保：
1. 环境变量已经设置（使用 `.env` 文件或系统环境变量）
2. 如果使用 `.env` 文件，确保它在正确的位置
3. 如果使用系统环境变量，可能需要重启终端

### Q: 为什么不保存 API 密钥？
A: 出于安全考虑，我们不在配置文件中保存敏感信息如 API 密钥。这样可以防止密钥意外泄露。

### Q: 如何查看当前的 API 配置？
A: 使用以下命令：
- `/api status` - 查看当前激活的 API 详情
- `/api list` - 查看所有 API 的配置状态

## 最佳实践

1. **使用 .env 文件**：在项目中使用 `.env` 文件管理 API 密钥
2. **添加到 .gitignore**：确保 `.env` 文件不会被提交到版本控制
3. **使用环境变量管理工具**：如 direnv (Linux/Mac) 或 dotenv (跨平台)
4. **定期轮换密钥**：定期更新您的 API 密钥以提高安全性 