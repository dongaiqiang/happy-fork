#!/usr/bin/env bash
set -e

echo "==> Starting Local Web..."
cd "/Users/dongaiqiang/Documents/mycode/codes/00-chanpin/happy-main"
LOCAL_IP=$(ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null || echo "localhost")
SERVER_URL="http://${LOCAL_IP}:3005"
WEB_URL="http://${LOCAL_IP}:8083"

export EXPO_PUBLIC_HAPPY_SERVER_URL="$SERVER_URL"
export EXPO_PUBLIC_SERVER_URL="$SERVER_URL"

echo "================================================================"
echo "⚠️  IMPORTANT: After Web starts, you MUST do these in browser:"
echo "1. Go to ${WEB_URL}/server -> Set URL to ${SERVER_URL}"
echo "2. Go to ${WEB_URL}/restore/manual -> Login with key:"
echo "   dJ7Xy_Ezi9gIFYAqsKwgZBkOGOD2hrudb0cgZLAw99E"
echo "================================================================"

# 启动 Web，使用端口 8083
yarn workspace happy-app web -- --port 8083
