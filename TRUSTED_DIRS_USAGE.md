# 可信目录 (Trusted Directories) 使用指南

## 概述

可信目录功能允许您指定一些目录，在这些目录中，所有工具操作都会绕过权限检查和确认提示，提供更流畅的工作体验。

## 配置方式

### 1. 通过环境变量配置（推荐用于测试）

设置 `UEVO_TRUSTED_DIRS` 环境变量，使用系统路径分隔符分隔多个目录：

**Windows (PowerShell)**:
```powershell
# 单个目录
$env:UEVO_TRUSTED_DIRS = "D:\dev\trusted-project"

# 多个目录
$env:UEVO_TRUSTED_DIRS = "D:\dev\project1;D:\dev\project2;C:\workspace\safe-area"

# 启动CLI
gemini -p "您的提示"
```

**Linux/macOS (Bash)**:
```bash
# 单个目录
export UEVO_TRUSTED_DIRS="/home/user/trusted-project"

# 多个目录
export UEVO_TRUSTED_DIRS="/home/user/project1:/home/user/project2:/opt/workspace/safe-area"

# 启动CLI
gemini -p "您的提示"
```

### 2. 通过 settings.json 配置（推荐用于持久配置）

在您的 `.gemini/settings.json` 文件中添加 `trustedDirs` 配置：

```json
{
  "trustedDirs": {
    "directories": [
      "/home/user/trusted-project",
      "/opt/workspace/safe-area",
      "D:\\dev\\project1"
    ],
    "recursive": true,
    "description": "开发环境中的可信目录"
  }
}
```

**配置选项说明**：
- `directories`: 可信目录列表（必需）
- `recursive`: 是否递归信任子目录，默认为 `true`（可选）
- `description`: 配置描述，用于日志和调试（可选）

## 功能特性

### 1. Shell 工具无限制访问

在可信目录中，shell 工具可以执行任何命令，无需权限检查：

```bash
# 在可信目录中，以下命令都会被允许
gemini -p "run shell command: rm -rf temp_files"
gemini -p "run shell command: sudo apt install new-package"
gemini -p "run shell command: format disk" # 注意：危险操作仍需谨慎
```

### 2. 文件操作无确认提示

在可信目录中，文件读写和编辑操作不需要用户确认：

```bash
# 直接执行，无需确认
gemini -p "写入配置文件到 config/app.json"
gemini -p "修改 src/main.py 中的函数"
gemini -p "创建新文件 docs/api.md"
```

### 3. 递归子目录支持

默认情况下，可信目录的所有子目录也被信任：

```
/home/user/trusted-project/        # 可信
├── src/                          # 可信
├── tests/                        # 可信
└── config/                       # 可信
    └── environments/             # 可信
```

如果设置 `"recursive": false`，则只有指定的确切目录被信任。

## 安全注意事项

⚠️ **重要警告**：可信目录功能会绕过所有安全检查，请谨慎使用！

### 建议的最佳实践

1. **只信任您完全控制的目录**
   ```json
   {
     "trustedDirs": {
       "directories": [
         "/home/user/my-projects",
         "/opt/my-workspace"
       ]
     }
   }
   ```

2. **避免信任系统关键目录**
   ```json
   // ❌ 危险 - 不要这样做
   {
     "trustedDirs": {
       "directories": [
         "/",           // 根目录
         "/usr",        // 系统目录
         "/etc",        // 配置目录
         "C:\\"         // Windows 根目录
       ]
     }
   }
   ```

3. **使用描述性配置**
   ```json
   {
     "trustedDirs": {
       "directories": ["/home/user/safe-sandbox"],
       "description": "个人开发沙盒环境 - 2024年1月配置"
     }
   }
   ```

4. **定期审查可信目录列表**

## 使用场景示例

### 开发环境配置

```json
{
  "trustedDirs": {
    "directories": [
      "/home/developer/workspace",
      "/opt/projects/current-sprint"
    ],
    "recursive": true,
    "description": "当前开发项目的可信环境"
  }
}
```

### 数据处理项目

```json
{
  "trustedDirs": {
    "directories": [
      "/data/processing/input",
      "/data/processing/output",
      "/scripts/data-pipeline"
    ],
    "recursive": false,
    "description": "数据处理管道的指定目录"
  }
}
```

## 故障排除

### 1. 环境变量不生效

确保环境变量设置正确并重启终端：

```bash
# 验证环境变量
echo $UEVO_TRUSTED_DIRS  # Linux/macOS
echo $env:UEVO_TRUSTED_DIRS  # Windows PowerShell
```

### 2. 路径格式问题

- 使用绝对路径
- Windows 路径使用正斜杠或转义反斜杠
- 确保目录存在

### 3. 配置优先级

配置优先级（从高到低）：
1. `UEVO_TRUSTED_DIRS` 环境变量
2. `settings.json` 中的 `trustedDirs` 配置

### 4. 调试模式

使用调试模式查看可信目录加载情况：

```bash
DEBUG=1 gemini -p "测试可信目录"
```

## 相关文档

- [配置文档](./docs/cli/configuration.md)
- [Shell 工具文档](./docs/tools/shell.md)
- [文件系统工具文档](./docs/tools/file-system.md)