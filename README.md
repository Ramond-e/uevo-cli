# 🚀 uEVO CLI - 自进化AI编程助手

[![GitHub](https://img.shields.io/badge/GitHub-AstreoX%2Fuevo--cli-blue.svg)](https://github.com/AstreoX/uevo-cli)
[![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)
[![Node.js](https://img.shields.io/badge/Node.js-20%2B-green.svg)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0%2B-blue.svg)](https://www.typescriptlang.org/)

> **🧬 革命性的自进化AI编程助手 - 让AI学会编写工具，实现真正的自我进化**

uEVO CLI 是基于 Google Gemini CLI 深度定制开发的下一代AI编程助手。我们的核心创新在于让AI具备**自我进化能力** - 它不仅能使用现有工具，更能根据需求**自主编写新工具**，从而不断扩展自己的能力边界。

---

## 🌟 核心特色

### 🧬 **自进化引擎** - 我们的核心创新
- **🛠️ 自主工具开发**：AI能够分析需求并编写新的工具函数
- **🔄 动态能力扩展**：实时学习和适应新的编程场景
- **📚 工具知识积累**：持续优化和改进已有工具
- **🎯 需求驱动进化**：根据实际使用场景自动进化功能

### 🌐 **多Provider AI支持** - 打破单一模型限制
- **🤖 六大AI提供商**：Gemini、DeepSeek、Claude、GPT、OpenRouter、阿里云Qwen
- **🔀 智能路由**：根据任务类型自动选择最适合的AI模型
- **🔧 一键配置**：通过 `/api config` 交互式配置所有API
- **⚡ 无缝切换**：使用 `/api switch` 快速切换AI提供商

### 📋 **智能任务管理** - TODO系统升级
- **🧠 任务智能分析**：自动将复杂需求分解为可执行的TODO清单
- **📊 实时进度追踪**：美观的渐变色进度显示和状态管理
- **🎯 上下文感知**：基于代码库结构生成精准的任务步骤
- **✅ 自动状态更新**：AI执行过程中自动更新任务完成状态

### 🎨 **个性化规则引擎** - 让AI按你的方式工作
- **📝 自定义编码规则**：通过 `/rules` 命令管理个人编程偏好
- **🖥️ 系统环境感知**：自动检测并适配您的开发环境
- **🔄 规则持久化**：规则配置跨会话保存，一次设置永久生效
- **🎯 上下文应用**：规则自动应用到所有代码生成和修改任务

---

## 🚀 快速开始

### 📦 安装方式

#### 方式一：NPX 直接运行（推荐）
```bash
npx @uevo/uevo-cli
```

#### 方式二：全局安装
```bash
npm install -g @uevo/uevo-cli
uevo
```

#### 方式三：从源码构建
```bash
git clone https://github.com/AstreoX/uevo-cli.git
cd uevo-cli
npm install
npm run build
cd packages/cli
npm link
```

构建完成后，您可以在任何位置使用`uevo`命令：
```bash
uevo
```

### ⚙️ 环境配置

1. **设置API密钥**（选择一个或多个）：
   ```bash
   export GEMINI_API_KEY="your-gemini-api-key"          # Google Gemini
   export DEEPSEEK_API_KEY="your-deepseek-api-key"    # DeepSeek
   export ANTHROPIC_API_KEY="your-claude-api-key"     # Anthropic Claude
   export OPENAI_API_KEY="your-openai-api-key"        # OpenAI GPT
   export DASHSCOPE_API_KEY="your-qwen-api-key"       # 阿里云Qwen
   export OPENROUTER_API_KEY="your-openrouter-key"    # OpenRouter
   ```

2. **或使用交互式配置**：
   ```bash
   uevo
   /api config  # 选择提供商并配置API密钥
   ```

---

## 💡 核心功能详解

### 🧬 自进化工具系统

uEVO的最大创新是**让AI学会编写工具**。当遇到现有工具无法解决的问题时，AI会：

1. **分析需求缺口**：识别当前工具集的不足
2. **设计工具架构**：规划新工具的接口和实现
3. **编写工具代码**：生成符合框架规范的工具类
4. **动态注册加载**：将新工具集成到系统中
5. **验证和优化**：测试工具功能并持续改进

```bash
> 我需要一个能够自动重构React组件的工具
# AI会分析需求，编写ReactRefactorTool，并立即投入使用
```

### 🌐 多Provider智能路由

支持6大主流AI提供商，根据任务特点自动选择最佳模型：

| 提供商 | 适用场景 | 特色模型 |
|--------|----------|----------|
| **Gemini** | 通用编程、代码理解 | gemini-2.0-flash-exp |
| **DeepSeek** | 代码生成、算法优化 | deepseek-chat, deepseek-reasoner |
| **Claude** | 文档写作、架构设计 | claude-3.5-sonnet |
| **GPT** | 创意编程、问题解决 | gpt-4o, gpt-4o-mini |
| **Qwen** | 中文编程、本土化开发 | qwen-max, qwen-coder-plus |
| **OpenRouter** | 模型聚合、成本优化 | 200+ 模型选择 |

```bash
/api list              # 查看所有可用提供商
/api switch deepseek   # 切换到DeepSeek
/api test qwen-max     # 测试阿里云Qwen连接
```

### 📋 智能TODO管理

将复杂任务自动分解为可执行步骤：

```bash
> 帮我创建一个带用户认证的博客系统

📋 任务清单
01. ○ 设计数据库schema（用户表、文章表、评论表）
02. ○ 创建用户认证中间件
03. ○ 实现用户注册和登录API
04. ○ 开发文章CRUD接口
05. ○ 构建前端登录注册组件
06. ○ 实现文章列表和详情页面
07. ○ 添加评论功能模块

# AI会按序执行，实时更新进度：
01. ● 设计数据库schema（用户表、文章表、评论表）
02. ◐ 创建用户认证中间件  # 进行中
03. ○ 实现用户注册和登录API
...
```

### 🎨 个性化规则系统

让AI按照你的编程风格工作：

```bash
/rules add "优先使用TypeScript严格模式"
/rules add "React组件使用函数式组件和Hooks"
/rules add "API接口遵循RESTful设计原则"
/rules add "代码注释使用中文，变量命名使用英文"

# 查看所有规则
/rules

📋 当前规则配置：
规则 0 (系统信息)： Windows 11, Node.js 20.x, TypeScript 5.x
用户自定义规则：
1. 优先使用TypeScript严格模式
2. React组件使用函数式组件和Hooks
3. API接口遵循RESTful设计原则
4. 代码注释使用中文，变量命名使用英文
```

---

## 🛠️ 高级功能

### 🔧 工具生态系统

内置丰富的开发工具：

- **📁 文件系统**：`read_file`, `write_file`, `grep`, `glob`
- **🔄 代码编辑**：`edit`, `multi_edit`, `refactor`
- **🌐 网络工具**：`web_fetch`, `web_search`
- **💾 记忆系统**：`memory_save`, `memory_recall`
- **⚡ Shell集成**：`shell_command`, `script_runner`

### 🧪 沙盒环境

安全的代码执行环境：
- Docker容器隔离
- 资源使用限制
- 网络访问控制
- 文件系统权限管理

### 📊 开发者体验

- **🎨 美观界面**：渐变色彩、ASCII艺术、进度条
- **🔍 智能补全**：命令和参数自动提示
- **📝 详细日志**：完整的操作记录和调试信息
- **⚡ 高性能**：并行处理、流式响应、增量更新

---

## 🌍 社区与生态

### 🤝 参与贡献

我们欢迎各种形式的贡献：

- **🐛 报告Bug**：[提交Issue](https://github.com/AstreoX/uevo-cli/issues)
- **💡 功能建议**：分享你的创意想法
- **🔧 代码贡献**：[提交Pull Request](https://github.com/AstreoX/uevo-cli/pulls)
- **📖 文档改进**：完善使用指南

### 📚 学习资源

- **📖 [完整文档](./docs/)**：详细的功能说明和API参考
- **🎯 [最佳实践](./docs/best-practices.md)**：高效使用uEVO的技巧
- **🔧 [工具开发指南](./docs/tool-development.md)**：如何扩展uEVO功能
- **🚀 [部署指南](./docs/deployment.md)**：生产环境部署方案

---

## 📄 许可证与致谢

本项目基于 **Apache License 2.0** 开源协议发布。

### 🙏 特别致谢

- **Google Gemini Team** - 为我们提供了优秀的基础框架
- **开源社区** - 持续的反馈和贡献让uEVO不断进步
- **AI研究社区** - 推动人工智能技术的边界

---

## 🔮 未来展望

uEVO的发展路线图：

- **🧬 v1.4**：完成Agent自主创建工具的实验沙箱
- **🌐 v1.5**：接入GitHub search等MCP搜索服务
- **🤖 v1.6**：完善todo列表管理功能
- **🚀 v1.7**：增强模型调度以及上下文管理功能

---

**💬 加入我们的旅程，一起探索AI编程的无限可能！**

> *"The future belongs to those who believe in the beauty of their dreams."*  
> *未来属于那些相信梦想之美的人。*
