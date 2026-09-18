#!/bin/zsh

set -u

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR" || exit 1

fail() {
  echo "[错误] $1" >&2
  exit 1
}

if (( $# > 1 )) || [[ $# -eq 1 && "$1" != "--validate-only" ]]; then
  echo "用法：$0 [--validate-only]" >&2
  exit 2
fi

for required_dir in apps shared docs cache; do
  [[ -d "$required_dir" ]] || fail "缺少平台目录：$required_dir"
done

[[ -d "apps/host/backend" ]] || fail "缺少 Host 后端目录：apps/host/backend"
[[ -f "apps/host/backend/build.gradle" ]] || fail "缺少 Host 构建入口：apps/host/backend/build.gradle"
[[ -f "settings.gradle" ]] || fail "缺少 Gradle 工程登记：settings.gradle"
[[ -x "gradlew" ]] || fail "缺少可执行 Gradle Wrapper：gradlew"
[[ -x "/usr/sbin/lsof" ]] || fail "缺少端口检查工具：/usr/sbin/lsof"

echo "SELPLAT platform startup validation passed."
echo "Platform root: $SCRIPT_DIR"
echo "Runtime project: apps/host/backend and its explicit Gradle dependencies"
echo "Excluded application: apps/ai-desktop"

if [[ "${1:-}" == "--validate-only" ]]; then
  echo "Validation-only mode completed; SELPLAT was not started."
  exit 0
fi

HOST_PORT=8080
LISTENER_PIDS=()
while IFS= read -r listener_pid; do
  [[ -n "$listener_pid" ]] && LISTENER_PIDS+=("$listener_pid")
done < <(/usr/sbin/lsof -nP -iTCP:"$HOST_PORT" -sTCP:LISTEN -t 2>/dev/null || true)

print_listener_processes() {
  /usr/sbin/lsof -nP -iTCP:"$HOST_PORT" -sTCP:LISTEN 2>/dev/null || true
}

if (( ${#LISTENER_PIDS[@]} > 0 )); then
  echo "Stopping existing process on SELPLAT port $HOST_PORT: ${LISTENER_PIDS[*]}"
  echo "Listener process details before stopping:"
  print_listener_processes
  kill "${LISTENER_PIDS[@]}" || fail "无法结束占用 SELPLAT 端口 $HOST_PORT 的进程。"
fi

for _ in {1..50}; do
  if ! /usr/sbin/lsof -nP -iTCP:"$HOST_PORT" -sTCP:LISTEN >/dev/null 2>&1; then
    break
  fi
  sleep 0.1
done

if /usr/sbin/lsof -nP -iTCP:"$HOST_PORT" -sTCP:LISTEN >/dev/null 2>&1; then
  echo "Listener process details after port-release timeout:" >&2
  print_listener_processes >&2
  fail "SELPLAT 端口 $HOST_PORT 未在等待期内释放，已取消启动。"
fi

echo "Starting the SELPLAT platform runtime."
echo "Health: http://localhost:$HOST_PORT/api/platform/runtime/health"
./gradlew --offline --no-daemon :apps:host:backend:run
exit $?
