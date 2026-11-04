# Harness 会话停止能力核查（2026-11-04）

结论：本机已安装的 Harness 提供停止当前原生会话轮次的公开接口。AI 助手自绘聊天区可以通过插件 Host 调用该接口，不必模拟点击原生停止按钮。现已接入 AI 助手停止按钮、关联会话取消及连续作业暂停。源码实现和合成验证见 [停止功能实施与验证](ASSISTANT-STOP-2026-11-04.md)；没有停止用户正在使用的真实会话。

## 已核实接口

| 入口 | 当前包内观察 | 用途 |
| --- | --- | --- |
| Host | `sessionController.cancel({sessionId})` | 停止指定、已挂载普通 Agent 的当前轮次 |
| Remote | `session/cancel`，service=`sessionController` | 严格参数只有 `sessionId`；返回 `{accepted:true}` |
| 原生 UI 会话服务 | 作用域内的 `conversation.cancel()` | 调用当前 SessionFace 的 cancel，向界面发布失败原因 |
| 原生输入框 | InputZone 的 `stop` 回调 | 与运行状态联动显示停止按钮；调用 scopedConversation.cancel |

本机 API 包版本为 `@deepseek-ai/dsh-api-session-controller@0.2.1-rc.5`。

包内位置：

- `/Applications/DeepSeek Harness.app/Contents/Resources/workbench-app/dsh/node_modules/@deepseek-ai/dsh-api-session-controller/lib/index.js:1061`：校验 `ctx.agents.get(sessionId)`、拒绝不受普通 API 控制的子智能体，再执行 `agent.cancel({kind:'user'},{keepInbox:true})`。
- 同文件 `:3253`：公开的 SessionController.cancel 委托 commands.cancel。
- 同包 `lib/typert.host.js:1458`：`session/cancel` Remote 契约与严格 SessionCancelRequest。
- `/Applications/DeepSeek Harness.app/Contents/Resources/workbench-app/dsh/node_modules/@deepseek-ai/dsh-client-ui-conversation/lib/client.js:4940`：公开会话服务 cancel。
- 同文件 `:19146`、`:19287`：运行态停止按钮判断、`input.stop` 标题、方形停止图标。
- 同文件 `:19808`、`:20220`：stop(sessionId) 与 InputZone.stop 回调。

## 明确边界

1. `{accepted:true}` 代表已请求取消，不能立刻当作模型、工具及整个业务流程都已结束。界面需等待原生终止状态/事件后显示已停止。
2. `keepInbox:true` 保留待处理消息；停止当前轮次并不清空排队消息，也不删除会话历史。
3. 未挂载的 Agent 会返回 `session/not-found`。仅为显示停止按钮不应恢复、创建替代会话或启动任务；只能停止当前绑定且确实运行的原生会话。
4. 子智能体具有独立控制边界。原生客户端走 `subagents.interruptByParent`；不能将所有地址都强制套用普通 session.cancel。
5. 已完成的外部副作用不会因取消自动回滚。工作台业务状态也不能直接标记为完成。
6. 工作台研发流程、连续识别和办公作业还有自己的调度状态。仅停止 Agent 不能保证不进入下一步；需先标记/暂停所属作业，再停止对应在途原生轮次，保留已完成步骤。

## AI 助手接入方案

- 右下角发送区增加“■ 停止”；当前会话运行时可用，不依赖本页是否刚点击过发送。
- 从 Harness 会话状态/事件读取运行态，关联既有 Harness 会话同样显示；切换会话不停止其他会话。
- 停止请求绑定 conversationId、原生 sessionId 和当前轮次标识；Host 再次核实归属与当前轮次，避免切换及迟到请求误停另一轮。
- 状态按“运行中 → 正在停止 → 已停止/停止失败”变化；按钮防重复点击。停止失败仍保留运行状态，并展示真实原因。
- 普通聊天走原生 cancel；属于工作台连续流程时同步暂停业务调度。附件尚在准备阶段则取消本地准备并阻止后续提交，已入队的情况按实际原生回执处理。
- 保留文字、已生成内容、附件、历史和已完成进度；停止后可在原会话继续。

## REA 证据与范围

API 包分析 parent：`ev_cba47ff36c3399db369c0727abfd05ded4abe53eaa6141a97a514ee03425d4ec`；summary：`ev_4bfb6b07daebef594be0faa25339f8d137ddadbc1e66ab7507f0e103997c1d91`。

API 分析选择 `package.json`、`lib/index.js`、`lib/typert.host.js`；另 38 个清单文件不在此次源码分析范围。包清单 digest 为 `e59419a322890f4052bf4fb82a9c2a5f4fdef09b798dc8326b7267e3d03ee10c`。

原生 UI 包分析 parent：`ev_66c48ec601add2372adeb1668f9e08b985a72a8636ecb17f6031ca0c276e56ea`；summary：`ev_61d7cdf1ff6a0644cc5e5b01804eff0d3b9c9a6ece6b7c58f3c244435e904223`。

UI 分析选择 `package.json`、`lib/client.js`；另 3 个文件不在分析范围。包清单 digest 为 `512b19ceec1f0bdc05202bc70756b01879ab08a423f8c0e966fd8ba9f75756f2`。

精确已读文件 SHA-256：

- API `lib/index.js`：`a9801acb577b03053c5d5a3191ff555c5f1d791d0acddec113bea4511e33b386`
- API `lib/typert.host.js`：`0c12316ed398710bcd87520f2332ebb647f0ab5f71cdfe04551c0592b48b2c3c`
- UI `lib/client.js`：`606ae0ba66ab52f5dd3dda5fa6010a21704329e43e10c28098685e7048d4da7c`

上文的 REA 证据属于包内静态观察。补充的 `host-integration/rc5/test-assistant-stop.mjs` 在临时副本中仅增加内部类的导出，使用未改动的方法体与真实 Session 类验证公开 cancel 委托、保留 inbox/历史、缺失 Agent/子会话拒绝及精确移除排队消息；这仍不等于真实桌面账号验收。未修改宿主安装包、用户会话、凭据或模型配置。
