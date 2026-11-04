# 后台任务独立模型配置

入口：连接与设置 → 后台任务模型。消息识别和资讯摘要各自选择模型，也可选择“沿用会话模型（新会话使用宿主默认）”。目录来自当前 Harness 已配置的服务商，不额外保存凭据。

## 生效与历史

保存只写工作台 settings.backgroundModels，不启动任务、不创建会话或调用模型。下一轮 submitPrompt 前捕获配置；本轮所有 Agent 步骤固定使用该配置，运行中修改设置在下一轮生效。识别覆盖所有相应用途/账号的后台会话；摘要使用自己的历史后台会话。

会话日志、批处理协议、seen 游标、队列完成状态和资讯已有摘要保持原值。仅处理原有筛选器选中的未完成项。遇到跨模型推理历史不兼容时沿用原有有限兼容恢复机制，保留旧日志，不伪造 reasoning_content，不重放已完成任务。

模型配置变化只解除对应功能的旧模型失败暂停。旧轮次在保存后才返回的失败携带其原配置标识，不重新阻断新模型。模型配置临时失效时保留 pending 和原 attempts，不消耗业务重试次数。

## 不影响宿主默认模型

不使用 SessionController.selectModel，也不调用 agentDefaultModel.saveSelection，不改宿主安装文件或默认模型配置。通过公开 resolveAgent 获取准确的后台 Agent，在其会话作用域注册 system-prompt/assemble、agent/request 和 agent/pre-step 钩子；提示词变量与请求路由保持一致，清除旧模型的 reasoning effort，切换通知指向实际使用的新模型。

钩子仅绑定待提交任务的后台 Agent，普通聊天和其他会话不受影响；取消覆盖或卸载插件时撤回。配置 ID、名称来自宿主模型目录，保存前校验路由；非法字段、不可用路由及绕过 saveSettings 的写入被拒绝。模型目录响应不返回默认选择、连接字段、凭据或供应商原始报错。

## 实现位置

- src/shared/background-models.ts：用途和持久化路由格式。
- src/host/assistant/background-models.ts：目录、路由校验与会话钩子。
- src/host/application/background-model-service.ts：受控配置入口。
- src/host/assistant/sessions.ts：每轮提交前应用。
- src/host/analysis/message-analysis.ts：迟到故障隔离。
- src/client/features/settings/BackgroundModels.tsx：独立选择、刷新、失效提示、保存失败保护。

## 验证边界

- tests/background-models.mjs：16 个隔离业务场景，覆盖历史与进度、独立配置、下一轮、旧失败迟到、重复执行保护、业务重试额度、恢复和钩子清理。
- plugin-tests/tests/background-models.test.jsx：5 个真实构建客户端交互测试，覆盖独立保存、失败、单飞、不可用服务商与取消覆盖。
- host-integration/rc5/test-background-model-route.mjs：使用本机已安装 Harness 的真实 Context/SystemPrompt/Agent/Session 模块，验证真实 waterfall 顺序、识别/摘要隔离、原生选择不变、普通会话默认不变、正确切换通知及卸载清理。仅合成 Session，无网络、真实账号或模型推理请求。
- 12 个后台模型深浅主题/窄屏场景通过；28 个设置卡片场景通过；226 个整体布局场景通过。
- pnpm check 通过；完整 pnpm test 通过，包含48个界面文件、716项界面测试，后端各回归也全部通过。
- 实际日常入口已重载：模型卡片显示，识别/摘要两个选择项可用，真实宿主模型列表展开并关闭成功。保持原来的沿用选择，没有保存具体模型或启动真实推理请求。本机忽略目录记录：`.local-host/rc5-daily-entry/background-models-live-20261104.json`。

本机安装包核对背景见 SESSION-MODEL-CAPABILITY-2026-11-04.md。此功能不需要修改、重新签名或替换 Harness 安装包。
