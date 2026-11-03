# ChatGPT 内嵌登录跳转修复

真实客户端停在 `chatgpt.com/auth/login_with` 的“继续登录”页。“继续”链接实际指向 `auth.openai.com/oauth/authorize`；原持久化分区 MAIN 策略只允许顶层访问 `chatgpt.com`，因而取消跳转。前端 popup 回调又使用仅用于保存聊天链接的校验函数，拒绝临时认证 URL；登录路由识别也遗漏了 `login_with`。

## 修改

- rc.5 的 ChatGPT 分区允许精确的 HTTPS origin：`chatgpt.com`、`auth.openai.com`、`accounts.google.com`。不允许任意域名、相似域名、非标准端口或 URL 用户名/密码；其他厂商不获得这些导航权限。
- 区分内存中临时导航与持久化聊天地址。登录 popup 仍在同一个 webview 和分区中处理，OAuth URL 和查询参数不保存到业务历史。
- 正确识别登录中转页和已注册认证域名；导航停止时结束加载提示，不把中断导航变成永久加载。
- 不读取、导出、迁移或清理真实登录凭证。第三方账号登录和安全验证仍由本人在官网完成。

## 验证

- `node tests/web-ai-login.mjs`：11 项精确域名、厂商隔离和历史过滤检查通过。
- `pnpm exec vitest run tests/web-ai-auth.test.jsx tests/web-ai-auth-lifecycle.test.jsx`：55 项通过。
- `node host-integration/rc5/test-login-navigation.mjs`：真实隐藏 Electron 的 8 项检查通过，所有 HTTPS 都由本地合成页面响应，无真实账号和外网认证请求。验证“继续”链接、同窗口 OAuth POST、原分区保留、MAIN 拒绝相似域名、Node 隔离。
- `node host-integration/rc5/test-persistence.mjs`：57 项跨进程隔离/持久化检查通过。
- `node host-integration/rc5/test-apply.mjs`：15 项预检通过；rc.5 Desktop 构建、插件构建及 `pnpm check` 通过。
- 全量 Host 回归在 `tests/development-issue-actions.mjs` 因“知识检索项目不存在”失败。全量前端 620 项通过、1 项知识范围断言失败。两处均涉及工作区已有的知识范围改动；本次不覆盖该部分实现或放宽断言。

日志：`/tmp/web-ai-login-*.log`。真实 Electron 记录：`host-integration/rc5/artifacts/process-IhBKgd/login.json`（登录）和 `host-integration/rc5/artifacts/process-eWX0TY/result.json`（持久化）。

## 客户端加载

待重启的签名副本位于 `.tmp/chatgpt-login/staged/DeepSeek Harness.app`。逐字对比确认，MAIN 除 ChatGPT 固定 origin 列表及其格式外完全一致；preload 哈希一致，签名严格验证通过。源工作树更新前已核对全部管理文件的既有 SHA256，旧策略和集成记录备份在 `.tmp/chatgpt-login/`。

客户端尚未重启前，现有进程继续使用旧 MAIN 策略，不能把源码测试通过视为真实账号已经登录成功。

## 2026-11-03 日常客户端安装

用户回复“继续”后，已通过原生应用正常退出并确认进程退出，执行 `.tmp/chatgpt-login/install-app.mjs --apply`。日常 `/Applications/DeepSeek Harness.app` 的 MAIN SHA256 已从 `913f3753d7d9f5a41081230c1a186be0a311ed705b451bdc5f6640789a560b0c` 变为 `864140ddc7114afa280f5937291cb633877715a209999120dee4bcf306a5b6da`，严格签名校验通过。原应用完整备份位于 `.tmp/chatgpt-login/installed-backup/DeepSeek Harness.app`；安装回执为 `.tmp/chatgpt-login/installed.json`。

已重新启动日常应用，在“多 AI 对话 → 登录 / 官网 → ChatGPT”打开真实官网，点击“登录”后出现含 Google、Apple、电话号码、邮箱入口的登录表单，状态正确显示“需要登录”。界面工具启动后曾持续超时，恢复后继续完成上述可视验证，不能将该超时解释为已证实的应用启动失败。

点击“使用 Google 账户继续”时，自动审批以“现有授权未明确包含 Google 认证目的地”为由拒绝，该点击未执行。已单独请求用户授权；在得到回复前，不通过其他方式进入 Google 或报告真实 Google 登录链路已通过。未读取、输入或保存账号密码、验证码和 OAuth 查询参数。

### Google 真实跳转核验

用户明确授权进入 Google 认证后，实际客户端已显示 `accounts.google.com` 的“登录 - Google 账号”页面，当前处于通行密钥验证阶段；未出现浏览器或应用不安全/不受支持提示。原先跳转被宿主取消的问题已在真实客户端验证解除。未处理账号、密码、验证码或通行密钥，完整登录仍待本人完成，不能把到达认证页当作已登录成功。脱敏核验记录位于 `.tmp/chatgpt-login/live-verification.json`，不保存认证查询参数或账号身份。

## Google 密码页“下一步”进一步排查

Google 密码验证页的“下一步”可获得焦点，没有可见密码错误，点击后仍停留原页。现有证据不能区分后续域名被拒绝、弹窗 POST 被拒绝或官网请求未完成，因此不根据猜测扩大域名权限。

已增加 MAIN 脱敏拒绝诊断：`DesktopBrowserPersistence` 的可选回调仅提供 providerId、origin 和 policy/popup_post 原因；只有 ChatGPT 的拒绝记录写入 `app.getPath('logs')/workbench-browser-navigation.json`，顺序写入且只保留最后一条。回调不接收路径、查询参数、请求头、响应正文或表单数据。未扩大允许的域名范围。

新增诊断验证：12 项导航/隐私检查、真实隐藏 Electron 的 10 项登录/POST/脱敏检查、57 项存储持久化、15 项补丁预检，以及既有 web-ai 60 项、session 10 项、unsent 回归均通过。Desktop 构建通过。测试日志位于 `/tmp/chatgpt-nextstep-*.log`。

已安装并重启诊断构建；MAIN SHA256 为 `a84a8f12dd7ee5d7fdaf047859617b25dda15ec3848acf69fc24dcacb2f66731`。上一版完整备份位于 `.tmp/chatgpt-nextstep/installed-backup/DeepSeek Harness.app`。此阶段仅增加诊断，不能声称 Google 密码页下一步问题已修复，须继续读取真实拒绝记录或其他可见结果。
