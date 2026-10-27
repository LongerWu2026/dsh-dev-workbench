# 智能工作台（dsh-dev-workbench）

DeepSeek Harness 的原生 Cordis 插件（Host + Client 双半），把「今天要处理的事」收进一个常驻面板：今日简报、任务中心、Agent 执行记录、离线开发工具箱、知识空间与连接设置。

实现依据同目录下的《DeepSeek Harness 开发者智能工作台 · 完整设计报告》v1.0。

```
┌ 侧边栏 ▸ 工作台图标（order 30）
└ 主面板 ▸ key = dev-workbench
         ├ 今日简报   统计 / 云之家 @我 横条 / 今日待办 / 技术雷达（RSS 或按主题联网发现）/ 快捷操作（含番茄钟、复制今日简报）/ 连接状态 / 工作台助手抽屉
         ├ 任务中心   待确认（规则候选→人工采纳）/ 列表 + 看板、筛选、来源证据、执行记录
         ├ 统一搜索   待办/知识/雷达/来源/本地项目（文件名+文本片段）/企业（消息+文档+联系人/会议室/考勤/日程）/PR·CI/互联网
         ├ Agent 中心 执行队列、审批空态、指标、任务简报
         ├ 开发工具箱 16 个：JSON / 时间戳 / Base64 / URL / UUID / JWT / 正则 / Diff / Cron / SQL / YAML / CSV / Markdown / HTTP 状态码 / Shell·Docker 速查 / SQL 计划解读
         ├ 研发协作   Git 分支与改动、PR 与 CI、Docker 容器、监听端口、进程 CPU/内存（全部只读）
         ├ 知识空间   收藏、笔记、代码片段
         └ 连接与设置 连接器、关注主题、权限分级、运行时诊断、数据管理
```

## 安装与卸载

```bash
# 本仓库目录已是可安装的 bundle（linked 安装，改代码后重新构建即可）
dsh plugin --profile desktop add /Users/wulonglong/Documents/AIWorkBench/dsh-dev-workbench
```

在 GUI 中也可以通过 **设置 → 插件** 的 `install_bundle` 路径安装。卸载：

```bash
dsh plugin --profile desktop remove dsh-dev-workbench
```

安装后侧边栏会出现第 5 个图标（`dev-workbench`，排在 `dsh-context` 之后）。

## 架构

| 层 | 文件 | 职责 |
| --- | --- | --- |
| 插件清单 | `package.json` | 包名/目录名 `dsh-dev-workbench`（技术标识，ASCII）；界面文案与插件页显示名「智能工作台」为中文 |
| 补丁层 | `cordis.patch.yml` | 插入一行 `dev-workbench` 加载 `index.js` 作为 Host 半 |
| Host | `src/host/*.js` → `index.js` | 状态权威、持久化、`workbench/*` Remote、`workbench_*` Agent 工具 |
| Client | `src/client/*.js` → `client.js` | `main` 与 `sidebar.panellist` 两个插槽的页面与图标 |
| 构建 | `scripts/build.mjs` | 把两个目录按文件名拼接成两个产物（无打包器、无运行时依赖） |

### 为什么是拼接而不是打包

浏览器半只有 `react` 一个模块表依赖，Host 半是单入口 ESM。拼接让插件保持「纯 JS、无构建依赖、可直接阅读产物」的形态，同时允许按页面拆分源文件。`scripts/build.mjs --check` 会检查跨文件的顶层重名。

### 通信契约

Host 用 `ctx.provide('workbench', api)` 暴露服务，并用 `ctx.typert.register()` 注册手写的 `src-json` 描述符；Client 通过
`ctx.connection.rpc.call('/api', 'workbench/<method>', { args })` 调用。每个写操作都返回**整份新快照**，Client 直接替换，不做增量合并 —— 这是设计报告 §5.2「Host 维护可重建快照」的最朴素实现。

端点：`snapshot` / `saveSettings` / `createTask` / `updateTask` / `deleteTask` / `addSource` / `createKnowledge` / `deleteKnowledge` / `saveRadarItem` / `deleteRadarItem` / `recordRun` / `updateRun` / `saveProject` / `deleteProject` / `fetchRadar` / `fetchMentions` / `createTaskFromRadar` / `search` / `environment` / `reset` / `seedDemo` / `diagnostics`（22 个，`tests/host-smoke.mjs` 会校验描述符与 service 方法一一对应）。

### 数据落盘

`$DSH_HOME/storages/dev-workbench/state.json`（默认 `~/.dsh/storages/dev-workbench/state.json`）。

- 单文件 JSON + `tmp → rename` 原子写入；
- 带 `version` 字段，为后续迁移到 SQLite 预留；
- 解析失败时回退为空状态并在诊断里报告，不会静默丢数据；
- 每次写操作追加一条 `audit` 记录（保留最近 200 条）。

### Agent 工具

模型可以读写与页面相同的对象，这是设计报告 §4.4「执行结果回写任务」的落地方式：

| 工具 | 用途 |
| --- | --- |
| `workbench_list_tasks` | 读取待办（默认只看未完成，按优先级与截止排序） |
| `workbench_create_task` | 「记一下」「帮我建个待办」 |
| `workbench_update_task` | 改状态 / 优先级 / 截止 / 标题 |
| `workbench_record_run` | 把一次执行登记进 Agent 中心并写回任务 |
| `workbench_task_brief` | 把任务 + 来源证据渲染成可直接使用的提示词 |
| `workbench_fetch_radar` | 抓取已配置的 RSS/Atom；**未配置 RSS 时按关注主题联网发现**。配合 DSH Schedule 的每日提醒即可闭环「定时简报」 |
| `workbench_update_radar` | 把四段摘要写回指定资讯（只改摘要，保留来源与时间） |
| `workbench_search` | 多路统一检索，返回分组结果与每路状态，供带引用的问答 |
| `workbench_fetch_mentions` | 通过 yzj-cli 拉取 @我 消息存为来源证据；只做确定性采集，是否转待办由会话里的 Agent 或用户决定 |

## 与设计报告的对应

| 报告章节 | 落地情况 |
| --- | --- |
| §1 一级导航 8 个模块 | **8/8 全部落地**：首页、任务、统一搜索、Agent、工具箱、研发协作、知识、设置；另有全局命令面板（⌘K）与 ⌘1–⌘8 直达 |
| §2 UI 设计系统 | 深色/浅色自适应：容器与文字全部走 `--dsw-alias-*` token，仅语义色沿用报告的蓝青/成功/警告/危险语汇 |
| §2.2 任务字段 | 全部字段落库；`aiExtracted` + `confidence` 与人工字段区分展示 |
| §3.1 技术雷达 | 列表 + 主题过滤 + **按 URL 与标题三元组相似度（≥0.82）双去重** + **四段摘要可编辑**（「编辑资讯」弹窗填技术变化/应用场景/采用风险/推荐实践）+ 收藏到知识空间 + **RSS/Atom 抓取**（逐源降级、按 URL 去重、抓取报告与陈旧标记落库）+ **生成实践任务**（原子建来源证据 + 任务，重复生成幂等）。抓取条目只保留原文摘录，四段留空待填 |
| §3.2 手动待办 | 增删改查、优先级、截止、标签、项目，离线可用、重启不丢 |
| §3.2 企业消息 | **云之家 @我 拉取已接入**（真实 yzj-cli）：whoami 验证身份 → `im message search "@姓名"` → 按 `param.notifyType===1` / `desc[].type==='at'` 判定真 @ → 存为来源证据（原文/群名/时间/**发送人姓名**/**msgId+groupId 定位**），按 msgId 去重；首页横条可一键预填建待办。只读；发送/审批等写操作留在会话里 |
| §3.2 AI 任务提取 | **规则候选 + 人工确认**：行动词 / 时间线索 / 长度 / 指向性算出可解释置信度（reasons 逐条可查），进任务中心「待确认」区；采纳才建任务（带来源证据与 aiExtracted 标记），忽略即丢弃；插件内无模型，故明确标注为规则候选而非 LLM 结论 |
| §3.3 统一搜索 | 十三路：待办 / 知识 / 雷达 / 来源证据 / **本地项目（文件名 + 文本片段，跳过 node_modules/.git，只读文本白名单）** / 企业（消息 + 文档）/ **联系人 / 会议室 / 考勤 / 日程（按意图触发，无命中不生成空分组）** / **PR·CI（gh CLI，代码协作类意图）** / 互联网。日期与项目过滤；**不做无引用 AI 归纳** |
| §3.4 开发工具箱 | **14 个工具**，全部浏览器内计算（L0）：新增 YAML（常用子集，锚点/块标量明确报错）、CSV（引号转义 + 类型推断）、Markdown 预览（React 元素构造，不用 innerHTML）、HTTP 状态码速查（34 条 + 分组过滤） |
| §3.5 研发协作 | Git 分支 / 改动数 / 最近提交，**PR 与 CI**（`gh pr list` / `gh run list`），Docker 容器列表，**监听端口**（`lsof -i`），**进程 CPU/内存 Top 12**（`ps aux`）。全部只读：多段前缀白名单（`gh pr list|view|status`、`gh run list|view`、`gh repo view`、`gh search repos`、`ps aux`）+ 单命令白名单，`pr merge` 这类写操作在 spawn 前即被拒绝 |
| §4.2 逻辑 Agent 角色 | 未建常驻角色；以 5 个工具 + 会话执行替代，避免与 DSH 原生 Session 冲突 |
| §4.5 Task 状态机 | `draft → ready → running/waiting_approval → completed/failed/cancelled` 完整落库 |
| §5.1 组件职责 | Host 持状态、Client 只渲染，前端无凭据、无 Shell |
| §6.1 核心实体 | Task / SourceRef / AgentRun / Connector / **Project（可增删改，`repoPath` 决定研发协作探测目录）** / Audit 已落库；SyncCursor 待接入连接器 |
| §7.1 权限分级 | 工具箱 L0；连接器探测 L1 只读；写操作 L2 经 Host；L3 未实现（无写外部系统的能力） |
| §7.2 安全基线 | 无凭据入库、无明文日志、来源 URL 可回跳、外部内容不做指令 |
| §9 阶段 A、B | 已完成 |
| §9 阶段 C、D、E | 部分完成（Agent 记录与回写已通，企业数据与 Git/Docker 只读诊断未接入） |
| §10 开放问题 1 | **已解决**：`main` 是 keyed 开放域插槽，`sidebar.panellist` 的 id 即 main key，独立工作台页成立 |

## 已知边界

这些能力**没有**实现，界面里也不会假装可用：

1. **云之家 CLI**：未做能力发现，`connectors` 中恒为「未配置」并附原因（设计报告 §6.3 的清单尚未逐条验证）。
2. **企业搜索 / 知识文件检索**：未接入；知识空间只有本地条目。
3. **Git / Docker**：已实现只读状态（分支、改动、最近提交、容器列表），但 PR / Review / CI、端口占用、进程指标未接入；写入类操作（暂存、提交、推送、重启容器）本插件完全没有。
4. **AI 摘要**：插件内没有模型，抓取条目只保留原文摘录，四段摘要留空——归纳应交给会话里的 Agent 并用 `workbench_record_run` 写回。GitHub Trending 抓取未接入（无稳定 RSS，不猜测第三方地址）。
5. **SQLite**：当前为原子写入的单文件 JSON，schema 版本已预留。
6. **定时同步**：未使用 Schedule；`updatedAt` 与 `settings.staleHours` 只用于提示数据陈旧。

## 可靠性与自动化（2026-10-27 补齐）

- **写入原子性**：工具调用与 Remote 共用同一组写入原语，重试走持久化操作账本（`idempotencyKey`），不会重复创建。
- **重载不丢关联**：状态恢复保留全部 ID，`projectId / taskId / runIds / sourceRefId` 与候选关联在重启后仍然成立。
- **规则提取语义**：相对日期以原消息时间为基准；「已解决 / 不用处理 / 取消」不建候选（「是否取消」这类询问除外）；一条消息可拆多事项；规则分数不会自动入库。
- **页面同步**：业务修订号 `revision` + 12s 轻量轮询，只有变新才重取快照，且编辑表单期间跳过。
- **备份与损坏保护**：每天首次写入自动备份（保留 5 份），损坏文件先改名留存再从空状态启动；设置页可手动备份/恢复。
- **工作台助手（侧栏可对话）**：工具栏「助手」按钮打开右侧聊天窗，直接提问；走宿主原生 `sessions` + `sessionController.prompt` 链路，复用原生模型与工具，回复里会显示本轮调用的 `workbench_*` 工具。卡片「AI 分析」把记录加入**可见可移除**的上下文引用，随消息一起提交；支持「新会话 / 打开完整会话」。
- **增量同步**：按最近群 + 每群游标只取新消息，用 `notifyType` 判据覆盖昵称 @；关键词检索作为兜底。
- **后台自动化**：插件侧定时器（每 60s 判定到期）执行资讯采集与 @我 拉取，单飞锁 + 补跑 + 结果记录；设置页可开关、调间隔、立即执行。

## 开发

```bash
cd dsh-dev-workbench
node scripts/build.mjs            # 生成 index.js 与 client.js
node scripts/build.mjs --check    # 只做跨文件重名检查
node --check index.js && node --check client.js
node tests/host-smoke.mjs         # Host 半自测（146 项：含 PR/CI、进程、本地文件搜索、语义去重、候选采纳/忽略、三路意图搜索）
node tests/client-render.mjs      # Client 全页面渲染（8 页 + 空态 + 6 个新增工具面板；真实驱动搜索/抓取/@我 按钮）
```

`tests/client-render.mjs` 不是 mock 预览：它加载**真实的** `client.js`，用最小 React 渲染器
（hook 状态按组件身份持久化，异步 `setState` 绑定到创建它的那一次渲染，children 同时进
`props.children`）在 Node 里渲染 `main` 面板，再通过导航按钮的真实 `onClick` 逐页切换，
并通过真实 `onChange` + `onClick` 驱动一次完整搜索查询，断言每页出现预期内容。它用于在
无法控制浏览器时挡住「页面抛错 / 读空快照崩溃 / 页面空白 / 数据到达后不重渲染」，但不证明布局与配色。

验收记录见 `docs/acceptance.md`。

修改 `src/**` 后必须重新构建。

> **重启要求**：Host 与 Client 都是进程内模块。改完 `client.js` 至少要在 GUI 里刷新窗口；改完 `index.js`（新增 Remote 端点 / 工具）必须**重启 DSH** —— 重新安装 bundle 不会替换已加载的 JavaScript 模块代际。

## 目录

```
dsh-dev-workbench/
├── index.js            # 构建产物：Host 半（勿手改）
├── client.js           # 构建产物：Client 半（勿手改）
├── cordis.patch.yml
├── icon.svg
├── locale/{zh,en}.json # 插件管理器的标题与描述
├── scripts/build.mjs
├── src/
│   ├── host/           00-util · 10-model · 20-store · 25-connectors · 30-service · 40-remote · 50-tools · 90-apply
│   └── client/         00-core · 10-shell · 15-taskform · 20-dashboard · 25-tasks · 30-agents · 40-toolbox · 45-knowledge · 50-settings · 60-palette
├── tests/host-smoke.mjs
└── docs/
```

## 许可

MIT。
