# Harness 0.2.1-rc.5 浏览器持久化集成

最新部署：用户确认后，已备份并替换日常 `/Applications/DeepSeek Harness.app`，继续使用之前的独立缓存。通过原应用标识关闭重开的 Kimi 真实验收；不再要求用户改用项目内副本。详见[日常入口记录](../../docs/WEB-AI-DAILY-ENTRY-2026-10-30.md)。下文的“原包未替换”仅描述早期阶段。

2026-10-30 后续：已生成独立原生入口应用 `.local-host/rc5-native-login/智能工作台 Harness RC5.app`。用户已确认切换，Kimi 本人登录后经过完整退出、冷启动，账号与历史会话恢复，无需再次登录。其他五站真实账号仍待验收；原版 `/Applications/DeepSeek Harness.app` 未覆盖。

基于官方 tag `dsh-v0.2.1-rc.5`，commit `b830ec950faba0a46dda564be3e2d854afed94f1`。实际安装包 `app.asar` SHA256 为 `8dad52f295bdbe9fa71948fdf38ac2ce3c910213d3b89c37174b2af77db9fb31`。原版桥只有进程内存分区；本目录为独立源码集成，不修改 `/Applications`，不使用旧 rc.3 源码。

## 行为

在原 Browser bridge 增加可选 `persistence.protocolVersion = 1` 和 `persistence.acquire({ namespace, providerId })`。旧 acquire 行为保持内存分区。MAIN 注册固定的 `dsh-dev-workbench.web-ai` 命名空间及六个厂商，按真实 profile 路径、命名空间、厂商计算稳定哈希分区。renderer 不能传分区名、目录或 Cookie。

持久分区沿用宿主租约归属、沙箱、Node 隔离和请求限制；额外限制顶层页面到该厂商注册 origin。窗口销毁、释放租约、正常退出及安装器交接执行有期限的刷盘。不导出凭证、不改 Cookie 到期时间、不恢复已经清理的登录状态。

它能保留服务器允许持久保存的 Cookie（含 HttpOnly）、localStorage、IndexedDB。普通 session cookie 在完整干净退出后消失，仍需按站点要求重新登录；站点主动过期、注销和风控也继续生效。第三方 OAuth 等尚未注册的顶层 origin 会被拒绝，不能据此声称所有登录方式均已验收。

## 重放

```sh
git clone --depth 1 --branch dsh-v0.2.1-rc.5 https://github.com/deepseek-ai/deepseek-harness.git .local-host/rc5-source
node host-integration/rc5/apply.mjs .local-host/rc5-source --check
node host-integration/rc5/apply.mjs .local-host/rc5-source
node host-integration/rc5/apply.mjs .local-host/rc5-source --check
```

脚本要求独立 git 根、精确 HEAD、package 版本，并先检查全部 6 个原文件的 SHA256、2 个新增路径、准备输出的审核哈希和已有集成记录，再写任何文件。偏离基线或部分应用均拒绝写入；完整已应用时逐文件核对后直接返回。`baseline.json` 为原始校验，`manifest.json` 为审核后输出校验；`--plan` 仅在干净源码上输出候选 manifest，不写源码。

## 已验证

2026-10-30 本机结果：

- `node host-integration/rc5/test-apply.mjs`：15 项断言通过，含无写入预检、幂等、最后一个原文件偏移时全量拒绝、部分应用拒绝、父仓库 git 回退拒绝。记录 `artifacts/preflight-1ZPF5j/result.json`。
- `node host-integration/rc5/test-persistence.mjs`：真实 Electron 44.7.0，四个不同进程，57 项检查通过。包括持久 Cookie、HttpOnly、localStorage、IndexedDB 跨重启，同 origin 不同厂商及不同 profile 隔离，普通 session cookie 不强制恢复，注销式清理后不恢复，IPC 限制、顶层导航限制、沙箱和退出排空。记录 `artifacts/process-ZEAMOA/result.json`。只使用合成数据和拦截的 `.invalid` 页面，无真实账户、个人 profile 或外部浏览器窗口。
- 独立 rc.5 源码 `pnpm install --frozen-lockfile --offline --ignore-scripts` 成功，`pnpm run build` 全部 9 gates 通过，日志 `artifacts/full-build.log`。这包含 Host/Desktop/Client/Web 编译和 aggregate checks，并非全仓所有测试。
- 本轮复跑 `pnpm test:host-persistence-patch`、`pnpm test:host-persistence`：15 / 57 项通过，记录 `artifacts/preflight-LAZTgx/result.json`、`artifacts/process-wlP0Ko/result.json`。
- `node host-integration/rc5/test-shell-boot.mjs host-integration/rc5/artifacts/review-host-UMK1Pk`：完整编译 MAIN/preload/后端正常启动、真实 IPC 持久租约申请/释放通过；0 可见窗口、0 原生错误框、退出码 0，记录 `artifacts/shell-LVJXyD/result.json`。测试禁止自动重启并按自己目录清理遗留进程。

## 审查副本与部署边界

`node host-integration/rc5/prepare-review-host.mjs` 生成单独、临时签名的 macOS 审查 app，不启动它、不注册协议。当前副本在 `artifacts/review-host-UMK1Pk/Harness Persistence RC5.app`，签名验证 `codesign --verify --deep --strict` 通过。它通过原生 Electron 的显式开发入口加载本次 rc.5 编译产物，使用独立 `DSH_HOME`、userData、开发项目，预装本地工作台插件链接；仅从已安装 rc.5 复制只读 primary-runtime 和随附 Office 技能程序资源，无个人设置或凭证。

这是依赖当前源码和 node_modules 路径的本机审查副本，不是可分发安装包。已通过完整宿主隐藏启动测试，尚未进行六站真实登录验收。替换正式 app、启动审查副本进行登录、迁移既有数据、正式签名发布，均未执行。正式部署应另行确认目标；现有内存登录态不会自动迁移，首次使用新分区需要重新登录。

## 可日常启动的本地副本

`node host-integration/rc5/prepare-standalone-host.mjs` 生成 `.local-host/rc5-native-login/智能工作台 Harness RC5.app`，已有输出时拒绝覆盖。它携带官方 Electron、rc.5 运行资源、审核后的 MAIN/preload 和工作台插件快照，不依赖开发源码或原安装位置。Mach-O 主程序与 `CFBundleExecutable` 一致，可正常使用 Dock、窗口自动化与应用菜单退出。应用内部明确按本地开发扩展模式使用随包运行资源，不注册 dsh 协议、不接管原版更新。

默认沿用 `DSH_HOME` 或 `~/.dsh` 的业务及模型配置，浏览器目录单独放在 `~/Library/Application Support/AIWorkBench Harness RC5`。不会复制原版的 Cookie；首次需在官网登录。启动前检查同一 profile 的现存宿主，拒绝并行运行。回退时正常退出该副本，再打开原版；浏览器目录互不共用。自定义环境变量仅供本地操作者测试，不由插件 renderer 传路径。

`pnpm test:host-login-cache` 在三个新 Electron 进程中加载最终应用包内全部 MAIN/preload/插件代码，使用隐藏窗口和合成官网验证实际工作台的登录状态、持久 Cookie/HttpOnly/localStorage/IndexedDB 重启恢复、注销后不恢复，25 项通过。原生打包入口不接受 NODE_OPTIONS 测试预载，因此测试使用同版本官方 Electron 的测试入口安装隐藏窗口钩子；真实原生入口另经用户本机正常启动及退出验收。证据为 `artifacts/standalone-cache-CSKe8a/result.json`，不含真实账号或凭据。

插件源码更新后，先正常退出本地副本，再运行 `node host-integration/rc5/update-standalone-plugin.mjs`。脚本核对输出归属、旧插件哈希和构建一致性，仅更新该副本内的插件快照并重新临时签名，不接触个人浏览器数据。原版插件若仍链接本仓库，则继续依宿主原有热更新机制加载。
