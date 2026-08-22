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

if [[ ! -d "$SCRIPT_DIR/node_modules/electron" || ! -d "$SCRIPT_DIR/node_modules/@openai/codex" ]]; then
  echo "[安装] 正在安装开发版与官方 Codex Harness 依赖..."
  npm install --no-audit --no-fund || {
    echo "[错误] 依赖安装失败。"
    read "?按回车键关闭窗口..."
    exit 1
  }
fi

echo "[构建] 正在生成最新开发版..."
if ! npm run build:developer; then
  echo "[错误] 开发版构建失败，已取消启动。"
  read "?按回车键关闭窗口..."
  exit 1
fi

APP_PATH="$(find "$SCRIPT_DIR/release/developer" -type d -name 'AI Desktop.app' -print -quit)"
REPACKAGE_REQUIRED=false
if [[ -z "$APP_PATH" || ! -d "$APP_PATH" ]]; then
  REPACKAGE_REQUIRED=true
else
  for IDENTITY_INPUT in "$SCRIPT_DIR/electron/packaged-bootstrap.ts" "$SCRIPT_DIR/electron-builder.developer.json" "$SCRIPT_DIR/package.json" "$SCRIPT_DIR/package-lock.json"; do
    if [[ -e "$IDENTITY_INPUT" && "$IDENTITY_INPUT" -nt "$APP_PATH" ]]; then
      REPACKAGE_REQUIRED=true
      break
    fi
  done
fi

if [[ "$REPACKAGE_REQUIRED" == true ]]; then
  echo "[打包] 固定应用外壳发生变化，正在重新生成 AI Desktop.app..."
  if ! npm run package:mac:developer; then
    echo "[错误] AI Desktop.app 生成失败，已取消启动。"
    read "?按回车键关闭窗口..."
    exit 1
  fi
  APP_PATH="$(find "$SCRIPT_DIR/release/developer" -type d -name 'AI Desktop.app' -print -quit)"
else
  echo "[复用] 固定 AI Desktop.app 身份未变化，本轮只加载最新外部构建。"
fi

if [[ -z "$APP_PATH" || ! -d "$APP_PATH" ]]; then
  echo "[错误] 未找到 AI Desktop.app。"
  read "?按回车键关闭窗口..."
  exit 1
fi

EXPECTED_DESIGNATED_REQUIREMENT='designated => identifier "com.selplat.aidesktop.developer"'
if ! codesign --verify --deep --strict "$APP_PATH" >/dev/null 2>&1; then
  echo "[签名] 正在为固定应用外壳生成本机开发签名..."
  if ! codesign --force --deep --sign - "$APP_PATH"; then
    echo "[错误] AI Desktop.app 本机签名失败，已取消启动。"
    read "?按回车键关闭窗口..."
    exit 1
  fi
fi

# 默认临时签名会把 designated requirement 写成当前 CDHash，外壳一次重打包就会让已有 TCC 授权失配。
if ! codesign -d --requirements - "$APP_PATH" 2>&1 | grep -Fq "$EXPECTED_DESIGNATED_REQUIREMENT"; then
  echo "[签名] 正在写入稳定屏幕录制身份..."
  if ! codesign --force --sign - --requirements "=$EXPECTED_DESIGNATED_REQUIREMENT" "$APP_PATH"; then
    echo "[错误] AI Desktop.app 稳定指定要求签名失败，已取消启动。"
    read "?按回车键关闭窗口..."
    exit 1
  fi
fi

if ! codesign --verify --deep --strict "$APP_PATH" >/dev/null 2>&1; then
  echo "[错误] AI Desktop.app 稳定签名校验失败，已取消启动。"
  read "?按回车键关闭窗口..."
  exit 1
fi

APP_EXECUTABLE="$APP_PATH/Contents/MacOS/AI Desktop"
EXISTING_PIDS=()
while IFS= read -r EXISTING_PID; do
  [[ -n "$EXISTING_PID" ]] && EXISTING_PIDS+=("$EXISTING_PID")
done < <(ps -axo pid=,command= | awk -v target="$APP_EXECUTABLE" '
  {
    pid = $1
    sub(/^[[:space:]]*[0-9]+[[:space:]]+/, "", $0)
    if ($0 == target || index($0, target " ") == 1) print pid
  }
')

if (( ${#EXISTING_PIDS[@]} > 0 )); then
  echo "[切换] 正在关闭 ${#EXISTING_PIDS[@]} 个旧 AI Desktop 实例，防止旧代码和屏幕流继续占用..."
  kill "${EXISTING_PIDS[@]}" 2>/dev/null || true
  for _ in {1..50}; do
    REMAINING=false
    for EXISTING_PID in "${EXISTING_PIDS[@]}"; do
      if kill -0 "$EXISTING_PID" 2>/dev/null; then REMAINING=true; break; fi
    done
    [[ "$REMAINING" == false ]] && break
    sleep 0.1
  done
  if [[ "$REMAINING" == true ]]; then
    echo "[错误] 旧 AI Desktop 实例未能正常退出，已取消启动，避免多个版本并行。"
    read "?按回车键关闭窗口..."
    exit 1
  fi
fi

echo "[注册] 正在向 macOS 注册 AI Desktop.app..."
LSREGISTER="/System/Library/Frameworks/CoreServices.framework/Frameworks/LaunchServices.framework/Support/lsregister"
if [[ -x "$LSREGISTER" ]]; then
  "$LSREGISTER" -f "$APP_PATH"
fi

echo "[启动] 正在打开最新 AI Desktop.app..."
open -n "$APP_PATH" --args "--selplat-root=$SELPLAT_ROOT" "--ai-desktop-runtime-root=$SCRIPT_DIR" "--ai-desktop-variant=developer"
if [[ $? -ne 0 ]]; then
  echo "[错误] AI Desktop.app 启动失败。"
  read "?按回车键关闭窗口..."
  exit 1
fi

echo "[完成] 已启动固定身份的 AI Desktop.app。"
echo "应用位置：$APP_PATH"
sleep 2
exit 0
