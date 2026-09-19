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
HOST_HEALTH_URL="http://localhost:$HOST_PORT/api/platform/runtime/health"
HOST_EVIDENCE_ENDPOINT_FILE="OPTION/temp/ai-desktop/临时材料/Host启动验收/endpoint.json"
HOST_LAUNCH_ID="host-startup-$(/usr/bin/uuidgen | tr '[:upper:]' '[:lower:]')"
HOST_STARTED_AT="$(date -u '+%Y-%m-%dT%H:%M:%SZ')"
HOST_HEALTH_SUCCESS=false
HOST_HEALTH_SUMMARY="未在启动等待期内取得 8080 health 响应。"
HOST_HEALTH_CHECKED_AT="$HOST_STARTED_AT"
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
echo "Health: $HOST_HEALTH_URL"
# 仍以前台方式等待 Gradle，保留终端输出和手动停止体验；health 只记录运行期间的真实响应。
./gradlew --offline --no-daemon :apps:host:backend:run &
HOST_GRADLE_PID=$!

for _ in {1..120}; do
  HOST_HEALTH_CHECKED_AT="$(date -u '+%Y-%m-%dT%H:%M:%SZ')"
  if HOST_HEALTH_RESPONSE=$(/usr/bin/curl --silent --show-error --fail --max-time 1 "$HOST_HEALTH_URL" 2>/dev/null); then
    HOST_HEALTH_SUMMARY="${HOST_HEALTH_RESPONSE:0:4000}"
    if [[ "$HOST_HEALTH_RESPONSE" == *'"success":true'* && "$HOST_HEALTH_RESPONSE" == *'"status":"READY"'* ]]; then
      HOST_HEALTH_SUCCESS=true
      break
    fi
  fi
  if ! kill -0 "$HOST_GRADLE_PID" 2>/dev/null; then
    break
  fi
  sleep 0.25
done

wait "$HOST_GRADLE_PID"
HOST_EXIT_CODE=$?

# AI Desktop 运行时创建短期本地凭据；脚本只提交事实，不读取或写入 SQLite。
if [[ -r "$HOST_EVIDENCE_ENDPOINT_FILE" ]]; then
  HOST_EVIDENCE_ENDPOINT=$(sed -nE 's/.*"endpoint":"([^"]+)".*/\1/p' "$HOST_EVIDENCE_ENDPOINT_FILE")
  HOST_EVIDENCE_TOKEN=$(sed -nE 's/.*"token":"([^"]+)".*/\1/p' "$HOST_EVIDENCE_ENDPOINT_FILE")
  if [[ -n "$HOST_EVIDENCE_ENDPOINT" && -n "$HOST_EVIDENCE_TOKEN" ]]; then
    /usr/bin/curl --silent --show-error --fail --max-time 2 --request POST "$HOST_EVIDENCE_ENDPOINT" \
      --data-urlencode "token=$HOST_EVIDENCE_TOKEN" \
      --data-urlencode "launchId=$HOST_LAUNCH_ID" \
      --data-urlencode "handler=启动SELPLAT.command" \
      --data-urlencode "startedAt=$HOST_STARTED_AT" \
      --data-urlencode "commandLaunchId=$HOST_LAUNCH_ID" \
      --data-urlencode "exitCode=$HOST_EXIT_CODE" \
      --data-urlencode "healthLaunchId=$HOST_LAUNCH_ID" \
      --data-urlencode "healthSuccess=$HOST_HEALTH_SUCCESS" \
      --data-urlencode "healthCheckedAt=$HOST_HEALTH_CHECKED_AT" \
      --data-urlencode "healthSummary=$HOST_HEALTH_SUMMARY" \
      >/dev/null || echo "[提示] Host 启动证据未能提交；AI Desktop 将显示尚未核验。" >&2
  fi
fi

exit "$HOST_EXIT_CODE"
