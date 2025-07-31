#!/bin/bash

# uEVO CLI启动脚本
# 适用于bash/zsh等终端环境

# 获取脚本所在目录
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# 设置项目路径
UEVO_PATH="$SCRIPT_DIR/packages/cli/dist/index.js"

# 检查文件是否存在
if [ ! -f "$UEVO_PATH" ]; then
    echo "错误: 找不到uEVO CLI文件: $UEVO_PATH"
    echo "请确保项目已构建完成"
    exit 1
fi

# 运行uEVO
node "$UEVO_PATH" "$@" 