/**
 * 真实 GUI E2E：通过 CDP attach 到正在运行的 DSH 桌面端。
 *
 * 启动方式（一次性，用户操作）：
 *   1) 完全退出 DeepSeek Harness；
 *   2) 终端执行：open -a "DeepSeek Harness" --args --remote-debugging-port=9222
 *   3) DSH_CDP_URL=http://127.0.0.1:9222 pnpm test:e2e
 *
 * 若使用别的端口：DSH_CDP_URL=http://127.0.0.1:<port> pnpm test:e2e
 */
export default {
  testDir: './e2e',
  workers: 1,
  retries: 0,
  timeout: 30000,
  fullyParallel: false,
  use: {},
}
