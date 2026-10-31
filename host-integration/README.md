# 本地宿主持久化扩展

当前已安装的 **0.2.1-rc.5** 请使用 [rc.5 集成与验证说明](rc5/README.md)。以下保留 rc.3 的历史实现，不适用于 rc.5。

适用 DeepSeek Harness **0.2.1-rc.3**，官方源码 SHA `1f81c047fc48fa190a683e469daa699857e9afe8`。这是本项目的本地扩展，未修改原安装包，也不是官方发行版已具备的 API。

## 结构

- `apply.mjs`：版本、源码指纹及替换点校验，校验通过后才写入；拒绝漂移和不同的既有覆盖文件。
- `overlay/`：MAIN 持久化 Session、六家导航策略、原生欢迎页认证请求。
- `harness-0.2.1-rc.3-persistence.patch`：完整 12 文件补丁；`manifest.json` 为最终源码 SHA256。
- `tests/` 与 `test-persistence.mjs`：实际 MAIN、preload、webview 的三进程合成存储测试。
- `test-host-fetch.mjs`：HTTP431 复现及认证、来源、重定向、超时检查。
- `test-shell-boot.mjs`：隔离 home、隐藏窗口，等待真实后端启动就绪。
- `prepare-local-app.mjs`：生成独立本地 `.app`，复制官方 Electron 44.7.0 运行时，使用原版相同版本的运行资源。
- `stop-local-host.mjs`：仅用于用户明确允许退出本任务测试版时；根据锁文件取得 PID 并核对精确可执行路径，拒绝其他应用。

## 重现

将上述官方版本源码放在 `.local-host/source`；该目录和 `.tmp` 不提交。先对干净源码执行：

```sh
node host-integration/apply.mjs .local-host/source
cd .local-host/source
pnpm install --frozen-lockfile
pnpm run build:artifacts
pnpm run build:check
pnpm exec vitest run apps/desktop/tests/keyboard.spec.ts apps/desktop/tests/preload-app.spec.ts apps/desktop/tests/main-startup.spec.ts
```

准备官方 npm 发布的 Electron **44.7.0 macOS arm64**，解压到 `.tmp/electron-runtime-44.7/Electron.app`。本机使用的官方 zip SHA256 为 `e04e411b58a0a14375dd21b0ab4a378fd38930a702e4e20e322fee4849404c0b`。测试入口支持 `WORKBENCH_HARNESS_SOURCE` 和 `WORKBENCH_ELECTRON_BINARY` 覆盖路径。

回到插件根目录：

```sh
pnpm build
pnpm check
pnpm test
pnpm test:host-persistence
node host-integration/test-host-fetch.mjs
node host-integration/test-shell-boot.mjs
pnpm test:layout
node host-integration/prepare-local-app.mjs
```

macOS 图形运行和 LaunchServices 注册需要正常桌面会话；受限沙箱可能阻止启动/注册，应在有授权的本机环境执行。`apply.mjs` 应用于干净源码，重复应用会拒绝；不要拿它覆盖成员的改动。完整 patch 已在隔离干净副本执行 `git apply --check`，并与脚本应用结果逐文件对照通过。

## 使用及保存位置

打开项目里的 `.local-host/DeepSeek Harness Workbench.app`，进入「智能工作台 → 更多 → 网页 AI 对比」。官网始终嵌在工作台；原生 popup 不另开窗口。

修正后的准备脚本复用 `~/.dsh` 以读取现有模型配置，但浏览器 userData 隔离到 `.local-host/user-data`，禁止再复用原版 Cookie 数据库。两版仍不可同时写相同 DSH_HOME，应先退出另一版。官网账号存储由 Electron 放在本地 userData 下的 `Partitions/`；租约以宿主 profile、固定 namespace、厂商派生，不接受客户端目录和 Cookie。退出/释放等待受限时长的存储 flush，失败不报告为成功。业务导出不会打包官网登录凭证。

本地版依赖保留的 `.local-host/source` 和同版本原安装运行资源，不是可任意搬走的独立安装包。原版升级后版本校验将阻止启动，应重新匹配源码和运行时构建。需要回到原版时先正常退出本地版，再打开 `/Applications/DeepSeek Harness.app`；原版无此扩展时会显示仅本次运行保留登录。

持久化不延长官网凭证寿命；session cookie、过期、撤销、验证码、退出账号均服从网站规则。六站真实登录恢复、发送/采集与账号切换待用户账号验收。尚未提供宿主清理账号存储的 API/UI；可使用官网正常退出，不自动清理或迁移凭证。详细证据及待办见 `../docs/WEB-AI-HOST-PERSISTENCE-2026-10-29.md`。

## 原版启动回归修正

早期测试版共享原版 userData，反复启动导致本机 `dsh-auth-*` Cookie 累积；2026-10-29 发现原版欢迎页认证失败。准备脚本现改为独立浏览器目录，本机已重新准备并签名验证本地包，当前未启动测试版。`recover-loopback-cookies.py` 默认只读；只有用户明确授权并正常关闭两版后才可加 `--apply`，先以0600备份数据库，再只清理 `127.0.0.1` 的确切 `dsh-auth-` 前缀记录，不触碰官网Cookie或业务数据。
