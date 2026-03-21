#!/usr/bin/env bash
set -x  # 打印执行命令

# 1. 杀死占用端口的进程
lsof -ti tcp:3005 | xargs -r kill -9  # Server
lsof -ti tcp:8083 | xargs -r kill -9  # Web
lsof -ti tcp:9090 | xargs -r kill -9  # Metrics

# 2. 尝试通过 CLI 停止 daemon（如果还活着）
cd "/Users/dongaiqiang/Documents/mycode/codes/00-chanpin/happy-main"
yarn cli daemon stop || true

# 3. 清理临时数据目录（可选，如果你想彻底重置数据）
rm -rf /tmp/pglite

echo "✅ All services stopped and ports cleared."
