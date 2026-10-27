# 验收记录 · 智能工作台（dsh-dev-workbench）v0.1.0

按《开发者智能工作台 · 完整设计报告》§9「发布门槛」逐条记录实际验证结果。

验证环境：DeepSeek Harness Desktop 0.2.1-rc.3（Electron 44 / Node 24），profile = `desktop`，
插件以 linked 目录方式安装（`dsh plugin --profile desktop add`）。

## 1. 已自动验证

| 项目 | 方法 | 结果 |
| --- | --- | --- |
| Host 半语法 | `node --check index.js` | 通过 |
| Client 半语法 | `node --check client.js` | 通过 |
| 跨文件顶层重名 | `node scripts/build.mjs --check` | 11 host / 12 client part，无冲突 |
| Host 业务逻辑 | `node tests/host-smoke.mjs` | **133/133 通过** |
| Client 全页面渲染 | `node tests/client-render.mjs` | **8/8 页面 + 空态 + 6 个新增工具面板**；真实驱动搜索、抓取资讯、@我 再拉一次、逐个切换工具 |
| **描述符实参交叉校验** | 渲染测试从 `src/host/40-remote.js` 解析签名表，逐一核对每个 RPC 调用的实参键 | **22/22 一致**——正是此项挡住 `fetchRadar` 的 `unexpected "request"`（客户端对零参端点多发了 `request` 字段，网关严格校验拒绝） |
| 插件安装 | `plugin_manager install_bundle` | `application: applied`，`warnings: []` |
| Host 行激活 | 运行时写出 `state.json`；`apply` 注册工具 | 已创建 |
| `main` 插槽 | `Slots.listSubTree {root:'main'}` | occupant `dsh-dev-workbench / key=dev-workbench / active` |
| 侧边栏入口 | `Slots.listSubTree {root:'sidebar.panellist'}` | occupant `dev-workbench / order 30 / active` |
| Agent 工具 | `Tool.listTools` | 7 个 `workbench_*` 工具全部可见（含 `workbench_fetch_radar`、`workbench_fetch_mentions`） |
| 插件元数据 | `locale/{zh,en}.json` 的 `meta.title` / `meta.description`，`icon.svg` | 已导出 |

### `tests/host-smoke.mjs` 覆盖
空状态初始化、创建 / 更新 / 重开待办、空标题拒绝、来源指纹去重、雷达按 URL 幂等更新、
知识新增、执行记录写回任务、无效 taskId 拒绝、重置保留设置、示例数据幂等、诊断读数、
7 个工具注册、**Remote 描述符与 service 方法一一对应**（22 个）、统一搜索（本地分组命中 / 空关键词拒绝 /
无 web 服务时降级为 `unavailable`）、研发环境探测（无 subprocess 时如实报告 `unavailable`，
不返回假空表）、**项目 CRUD**（新增 / 按仓库目录幂等 / 缺目录拒绝 / 删除后任务解绑）、
**RSS 抓取**（好源新增 / 网络失败与 HTTP 403 逐源降级 / 重复抓取按 URL 去重 / 四段摘要留空不伪装 AI /
空资讯源如实报告）、**生成实践任务**（来源证据原子落库 / 重复生成幂等 / 不存在的资讯拒绝）、
**云之家 @我 拉取**（whoami 验证 / notifyType+desc 判定真 @ / 剔除自己发的 / 按 msgId 去重 / 无 CLI 与 token 失效如实降级 / 企业搜索分路报告——消息路失败不拖垮文档路）、
**重新加载模块后数据仍在**（持久化，按重载前后记录数对比）。

### `tests/client-render.mjs` 覆盖
载入**真实** `client.js`，用最小 React 渲染器（hook 状态按组件身份持久化、异步 setState 绑定到
发起它的渲染、children 同时进 `props.children`）渲染 `main` 面板，再通过导航按钮的真实
`onClick` 逐页切换 8 个模块；统一搜索页额外通过真实 `onChange` 填入关键词、点击「检索」，
断言六路分组与企业路的诚实降级文案出现。每页断言标题与多条预期内容（如研发协作的
「添加仓库目录」+「端口占用」、设置的「仓库目录决定」+「资讯源」、首页的「抓取资讯」）、
节点数合理、store 的 `page` 确实变化。它捕获「页面抛错 / 读空快照崩溃 / 页面空白 /
异步数据到达后不重渲染」，但不证明布局与配色。

## 2. 无法在本环境验证

| 项目 | 原因 | 影响 |
| --- | --- | --- |
| 真实浏览器视觉验证 | 桌面版 Web GUI 需要 Host 进程内的 launch token 换取签名 cookie；外部浏览器无法获得，且验证规范禁止寻找该令牌 | 布局、配色、悬停/焦点态、深色↔浅色切换未经肉眼确认 |
| 插槽崩溃日志 | 只存在于桌面窗口 DevTools 控制台 | 首屏抛错已被渲染冒烟覆盖大部分情形 |
| 外网检索的真实返回 | 依赖当前 profile 的 web provider 与网络 | 只能验证「不可用时降级」分支与分组结构 |
| RSS 抓取的真实网络往返 | host-smoke 用注入的假 web 服务验证解析 / 去重 / 降级；真实站点（如被 Cloudflare 拦截的源）需实机确认 | 解析器按真实 hnrss 样例设计；逐源失败不影响其它源 |
| 云之家真实闭环 | 测试用假 spawner；另跑过一次**真实 CLI 冒烟**（whoami ok / @我 发现 10 条入库 / 企业搜索 12 条真实消息+文档） | 已实机验证；写入量随真实数据变化，见下 |
| 真实 git / docker 读数 | 沙箱内无 subprocess 服务 / 无 docker | 已验证降级分支；正常分支需在有该服务的 profile 里跑 |
| 系统目录选择器 | 依赖 `uiWorkspace.pickDirectory()` 与桌面窗口交互 | 已做 null 兜底与提示；实际弹窗未验证 |

## 3. 发布门槛对照（报告 §9）

| 验收项 | 通过标准 | 状态 |
| --- | --- | --- |
| UI 插件 | 不改核心代码即可启停 | ✅ 双插槽注册，`remove_bundle` 可卸载 |
| 任务 | 重启后不丢、同步重复不建重复任务 | ✅ 持久化往返测试；来源按指纹去重、雷达按 URL 去重 |
| 搜索 | 每条结果可见来源 | ✅ 六路分组，每条结果带来源类型与外链；不合并成无引用结论 |
| Agent | 运行日志可恢复、审批可追踪、取消可生效 | ⚠️ 执行记录可追、可标记完成/失败；审批与取消由 DSH 会话负责，本插件不接管 |
| 命令安全 | 未授权写入与生产指令被阻止 | ✅ 仅 argv allowlist 内的只读命令，无 shell 拼接，无写入类调用 |
| 故障兜底 | CLI 下线 / 网络断开时其它模块可用 | ✅ 每路独立状态；缺 git / docker / web 均降级为可读说明 |

## 4. 已知未实现（界面中不假装可用）

1. 云之家写操作（发消息/撤回/审批/删除）：**刻意不实现**。插件只挂 27 个只读命令的 allowlist，写操作留在会话里走逐次审批 + CLI 的 exit-10 确认闸门（§7.1 L3 分级）。
   已接入：@我 拉取、消息搜索、文档标题搜索（whoami 已验证）。未接入：游标增量同步、联系人/日历/考勤三路、知识文件正文检索。
2. 企业搜索 / 企业知识文件检索：搜索页的「企业（云之家）」一路诚实显示未接入与原因，不返回任何伪造结果。
3. PR / Review / CI 状态、进程 CPU/内存、服务探测：需要平台凭据或扩大本地探测面，未接入（研发协作已含 git 状态、docker ps、监听端口）。
4. AI 摘要与 GitHub Trending：插件内没有模型——抓取条目只保留原文摘录、四段摘要留空，归纳交给会话里的 Agent 并用 workbench_record_run 写回；GitHub Trending 无稳定 RSS，不猜测第三方地址。
5. SQLite 存储：刻意保留原子写入单文件 JSON（schema 版本与幂等约束已具备）。当前状态是单文档内存模型，多表 SQLite 不改变模型只增加复杂度；如需迁移，`version` 字段已预留。
6. 定时抓取：不自带调度器。替代闭环 = DSH Schedule 每日提醒（原生能力）→ Agent 调 `workbench_fetch_radar` → 抓取报告落库 → 首页陈旧标记。
7. L3 高风险操作（发消息、推代码、写数据库）——插件根本不具备这些能力。

## 5. 本轮界面修复（用户实测反馈）

| 反馈 | 修复 | 验证 |
| --- | --- | --- |
| 雷达卡「仅看关注主题」竖排文字压住按钮（致命） | 根因是 flex 收缩：`.wb-card-actions` 无 `flex:none`、`.wb-chip` 无 `white-space:nowrap`，长副标题把操作列挤成一字一行。两者已修，标题区改为显式 `flex: 1 1 auto` 承担换行 | CSS 级修复，需浏览器目验 |
| 空态不一致（雷达保留头部信息、空态偏下） | 空态下雷达隐藏副标题与筛选 Chip；上次抓取改为标题旁 Badge；待办空态同样隐藏副标题 | 渲染测试新增「空态场景」：空快照下断言空态文案出现、筛选 Chip 不出现 |
| 同屏三个「新建待办」黑色主按钮 | 保留全局工具栏一处；首页 PageHead 的移除；待办空态降级为次级（「新建第一条待办」） | 空态断言「新建第一条待办」 |
| 指标卡/连接栏观感 | 副标题字号 11.5→12px、行高固定；空态留白收紧（34px→26px） | 渲染测试节点数通过 |
| 英文残留 | 品牌区「DEV WORKBENCH」副标题移除；「关于」面板中文化 | — |
| 命名约定 | 目录与包名统一为 ASCII `dsh-dev-workbench`（技术标识，便于终端 / git / CI）；插件页显示名与全部界面文案统一为中文 | `install_bundle` `application: applied`；链接指向 `dsh-dev-workbench` |

## 6. 本轮补齐（用户要求 1–6 全部完成）

| # | 原缺口 | 现状 | 验证 |
| --- | --- | --- | --- |
| 1 | 雷达四段摘要「提示可补充但无入口」 | 首页雷达条目新增「编辑资讯」：标题/来源/日期/链接/主题 + 技术变化/应用场景/采用风险/推荐实践四段全部可编辑 | 渲染测试首页含编辑按钮；`saveRadarItem` 按 id 幂等更新 |
| 2 | 知识不能编辑、项目不能改名 | `updateKnowledge` 端点 + 知识页编辑弹窗；设置页项目行新增编辑（名称 + 仓库目录，改动后自动失效环境缓存） | host-smoke：知识编辑成功 + 不存在条目被拒绝；渲染测试设置页含编辑入口 |
| 3 | @我 无发送人、无原始定位 | 批量 `contact user get` 解析 openId→姓名（最多 6 个，失败回退短 ID）；来源新增 `sender` 与 `locator{groupId,msgId,groupName}`。IM 无文档化深链，**不伪造 URL**，只存定位 ID | host-smoke：来源 sender==='张三'、locator.msgId==='m1' |
| 4 | 企业搜索只有消息+文档 | 新增联系人 / 会议室 / 考勤三路，按查询意图触发（人名形状或找人意图 / 会议类 / 考勤类），**无命中不生成空分组**避免噪音 | host-smoke：三路各自命中 + 普通查询不触发 |
| 5 | 工具箱缺 YAML/CSV/Markdown/状态码 | 新增 4 个工具，共 14 个。YAML 仅常用子集（锚点/别名/块标量明确报错）；Markdown 全程 React 元素构造、不用 innerHTML；状态码内置 34 条 | 渲染测试逐个点开 4 个面板无异常 |
| 6 | 无 AI 任务提取 | 规则候选：行动词 + 时间线索 + 长度 + 指向性 → 可解释置信度与 reasons；任务中心「待确认」区采纳/忽略；采纳原子建任务并带来源证据，重复采纳幂等、重复提取不重复生成 | host-smoke：提取/采纳/幂等/忽略/再次提取不重复 |

## 7. 第三轮补齐（清空上一轮审计清单）

| 原缺口 | 现状 | 验证 |
| --- | --- | --- |
| 统一搜索缺「本地项目」 | 新增 files 路：在 Host 工作目录与项目 repoPath 内只读遍历，文件名 + 文本片段匹配；跳过 node_modules/.git/dist 等，遍历 4000/读取 300 上限、60s 索引缓存 | host-smoke：文件名命中 + 内容片段命中（带行号） |
| PR / Review / CI 状态 | 新增 `workbench/github` + 研发协作「PR 与 CI」面板；`gh pr list` / `gh run list` 只读，多段前缀白名单挡住 `pr merge` 等写操作 | host-smoke：解析 PR 与 CI 运行；渲染测试断言面板出现 |
| 日程与会议 | 新增日程搜索路（`calendar event list`，今天起 3 天，按标题过滤） | —— 本机当日无日程，接口实测返回空数组 |
| 进程 CPU / 内存 | 研发协作新增「进程 CPU/内存」表（`ps aux` Top 12，按 CPU 排序） | host-smoke：解析并按 CPU 排序 |
| 语义近似去重 | 雷达抓取新增标题三元组 Jaccard 相似度（≥0.82 视为同一事件） | host-smoke：标题相近、URL 不同的第二条不入库 |
| 看板不能拖拽 | 看板卡片可拖动，列容器接收 drop 改状态（拖拽时列高亮） | 渲染测试通过（拖拽为原生 DnD，需浏览器目验） |
| 首页缺快捷操作 | 新增「快捷操作」卡：新建待办 / 统一搜索 / 工具箱 / Agent 中心 / 拉取 @我 / 抓取资讯 + **番茄钟**（25 分钟）+ **复制今日简报**（Markdown） | 渲染测试断言「快捷操作」「专注」「复制今日简报」 |
| 工具箱缺 Shell/Docker 查询、SQL Explain | 新增「Shell / Docker 速查」（22 条，分类 + 搜索 + 复制）与「SQL 计划解读」（14 条关键字规则，不连库不执行） | 渲染测试逐个点开两个新面板 |

## 8. 复现命令

```bash
cd dsh-dev-workbench
node scripts/build.mjs
node --check index.js && node --check client.js
node tests/host-smoke.mjs
node tests/client-render.mjs
```

## 9. 第四轮：可靠性修复与 AI 自动化（对应 docs/TODO-AI-AUTOMATION.md）

| 待办 | 处理 | 证据 |
| --- | --- | --- |
| 01 工具异步 | 三个工具补 `await`，抽出统一写入原语，新增操作账本与 `idempotencyKey` | 真实执行工具 6 项断言（返回值/落库/幂等/失败如实报错） |
| 02 重载 ID | 恢复时 `normalizeX(raw, raw)`，知识条目纳入归一化 | 9 项重载关联断言 |
| 03 日期/否定 | 以消息时间为基准、匹配顺序修正、取消语义、多事项拆分、`extractor` 标记 | 9 项断言 |
| 04 聊天接入 | 工具收敛到业务原语；助手抽屉（上下文引用 + 复制简报 + 跳转会话）；`workbench_search` / `workbench_update_radar` | 渲染断言（抽屉标题、按钮、加入上下文） |
| 05 自动待办 | 取消跳过、消息时间、多事项、msgId 去重、幂等账本 | 见 03 断言 |
| 06 AI 资讯 | 无 RSS 时按主题联网发现；摘要写回工具；逐路失败如实记录 | 发现路径断言 + 摘要写回断言 |
| 08 页面同步 | `revision` 递增 + 轻量端点 + 12s 轮询（编辑期间跳过） | 2 项修订号断言 |
| 09 Agent 回写 | 任务上下文入会话，`workbench_record_run` 回写并挂 `runIds` | 工具执行断言 |
| 10 引用问答 | `workbench_search` 返回分组 + 每路状态，模型据此引用作答 | 工具注册与描述 |
| 11 备份恢复 | 损坏文件留存、每日自动备份、手动备份/恢复 UI | 3 项断言 |
| 07 后台调度 | **未做**：`schedule` 只做会话提醒、`jobs` 是抽象契约，需宿主适配层 | 文档说明 |

## 10. 生效条件

- 只改 `src/client/**`：重新构建后刷新 GUI 窗口即可。
- 改 `src/host/**`（新增 Remote 端点或工具）：必须**重启 DSH**；重新安装 bundle 不会替换已加载的
  JavaScript 模块代际。
