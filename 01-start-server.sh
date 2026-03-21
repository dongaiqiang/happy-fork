#!/usr/bin/env bash
set -e

echo "==> Starting Local Server..."
cd "/Users/dongaiqiang/Documents/mycode/codes/00-chanpin/happy-main/packages/happy-server"
export HANDY_MASTER_SECRET="local-dev-secret"
export DATA_DIR="/tmp"

echo "==> Migrating database..."
yarn standalone migrate

echo "==> Running server..."
yarn standalone serve
