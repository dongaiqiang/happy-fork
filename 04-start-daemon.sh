#!/usr/bin/env bash
set -e

echo "==> Starting CLI Daemon..."
cd "/Users/dongaiqiang/Documents/mycode/codes/00-chanpin/happy-main"

export HAPPY_SERVER_URL="http://172.20.10.2:3005"
export HAPPY_WEBAPP_URL="http://172.20.10.2:8083"

# 启动 daemon (前台运行，方便看日志)
# 如果想后台跑，可以加 &
yarn cli daemon start
