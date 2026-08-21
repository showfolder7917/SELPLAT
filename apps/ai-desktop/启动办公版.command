#!/bin/zsh

set -u

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR" || exit 1

# 双击启动时补齐 Homebrew 的常用命令目录，并把稳定工程根传给桌面端。
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
export SELPLAT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

if ! command -v node >/dev/null 2>&1; then
  echo "[错误] 未找到 Node.js，请先安装 Node.js 20 或更高版本。"
  read "?按回车键关闭窗口..."
  exit 1
fi

if ! command -v npm >/dev/null 2>&1; then
  echo "[错误] 未找到 npm。"
  read "?按回车键关闭窗口..."
  exit 1
fi

if [[ ! -d "$SCRIPT_DIR/node_modules/electron" ]]; then
  echo "[安装] 正在安装办公版依赖..."
  npm install --no-audit --no-fund || {
    echo "[错误] 依赖安装失败。"
    read "?按回车键关闭窗口..."
    exit 1
  }
fi

echo "[启动] 正在构建并启动办公版..."
npm run start:office
APP_EXIT_CODE=$?

echo
echo "[结束] 办公版已停止，退出码：$APP_EXIT_CODE"
read "?按回车键关闭窗口..."
exit "$APP_EXIT_CODE"
