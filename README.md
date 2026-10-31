# 智能工作台 · DSH Dev Workbench

DeepSeek Harness 原生插件，把消息跟进、研发任务、多 AI 对话、开发调试和知识检索放在同一个工作入口。复用 Harness 已配置的模型、会话和工具，从日常沟通中整理事项，带着工程与来源上下文继续处理，再把确认过的结论沉淀为知识。

- **办公跟进**：今日简报、待办与待回复、云之家连接、持续消息识别和日报周报。
- **研发协作**：Linky 工作项、本地工程、专属 Harness 会话、测试与独立审查。
- **分析与复用**：多 AI 统一提问、开发工具与数据查询、历史搜索和带来源的知识问答。

[源码仓库](https://github.com/LongerWu2026/dsh-dev-workbench) · [版本与下载](https://github.com/LongerWu2026/dsh-dev-workbench/releases) · [npm](https://www.npmjs.com/package/dsh-dev-workbench) · [问题反馈](https://github.com/LongerWu2026/dsh-dev-workbench/issues)

## 安装与升级

需要已安装的 DeepSeek Harness；命令行安装需要 Node.js **≥22.19.0** 和可用的 `dsh` 命令。插件名称为 `dsh-dev-workbench`，界面名称为「智能工作台」。

### 从插件市场安装

在 **dshmarket** 中搜索 `dsh-dev-workbench` 或「智能工作台」，进入详情安装或升级。市场共享目录更新可能晚于 GitHub 和 npm；中国大陆线路还取决于目录包及镜像同步。暂时搜不到或版本较旧时，可使用下面的安装方式。

### 通过 npm 安装

通过 npm 安装下列版本；若 registry 或镜像暂未同步，可使用下一节的 GitHub 预构建包。

```sh
dsh plugin --profile desktop add dsh-dev-workbench@0.3.0
```

将 `desktop` 替换为实际宿主使用的 profile。使用指定版本便于核对安装结果；桌面端也可使用应用自己的插件管理入口。

### 下载预构建包

从 [Releases](https://github.com/LongerWu2026/dsh-dev-workbench/releases) 下载 `dsh-dev-workbench-<版本>.tgz`，或直接安装：

```sh
dsh plugin --profile desktop add https://github.com/LongerWu2026/dsh-dev-workbench/releases/download/v0.3.0/dsh-dev-workbench-0.3.0.tgz
```

升级后按宿主机制重载插件组件或重启 Harness，再打开侧栏「智能工作台」。只刷新页面不会重新注册新增 Host 接口；遇到 `/api/workbench/...` 返回 404，先重载插件组件。升级前建议备份工作台数据，位置见下文。

## 首次使用

1. 打开「更多 → 连接与设置」，按需要配置连接器、项目和 AI。AI 主开关、自动登记及普通定时运行分别配置，新安装默认关闭；AI 使用宿主已配置模型及其用量。
2. 需要消息跟进时，在云之家连接器中点击「安装」和「登录授权」，在官方浏览器页面完成授权，再点击「重新检测」。连接成功后开始同步和提取；无需为 CLI 安装再次重启 Harness。
3. 在「今日简报」查看待办、待回复、日程与 AI 动态；进入来源详情核对消息后处理。点一次提取可按每批最多 50 条持续执行，在状态栏查看剩余数量、失败或暂停原因。
4. 需要研发辅助时，进入「研发任务」连接 Linky，选择本人工作项和工程，再确认测试命令。需要多 AI 问答时，进入「多 AI 对话」，在各厂商内嵌官网完成登录并选择发送对象。

各模块可独立使用；使用工具箱不要求先连接云之家或 Linky。窄窗口放不下的导航入口自动收进「更多」。

## 功能介绍

| 模块 | 可以做什么 |
| --- | --- |
| 今日简报 | 聚合待办与待回复、查看会议和提醒、关注 AI 动态、复制工作简报，持续查看提取进度 |
| 研发任务 | 读取 Linky 本人需求、用户故事和缺陷，关联工程、原生工作区和开发会话，组织分析、开发、测试、独立审查与人工确认 |
| 智能办公 | 批量准备回复草稿、生成日报周报和待办方案，保留产物与执行记录，按需开启忙碌自动回复 |
| 任务中心与待回复 | 独立管理交付与回复责任，支持搜索、筛选、状态切换、来源回查和确认后回复 |
| AI 资讯 | 使用宿主联网能力或可选 RSS 发现资讯，读取原文、生成摘要，按时间及关注主题组织 |
| 知识空间 | 保存候选知识、人工审核、限定项目和账号范围，检索原文并显示版本、行号与引用 |
| 多 AI 对话 | 同一问题发给选定厂商，逐轮切换查看回答，管理附件和本地历史，将选中回答保存为候选知识 |
| 工作搜索 | 在工作台记录中查找任务、回复、资料与问答，回到对应内容继续处理 |
| 开发工具箱 | 数据连接、JSON、Diff、HTTP/MCP 调试、日志、SQL、正则、类型生成及常用转换工具 |
| 研发协作 | 管理本地工程、启动命令，联动 VS Code、IDEA 和终端，查看运行日志 |

### 消息提取、待办与回复

消息按组织、账号、会话和原消息去重，保留来源及北京时间。聚焦未读消息、@本人、@全员及明确关联已有事项的跟进，普通已读聊天不会全量交给 AI。只采集和处理插件安装日期（北京时间）起的消息；升级、恢复与导入保留本机安装日期。

私聊未读先登记回复义务，识别为具体事项后转为待办；群消息需符合 @ 等处理规则。已读、确认收到和实际完成是不同状态，聊天不会自动完成或取消待办，人工确认字段受到保护。首页聚合存在明确关联的事项，完成待办和处理回复仍分别操作。

提取采用持久化队列：每批最多 50 条，点击一次持续处理，显示累计、剩余、失败及自动重试时间。临时失败按规则恢复，达到上限则明确暂停；重启恢复进度，成功内容不重复识别。普通自动同步在北京时间 **09:00–21:00 每五分钟**运行，包含 21:00；手动同步不受此时段限制。后台任务依赖 Harness 进程运行。

人工回复先编辑、核对并确认发送，生成、保存和复制草稿不会发送消息。可选的「忙碌自动回复」默认关闭：主动开启后，仅对本次忙碌期间的新未读私聊发送一次告知，每个会话每周期最多一次；成功告知后仍保留人工答复义务。该模式在 Harness 运行期间额外每分钟检查，关闭停止新告知，账号变化后需重新启用。详见[消息分流规则](docs/MESSAGE-ROUTING-RULES-2026-10-29.md)、[连续识别](docs/CONTINUOUS-ANALYSIS-2026-10-30.md)和[忙碌回复](docs/BUSY-PRIVATE-REPLY-2026-10-31.md)。

### Linky 研发任务

- 登录后查看本人需求、用户故事与缺陷，按空间、类型、状态筛选，打开完整描述并继续已有研发过程。
- 将工作项与本地工程、原生 Harness 工作区及专属会话关联。满足条件的干净 Git 根仓库可建立独立 worktree；普通目录或已有改动等情形使用所选目录，保留原有内容。
- 确认工程与测试命令后启动分析、开发、真实测试和独立 AI 审查。测试未配置、执行失败或模型异常会暂停；可补充要求并继续原会话。
- 人工审查展示差异、测试退出码及审查意见。批准绑定当前代码内容，后续变化会使批准失效。批准与向 Linky 回写评论分别确认，评论回写不会代替代码提交、合并或发布。
- npm 包包含 `harness-linky` CLI，可将 Linky 的 Codex 协议入口适配到官方 Harness ACP；配置及权限边界见[实施说明](docs/LINKY-DEVELOPMENT-IMPLEMENTATION-2026-10-31.md)。

页面使用方式及工程选择见[研发任务说明](docs/DEVELOPMENT-UX-2026-10-31.md)。完整真实业务修复与回写仍需用户在实际工作项中验证，隔离测试不代表业务已完成。

### 多 AI 对话与历史

内嵌 Kimi、智谱清言、豆包、元宝和千问，ChatGPT 可选。统一输入问题，选择发送厂商，每轮通过厂商标签查看回答；各厂商保持自己的官网会话，新厂商不会自动继承其他厂商的历史上下文。

支持选择、粘贴和拖入图片或文档，发送前预览和移除。每次最多 5 个附件，单文件 10 MB、合计 20 MB；历史仅保留附件元数据，刷新后需重选原文件。回答可保存、搜索、重命名、归档或放入本地回收站，选中内容可加入候选知识。恢复采集只读取回答；仅明确未提交的厂商可由用户点击补发，提交结果不确定时不自动重发。

登录、验证码、站点繁忙及附件格式受各厂商规则约束。**跨 Harness 重启的网页登录持久化需要另行适配宿主扩展，安装本插件不会自动修改桌面应用**；普通原版宿主不保证这一能力。详见[聊天与补发](docs/WEB-AI-CHAT-REDESIGN-2026-10-30.md)、[历史管理](docs/WEB-AI-LOCAL-HISTORY-2026-10-29.md)、[真实站点验证](docs/WEB-AI-LIVE-ACCEPTANCE-2026-10-30.md)及[可选 rc.5 宿主扩展](host-integration/rc5/README.md)。

### 开发工具与数据查询

工具箱按工具展示输入和结果，可搜索、筛选并在当前页面保留切换前的输入。JSON 支持格式化、树形查看和路径复制；Diff 支持文本和 JSON 结构对比；HTTP 调试支持导入基础 cURL，导入本身不发送请求；另有 MCP Streamable HTTP 调试、日志筛选、正则、Cron、SQL 格式化、类型生成、YAML/CSV 转换等工具。AI 辅助需显式点击，沿用宿主助手。

数据连接支持 MySQL、PostgreSQL、Elasticsearch 和单节点 Redis：读取所选结构、生成查询并在用户点击后执行。SQL 使用语法树校验和只读事务，Redis 仅开放受限读取；建议配合只读账号使用。AI 生成只传数据库类型与所选结构元数据，不传连接密码、地址或业务行数据；生成的结构变更与回滚脚本仅供预览。查询结果最多 200 行、1 MB。

数据连接密码只驻留宿主内存，重启或断开后重新填写；非密码配置保存在本地。HTTP/MCP 调试按用户操作联网，离线转换在本地执行。详见[工具箱介绍](docs/DEVELOPER-TOOLBOX-2026-10-31.md)、[数据连接说明](docs/DATA-TOOLS-2026-10-31.md)和[研发协作](docs/DEVELOPER-WORKFLOWS-2026-10-29.md)。

### 知识检索与工作汇总

回答和办公产物先保存为候选知识，经人工审核后参与默认检索。检索按项目、账号、有效期和归档状态过滤，默认采用本地中文分词、分块与 BM25 排序，回答携带实际使用的原文、版本及行号。可选远程 Embedding 需要 HTTPS，HTTP 仅允许本机回环地址；不安全地址会在发送凭据和正文前被阻断，并保留本地检索。

智能办公将工作记录组织为回复草稿、日报周报和待办方案，产物及执行状态可追踪。模型输出仍需人工核验，未命中资料时不会把未读取的链接当作依据。详见[知识检索与引用](docs/KNOWLEDGE-RETRIEVAL-IMPLEMENTATION-2026-10-28.md)及[办公流程](docs/AGENT-WORKFLOWS-IMPLEMENTATION-2026-10-28.md)。

## 数据、权限与备份

工作台数据按 Harness Home 保存，切换聊天不会切换数据空间。项目用于记录归属和上下文范围。默认目录为 `~/.dsh/storages/dev-workbench/`；设置了 `DSH_HOME` 时使用 `$DSH_HOME/storages/dev-workbench/`。

| 内容 | 相对工作台数据目录的位置 |
| --- | --- |
| 业务记录与处理队列 | `state.json` |
| 业务状态备份 | `backups/` |
| 数据连接非密码配置 | `data-connections.json` |
| 研发配置、任务和适配器记录 | `development/` |
| 托管云之家 CLI | `tools/yunzhijia/` |

迁移工具提供预检、备份、关联检查、合并或替换。**现有业务导出不会包含独立的 `development/`，备份研发记录时须一并保存该目录。** 模型凭据、厂商登录状态和原生 Harness 会话另行管理。

连接器需要对应账号授权；AI 请求使用宿主配置的模型；主动发送、开启忙碌告知、研发执行和回写均应按页面要求操作。源码和 npm 包不包含本机截图、原始观测日志或账号数据，相关验收材料保存在本地忽略目录中。

## 开发与验证

源码采用 TypeScript 和 React/TSX：`src/host.ts` 为 Host 入口，`src/client.ts` 为 Client 入口，`src/shared/` 维护共享契约，`src/cli/harness-linky.ts` 为 CLI 入口。构建生成 `index.js`、`client.js` 和 `bin/harness-linky.mjs`；不要直接编辑生成文件。模块职责见[源码导航](src/README.md)。

```sh
pnpm install --frozen-lockfile
pnpm --dir plugin-tests install --frozen-lockfile
pnpm build
pnpm check
pnpm test
pnpm test:layout
```

`pnpm check` 包含严格类型、架构、产物一致性与语法检查；`pnpm test` 运行 Host 场景及客户端交互回归；布局测试使用隔离浏览器与合成数据。可选宿主集成测试见[rc.5 集成说明](host-integration/rc5/README.md)，需要单独准备对应宿主源码或运行环境。

本地源码安装：

```sh
dsh plugin --profile desktop add .
```

真实账号、厂商网页与多日运行的验证范围应以对应记录为准；单元测试、合成消息与协议夹具不等同于真实业务投递或执行。历史桌面验证见[桌面记录](docs/DESKTOP-VALIDATION-2026-10-28.md)和[稳定性记录](docs/RELIABILITY-VALIDATION-2026-10-28.md)。

## 文档索引

| 文档 | 内容 |
| --- | --- |
| [研发任务](docs/DEVELOPMENT-UX-2026-10-31.md) | Linky 工作项、工程、会话、测试和人工审查 |
| [多 AI 对话](docs/WEB-AI-CHAT-REDESIGN-2026-10-30.md) | 聊天布局、逐厂商状态、附件与补发规则 |
| [今日简报](docs/BRIEF-OVERVIEW-2026-10-30.md) | 待办与回复聚合、日程和资讯入口 |
| [提取状态](docs/EXTRACTION-STATUS-2026-10-30.md) | 连续处理、进度与失败重试 |
| [云之家连接](docs/YUNZHIJIA-SETUP-2026-10-30.md) | 安装、授权、重新检测与运行要求 |
| [架构与功能](docs/PROJECT-ARCHITECTURE-AND-FEATURES.md) | 模块及数据组织 |
| [实施与验证记录](docs/IMPLEMENTATION-STATUS-0.2.0.md) | 历史实现、技术证据及验证边界 |
| [待办与验收](docs/TODO-AI-AUTOMATION.md) | 当前验收、历史及后续观察事项 |
| [业务验收手册](docs/REAL-VALIDATION-RUNBOOK.md) | 隔离样本与复验步骤 |

## 开源许可

MIT。第三方组件说明见 [THIRD-PARTY-NOTICES.txt](THIRD-PARTY-NOTICES.txt)。
