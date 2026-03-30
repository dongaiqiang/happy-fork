#!/usr/bin/env bash
set -euo pipefail

PROJECT_ROOT="/Users/dongaiqiang/Documents/mycode/codes/00-chanpin/happy-main"
SERVER_URL="http://192.168.10.114:3005"
HAPPY_HOME_DIR_VALUE="$HOME/.happy-rebind-20260327"
SERVER_WORKSPACE="$PROJECT_ROOT/packages/happy-server"

open_terminal_tab() {
  local command="$1"
  osascript - "$command" <<'OSA'
on run argv
  set shellCommand to item 1 of argv
  tell application "Terminal"
    activate
    do script shellCommand
  end tell
end run
OSA
}

cd "$PROJECT_ROOT"

pkill -f "daemon start-sync" || true
pkill -f "yarn workspace happy-server dev" || true
pkill -f "expo start" || true

for p in 8081 3005 5432 9090 9091; do
  lsof -ti tcp:$p | xargs kill -9 2>/dev/null || true
done

unset HAPPY_HOME_DIR || true
yarn cli daemon stop || true

export HAPPY_HOME_DIR="$HAPPY_HOME_DIR_VALUE"
yarn cli daemon stop || true

rm -rf "$HOME/.happy"
rm -rf "$HOME/.happy-rebind-20260327"

git checkout daily/soeasywork-stable
git status --short --branch

open -a Docker
until docker ps >/dev/null 2>&1; do
  sleep 2
done
docker ps >/dev/null 2>&1 || docker context use desktop-linux
docker ps

open_terminal_tab "cd '$PROJECT_ROOT'; yarn workspace happy-server db; cd '$SERVER_WORKSPACE'; printf '%s\n' 'DELETE FROM \"Machine\";' | npx dotenv -e .env.dev -- prisma db execute --schema ./prisma/schema.prisma --stdin; cd '$PROJECT_ROOT'; METRICS_PORT=9091 yarn workspace happy-server dev"

open_terminal_tab "cd '$PROJECT_ROOT'; yarn workspace happy-app start --clear"

read -r -p '手机完成打开 App / 扫 Metro 二维码 / 进入主界面后，按回车继续...'

open_terminal_tab "cd '$PROJECT_ROOT'; export HAPPY_SERVER_URL='$SERVER_URL'; export HAPPY_HOME_DIR='$HAPPY_HOME_DIR_VALUE'; yarn cli auth login --force"

read -r -p '终端里完成 Mobile 扫码并出现 Authentication successful 后，按回车结束前半段脚本...'

echo done
