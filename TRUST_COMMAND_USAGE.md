# /trust 命令系列使用指南

## 概述

`/trust` 命令系列允许您通过CLI界面动态管理可信目录，无需手动编辑配置文件。在可信目录中，所有工具操作都会绕过权限检查和确认提示。

## 命令列表

### `/trust` 或 `/trust status`
显示当前可信目录状态和配置概览。

**语法**：
```
/trust
/trust status
/trust show
/trust current
```

**示例输出**：
```
Trusted Directories Status

Current Directory: ✓ TRUSTED
/home/user/my-project

Configured Trusted Directories:
Recursive: Yes
Description: 开发环境可信目录

1. ✓ /home/user/my-project
2. ✗ /opt/missing-dir
```

### `/trust add <path>`
添加目录到可信列表。

**语法**：
```
/trust add <directory-path>
/trust trust <directory-path>
```

**示例**：
```
/trust add /home/user/safe-project
/trust add D:\dev\workspace
/trust add .  # 当前目录
```

**功能**：
- 自动转换为绝对路径
- 验证目录是否存在
- 检查路径是否为目录
- 防止重复添加
- 持久化保存到 `settings.json`

### `/trust remove <path-or-index>`
从可信列表中移除目录。

**语法**：
```
/trust remove <directory-path>
/trust remove <index>        # 使用 /trust list 中显示的数字索引
/trust rm <path-or-index>
/trust delete <path-or-index>
/trust untrust <path-or-index>
```

**示例**：
```
/trust remove /home/user/old-project
/trust rm 2                             # 移除列表中的第2项
/trust untrust D:\dev\old-workspace
```

### `/trust list`
列出所有已配置的可信目录。

**语法**：
```
/trust list
/trust ls
/trust all
```

**示例输出**：
```
Trusted Directories

Recursive: Yes
Description: 开发环境可信目录

1. ✓ /home/user/project-a
2. ✓ /home/user/project-b
3. ✗ /opt/deleted-project

Environment Variable (UEVO_TRUSTED_DIRS):
E1. ✓ /tmp/temp-workspace
E2. ✗ /var/missing-temp

Legend: ✓ Directory exists, ✗ Directory not found
Note: Environment variables override settings.json configuration
```

### `/trust clear`
清除所有可信目录。

**语法**：
```
/trust clear
/trust reset
/trust clean
```

**警告**：此操作会移除所有配置的可信目录，且不可撤销。

### `/trust check <path>`
检查指定路径是否被信任。

**语法**：
```
/trust check <path>
/trust test <path>
/trust verify <path>
```

**示例**：
```
/trust check /home/user/some-directory
/trust check .
/trust verify D:\uncertain\folder
```

**示例输出**：
```
Trust Check

Path: /home/user/some-directory
Status: ✓ TRUSTED

This path is in a trusted directory. All tool operations here will bypass permission checks.
```

## 配置优先级

配置按以下优先级应用（从高到低）：

1. **环境变量** (`UEVO_TRUSTED_DIRS`)
2. **settings.json** 配置文件

如果设置了环境变量，它会覆盖 `settings.json` 中的配置。

## 使用场景

### 1. 快速添加当前项目
```bash
cd /path/to/my-project
gemini
# 在CLI中：
/trust add .
```

### 2. 管理多个开发目录
```bash
# 添加多个项目目录
/trust add /home/user/project1
/trust add /home/user/project2
/trust add /home/user/project3
# 查看列表
/trust list
```

### 3. 临时项目管理
```bash
# 添加临时项目
/trust add /tmp/temp-work
# 完成后清理
/trust remove /tmp/temp-work
```

### 4. 批量清理
```bash
# 查看当前配置
/trust list
# 如果需要重新开始
/trust clear
```

## 安全注意事项

⚠️ **重要提醒**：

1. **只信任您完全控制的目录**
   ```bash
   # ✅ 安全的例子
   /trust add /home/myusername/my-projects
   /trust add D:\My-Development
   
   # ❌ 危险的例子 - 不要这样做！
   /trust add /
   /trust add C:\
   /trust add /usr
   /trust add /etc
   ```

2. **定期审查可信目录**
   ```bash
   # 定期检查配置
   /trust list
   # 移除不再需要的目录
   /trust remove /path/to/old/project
   ```

3. **验证路径安全性**
   ```bash
   # 在添加前先检查
   /trust check /uncertain/path
   # 只有确认安全后再添加
   /trust add /uncertain/path
   ```

## 技术细节

### 配置文件位置
- **Windows**: `%USERPROFILE%\.gemini\settings.json`
- **Linux/macOS**: `~/.gemini/settings.json`

### 配置格式
```json
{
  "trustedDirs": {
    "directories": [
      "/home/user/project1",
      "/home/user/project2"
    ],
    "recursive": true,
    "description": "Managed via /trust command"
  }
}
```

### 配置生效
- 通过 `/trust` 命令修改的配置需要**重启CLI**才能生效
- 环境变量 `UEVO_TRUSTED_DIRS` 在CLI启动时读取

### 路径处理
- 所有路径都会自动转换为绝对路径
- 支持相对路径（如 `.` 表示当前目录）
- Windows路径支持正斜杠和反斜杠

## 常见问题

### Q: 为什么修改后没有生效？
A: 通过 `/trust` 命令修改的配置需要重启CLI才能生效。

### Q: 环境变量和配置文件冲突了怎么办？
A: 环境变量优先级更高，会覆盖配置文件中的设置。

### Q: 如何临时禁用可信目录？
A: 可以设置空的环境变量：
```bash
export UEVO_TRUSTED_DIRS=""
```

### Q: 可以信任网络驱动器吗？
A: 可以，但要确保网络驱动器稳定可用，否则可能导致工具执行失败。

### Q: 递归设置是什么意思？
A: `recursive: true`（默认）表示信任指定目录及其所有子目录。设置为 `false` 则只信任指定的确切目录。

## 相关文档

- [可信目录功能详细说明](./TRUSTED_DIRS_USAGE.md)
- [配置文档](./docs/cli/configuration.md)
- [Shell工具文档](./docs/tools/shell.md)