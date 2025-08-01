# Anthropic API 认证设置指南

## 🔑 概述

uEVO CLI 现在支持 Anthropic API 认证，允许您使用 Claude 模型进行对话和工具调用。本指南将帮助您设置和配置 Anthropic API 认证。

## 📋 前置要求

1. **Anthropic API 账户**: 您需要在 [Anthropic Console](https://console.anthropic.com/) 创建账户
2. **API 密钥**: 从 Anthropic Console 获取您的 API 密钥
3. **uEVO CLI**: 确保您使用的是支持 Anthropic 认证的最新版本

## 🚀 设置步骤

### 1. 获取 Anthropic API 密钥

1. 访问 [Anthropic Console](https://console.anthropic.com/)
2. 登录或注册账户
3. 导航到 API 密钥管理页面
4. 创建新的 API 密钥
5. 复制生成的 API 密钥（格式通常为 `sk-ant-...`）

### 2. 配置环境变量

将您的 Anthropic API 密钥设置为环境变量：

#### Windows (PowerShell)
```powershell
$env:ANTHROPIC_API_KEY="your-anthropic-api-key-here"
```

#### Windows (Command Prompt)
```cmd
set ANTHROPIC_API_KEY=your-anthropic-api-key-here
```

#### macOS/Linux (Bash/Zsh)
```bash
export ANTHROPIC_API_KEY="sk-ant-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
```

#### 使用 .env 文件（推荐）
在项目根目录创建或编辑 `.env` 文件：
```env
ANTHROPIC_API_KEY=your-anthropic-api-key-here
```

### 3. 启动 uEVO CLI

运行 uEVO CLI：
```bash
npx uevo-cli
# 或
npm start
```

### 4. 选择认证方式

当 CLI 启动时，您会看到认证选择界面：

```
How would you like to authenticate for this project?

○ Login with Google
○ Use Gemini API Key  
○ Vertex AI
● Use Anthropic API Key  ← 选择这个选项
○ Use Aliyun DashScope API Key

(Use Enter to select)
```

如果您已经设置了 `ANTHROPIC_API_KEY` 环境变量，CLI 会自动检测并提示您使用 Anthropic 认证。

## 🎯 支持的 Claude 模型

配置完成后，您可以使用以下 Claude 模型：

- `claude-3-5-sonnet-20241022` (默认)
- `claude-3-opus-20240229`
- `claude-3-sonnet-20240229`
- `claude-3-haiku-20240307`

### 切换模型

使用 `/model` 命令切换到 Claude 模型：
```
/model claude-3-5-sonnet-20241022
```

## 🔧 验证设置

您可以通过以下方式验证 Anthropic 认证是否正确配置：

### 1. 检查环境变量
```bash
echo $ANTHROPIC_API_KEY  # macOS/Linux
echo %ANTHROPIC_API_KEY% # Windows CMD
$env:ANTHROPIC_API_KEY   # Windows PowerShell
```

### 2. 测试 API 连接
启动 CLI 后，发送一个简单的消息：
```
你好，请介绍一下你自己
```

如果配置正确，Claude 会响应并可以使用工具调用功能。

### 3. 测试工具调用
尝试一个需要工具调用的请求：
```
请列出当前目录的内容
```

您应该能看到工具调用过程和结果。

## 🛠️ 故障排除

### 常见问题

#### 1. "ANTHROPIC_API_KEY environment variable not found"
**解决方案**: 
- 确保正确设置了环境变量
- 重启终端/命令行界面
- 检查 `.env` 文件是否在正确位置

#### 2. "Invalid API key"
**解决方案**:
- 验证 API 密钥格式（应以 `sk-ant-` 开头）
- 确保 API 密钥没有过期
- 检查 Anthropic Console 中的 API 密钥状态

#### 3. "Rate limit exceeded"
**解决方案**:
- 检查您的 Anthropic 账户使用限制
- 等待一段时间后重试
- 考虑升级您的 Anthropic 计划

#### 4. 工具调用不工作
**解决方案**:
- 确保使用的是支持工具调用的 Claude 模型
- 检查 API 密钥是否有足够的权限
- 尝试重新启动 CLI

### 调试模式

启用调试模式以获取更详细的错误信息：
```bash
DEBUG=1 npx uevo-cli
```

## 🔒 安全最佳实践

1. **保护 API 密钥**: 
   - 不要在代码中硬编码 API 密钥
   - 使用环境变量或 `.env` 文件
   - 将 `.env` 文件添加到 `.gitignore`

2. **定期轮换密钥**: 
   - 定期更新您的 API 密钥
   - 删除不再使用的旧密钥

3. **监控使用情况**: 
   - 在 Anthropic Console 中监控 API 使用情况
   - 设置使用限额和警报

## 📊 使用限制

- **请求频率**: 根据您的 Anthropic 计划限制
- **上下文长度**: 不同模型有不同的上下文窗口大小
- **并发请求**: 根据您的账户类型限制

## 🆘 获取帮助

如果您遇到问题：

1. 查看 [uEVO CLI 文档](./docs/)
2. 检查 [Anthropic API 文档](https://docs.anthropic.com/)
3. 在项目 GitHub 上提交 Issue
4. 查看故障排除部分

## 🎉 完成！

现在您已经成功配置了 Anthropic API 认证！您可以：

- ✅ 使用 Claude 模型进行对话
- ✅ 执行工具调用（如文件操作、命令执行等）
- ✅ 享受与 Claude 的智能交互体验
- ✅ 在界面中看到完整的工具执行过程和结果

开始与 Claude 对话吧！🚀