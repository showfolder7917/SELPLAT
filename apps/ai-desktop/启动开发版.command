#!/bin/zsh

set -u

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR" || exit 1

# 无参数保持人工双击行为；受控集成重启必须携带批次、候选提交和旧进程，供新版本核验后原位续接。
CONTROLLED_BATCH=""
CONTROLLED_SHA=""
CONTROLLED_OLD_PID=""
CONTROLLED_USER_DATA_DIR=""
if (( $# > 0 )); then
  if (( $# < 3 || $# > 4 )) || [[ "$1" != --release-batch=* || "$2" != --runtime-sha=* || "$3" != --replace-pid=* ]]; then
    echo "[错误] 受控重启参数不完整。"
    exit 1
  fi
  if (( $# == 4 )) && [[ "$4" != --user-data-dir=* ]]; then
    echo "[错误] 受控重启参数不完整。"
    exit 1
  fi
  CONTROLLED_BATCH="${1#--release-batch=}"
  CONTROLLED_SHA="${2#--runtime-sha=}"
  CONTROLLED_OLD_PID="${3#--replace-pid=}"
  if (( $# == 4 )); then CONTROLLED_USER_DATA_DIR="${4#--user-data-dir=}"; fi
  if [[ ! "$CONTROLLED_BATCH" =~ '^[a-zA-Z0-9._-]+$' || ! "$CONTROLLED_SHA" =~ '^[0-9a-f]{40,64}$' || ! "$CONTROLLED_OLD_PID" =~ '^[0-9]+$' ]]; then
    echo "[错误] 受控重启参数格式无效。"
    exit 1
  fi
  if (( $# == 4 )) && [[ "$CONTROLLED_USER_DATA_DIR" != /* ]]; then
    echo "[错误] 受控重启的用户数据目录不是绝对路径。"
    exit 1
  fi
fi

# 受控后台启动没有终端输入，错误直接写日志退出；人工双击仍保留排查窗口。
wait_before_close() {
  [[ -n "$CONTROLLED_BATCH" ]] || read "?按回车键关闭窗口..."
}

# 记录本次启动脚本所在的终端窗口。成功后按 TTY 精确关闭，避免误关用户的其他终端窗口。
LAUNCH_TERMINAL_TTY="$(tty 2>/dev/null || true)"

# 双击启动时补齐 Homebrew 的常用命令目录，并把稳定工程根传给桌面端。
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
export SELPLAT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

if [[ -n "$CONTROLLED_SHA" ]]; then
  if [[ -n "$(git -C "$SELPLAT_ROOT" status --porcelain)" ]] || ! git -C "$SELPLAT_ROOT" diff --quiet "$CONTROLLED_SHA" HEAD --; then
    echo "[错误] 当前工程源码不是已核验的候选版本，已停止受控重启。"
    exit 1
  fi
fi

if ! command -v node >/dev/null 2>&1; then
  echo "[错误] 未找到 Node.js，请先安装 Node.js 20 或更高版本。"
  wait_before_close
  exit 1
fi

if ! command -v npm >/dev/null 2>&1; then
  echo "[错误] 未找到 npm。"
  wait_before_close
  exit 1
fi

APP_NAME="$(node -p "JSON.parse(require('fs').readFileSync('package.json','utf8')).name")"
BUILD_ROOT="$SELPLAT_ROOT/build/$APP_NAME"
PACKAGE_AREA="$BUILD_ROOT/package"
RUNS_ROOT="$PACKAGE_AREA/developer-runs"
if [[ -L "$PACKAGE_AREA" || -L "$RUNS_ROOT" ]]; then
  echo "[错误] 打包目录不能是符号链接。"
  exit 1
fi
mkdir -p "$PACKAGE_AREA" "$RUNS_ROOT" || exit 1
RUN_ID="${CONTROLLED_BATCH:-manual-$(date +%Y%m%d%H%M%S)}-$$"
RUN_PATH="$RUNS_ROOT/$RUN_ID"
if ! mkdir "$RUN_PATH"; then
  echo "[错误] 本次隔离打包目录已存在，拒绝覆盖。"
  exit 1
fi
export AI_DESKTOP_PACKAGE_OUTPUT_ROOT="$RUN_PATH"
PACKAGE_ROOT="$RUN_PATH"

echo "[依赖] 正在核对当前锁文件专属缓存..."
if ! npm run dependencies:ensure; then
    echo "[错误] 依赖安装失败。"
    wait_before_close
    exit 1
fi

# package:mac:developer 内部已经执行完整开发版构建；这里禁止提前重复构建一次。
echo "[构建与打包] 正在生成最新的自包含 AI Desktop.app..."
if ! npm run package:mac:developer; then
  echo "[错误] 开发版构建或 AI Desktop.app 生成失败，已取消启动。"
  wait_before_close
  exit 1
fi
APP_PATH="$(find "$PACKAGE_ROOT" -type d -name 'AI Desktop.app' -print -quit 2>/dev/null)"

if [[ -z "$APP_PATH" || ! -d "$APP_PATH" ]]; then
  echo "[错误] 未找到 AI Desktop.app。"
  wait_before_close
  exit 1
fi

EXPECTED_DESIGNATED_REQUIREMENT='designated => identifier "com.selplat.aidesktop.developer"'
if ! codesign --verify --deep --strict "$APP_PATH" >/dev/null 2>&1; then
  echo "[签名] 正在为固定应用外壳生成本机开发签名..."
  if ! codesign --force --deep --sign - "$APP_PATH"; then
    echo "[错误] AI Desktop.app 本机签名失败，已取消启动。"
    wait_before_close
    exit 1
  fi
fi

# 在旧实例仍可用时完成产物与隔离启动验证；失败保留本次目录供令狐排查。
if ! npm run verify:package-content || ! npm run verify:mac:developer; then
  echo "[错误] 隔离包验证失败；旧实例未关闭。诊断包：$RUN_PATH"
  wait_before_close
  exit 1
fi
unset AI_DESKTOP_PACKAGE_OUTPUT_ROOT

# 默认临时签名会把 designated requirement 写成当前 CDHash，外壳一次重打包就会让已有 TCC 授权失配。
if ! codesign -d --requirements - "$APP_PATH" 2>&1 | grep -Fq "$EXPECTED_DESIGNATED_REQUIREMENT"; then
  echo "[签名] 正在写入稳定屏幕录制身份..."
  if ! codesign --force --sign - --requirements "=$EXPECTED_DESIGNATED_REQUIREMENT" "$APP_PATH"; then
    echo "[错误] AI Desktop.app 稳定指定要求签名失败，已取消启动。"
    wait_before_close
    exit 1
  fi
fi

if ! codesign --verify --deep --strict "$APP_PATH" >/dev/null 2>&1; then
  echo "[错误] AI Desktop.app 稳定签名校验失败，已取消启动。"
  wait_before_close
  exit 1
fi

APP_EXECUTABLE="$APP_PATH/Contents/MacOS/AI Desktop"
if [[ -n "$CONTROLLED_SHA" ]]; then
  # 包外清单与启动参数必须一致，新进程才会把本批次标记为真正重启健康。
  node -e 'const fs=require("node:fs");const path=require("node:path");fs.writeFileSync(path.join(process.argv[2],"ai-desktop-runtime-source.json"),JSON.stringify({sourceSha:process.argv[1]})+"\n")' "$CONTROLLED_SHA" "$(dirname "$APP_PATH")" || exit 1
fi
EXISTING_PIDS=()
while IFS= read -r EXISTING_PID; do
  [[ -n "$EXISTING_PID" ]] && EXISTING_PIDS+=("$EXISTING_PID")
done < <(ps -axo pid=,command= | awk -v packageRoot="$PACKAGE_AREA/" '
  {
    pid = $1
    sub(/^[[:space:]]*[0-9]+[[:space:]]+/, "", $0)
    if (index($0, packageRoot) > 0 && index($0, "/AI Desktop.app/Contents/MacOS/AI Desktop") > 0) print pid
  }
')
if [[ -n "$CONTROLLED_OLD_PID" ]]; then
  OLD_COMMAND="$(ps -p "$CONTROLLED_OLD_PID" -o command= 2>/dev/null || true)"
  if [[ "$OLD_COMMAND" != *"AI Desktop.app/Contents/MacOS/AI Desktop"* ]]; then
    echo "[错误] 待替换进程不是 AI Desktop，已取消重启。"
    exit 1
  fi
  EXISTING_PIDS+=("$CONTROLLED_OLD_PID")
fi
EXISTING_PIDS=("${(@u)EXISTING_PIDS}")

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
    wait_before_close
    exit 1
  fi
fi

echo "[注册] 正在向 macOS 注册 AI Desktop.app..."
LSREGISTER="/System/Library/Frameworks/CoreServices.framework/Frameworks/LaunchServices.framework/Support/lsregister"
if [[ -x "$LSREGISTER" ]]; then
  "$LSREGISTER" -f "$APP_PATH"
fi

echo "[启动] 正在打开最新 AI Desktop.app..."
LAUNCH_ARGS=("--selplat-root=$SELPLAT_ROOT" "--ai-desktop-variant=developer")
READY_FILE="$RUN_PATH/.renderer-ready.json"
LAUNCH_ARGS+=("--ai-desktop-launch-ready-file=$READY_FILE")
if [[ -n "$CONTROLLED_SHA" ]]; then
  LAUNCH_ARGS+=("--ai-desktop-runtime-sha=$CONTROLLED_SHA" "--ai-desktop-resume-release=$CONTROLLED_BATCH")
  if [[ -n "$CONTROLLED_USER_DATA_DIR" ]]; then LAUNCH_ARGS+=("--ai-desktop-user-data-dir=$CONTROLLED_USER_DATA_DIR"); fi
fi
open -n "$APP_PATH" --args "${LAUNCH_ARGS[@]}"
if [[ $? -ne 0 ]]; then
  echo "[错误] AI Desktop.app 启动失败。"
  wait_before_close
  exit 1
fi

# 新实例的 Renderer 真正就绪后才回收旧开发包；进程出现本身不算健康。
NEW_PROCESS_READY=false
for _ in {1..300}; do
  if [[ -f "$READY_FILE" ]]; then
    NEW_PROCESS_READY=true
    break
  fi
  sleep 0.1
done
if [[ "$NEW_PROCESS_READY" == true ]]; then
  for OLD_RUN in "$RUNS_ROOT"/*(N/); do
    [[ "$OLD_RUN" == "$RUN_PATH" ]] && continue
    [[ -L "$OLD_RUN" ]] && continue
    rm -rf -- "$OLD_RUN"
  done
  # 旧固定输出不再是运行位置；正式发布接口仍由原有 npm 命令保留。
  if [[ -d "$PACKAGE_AREA/developer" ]]; then rm -rf -- "$PACKAGE_AREA/developer"; fi
  # 历史正式发布副本只在新开发版页面就绪后回收；发布归档文档不在此目录。
  if [[ -d "$PACKAGE_AREA/published" && ! -L "$PACKAGE_AREA/published" ]]; then
    for OLD_PUBLISHED in "$PACKAGE_AREA/published"/*(N/); do
      [[ -L "$OLD_PUBLISHED" ]] && continue
      rm -rf -- "$OLD_PUBLISHED"
    done
  fi
else
  echo "[错误] 新实例未在 30 秒内报告页面就绪；保留旧包与诊断材料。"
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
