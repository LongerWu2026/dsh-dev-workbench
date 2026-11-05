# lulu 头像接入

- 使用 `src/client/assets/avatars/lulu.svg`，原稿 1,380 字节，通过构建内嵌为 data URL；无需联网或额外静态资源服务。
- 共享 `AssistantAvatar` 组件用于 AI 助手回复、多 AI 对话的各厂商回答和助手设置预览，沿用现有头像尺寸、用户头像及消息身份区分。
- 按用户明确要求仅保留 SVG；PNG 已删除，父目录的 `outputs` 在确认只剩该 PNG 后清空并删除。
- `pnpm build`、`pnpm check` 通过；156 项助手/多 AI 对话测试及 24 组离线 SVG 解码、设置预览、厂商切换、明暗主题和 360/640/1280px 布局验证通过。Markdown 安全测试限定检查回答正文，可信本地头像不计为模型返回的 HTML 图片。
- 原版 Harness 已截图核对：实际 AI 回答左侧显示 lulu，头像大小和消息排版正常，未新建模型会话或发送消息。

日志：`/tmp/workbench-lulu-build.log`、`/tmp/workbench-lulu-check.log`、`/tmp/workbench-lulu-tests.log`、`/tmp/workbench-lulu-layout.log`。布局报告及截图：`/tmp/workbench-lulu-avatar/`。
