#!/usr/bin/env bash
set -e

echo "==> Auth CLI with Local Web..."
cd "/Users/dongaiqiang/Documents/mycode/codes/00-chanpin/happy-main"

export HAPPY_SERVER_URL="http://172.20.10.2:3005"
export HAPPY_WEBAPP_URL="http://172.20.10.2:8083"

echo "================================================================"
echo "⚠️  Ensure you have logged in to Web (localhost:8083) first!"
echo "If not, run ./02-start-web.sh and follow instructions there."
echo "================================================================"

echo "Please select 'Web Browser' and approve connection in the browser."
yarn cli auth login
