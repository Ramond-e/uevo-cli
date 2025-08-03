# /testspace 命令使用指南

`/testspace` 命令系列用于交互式设置和管理工具测试空间变量，这是 uEVO CLI 工具开发与自动化工作流的核心组件。

## 命令概览

### 基本命令
- `/testspace` - 显示当前测试空间配置
- `/testspace set <path>` - 设置自定义测试空间路径
- `/testspace create` - 创建测试空间目录
- `/testspace reset` - 重置为默认配置
- `/testspace remove` - 移除自定义配置

### 命令别名
- `/ts` - `/testspace` 的简短别名
- `/workspace` - `/testspace` 的完整别名

## 详细用法

### 1. 查看当前配置
```bash
/testspace
```
显示：
- 当前测试空间路径
- 环境变量设置状态
- 存储的配置信息
- 可用命令列表

### 2. 设置自定义路径
```bash
/testspace set ~/my-tools
/testspace set /opt/uevo-workspace
/testspace set C:\Tools\uevo
```
支持的路径格式：
- `~` - 用户主目录
- `~/path` - 相对于用户主目录的路径
- 绝对路径

### 3. 创建工作空间
```bash
/testspace create
```
自动创建：
- 测试空间主目录
- `docs/` 子目录（用于存放工具文档）
- `README.md` 说明文件

### 4. 重置配置
```bash
/testspace reset
```
清除所有自定义配置，恢复到默认路径：`~/uevo/testspace`

### 5. 移除自定义配置
```bash
/testspace remove
```
只移除自定义设置，保留默认行为

## 配置存储

### 环境变量
配置会自动设置 `UEVO_TESTSPACE` 环境变量

### 配置文件
设置持久化存储在：`~/.uevo/.uevo-env`

### 优先级
1. 当前进程的 `UEVO_TESTSPACE` 环境变量
2. 配置文件中的存储值
3. 默认路径：`~/uevo/testspace`

## 工具开发工作流集成

设置的测试空间会自动应用到工具开发工作流中：

1. **工具获取**：`git clone` 命令会将工具下载到测试空间
2. **工具部署**：改造后的工具会保存在对应项目目录
3. **文档生成**：工具文档会保存在 `docs/` 子目录

## 示例工作流

```bash
# 1. 设置自定义测试空间
/testspace set ~/development/uevo-tools

# 2. 创建工作空间目录
/testspace create

# 3. 验证配置
/testspace

# 4. 现在可以使用工具开发工作流
# AI会自动使用设置的测试空间路径
```

## 故障排除

### 路径不存在
如果设置的路径不存在，使用 `/testspace create` 创建目录

### 权限问题
确保对目标路径有读写权限

### 配置重置
如果遇到配置问题，使用 `/testspace reset` 重置到默认状态

## 注意事项

1. **路径安全**：设置的路径会在系统prompt中显示给AI，确保不包含敏感信息
2. **目录结构**：AI工具会在测试空间创建子目录，确保有足够的磁盘空间
3. **跨平台**：路径格式会自动适配当前操作系统
4. **持久化**：配置会在CLI重启后保持，除非手动重置
