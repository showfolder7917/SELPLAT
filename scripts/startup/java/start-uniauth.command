#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PLATFORM_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"
PORT=8080
PROJECT_JAVA_HOME="$PLATFORM_ROOT/runtime/jdks/temurin-21.jdk/Contents/Home"

if [ -d "$PROJECT_JAVA_HOME" ]; then
  export JAVA_HOME="$PROJECT_JAVA_HOME"
  export PATH="$JAVA_HOME/bin:$PATH"
elif /usr/libexec/java_home -v 21 >/dev/null 2>&1; then
  export JAVA_HOME="$(/usr/libexec/java_home -v 21)"
  export PATH="$JAVA_HOME/bin:$PATH"
fi

EXISTING_PID="$(lsof -ti tcp:"$PORT" || true)"
if [ -n "$EXISTING_PID" ]; then
  echo "Stopping existing process on port $PORT: $EXISTING_PID"
  kill "$EXISTING_PID"
  sleep 1
fi

echo "Project: $PLATFORM_ROOT"
echo "JAVA_HOME: ${JAVA_HOME:-not-set}"
echo "URL: http://localhost:$PORT"

cd "$PLATFORM_ROOT"
exec bash "$PLATFORM_ROOT/gradlew" --no-daemon :apps:uniauth:backend:run
