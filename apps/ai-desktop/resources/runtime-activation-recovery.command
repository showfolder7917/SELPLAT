#!/bin/zsh

# 此资源与候选包一起分发，用于旧宿主在暂存清理失败后接管已提升的同一批次。
set -u

if (( $# < 4 || $# > 5 )) || [[ "$1" != --selplat-root=* ]] || [[ "$2" != --release-batch=* ]] || [[ "$3" != --runtime-sha=* ]] || [[ "$4" != --replace-pid=* ]] || { (( $# == 5 )) && [[ "$5" != --user-data-dir=* ]]; }; then
  echo "[错误] 恢复参数必须包含工程根、批次、候选 SHA 与待替换进程。"
  exit 1
fi

SELPLAT_ROOT="${1#--selplat-root=}"
RELEASE_BATCH="${2#--release-batch=}"
RUNTIME_SHA="${3#--runtime-sha=}"
OLD_PID="${4#--replace-pid=}"
USER_DATA_DIR=""
if (( $# == 5 )); then USER_DATA_DIR="${5#--user-data-dir=}"; fi

if [[ "$SELPLAT_ROOT" != /* ]] || [[ ! "$RELEASE_BATCH" =~ '^[A-Za-z0-9._-]+$' ]] || [[ ! "$RUNTIME_SHA" =~ '^[0-9a-f]{40,64}$' ]] || [[ ! "$OLD_PID" =~ '^[0-9]+$' ]] || { [[ -n "$USER_DATA_DIR" ]] && [[ "$USER_DATA_DIR" != /* ]]; }; then
  echo "[错误] 恢复参数格式无效。"
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
APP_PATH="$(cd "$SCRIPT_DIR/../.." && pwd)"
ACTIVATION_ROOT="$(cd "$APP_PATH/.." && pwd)"
APP_EXECUTABLE="$APP_PATH/Contents/MacOS/AI Desktop"
APP_NAME="ai-desktop"
ARCHIVE_ROOT="$SELPLAT_ROOT/log/$APP_NAME/归档日志/发布归档"

if [[ -L "$APP_PATH" || -L "$ACTIVATION_ROOT" ]] || [[ ! -x "$APP_EXECUTABLE" ]] || [[ ! -d "$ARCHIVE_ROOT" ]]; then
  echo "[错误] 候选运行包、发布归档或可执行文件不可用。"
  exit 1
fi
if ! command -v node >/dev/null 2>&1; then
  echo "[错误] 未找到 Node.js，无法校验恢复边界。"
  exit 1
fi

# 恢复只接受本包来源匹配、尚未安排重启且因暂存清理失败的唯一归档批次。
if ! node -e 'const fs=require("node:fs"),path=require("node:path");const [archiveRoot,batch,sha,activationRoot]=process.argv.slice(1);const matches=fs.readdirSync(archiveRoot,{withFileTypes:true}).filter(e=>e.isDirectory()).map(e=>path.join(archiveRoot,e.name,batch,"发布批次文档.json")).filter(fs.existsSync);if(matches.length!==1)process.exit(2);const document=JSON.parse(fs.readFileSync(matches[0],"utf8"));const manifest=JSON.parse(fs.readFileSync(path.join(activationRoot,"ai-desktop-runtime-source.json"),"utf8"));if(document.state!=="failed"||document.runtimeActivation?.state!=="preparing"||document.candidateSha!==sha||document.runtimeActivation?.candidateSha!==sha||manifest.sourceSha!==sha||!document.failureReason?.includes("ENOTDIR: not a directory, rmdir")||!document.failureReason.includes(`${path.sep}package${path.sep}activation-staging-`))process.exit(3);' "$ARCHIVE_ROOT" "$RELEASE_BATCH" "$RUNTIME_SHA" "$ACTIVATION_ROOT"; then
  echo "[错误] 归档批次、候选 SHA、暂存清理失败事实或运行包来源不匹配。"
  exit 1
fi

OLD_COMMAND="$(ps -p "$OLD_PID" -o command= 2>/dev/null || true)"
if [[ "$OLD_COMMAND" != *"AI Desktop.app/Contents/MacOS/AI Desktop"* ]]; then
  echo "[错误] 待替换进程不是 AI Desktop，已取消接管。"
  exit 1
fi
kill "$OLD_PID" 2>/dev/null || true
for _ in {1..50}; do kill -0 "$OLD_PID" 2>/dev/null || break; sleep 0.1; done
if kill -0 "$OLD_PID" 2>/dev/null; then
  echo "[错误] 旧 AI Desktop 实例未退出，拒绝并行运行候选包。"
  exit 1
fi

LAUNCH_ARGS=("--selplat-root=$SELPLAT_ROOT" "--ai-desktop-variant=developer" "--ai-desktop-runtime-sha=$RUNTIME_SHA" "--ai-desktop-recover-release=$RELEASE_BATCH")
if [[ -n "$USER_DATA_DIR" ]]; then LAUNCH_ARGS+=("--ai-desktop-user-data-dir=$USER_DATA_DIR"); fi
open -n "$APP_PATH" --args "${LAUNCH_ARGS[@]}" || exit 1
echo "[完成] 已请求候选运行包恢复原发布批次。"
