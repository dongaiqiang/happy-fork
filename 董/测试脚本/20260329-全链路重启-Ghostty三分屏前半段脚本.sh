#!/usr/bin/env bash
set -euo pipefail

PROJECT_ROOT="/Users/dongaiqiang/Documents/mycode/codes/00-chanpin/happy-main"
SERVER_URL="http://192.168.10.114:3005"
HAPPY_HOME_DIR_VALUE="$HOME/.happy-rebind-20260327"
SERVER_WORKSPACE="$PROJECT_ROOT/packages/happy-server"

SERVER_COMMAND="cd '$PROJECT_ROOT'; printf '\033]2;后端日志\007'; yarn workspace happy-server db; printf '%s\n' '等待数据库启动 10 秒...'; sleep 10; cd '$SERVER_WORKSPACE'; printf '%s\n' 'DELETE FROM \"Machine\";' | npx dotenv -e .env.dev -- prisma db execute --schema ./prisma/schema.prisma --stdin; cd '$PROJECT_ROOT'; METRICS_PORT=9091 yarn workspace happy-server dev"
APP_COMMAND="cd '$PROJECT_ROOT'; printf '\033]2;前端日志\007'; yarn workspace happy-app start --clear"
LOGIN_COMMAND="cd '$PROJECT_ROOT'; printf '\033]2;登录日志\007'; export HAPPY_SERVER_URL='$SERVER_URL'; export HAPPY_HOME_DIR='$HAPPY_HOME_DIR_VALUE'; printf '手机完成打开 App / 扫 Metro 二维码 / 进入主界面后，在当前 pane 按回车继续 auth login。\\n'; read; yarn cli auth login --force"

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

osascript - "$PROJECT_ROOT" "$SERVER_COMMAND" "$APP_COMMAND" "$LOGIN_COMMAND" <<'OSA'
on run argv
  set projectRoot to item 1 of argv
  set serverCommand to item 2 of argv
  set appCommand to item 3 of argv
  set loginCommand to item 4 of argv

  tell application "Ghostty"
    activate
    set cfg to new surface configuration
    set initial working directory of cfg to projectRoot
    set win to new window with configuration cfg
    set paneServer to terminal 1 of selected tab of win
    set paneApp to split paneServer direction right with configuration cfg
    set paneLogin to split paneApp direction down with configuration cfg
    input text serverCommand to paneServer
    send key "enter" to paneServer
    input text appCommand to paneApp
    send key "enter" to paneApp
    input text loginCommand to paneLogin
    send key "enter" to paneLogin
    focus paneLogin
  end tell
end run
OSA

echo done
