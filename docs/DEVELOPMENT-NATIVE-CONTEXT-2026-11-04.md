# 研发阶段消息与原生上下文分离

问题：AI 助手发送链路已使用原生上下文，研发自动流程仍把阶段约束、角色技能、Linky 定位、需求正文以及审查证据拼在普通用户消息里。

修改：研发 analysis / implementation / review 阶段复用现有 native-context 入轮机制。用户消息分别为“开始需求分析：编号 · 标题”“继续开发：编号 · 标题”“独立审查：编号 · 标题”。完整内部提示与兼容恢复资料持久化在独立的“研发上下文”快照中，按 sessionId 和 requestId 精确匹配；模型仍接收完整内容。空的可选块不再生成多余空行。

分析和开发继续原开发会话，审查继续既有独立审查流程。缺少原生钩子时在 prompt 前暂停，不降级成普通长消息。研发快照单独设置有界容量以容纳现有角色技能、差异与测试证据，超限明确拒绝，不截断；普通助手原容量不变。此前已写入的历史消息没有改写，也未启动真实工作项的开发、测试或回写。

验证：

- tests/development.mjs：72 个集成场景，使用临时真实 Git 工程、临时进程与确定性模型夹具；分别检查可见 prompt 和原生入轮后模型消息，覆盖三个阶段、原会话复用、审查证据、旧历史兼容恢复、不重复开发、缺失钩子停止。
- tests/assistant-native-context.mjs：16 个检查，覆盖请求/会话隔离、去重、重载恢复、长研发快照及普通容量边界。
- host-integration/rc5/test-native-context.mjs：使用本机已安装 Harness 公共 SDK 与临时 Session，验证完整研发快照进入 deriveMessages、简短用户消息逐字保留、默认折叠渲染契约和已提交快照去重。网络请求 0，真实会话修改 0；这属于 SDK / 渲染契约验证，不是真实工作项运行。
- pnpm build、pnpm check、git diff --check 已通过。完整 `pnpm test` 退出码 0：全部后端检查、50 个界面文件、783 项界面测试通过。

日志：/tmp/development-context-test.log、/tmp/development-native-context.log、/tmp/development-context-sdk.log、/tmp/development-context-check.log、/tmp/development-context-full-test.log。

客户端通过“插件 → 智能工作台 → 启用组件”关闭再开启加载本地链接工程，已核对组件恢复运行中，并返回原研发会话。未重新运行真实需求的分析、开发、测试或审查。
