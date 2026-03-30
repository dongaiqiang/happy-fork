#!/usr/bin/env bash
set -euo pipefail

cd /Users/dongaiqiang/Documents/mycode/codes/00-chanpin/happy-main
export HAPPY_SERVER_URL=http://192.168.10.114:3005
export HAPPY_HOME_DIR=$HOME/.happy-rebind-20260327
echo "启动 daemon（后台）..."
yarn cli daemon start
LOG_PATH="$(yarn cli daemon logs | awk '/\.log$/ { line=$0 } END { print line }')"
if [ -z "$LOG_PATH" ] || [ ! -f "$LOG_PATH" ]; then
  echo "未能解析 daemon 日志路径，原始输出如下："
  yarn cli daemon logs
  exit 1
fi
echo "开始实时显示 daemon 日志: $LOG_PATH"
tail -n 120 -f "$LOG_PATH"
