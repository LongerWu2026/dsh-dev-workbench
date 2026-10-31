# 日常启动入口与登录缓存修复

当前日常入口为 `/Applications/DeepSeek Harness.app`，已按用户确认替换为同一 rc.5 基线的本地持久化修复版。无需再记住项目内的独立副本。它保留 `com.deepseek.dsh` 标识和原图标，采用标准 Mach-O 主程序及本地临时签名；不会接管官方更新。官方升级或重装可能覆盖本地扩展，需要按新版本重新适配。

## 本次复现与根因

用户报告关闭重开后登录丢失时，实际运行进程为原版 `/Applications/DeepSeek Harness.app/Contents/MacOS/DeepSeek Harness`（主进程 93682），该包仍只有临时 Browser 分区。前次验证的是项目中的独立副本，日常入口没有更新。这是交付入口遗漏，不能将该现象归为用户缓存被清理或官网过期。

原独立缓存的 Cookie 数据库与 localStorage 文件仍存在。检查仅涉及目录、文件大小和路径，没有读取凭据。修复版沿用 `~/Library/Application Support/AIWorkBench Harness RC5`，保持原 profile、namespace、厂商分区身份；不迁移 Cookie、不清理登录状态，业务和模型配置仍来自原 `DSH_HOME`。

## 实施与备份

用户明确确认「替换日常入口并验收」后，通过原应用菜单正常退出，处理退出确认；安装脚本会在进程仍运行时拒绝替换。原包完整移至 `.local-host/original-app-backup-20261030/DeepSeek Harness.app.backup`，其 `app.asar` SHA256 仍为 `8dad52f295bdbe9fa71948fdf38ac2ce3c910213d3b89c37174b2af77db9fb31`。没有删除原包。

`prepare-daily-entry.mjs` 只准备应用身份一致的替换包。`install-daily-entry.mjs` 默认输出计划，仅 `--apply` 执行；先校验原包哈希、审核构建哈希、临时签名、进程与备份路径，再做目录替换和安装后验证，最后注册日常应用入口。安装后验证失败会恢复原包，并保留失败产物，不通过删除应用进行回滚。结果在 `.local-host/rc5-daily-entry/deployment.json`。

原版 `dsh://` 回调声明已原样保留，安装后的 Info.plist 与备份对照一致，并经签名验证和入口注册，避免影响宿主后续登录授权。

## 验证边界

- 替换/拒绝/回滚的真实目录测试：13 项，全部使用新建合成目录，不操作个人数据。
- 最终应用包中的 MAIN/preload/工作台 UI：三个新 Electron 进程、25 项缓存写入/重开/注销检查通过。测试用同版本官方 Electron 测试入口隐藏窗口，代码全部来自最终应用包。
- 实机从 `/Applications/DeepSeek Harness.app` 启动，确认使用已有独立缓存，并显示「已识别登录」「已使用内嵌持久化分区」。随后通过应用菜单完整退出，进程检查为空；使用原 `com.deepseek.dsh` 标识冷启动，再打开 Kimi，仍显示「已识别登录」，没有重新登录或发送问题。
- 原版备份哈希一致；验证期间未读取/导出 Cookie、Token 或密码。
- 最终 `pnpm check`、`pnpm test` 通过，前端 22 文件 / 299 项通过；安装后包再次经过 25 项三进程缓存检查（`host-integration/rc5/artifacts/standalone-cache-GFRS7m/result.json`）。最终本机[验收记录](evidence/web-ai-login-daily-entry-2026-10-30.json)只保留状态、路径、进程与布尔值，不含账号或凭据。结束时只有日常修复版在运行，没有遗留测试 Electron 进程。

其他五家真实账号及第三方 OAuth 未逐一验收，官网过期、注销、验证码规则继续生效。首次进入其他厂商仍需正常登录。

如需回退，先正常退出修复版，保留当前修复包，将原版备份放回 `/Applications/DeepSeek Harness.app` 并重新注册入口；浏览器缓存和业务目录均不需要删除。

## 测试入口收录副作用与修复

安装事务测试曾创建 18 个只有 `app-marker` 的 `.app` 夹具目录，macOS 应用列表将它们当作应用登记，显示重复的失效图标。已将测试后缀改为 `.fixture`；重新运行 13 项事务测试通过，复查未产生新的假应用登记。

用户确认后，`cleanup-fixture-launchers.mjs --apply` 只处理审核清单内、位于 `artifacts/daily-entry-*` 且仅含已知标记文件的 18 个目录：注销它们的 Launch Services 登记并改后缀为 `.fixture`。全部标记文件保留，没有删除文件、重置应用列表数据库或触碰日常应用、原版备份和官网登录缓存。清理后旧路径和新路径均没有残留登记。方案与逐项结果保存在 `host-integration/rc5/artifacts/fixture-launcher-cleanup-{plan,result}.json`。
