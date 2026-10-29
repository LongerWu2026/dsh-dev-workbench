# 源码模块导航

只修改这里的源码；根目录 `index.js` 和 `client.js` 是生成产物。文件使用职责名称，不使用编号控制顺序。

| 需求 | 修改位置 |
| --- | --- |
| 页面和界面组件 | `client/features/<业务>/` |
| 跨页面控件 | `client/components/`；基础控件在 `primitives.ts` |
| 布局、导航、命令面板 | `client/shell/` |
| 宿主桥、状态、主题、格式化 | `client/core/` |
| 业务写入与数据标准化 | `host/domain/` |
| 待办、回复、资讯、知识等业务用例 | `host/application/*-service.ts` |
| 注册组合入口 | `host/application/workbench-service.ts`；此处只组合服务 |
| 消息理解、关联与批次调度 | `host/analysis/` |
| 原生会话、后台历史、用量 | `host/assistant/` |
| 网页 AI 对比及官网容器 | `client/features/web-ai/`；固定页面操作和厂商契约在 `shared/web-ai*.ts` |
| 网页对比持久化及备用专用浏览器 | `host/application/web-ai-service.ts`、`host/web-ai/` |
| 项目启动、IDE/终端联动与日志 | `client/features/collaboration/ProjectLauncher.tsx`、`host/integrations/project-runtime.ts` |
| HTTP/MCP 调试 | `client/features/toolbox/tools/NetworkDebugger.tsx`、`host/integrations/debug-client.ts`；共用 RPC 在 `host/application/developer-service.ts` |
| 云之家重点收件箱、未读/@筛选和日历 | `shared/message-intake.ts`；`host/integrations/message-intake.ts`、`calendar-sync.ts`；`client/features/inbox/FocusedInbox.tsx` |
| 云之家及外部适配 | `host/integrations/` |
| 存储、迁移、变更历史 | `host/storage/` |
| 提醒、草稿、评测等办公组合流程 | `host/workflows/` |
| 模型工具和页面 Remote 接口 | `host/api/` |
| 两端可共用的纯契约和规则 | `shared/` |

## 添加一个功能

1. 在相应业务服务实现用例；业务修改经 `mutateWorkbenchState` 原子提交。模型和网络等待放在提交锁外。
2. 页面需要调用时，在 `host/api/remote.ts` 登记方法；在对应 feature 创建 TSX，调用 `WB.rpc` 或现有 action。
3. 需要聊天可调用时，在 Agent 工具定义里复用同一用例，不复制另一套写入逻辑。
4. 只有全新业务域才新增服务文件，并在组合入口加入。子服务不要反向导入 `workbench-service.ts`；宿主上下文从 `service-context.ts` 读取。
5. 新增必要的行为回归，然后执行下方检查。不要直接修改生成的 JS。

## 添加一个离线工具

在 `client/features/toolbox/tools/` 新建具名模块，导出接收 `{ value, patch }` 的工具面板；在 `catalog.ts` 添加目录和初始状态，在 `toolbox.ts` 的面板表注册。复用 `shared-controls.ts`；工具模块之间按需显式导入，不从工具入口反向导入。离线工具不得调用网络或 Host。HTTP/MCP 调试工具必须标记 `network: true`，通过专用 Remote 调用 Host，并明确展示目标、发送动作与停止入口。

## 模块边界

- Client 不能直接导入 Host；通过 Remote 调用。
- shared 不能导入任一运行时层或 Node/宿主包。
- 基础控件仅依赖主题和 React，不依赖业务页注册。
- 资讯展示组件位于资讯模块，其他页面直接导入组件，不导入首页来获得组件。
- 兼容导出用于保持既有测试和调用；新增代码优先直接导入职责模块。

```bash
pnpm build
pnpm check       # 类型、架构边界/循环引用、产物一致性及语法
pnpm test        # 包含隔离的归档与生命周期测试
pnpm test:layout # 已安装Chrome时：隔离浏览器检查窄屏、缩放、控件裁切
pnpm test:suspend # macOS/Linux可选：独立Host进程实际挂起95秒并恢复
pnpm test:web-ai-browser # 可选：临时Chrome资料目录重启验证，不使用真实账号
```

`pnpm check:architecture` 会检查数字文件名、循环依赖、Client→Host 和 shared→运行时越层依赖。

Host 更新需重启 Harness；Client 更新会热重载。实机、合成测试和长期观察的证据要分开记录。

持续运行与界面适配的本轮边界见[验证记录](../docs/LONG-RUN-AND-RESPONSIVE-2026-10-28.md)。两个可选测试使用合成数据，不连接日常企业账号；布局测试不连接真实桌面的CDP。
