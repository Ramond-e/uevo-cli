# /trust 命令测试指南

本文档提供了 `/trust` 命令系列的测试步骤和预期结果。

## 测试准备

### 1. 环境设置
```bash
# 确保没有环境变量干扰
unset UEVO_TRUSTED_DIRS

# 创建测试目录结构
mkdir -p /tmp/trust-test/project1
mkdir -p /tmp/trust-test/project2
mkdir -p /tmp/trust-test/project3
echo "test file" > /tmp/trust-test/project1/test.txt
```

### 2. 清理现有配置
```bash
# 备份现有配置（如果有）
cp ~/.gemini/settings.json ~/.gemini/settings.json.backup 2>/dev/null || true

# 启动CLI
gemini
```

## 基础功能测试

### 测试1：查看初始状态
```bash
# 在CLI中执行
/trust status
```

**预期结果**：
- 显示当前目录不受信任
- 显示无可信目录配置
- 无环境变量配置

### 测试2：添加可信目录
```bash
/trust add /tmp/trust-test/project1
```

**预期结果**：
- 成功添加消息：`✓ Added trusted directory: /tmp/trust-test/project1`
- 提示重启CLI生效

### 测试3：查看添加后的状态
```bash
/trust list
```

**预期结果**：
- 显示1个可信目录
- 目录状态为存在（✓）
- 递归设置为Yes

### 测试4：添加更多目录
```bash
/trust add /tmp/trust-test/project2
/trust add /tmp/trust-test/project3
```

**预期结果**：
- 每次都成功添加
- 显示成功消息

### 测试5：重复添加测试
```bash
/trust add /tmp/trust-test/project1
```

**预期结果**：
- 显示"Directory is already trusted"消息
- 不重复添加

## 删除功能测试

### 测试6：通过索引删除
```bash
/trust list  # 查看当前列表
/trust remove 2  # 删除第2个项目
```

**预期结果**：
- 成功删除project2
- 显示删除确认消息

### 测试7：通过路径删除
```bash
/trust remove /tmp/trust-test/project3
```

**预期结果**：
- 成功删除project3
- 显示删除确认消息

### 测试8：删除不存在的目录
```bash
/trust remove /nonexistent/path
```

**预期结果**：
- 显示错误消息："Directory not found in trusted list"

## 检查功能测试

### 测试9：检查受信任路径
```bash
/trust check /tmp/trust-test/project1
```

**预期结果**：
- 显示"TRUSTED"状态
- 说明该路径在可信目录中

### 测试10：检查不受信任路径
```bash
/trust check /tmp/some-other-path
```

**预期结果**：
- 显示"NOT TRUSTED"状态
- 提示如何添加为可信目录

### 测试11：检查子目录（递归测试）
```bash
/trust check /tmp/trust-test/project1/subdir
```

**预期结果**：
- 显示"TRUSTED"状态（因为recursive=true）

## 清理功能测试

### 测试12：清除所有配置
```bash
/trust clear
```

**预期结果**：
- 显示清除成功消息
- 提示重启CLI生效

### 测试13：验证清除结果
```bash
/trust list
```

**预期结果**：
- 显示"No trusted directories configured"

## 环境变量测试

### 测试14：设置环境变量
```bash
# 退出CLI
/quit

# 设置环境变量
export UEVO_TRUSTED_DIRS="/tmp/trust-test/project1:/tmp/trust-test/project2"

# 重新启动CLI
gemini
```

### 测试15：验证环境变量配置
```bash
/trust list
```

**预期结果**：
- 显示环境变量配置的目录
- 显示"Environment Variable"部分
- 显示优先级说明

### 测试16：环境变量优先级测试
```bash
# 尝试添加配置文件中的目录
/trust add /tmp/trust-test/project3
/trust list
```

**预期结果**：
- 环境变量目录仍然显示
- 配置文件中的目录也会显示
- 说明优先级关系

## 功能集成测试

### 测试17：实际工具权限测试

#### 17.1 准备测试环境
```bash
# 退出CLI并清理环境变量
/quit
unset UEVO_TRUSTED_DIRS

# 创建测试文件
mkdir -p /tmp/trust-test/write-test
echo "original content" > /tmp/trust-test/write-test/test.txt
```

#### 17.2 未信任目录测试
```bash
# 启动CLI并进入测试目录
gemini
cd /tmp/trust-test/write-test

# 尝试文件操作（应该需要确认）
"请修改test.txt文件的内容"
```

**预期结果**：
- 文件操作需要用户确认
- Shell命令受到权限限制

#### 17.3 信任目录测试
```bash
# 添加当前目录为可信
/trust add .
/quit  # 重启生效

# 重新启动并测试
gemini
cd /tmp/trust-test/write-test

# 再次尝试文件操作（应该无需确认）
"请修改test.txt文件的内容"
```

**预期结果**：
- 文件操作无需确认
- Shell命令无权限限制

## 错误处理测试

### 测试18：无效路径测试
```bash
/trust add /this/path/does/not/exist
```

**预期结果**：
- 显示"Directory does not exist"错误

### 测试19：文件路径测试
```bash
/trust add /tmp/trust-test/project1/test.txt
```

**预期结果**：
- 显示"Path is not a directory"错误

### 测试20：权限错误测试
```bash
# 尝试添加需要特殊权限的目录（如果有）
/trust add /root  # 在普通用户下
```

**预期结果**：
- 可能显示权限相关错误
- 或成功添加但在使用时出错

## 清理测试环境

### 最终清理
```bash
# 在CLI中清理
/trust clear
/quit

# 在shell中清理
rm -rf /tmp/trust-test
mv ~/.gemini/settings.json.backup ~/.gemini/settings.json 2>/dev/null || true
unset UEVO_TRUSTED_DIRS
```

## 测试检查清单

- [ ] 基础状态显示
- [ ] 添加单个目录
- [ ] 添加多个目录
- [ ] 重复添加处理
- [ ] 通过索引删除
- [ ] 通过路径删除
- [ ] 删除不存在项处理
- [ ] 路径信任检查
- [ ] 递归目录信任
- [ ] 清除所有配置
- [ ] 环境变量配置
- [ ] 环境变量优先级
- [ ] 文件操作权限集成
- [ ] Shell命令权限集成
- [ ] 错误路径处理
- [ ] 文件vs目录检查
- [ ] 权限错误处理

## 已知限制

1. **重启要求**：通过 `/trust` 命令修改的配置需要重启CLI才能生效
2. **环境变量优先级**：环境变量会覆盖配置文件设置
3. **绝对路径**：内部统一使用绝对路径，相对路径会被转换
4. **平台差异**：Windows和Unix路径处理可能有细微差异

## 故障排除

### 配置不生效
- 确认已重启CLI
- 检查环境变量是否干扰
- 验证配置文件格式

### 路径识别问题
- 使用绝对路径
- 检查目录是否存在
- 验证权限设置

### 权限仍然被检查
- 确认当前目录在可信目录中
- 检查recursive设置
- 重启CLI确保配置生效