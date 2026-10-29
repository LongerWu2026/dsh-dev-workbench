# 内嵌 DeepSeek Harness 原生聊天：可行方案

> 阶段记录说明：本文件保留原生聊天接入的阶段方案与验证过程。当前助手使用 Session 和增量轮询，现状以项目说明为准。 [当前项目架构与功能说明](PROJECT-ARCHITECTURE-AND-FEATURES.md)。

> 目标：在工作台插件里呈现「原生会话内容」——能看历史、能继续聊、体验接近原生。
> 本文基于 **2026-10-27 实测**（DSH 0.2.1-rc.3 桌面版 / 客户端插槽拓扑 / 客户端 RPC 契约），
> 不用「理论上可以」糊过去：每条路径都标了**验证方式**与**做不到时怎么办**。

---

## 0. 需求原文与结论先行

`docs/TODO-AI-AUTOMATION.md` 04 条：

> 用户指 DeepSeek Harness 内工作台旁边的聊天入口。推荐插件内可折叠的「工作台助手」侧栏，
> **复用 DSH 原生 Session、模型与工具**；本轮不以 Codex/MCP 接入为目标。
> 先验证当前安装版本的原生会话嵌入和控制能力；**若嵌入暂不可行，先做带上下文的原生会话跳转与回写**。

**结论**：

| 问题 | 答案 |
|---|---|
| 能不能把原生会话**组件**（像素级）塞进插件面板？ | **不能**。DSH 未导出会话组件，也没有可声明的「会话面板」插槽 |
| 能不能复用原生 **Session / 模型 / 工具**？ | **能**，已实现（`sessions.create` + `sessionController.prompt`） |
| 能不能拿到原生 **会话内容**（消息、工具调用、状态）？ | **能**，两条路：Host 读 `session.snapshotEvents()`；或会话作用域插槽的 `useChat/useConversation/useTrajectory` |
| 能不能做**流式/渐进**输出？ | **能**，两条：`connection.rpc.open` 流式通道（需验证 stream 描述符）或 `fromSeq` 增量轮询（已可用，推荐先做） |

---

## 1. 平台能力盘点（实测证据）

### 1.1 没有可复用的会话组件

```
$ strings app.asar | grep -c "exports.ConversationPanel"   → 0
$ strings app.asar | grep -c "exports.ConversationView"    → 0
$ strings app.asar | grep -c "exports.SessionView"         → 0
```

会话 UI 由壳层用插槽现场组装（`conversation.chat.flow` → `conversation.chat.node` → `tool.call.toolview`），
没有任何「一个组件 = 完整会话」的导出。已装插件里最接近的 `dsh-better-sidebar`
也只用了 `conversation.session.header*` 插槽与 `useSessionRoot/useSessionPhase`，**不渲染消息**。

### 1.2 会话数据只在「会话作用域插槽」里下发

`Slots.listSubTree { root: 'conversation.chat.node' }` 的 `standardProps` 实测包含：

```
useChat, useConversation, useInput, inputActions, useSession, sessionId,
useProjection, useAccess, useTrajectory, useSessionStatus, useSessionRetainInfo, ...
```

而根作用域的 `main` 插槽（我们的工作台面板所在处）只有：

```
useRemoteAccess, useResource, useWorkspaces, usePanelInfo, useSessions,
useSessionStatus, useSessionRetainInfo, useSessionAccess, useWorkspaceAccess
```

**含义**：`useConversation/useChat/useTrajectory` 这类「原生会话渲染数据」只在
`conversation.*`（session scope）插槽的组件里可用；根作用域面板拿不到
（这些 hook 绑定在 Chat view 提供的 React context 上）。

### 1.3 客户端 RPC 支持流式

```
interface ClientConnectionRpc {
  call(channel, endpoint, payload, signal?): Promise<ConnectionRpcResult<unknown>>
  readonly open?: (channel, endpoint, payload, signal, uplink?) => AsyncIterable<unknown>
}
```

`connection.rpc.open` 存在 ⇒ 客户端**可以消费流式 Remote**。
注意：我们的手写 `src-json` 描述符目前是 unary（`result: {mode:'src-json'}`），
要开流式需要验证 stream 描述符，见 §3.2。

### 1.3.1 踩坑记录：不要用 `sessions.create()` 建助手会话

首版用 `ctx.sessions.create()` 建会话，聊天报：

```
提示提交失败：resume failed for session "session-1":
SessionPersistenceNotFoundError: session "session-1" not found
```

原因：`sessions.create()` 只造内存对象，**不写会话日志**；`sessionController.prompt`
内部会对目标会话 `resume`，找不到持久化记录就报错。而且它给的默认 id 是
`session-1` 这类计数 id，DSH 重启后注册表清空 → 再次拿到同名 id → 循环报错。

正确做法：`sessionController.create({cwd})`，它内部走
`createAgent → ctx.agents.create`（`session-${randomUUID()}`），会话是可恢复的。

自愈策略（`src/host/46-assistant.js`）：
1. 记录的 id 形如 `session-\d+` → 视为旧版脏 id，直接丢弃重建；
2. `sessions.get(id)` 取不到 → 重建；
3. `prompt` 仍报 `resume failed` / `SessionPersistenceNotFound` → 重建会话并**重试一次**，
   同时把新 id 写回设置（`submitPrompt`）。

### 1.4 Host 侧会话接口（已验证可用）

```
sessions.create(id?, options?)         → Session
sessions.get(id) / list()              → Session | Session[]
sessionController.prompt({requestId, sessionId, mode:'queue'|'steer',
                          content:[{type:'text',text}], clientTimeZone}) → {accepted:true}
session.snapshotEvents(fromSeq?, toSeqExclusive?)   → SessionEvent[]
session.seq / session.header / session.deriveMessages()
```

事件类型（实测）：`user/message`、`assistant/message`、`assistant/attempt`、
`tool/call`、`tool/result`、`turn/start`、`turn/end`。

---

## 2. 方案 A：会话级内嵌（已实现，推荐作为基座）

**思路**：不复用组件，复用**数据与通道**。侧栏自己渲染，但读的是同一份原生会话记录，
发的是同一套 `sessionController.prompt`，所以模型、工具、记忆、历史全一致。

已落地：

| 能力 | 端点 / API | 状态 |
|---|---|---|
| 会话列表（最近会话、助手会话标记、首条消息作标题） | `workbench/assistantSessions` → `sessions.list()` | ✅ |
| 读取会话记录（user/assistant + tool/call 参数摘要） | `workbench/assistantTranscript` → `snapshotEvents()` | ✅ |
| 在指定会话里继续对话 | `workbench/assistantAsk{sessionId}` → `sessionController.prompt` | ✅ |
| 新会话 / 在主面板打开该会话 | `assistantReset` / `uiWorkspace.openSession(sessionId)` | ✅ |
| 上下文引用（可见可移除）随消息提交 | 客户端 chip → 拼进 prompt | ✅ |

**增强项 A1（已实现）**：渐进渲染
- 新增 `workbench/assistantSend`：只提交 prompt 并立即返回 `{sessionId, fromSeq}`（已实现）；
- `assistantDelta({sessionId, fromSeq})` 返回 `{entries, nextSeq, turnActive}`（增量，已实现）；
- 侧栏在 `turnActive` 为真时每 400ms 增量拉取，逐条追加，`turnActive` 转假即停。
- 收益：用户能在模型思考过程中先看到「工具调用 → 工具结果 → 回复分段」，
  体感接近流式，且**不依赖未验证的 stream 描述符**。

**增强项 A2**：工具结果与状态行
- transcript 聚合 `tool/result` 的输出摘要（截断 160 字）、工具耗时；
- 渲染 `turn-error` / `turn-max-tokens` 为状态行（原生会话里这些是独立节点）。

**增强项 A3**：排队 vs 打断
- `sessionController.prompt` 的 `mode` 支持 `'queue' | 'steer'`；
- 侧栏加「打断当前轮」开关，映射到 `mode:'steer'`。

**风险与边界**
- 不是逐 token 流式（A1 是「逐节点」，不是「逐字」）。
- 会话记录由 Host 读取，超大历史需分页（当前 40 条封顶）。
- 侧栏 UI 与原生观感接近但非同一组件，主题适配需自己维护。

---

## 3. 方案 B：真正的流式（需先验证 stream 描述符）

### 3.1 目标
助手回复逐字出现、工具调用实时插入，和原生会话一致。

### 3.2 验证步骤（30 分钟，先验证再投入）

1. 在 `40-remote.js` 的某个方法描述符上尝试 `mode: 'stream'`：
   ```js
   { method: 'assistantStream', params: ['request'],
     result: { mode: 'stream', codec: { mode: 'src-json' } } }
   ```
   观察 Host 激活时 `typert.register` 是否接受该描述符（不接受会在插件激活处报错）。
2. 若接受，Host 侧让方法返回 `AsyncIterable`（如 `session.snapshotEvents` 的增量流）；
3. 客户端用 `connection.rpc.open('/api', 'workbench/assistantStream', {args}, signal)`
   拿到 `AsyncIterable`，逐块追加到侧栏。
4. 失败判据：描述符被拒，或 `open` 返回的迭代立即抛错 → **回退方案 A1**（不阻塞主线）。

### 3.3 风险
- 手写 `src-json` 描述符的 stream 契约未在官方文档中给出（`typert-protocol` 只保证
  「stream Remote 必须走 stream carrier」，未说明手动路径如何声明 codec）。
- 若 stream 不可用，A1 的 400ms 增量在多数场景已够用。

---

## 4. 方案 C：把工作台内容注入原生会话（反向内嵌，**已实现**）

`conversation.chat.node` 是 keyed 插槽，`keyDomain` 里已有 `user/assistant-step/tool-call/turn-tail` 等。
插件可以注册**自己的 key**，在原生会话里渲染工作台专属卡片（例如「这条消息已建成待办 #123」）。

```js
// client half
ctx.slots.inject('conversation.chat.node', () => ctx.slots.register(
  { name: 'conversation.chat.node', key: 'workbench-task-card' },
  function WorkbenchTaskCard(props) {
    // props 里有 useChat / useConversation / useSession / useTrajectory 等原生 hook
    // 注意：这是 session scope，能拿到当前会话的原生数据
    return h('div', { className: 'wb-card' }, '工作台卡片')
  }
))
```
但注意：**节点由 owner 按 `ChatNodeKind` 派发**，插件注册的新 key 只有在 owner 派发同名 kind 时才渲染；
自定义 kind 需要 Host 侧写入对应事件类型。因此这条更适合「替换/增强既有节点」
（例如给 `tool-call` 增加工作台操作按钮），不适合凭空插入新行。

**更适合的用法**：在 `conversation.chat.assistant-actions`（list 插槽）里给每条助手消息加动作
——「存为知识」「生成待办」「写回资讯摘要」，把工作台能力挂到原生聊天上。这是**低风险、高收益**的
补充方案，可与 A 并行。

---

## 5. 方案 D：像素级原生（不可行，需上游支持）

要「完全就是原生会话组件」，缺两个东西之一：

1. **导出组件**：`@deepseek-ai/dsh-client-ui-conversation` 暴露
   `ConversationPanel({ sessionId, variant: 'embedded' })`；
2. **root 级会话 hook**：让任意 slot 的 `standardProps` 都能拿到
   `useChat/useConversation/useInput/useInputActions`（或以 Provider 形式可包裹子树）。

可提给上游的具体请求（建议直接提 issue）：

> 希望提供 `ConversationEmbed` 组件或 `ConversationProvider({sessionId, children})`，
> 使插件能在自有面板内渲染原生会话（含输入框、工具卡、流式），并保证与主面板共享同一会话状态与权限。

在拿到之前，任何「把原生会话塞进插件」的实现都只能靠读别的插件 DOM/组件源码——不可维护，
本方案明确不做。

---

## 6. 推荐路线与验收

```
第 1 步（已完成）  方案 A 基座：会话列表 + 记录 + 续聊 + 跳转
第 2 步（已完成）  A1 渐进渲染：assistantSend + assistantDelta(400ms) + turnActive 停机
第 3 步（已完成）  A2/A3 工具行/结果行/错误行渲染 + 「排队 / 打断」开关（mode: queue|steer）
第 4 步（已完成）  C 反向内嵌：助手消息动作（生成待办/存为知识/记执行记录）+ workbench_* 工具卡片
第 5 步（可选 2h） B 流式验证；失败即回退 A1（已可回退）
第 6 步（并行）    D 向上游提需求，拿到后再替换渲染层
```

**验收标准（可自动验证的部分）**

| 项 | 验证方式 |
|---|---|
| 会话列表与原生一致 | `assistantSessions` 与 GUI 会话列表条数/标题一致（人工对照一次） |
| 记录完整性 | 原生会话里发的消息，侧栏能读到；工具调用名称与参数可见 |
| 续聊同会话 | 侧栏发一条，原生面板打开同一会话能看到；反过来亦然 |
| 渐进渲染 | 长任务期间侧栏在 turn 结束前已出现分段内容 |
| 失败可知 | 缺服务/超时时侧栏显示具体原因，不静默 |

**当前测试证据**：`host-smoke` 156 项（含助手 10 项：回复抽取、工具调用、会话复用、历史、
重置、缺服务降级、会话列表、助手标记、记录含工具调用、不存在会话）、
`client-render` 驱动会话列表 + 记录渲染 + 真实发送。

---

## 7. 已实现的接口清单（本方案基座）

| 端点 | 作用 |
|---|---|
| `workbench/assistantSessions` | 最近原生会话列表（标题、最近活动、是否助手会话） |
| `workbench/assistantTranscript` | 指定会话的记录（user/assistant + tool/call 摘要） |
| `workbench/assistantAsk` | 向指定会话提交提示并等待本轮结束（一次性返回） |
| `workbench/assistantSend` | 只提交提示，立即返回 `{sessionId, fromSeq}`（配合 delta 渐进渲染） |
| `workbench/assistantDelta` | `fromSeq` 之后的增量条目 + `nextSeq` + `turnActive` |
| `workbench/assistantMessage` | 按持久化 messageId 取助手回复正文（原生聊天动作使用） |
| `workbench/assistantHistory` | 助手会话的简版历史 |
| `workbench/assistantReset` | 新开一个助手会话 |

Host 侧实现：`src/host/46-assistant.js`；客户端：`src/client/10-shell.js` 的 `AssistantDrawer`。
