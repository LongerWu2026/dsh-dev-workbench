# 智能工作台

DeepSeek Harness 原生 Cordis 插件。0.2.0 工作树已迁移为 TypeScript 模块与 React/TSX 组件，以消息理解、独立待回复和待办、AI 资讯及上下文助手构成办公流程。

当前为已在 DeepSeek Harness 桌面验证主要办公闭环的 0.2.0 候选版：复用软件已有 GLM-5.3-Flash 配置，实际执行聊天建改待办、消息识别、独立待回复、资讯搜索和四段摘要。工程回归及十页走查通过；短时休眠恢复和未读对照已有验证，多日运行及第二账号仍需观察。详细证据见 [桌面验收记录](docs/DESKTOP-VALIDATION-2026-10-28.md) 和 [实施记录](docs/IMPLEMENTATION-STATUS-0.2.0.md)。

源码与新增功能入口见 [源码模块导航](src/README.md)，本轮深化拆分与原生归档见 [模块边界记录](docs/MODULE-BOUNDARIES-AND-SESSION-ARCHIVE-2026-10-28.md)。

源码仓库：[LongerWu2026/dsh-dev-workbench](https://github.com/LongerWu2026/dsh-dev-workbench)。本机验收截图与原始观测记录保留在本地 `docs/evidence/`，不随源码或 npm 包公开；文档中相关路径用于本地复验。

## 文档

| 文档 | 用途 |
| --- | --- |
| [模块重构与办公能力](docs/MODULAR-REFACTOR-AND-OFFICE-UPGRADE-2026-10-28.md) | 新模块职责、维护入口、新增功能与本轮实测 |
| [项目架构与功能](docs/PROJECT-ARCHITECTURE-AND-FEATURES.md) | 当前模块、数据、消息和后台工作流 |
| [实施与验证记录](docs/IMPLEMENTATION-STATUS-0.2.0.md) | 本轮实现、测试证据、真实环境限制及交付状态 |
| [待办](docs/TODO-AI-AUTOMATION.md) | 唯一验收状态入口，保留历史、当前验收与延长观察项 |
| [界面设计与参考](docs/UI-REDESIGN-AND-REFERENCES.md) | 顶部目录、窗口避让、布局与社区参考 |
| [实施方案](docs/UNIFIED-IMPLEMENTATION-PLAN.md) | 开发阶段与验收门槛 |
| [业务验收手册](docs/REAL-VALIDATION-RUNBOOK.md) | 隔离样本的完整业务检查 |

## 已编码的办公流程

- 顶部目录包含今日简报、任务中心、待回复、资讯、知识空间、多 AI 对话；搜索、Agent、工具、研发和设置保留在更多。
- 消息仅识别未读会话中的未读窗口、@本人、@全员和明确引用已有事项的跟进；普通已读聊天不再进入 AI。日历会议直接同步，改期、取消沿用原记录，并与唯一匹配的群会议合并来源。按组织/账号、会话、消息和日历事件去重，限流或预算耗尽保留续采位置。
- 消息分流：私聊未读先进入待回复，AI识别为具体事项后仅保留待办；群未@本人/全员不能自动建待办。已读不等于已回复，聊天不自动完成或取消任务。规则和验证见 [消息分流](docs/MESSAGE-ROUTING-RULES-2026-10-29.md)。
- 模型输出经结构、日期、证据和关联范围检查后建立 Reply / Task；确认收到与实质答复分开，人工标记受保护。
- 助手、任务编辑共用一个侧区，窄容器切换为专注视图。切换模块可收起编辑，继续编辑保留草稿。
- 资讯可使用宿主联网能力发现来源，RSS 为可选；后台读取原文、补齐摘要，按主题/项目匹配与时间排序。
- 耗时识别和摘要可立即返回 jobId；持久化队列记录运行、失败与重试。后台只在 DSH 进程运行期间执行。
- 新增会前/到期/待回复提醒、ICS 导出和 AI 回复草稿；待回复页可编辑正文、核对后引用原消息发送，成功后标记已回复。生成、保存和复制草稿不会发送。消息优先显示发件人姓名，群消息同时显示来源群名；只有 BOT 编号时标识为机器人，有名称时显示名称。今日简报及任务中心列表、看板和来源详情均展示原消息发出时间（北京时间，精确到秒）。当前待办、待回复关联的旧消息在启动和同步时按原消息 ID 补全元数据，不重新识别历史任务。
- 设置页支持业务变更预览/撤销、真实后台 Token 用量与预算、识别质量样本评测、记录归档/恢复。
- 数据采用副本和串行短提交，成功落盘后发布缓存；迁移提供纯预检、备份、关联检查、合并/替换及目录映射。

AI 主开关、自动登记和定时运行是分别配置的。新安装默认关闭，开启后使用宿主模型及其用量；关闭自动登记时，实际处理事项等待确认，回复义务仍独立登记。连接器不可用、模型未认证或网络失败会保留状态。

消息只采集和处理插件安装日期（北京时间）起的内容；已有历史暂存及安装日期之前的未完成识别标记为已跳过，不再识别、确认或重试。旧版按本机工作台数据目录的首次创建日期补齐安装日期，后续重启、恢复备份和导入均保留本机日期。云之家限流后冷却两分钟并保留未读取会话。本机此次验收已开启AI识别、自动登记和1小时后台采集，待处理队列按分钟检查。

全员参会通知按本人处理义务识别；没有截止时间的会议也按开始时间进入今日待办。姓名补全优先处理当前待办和待回复，批量查询中的失效账号会隔离并暂时跳过，具体故障及验证见[验收记录](docs/acceptance.md#20-全员参会通知与姓名补全修复2026-10-29)。

## 架构与数据

`src/host.ts` 为 Host 入口，`src/client.ts` 为 Client 入口，`src/shared` 维护契约和运行时校验。源码已移除数字前缀：Host 按业务/存储/识别/会话/资讯/自动化等模块组织，Client 按 `features`、`components`、`shell`、`core` 组织；新旧路径见 [映射表](docs/MODULE-PATH-MAP.json)。源码使用显式模块导入，`scripts/build.mjs` 通过 esbuild 输出 Host ESM `index.js` 和宿主模块工厂 `client.js`；Client 运行时只依赖宿主 React。

业务数据位于 `$DSH_HOME/storages/dev-workbench/state.json`，默认 `~/.dsh/storages/dev-workbench/state.json`，schema v2。数据按 Harness Home 共用，切换聊天不会切换数据空间；项目是记录归属和上下文范围。迁移包包含业务记录与队列，凭据和原生会话单独管理。备份位于同目录的 `backups/`。

## 开发和验证

Node.js ≥22.19.0，使用 pnpm。

```bash
pnpm install
pnpm build
pnpm check
pnpm test
```

`pnpm check` 包含严格类型检查、重新构建与产物一致性检查及产物语法检查。`pnpm test` 包含 Host、可靠性、批量分析、办公增强、十页渲染与 React 交互测试。修改源码后先构建，不直接编辑生成产物。

本机 desktop profile 已通过本地链接指向当前仓库。安装其他测试 profile 可执行：

```bash
dsh plugin --profile desktop add /Users/wulonglong/Documents/AIWorkBench/dsh-dev-workbench
```

Host 更新后需重新加载宿主进程，Client 更新后需刷新界面。本轮通过原生软件操作完成桌面验收与正常退出重启；Playwright GUI 脚本未执行，使用时须连接明确的隔离 DSH 调试目标，详见验收手册。

MIT。

本机休眠恢复、云之家未读对照、热重载与长时间运行的后续修复和证据见 [稳定性验证记录](docs/RELIABILITY-VALIDATION-2026-10-28.md)。

顶部目录和原生聊天菜单的最新样式修复、实机截图及剩余事项见[界面修复记录](docs/UI-POLISH-2026-10-28.md)。

Agent 中心新增批量回复草稿、日报/周报与待办处理方案，支持产物、取消与继续。入口、实现范围及验证见[办公执行记录](docs/AGENT-WORKFLOWS-IMPLEMENTATION-2026-10-28.md)。

知识空间支持审核、范围检索、自动问答引用和知识驱动办公流程；默认本地使用，见[知识检索实施记录](docs/KNOWLEDGE-RETRIEVAL-IMPLEMENTATION-2026-10-28.md)。

「多 AI 对话」（原「网页 AI 对比」）直接显示在顶部导航：内嵌 Kimi、智谱清言、豆包、元宝、千问，ChatGPT 可选。支持直接提问并自动保存历史、批量问题、保留官网操作、人工保存回答及候选知识；已关闭另开浏览器窗口入口。本地持久化宿主已接入并通过真实 Electron 三进程存储与工作台冷启动检查；使用项目内 `.local-host/DeepSeek Harness Workbench.app`，原安装包未覆盖，原版无扩展时仍只在本次运行保留登录。六站真实账号恢复及登录后自动化仍待验收，见[宿主实施与证据](docs/WEB-AI-HOST-PERSISTENCE-2026-10-29.md)、[构建说明](host-integration/README.md)及[功能边界](docs/WEB-AI-COMPARISON-2026-10-28.md)。

多 AI 对话采用统一提问与回答视图，官网按需展开，并增加只读恢复采集。 历史问答支持本地搜索、分页、重命名、问题修订、回收站恢复和确认后的本地删除，见[历史管理](docs/WEB-AI-LOCAL-HISTORY-2026-10-29.md)。最新逐站状态及锁屏/认证边界见[适配复验](docs/WEB-AI-ADAPTATION-2026-10-28.md)。

统一提问区现可选择、粘贴或拖入图片和文档，预览后逐项移除；批量首问上传附件，追问沿用同一官网会话。每次最多5个，单文件10MB，总计20MB；历史仅记录附件信息，刷新后需重新选择。各厂商实测范围及未验收格式见[附件实现与验证](docs/WEB-AI-ATTACHMENTS-2026-10-29.md)。

研发协作新增项目启动、VS Code/IDEA/终端联动与运行日志；开发工具箱新增 HTTP 接口调试和 MCP Streamable HTTP 调试，联网工具与离线工具分别标注。入口、使用方式及验证边界见[开发工作流实施说明](docs/DEVELOPER-WORKFLOWS-2026-10-29.md)。
