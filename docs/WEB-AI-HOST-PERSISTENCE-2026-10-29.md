# 网页 AI 宿主持久化接入与验收（2026-10-29）

本地宿主扩展已接入 MAIN、preload、IPC 和工作台内嵌官网。无账号的真实 Electron 跨进程存储与本机工作台重开验证通过。六站真实账号登录恢复及发送/采集仍待验收，不代表登录永不过期。

## 交付及边界

基线为官方 DeepSeek Harness `0.2.1-rc.3`，SHA `1f81c047fc48fa190a683e469daa699857e9afe8`，Electron `44.7.0`。新增可选 `browser.persistence` v1 是本项目本地扩展，未经修改的原版宿主没有该能力。

实际入口为项目内 `.local-host/DeepSeek Harness Workbench.app`。原 `/Applications/DeepSeek Harness.app` 未覆盖。内嵌官网继续在工作台里显示，原生 popup 不另开窗口。初次验收复用了原 userData，后续发现这会影响原版启动，现已将测试包浏览器目录隔离到 `.local-host/user-data` 并重新准备、签名校验。两版仍不可同时写相同 DSH_HOME，应先正常退出另一版。

本地启动依赖保留的 `.local-host/source` 和同版本原安装运行资源。原版升级后须重新匹配基线构建；本地启动器会校验版本。构建重现、数据目录及切回原版说明见 [host-integration/README.md](../host-integration/README.md)。补丁及 12 文件最终哈希均保存在该目录。

## 实现

1. MAIN 使用可信 profile 的 realpath、固定 namespace、六家厂商和版本派生稳定 `persist:` 分区；客户端不能提交目录、Cookie、token、partition 或任意 origin。
2. 保留既有租约所属窗口、分区、src 检查，IPC 限定主 renderer/mainFrame。webview 的 sandbox、contextIsolation、webSecurity 保留，Node 未开放。主框架导航限定厂商 HTTPS 来源，拒绝带凭据 URL、跨厂商导航和原生 popup。
3. 释放 guest、正常退出和安装器交接会等待受限时长的存储 flush。并发释放共享在途操作，失败与超时不伪装为保存成功；不自动删除或导出账号存储。
4. 重启后旧“已填入”记录恢复为待核对，保留采集基线；显示“应用已重启，请核对官网草稿和发送状态；不会自动重新填入或发送。”业务历史保留不意味着网页内存草稿一定恢复。
5. 修复真实 profile 欢迎页 HTTP431：原实现汇总 localhost Cookie，历史不同宿主 Cookie 累积导致请求头超限。新请求仅附带当前宿主认证 Cookie，固定同源及 Origin，拒绝重定向和 URL 凭据，并有 15 秒请求超时；未删除 Cookie、放宽请求头限制或关闭认证。

## 验证证据

| 验证 | 结果与范围 |
| --- | --- |
| 真实 Electron 跨进程 | 38 项通过，三个独立进程，隔离合成 profile，零账号、零可见浏览器窗口 |
| 存储 | 持久 Cookie、HttpOnly Cookie、localStorage、IndexedDB 完整退出后恢复；同一测试 origin 的不同厂商分区、不同 profile 均隔离 |
| 租约与隔离 | 拒绝未知 namespace/厂商/客户端路径，导航拦截含 loadURL，重复释放后存储保留，shutdown 后拒绝新租约 |
| 实际策略与 flush | 10 项通过，直接测试生产 overlay，含并发落盘与失败传播；Node 身份检查未冒充浏览器存储验收 |
| HTTP 边界 | 7 项通过，合成大 Cookie 实际复现431，当前认证 Cookie 请求200，跨源/凭据/重定向拒绝、超时中止 |
| 完整宿主 | 官方 build:artifacts 七道构建门、build:check 两道检查通过；桌面 keyboard/preload-app/main-startup 共184测试通过 |
| 独立完整启动 | 隐藏窗口、隔离 home，等待真实后端 boot ready；bridge v1、backendBoot true、无错误对话框、exit0 |
| 插件回归 | pnpm build/check/test 全部通过；135模块无数字前缀/循环/分层违规，WebAI业务29、React79测试通过 |
| 布局 | 103 场景，errors=[]、failures=[] |
| 补丁可重现 | 干净官方源码副本 git apply --check；apply.mjs 结果逐文件与实际12文件一致 |

结构化证据见 [验收 JSON](evidence/web-ai-host-persistence-2026-10-29.json)，包含实际测试进程 PID 和逐项断言，不含真实凭证或官网账号。

实机通过正常 DeepSeek Harness 界面确认：本地版启用持久化租约，Kimi 合成问题仅填入草稿，未发送；正常 Cmd+Q 完整退出已观察到成功。随后冷启动打开工作台，再从历史选择 `【宿主持久化验收20261029】仅填入草稿，不发送。`，确认问题保留并显示重启核对提示。展开 Kimi 后再次显示“已使用内嵌持久化分区”，官网实际输入框仍可见同一合成草稿；这仅证明本次 Kimi 无账号草稿恢复，不推及其他站点或真实账号。中间桌面工具曾出现无窗口/无 frame，按用户明确授权、核对可执行路径后仅退出本任务测试版，再重开完成最终检查。未登录账号、未发送消息、未另开可见浏览器。

## 保留待办

- 61：六站真实登录后的发送、同题追问、批量及回答结束/提取适配。
- 62：六站真实账号完整退出重开，以及过期、撤销、官网退出、切换账号、验证码。持久 Cookie 的合成测试不能代替真实网站授权策略验收。
- 65 的宿主核心接入与无账号测试已经核验；原条目中的“确认清理”拆为 66：可选受控账号存储清理 API/UI，需确认范围后才能删除，当前未实现。官网正常退出仍由官网处理。
- 原18等实际系统休眠、多日运行与第二账号矩阵继续按原待办保留；本次没有以短时隔离测试核销长期验收。

浏览器账号数据由 Electron 保存到所用 userData 下 `Partitions/`；修正后的测试包使用独立 `.local-host/user-data`，原版目录保持原状。账号数据不混入业务 JSON 或知识导出。备份/迁移官网授权须单独评估系统绑定与网站限制，不自动复制凭证。

## 原版无法启动事件与恢复

随后用户发现原版启动失败。实机确认原版停在 `desktop welcome: Web authentication failed`，默认 Cookie 库累积71个 `127.0.0.1` 的 `dsh-auth-*` 记录，请求头约16117字节。测试版反复复用默认浏览器目录增加了认证 Cookie。此前独立宿主修复了当前请求头，却未处理原版旧记录；上一阶段不能称为对日常原版无影响。

用户明确授权后，正常退出应用，先以0600权限完整备份 Cookie 数据库，再仅清理这71个本机认证记录。清理前后其余 Cookie 逐行对比一致，未改聊天、待办、模型配置及安装文件。原版随后真实启动通过，工作台“今日简报”正常显示现有21项待处理数据。备份保存在 gitignored `.local-host/recovery/`，含敏感存储，不提交或导出。

准备脚本已改为独立浏览器 userData，并重新准备、签名验证本地包，本轮未再启动测试包。恢复脚本默认只读，合成数据库精确范围与备份检查通过。当前桌面运行原版，持久化宿主扩展仍属于本地测试版，尚未合入原版发行包。
