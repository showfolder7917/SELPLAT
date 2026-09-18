#!/bin/zsh

set -u

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR" || exit 1

# 记录本次启动脚本所在的终端窗口。成功后按 TTY 精确关闭，避免误关用户的其他终端窗口。
LAUNCH_TERMINAL_TTY="$(tty 2>/dev/null || true)"

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

APP_NAME="$(node -p "JSON.parse(require('fs').readFileSync('package.json','utf8')).name")"
BUILD_ROOT="$SELPLAT_ROOT/build/$APP_NAME"
PACKAGE_ROOT="$BUILD_ROOT/package/developer"

echo "[依赖] 正在核对当前锁文件专属缓存..."
if ! npm run dependencies:ensure; then
    echo "[错误] 依赖安装失败。"
    read "?按回车键关闭窗口..."
    exit 1
fi

# package:mac:developer 内部已经执行完整开发版构建；这里禁止提前重复构建一次。
echo "[构建与打包] 正在生成最新的自包含 AI Desktop.app..."
if ! npm run package:mac:developer; then
  echo "[错误] 开发版构建或 AI Desktop.app 生成失败，已取消启动。"
  read "?按回车键关闭窗口..."
  exit 1
fi
APP_PATH="$(find "$PACKAGE_ROOT" -type d -name 'AI Desktop.app' -print -quit 2>/dev/null)"

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
open -n "$APP_PATH" --args "--selplat-root=$SELPLAT_ROOT" "--ai-desktop-variant=developer"
if [[ $? -ne 0 ]]; then
  echo "[错误] AI Desktop.app 启动失败。"
  read "?按回车键关闭窗口..."
  exit 1
fi

echo "[完成] 已启动固定身份的 AI Desktop.app。"
echo "应用位置：$APP_PATH"

# 失败时保留终端供排查；只有成功启动后才异步关闭当前脚本对应的终端窗口。
if [[ "$LAUNCH_TERMINAL_TTY" == /dev/* ]]; then
  nohup /usr/bin/osascript \
    -e 'on run arguments' \
    -e 'set launchTty to item 1 of arguments' \
    -e 'delay 2' \
    -e 'tell application "Terminal"' \
    -e 'repeat with terminalWindow in windows' \
    -e 'repeat with terminalTab in tabs of terminalWindow' \
    -e 'if tty of terminalTab is launchTty then' \
    -e 'close terminalWindow' \
    -e 'return' \
    -e 'end if' \
    -e 'end repeat' \
    -e 'end repeat' \
    -e 'end tell' \
    -e 'end run' \
    "$LAUNCH_TERMINAL_TTY" >/dev/null 2>&1 &!
fi

exit 0
