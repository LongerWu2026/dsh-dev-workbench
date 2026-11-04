# Harness 历史会话切换模型能力核对

核对日期：2026-11-04（北京时间）。本次只读分析，不切换真实会话模型、不发起模型调用、不修改宿主默认设置。

## 已确认接口

本机应用：`/Applications/DeepSeek Harness.app`，Info.plist 版本 `0.2.1-rc.5`。原生入口引用 `Contents/Resources/workbench-app/workbench-bootstrap.cjs`，由其中的 dsh 目录承载宿主依赖。

安装包中的 `dsh-api-session-controller/lib/index.js`：
- 793–821 行：`selectModel` 校验 provider/model/reasoningEffort，调用 `selectForNextRequest`；随后异步调用 `agentDefaultModel.saveSelection`，因此有更新宿主默认模型的副作用。
- 3098–3100 行：SessionController.selectModel 对外入口。
- 3121–3123 行：modelCatalog 对外入口。
- `lib/typert.host.js` 1171–1184 行：sessionId/provider/model/reasoningEffort 请求与 selected 响应契约；注册路由包括 `session/selectModel`、`session/modelCatalog`。

对应源码：`.local-host/rc5-source/packages/api/session-controller/src/types.ts` 100–120、307–315 行；`src/commands.ts` 157–191 行；`src/agent.ts` 的 selectForNextRequest 追加 model/selection 事件，不替换既有历史。

安装包中的 `dsh-client-ui-model-selection/lib/client.js` 1903 行起注册 `conversation.input.model`；会话模型目录按 sessionId 获取。对应源码还提供 `conversation.input.model.label`，该子插槽只定制文字，不承担模型切换。工作台自己的聊天界面需绑定真实会话作用域或通过自己的受控界面调用会话接口，不能仅改标签。

## 当前插件与建议

`src/host/assistant/sessions.ts` 的 ensureBackgroundSession 按用途和账号复用持久后台会话，配置中心尚未提供消息识别/资讯摘要各自的模型选择。仅修改宿主新会话默认模型，不能据此声称旧后台会话也已经换模型。

建议配置中心按用途保存选择；下一轮开始前对实际后台 sessionId 应用配置，助手标题栏显示实际模型。正在执行的轮次不强行中断。只处理未完成队列，不重新执行已完成条目。

若希望各功能独立配置且不改变宿主默认模型，必须处理原生 selectModel 的默认保存副作用；当前请求契约没有 saveDefault=false 参数，不能凭空传入此字段。本文记录该接口的静态能力；后台任务独立模型现已通过公开 Agent 会话钩子实现，未使用 selectModel，见[后台任务模型](BACKGROUND-MODELS-2026-11-04.md)。

跨模型历史可能因 reasoning_content、工具消息或上下文格式不兼容而继续失败。优先保留原会话切换；遇到兼容问题保留原日志，在兼容会话中带入必要上下文和任务进度接续，避免重复执行已完成步骤。

## REA 静态证据

技能：`reverse-engineer-anything`（本地分析技能，不随插件分发）。

分析目标为已安装应用内的 `dsh-api-session-controller` 目录；只选 package.json、lib/index.js、lib/typert.host.js，不执行目标。

- 应用包目录身份 SHA-256：`e59419a322890f4052bf4fb82a9c2a5f4fdef09b798dc8326b7267e3d03ee10c`。
- 原分析 Evidence：`ev_e9646ce07126cb32bcc98141609f865279b09101fd64124f4f50ba27e9c80e8c`。
- 摘要 Evidence：`ev_4080fd698373fe4379022555d070c395fa48f9451404d3975b03dfeff4458613`。
- 模块页 Evidence：`ev_7ea8662520c458065d7afa2710a65a557c1ed5aa8dca2ce873efcc56526e130a`。

限制：两个已选 JavaScript 文件成功静态解析；38 个目录清单文件未选作源码分析，图关系覆盖为 partial。接口行为与插槽位置另经安装包精确文本及对应源码交叉核对。此次没有对真实账号进行模型切换、失败模型恢复或跨重启验收，不宣称这些运行场景已经通过。
