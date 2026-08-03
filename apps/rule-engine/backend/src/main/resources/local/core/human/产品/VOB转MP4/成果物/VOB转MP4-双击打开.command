#!/bin/zsh

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
WORKSPACE_ROOT="$(cd "$SCRIPT_DIR/../../../../.." && pwd)"

cd "$WORKSPACE_ROOT" || exit 1

/usr/local/bin/python3 "$WORKSPACE_ROOT/apps/rule-engine/backend/src/main/python/com/sp/selplat/local/code/core/app/vob_to_mp4_gui_pyside6.py" '{"input_file":"./OPTION/VIDEO_TS.VOB","output_file":"./OPTION/VIDEO_TS_gui.mp4","log_file":"./OPTION/tmp/log/VIDEO_TS_gui.log","always_on_top":true}'
