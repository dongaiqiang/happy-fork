#!/usr/bin/env bash
set -euo pipefail

PROJECT_ROOT="/Users/dongaiqiang/Documents/mycode/codes/00-chanpin/happy-main"
SERVER_URL="http://192.168.10.114:3005"
HAPPY_HOME_DIR_VALUE="$HOME/.happy-rebind-20260327"
SERVER_COMMAND="clear; cd '$PROJECT_ROOT'; printf '\033]2;后端日志\007'; yarn workspace happy-server db; printf '%s\n' '等待数据库启动 10 秒...'; sleep 10; METRICS_PORT=9091 yarn workspace happy-server dev"
APP_COMMAND="clear; cd '$PROJECT_ROOT'; printf '\033]2;前端日志\007'; yarn workspace happy-app start --clear"
HELP_COMMAND="clear; cd '$PROJECT_ROOT'; printf '\033]2;操作区\007'; export HAPPY_SERVER_URL='$SERVER_URL'; export HAPPY_HOME_DIR='$HAPPY_HOME_DIR_VALUE'; printf '%s\n' '轻量三分屏已启动。' '' '当前脚本不会做下面这些动作：' '- 不会停止 daemon' '- 不会删除 ~/.happy 或 ~/.happy-rebind-20260327' '- 不会删除 Machine 表数据' '- 不会自动执行 auth login --force' '' '如需后续动作，可在当前 pane 手动执行：' 'yarn cli auth login --force' 'yarn cli daemon start'"

cd "$PROJECT_ROOT"

pkill -f "yarn workspace happy-server dev" || true
pkill -f "expo start" || true

for p in 3005 8081 9091; do
  lsof -ti tcp:$p | xargs kill -9 2>/dev/null || true
done

open -a Docker
until docker ps >/dev/null 2>&1; do
  sleep 2
done
docker ps >/dev/null 2>&1 || docker context use desktop-linux

osascript - "$PROJECT_ROOT" "$SERVER_COMMAND" "$APP_COMMAND" "$HELP_COMMAND" <<'OSA'
on run argv
  set projectRoot to item 1 of argv
  set serverCommand to item 2 of argv
  set appCommand to item 3 of argv
  set helpCommand to item 4 of argv

  tell application "Ghostty"
    activate
    set cfg to new surface configuration
    set initial working directory of cfg to projectRoot
    set win to new window with configuration cfg
    set paneServer to terminal 1 of selected tab of win
    set paneApp to split paneServer direction right with configuration cfg
    set paneHelp to split paneApp direction down with configuration cfg
    input text serverCommand to paneServer
    send key "enter" to paneServer
    input text appCommand to paneApp
    send key "enter" to paneApp
    input text helpCommand to paneHelp
    send key "enter" to paneHelp
    focus paneHelp
  end tell
end run
OSA

echo "已新开一个 Ghostty 轻量三分屏窗口：左侧 server，右上 Metro，右下操作区。"
