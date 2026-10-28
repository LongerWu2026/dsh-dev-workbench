#!/bin/sh
# 用调试端口重启 DeepSeek Harness（GUI E2E 前置步骤）
osascript -e 'quit app "DeepSeek Harness"' 2>/dev/null || true
sleep 2
open -a "DeepSeek Harness" --args --remote-debugging-port=9222
sleep 6
echo "DeepSeek Harness 已以 --remote-debugging-port=9222 启动"
echo "接下来：cd plugin-tests && DSH_CDP_URL=http://127.0.0.1:9222 pnpm test:e2e"
