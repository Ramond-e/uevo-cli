# 在Bash中使用uEVO

如果您在bash终端中无法直接使用 `uevo` 命令，请使用以下解决方案：

## 方案1：使用npm link（推荐）

从源码构建后，需要创建全局命令链接：

```bash
cd uevo-cli/packages/cli
npm link
```

然后就可以在任何位置使用：
```bash
uevo
```

## 方案2：使用启动脚本

1. 给脚本添加执行权限：
```bash
chmod +x uevo.sh
```

2. 在项目根目录运行uEVO：
```bash
./uevo.sh
```

3. 或者从任何位置运行（使用完整路径）：
```bash
/e/IDEProjects/AI/uevo/uevo.sh
```

## 方案3：直接使用node命令

```bash
node /e/IDEProjects/AI/uevo/packages/cli/dist/index.js
```

## 方案4：设置PATH环境变量

在您的 `~/.bashrc` 或 `~/.bash_profile` 中添加：

```bash
# 添加npm全局bin目录到PATH
export PATH="$PATH:/c/Users/Lenovo/AppData/Roaming/npm"

# 或者创建别名
alias uevo='node /e/IDEProjects/AI/uevo/packages/cli/dist/index.js'
```

然后重新加载bash配置：
```bash
source ~/.bashrc
```

## 方案5：使用npx（如果可用）

```bash
npx @uevo/uevo-cli
```

## 验证安装

运行以下命令验证uEVO是否正常工作：

```bash
./uevo.sh --version
```

您应该看到版本号 `0.1.13`。

## 启动uEVO

```bash
./uevo.sh
```

这将启动uEVO CLI界面，您将看到美观的"uEVO" ASCII艺术字标题！ 