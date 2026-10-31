# 开发工作流实施说明

日期：2026-10-29。研发协作管理项目与运行环境；工具箱提供独立调试入口，复用已有项目、Remote、宿主进程服务和基础组件。

## 研发协作

在原有 Git、PR/CI、端口、Docker、进程面板前增加“项目启动与运行”。已有探测继续只读。

1. 使用“添加仓库目录”登记项目，或沿用设置中的项目。
2. 选择项目，打开 VS Code、IntelliJ IDEA 或终端。macOS 使用系统 `open`，目录作为单独参数传入；应用需要已安装。其他系统支持 `code` / `idea` CLI，终端联动目前仅支持 macOS。
3. 自动发现 package.json scripts，按锁文件选择 npm/pnpm/yarn/bun；发现 pom.xml 或 gradlew 时提供 Spring Boot / bootRun 入口。具体项目若不使用这些任务，应保存自己的启动配置。
4. 点击启动项后，宿主在已登记的真实项目目录执行。Client 只传项目ID和配置ID；不从消息或本次启动请求接收目录、命令字符串。
5. 查看标准输出、标准错误、运行状态和退出码；可停止本插件启动的运行。运行及停止中的项目不能直接移除，避免失去管理入口。

额外启动配置保存在已有 Project 的 `launchCommands` 中，设置保存、重启和项目迁移时保留。例如：

```json
[
  {"id":"backend","name":"后端服务","argv":["./mvnw","spring-boot:run"]},
  {"id":"frontend","name":"前端服务","argv":["pnpm","run","dev"]}
]
```

只接受开发运行器的 argv 数组，不通过 shell 拼接执行；支持 npm/pnpm/yarn/bun/node/python/python3/java/mvn/mvnw/gradle/gradlew/dotnet/go/cargo。同一项目的相同命令禁止重复启动，最多同时运行4项。日志为本次宿主运行的内存缓冲，每路64KB，最近最多8次运行；截断时明确提示。退出或停用插件会请求停止其持有的进程，宿主重启不会自动重启项目。旧挂载的清理不能停止新挂载启动的运行。

## 开发工具箱

原有16项离线工具保留，新增两项联网工具，并分别展示“本地执行”与“宿主联网调试”。联网调试不复用工作台模型或企业凭据。

- **接口调试**：HTTP/HTTPS 地址、7种方法、自定义 JSON 请求头、正文、超时及停止；返回 HTTP 状态、响应头、原文和耗时。HTTP 4xx/5xx 保留实际响应；重定向不自动跟随。请求正文最多512KB，响应最多1MB，超限明确标注。
- **MCP 调试**：Streamable HTTP 连接、工具分页发现、工具描述及输入 schema、JSON 参数调用、原始结果、SSE 通知和耗时。支持2025-03-26、2025-06-18、2025-11-25的初始化和会话头；2026-07-28使用逐请求 metadata 和标准/参数头，支持中文工具名的头编码。版本由用户选择，不自动重放工具调用。
- 支持超时/停止，legacy工具调用停止时发送关联取消通知。断开、页面卸载或停用插件时清理连接；远端会话释放失败会保留说明。停止客户端等待不代表撤回目标端已经产生的效果。
- 请求头、正文、响应和连接凭据不写入业务状态或迁移包；页面输入保留在本次页面实例中，刷新后清空。鉴权通过用户填写的请求头提供。

本轮不包含 stdio、旧 HTTP+SSE GET 传输、OAuth 登录交互、服务端 sampling/roots 等交互请求、资源/提示词浏览和完整 JSON Schema 表单生成。暂不提供请求集合、环境变量集及 cURL 导入。MCP客户端最多保留12个连接，每次发现最多20页/500项工具，单次调试超时最长60秒。

协议实现参考：[2025版传输](https://modelcontextprotocol.io/specification/2025-11-25/basic/transports)、[2026版 Streamable HTTP](https://modelcontextprotocol.io/specification/2026-07-28/basic/transports/streamable-http)。

## 验证与入口

- `tests/developer-tools.mjs`：临时项目、真实 Node 子进程、本机 HTTP/MCP 服务器；覆盖21项集成场景，包括日志、停止、重复启动、移除保护、取消/超时、分页、SSE、鉴权错误、现代参数头、会话释放及旧挂载清理。
- `plugin-tests/tests/developer-tools.test.jsx`：真实 React 下的4项交互场景，覆盖入口职责、点击发送、参数选择、取消及页面离开时断开。
- `pnpm check`、`pnpm test` 和 `pnpm test:layout` 为本轮回归命令。布局夹具包含项目启动配置、长日志和HTTP/MCP表单的800/360宽度检查。
- 本轮结果：`pnpm check`通过；完整`pnpm test`通过，其中新增21项本地集成场景、前端共138项测试通过；布局检查113项通过，无页面错误或溢出失败。最后的连接数与日志保留上限修订另经`pnpm check`及21项集成场景复验通过。
- IDE/终端验证采用启动器参数夹具，未据此声称已经实机打开用户软件。未启动用户的真实项目，也未调用真实外部业务接口。

源码入口：`src/client/features/collaboration/ProjectLauncher.tsx`、`src/host/integrations/project-runtime.ts`、`src/client/features/toolbox/tools/NetworkDebugger.tsx`、`src/host/integrations/debug-client.ts`。Host 更新后需要重启 Harness。

## 2026-10-31：项目联动与运行反馈

- 页面统一“当前项目”，Git、PR/CI、启动配置与运行日志使用同一项目ID；切换时丢弃旧项目迟到响应。保留无项目时的 Host 环境查看。
- “重新探测”同时刷新环境、PR/CI与运行状态，并绕过对应缓存。PR和CI分别显示成功、空结果或失败，部分成功的数据继续保留；认证、仓库与网络错误分别提示。Git状态读取失败时不再显示“工作区干净”。
- 启动配置改为名称、执行程序、逐行参数、常用标记和可选本机服务地址表单，可从已发现脚本添加。保存仍使用既有 argv 白名单，不执行 shell 字符串，不自动启动项目。已有配置和项目其他字段保留。
- 常用启动项直接显示，其余脚本折叠；端口、Docker与CPU/内存归入折叠的“环境诊断（本机）”，这些列表仍为本机范围，不伪装成项目专属资源。
- 进程状态与服务地址状态分别保留。配置地址的运行显示“启动中”，首次30秒后仍不可访问显示“服务未就绪，进程仍在运行”；未配置地址时不宣称已就绪。HTTP 2xx/3xx仅标记“服务地址可访问”，可手动打开；该检测不证明业务健康或端口由该进程独占。
- 服务检测仅限显式配置的 localhost、127.0.0.1或IPv6回环 HTTP/HTTPS地址，使用HEAD、不跟随重定向，单次最长1.5秒；运行中查看状态时检查，常规检查至少间隔2秒且复用在途检查。退出后清除可访问状态，未配置地址不发请求。运行区常规轮询在页面隐藏时跳过，结束后停止。

新增验证：`node tests/collaboration.mjs`（隔离项目、CLI夹具与真实本机HTTP子进程）、`plugin-tests/tests/collaboration.test.jsx`（项目切换、迟到响应、分路失败、表单与运行反馈）、`node plugin-tests/layout/collaboration.mjs`（四种宽度、两种主题，合成数据并拦截网络）。继续运行`pnpm build`、`pnpm check`、`pnpm test`和`pnpm test:layout`。

本轮验证不启动用户实际项目，不实际打开IDE，也不证明真实GitHub账号或远端PR/CI可用；这些需在用户环境中单独验收。

本轮结果：`pnpm build`、`pnpm check`、完整`pnpm test`通过（前端26个测试文件、356项测试；新增Host验证18项）；通用布局155个场景与研发协作专项8个场景通过，无页面错误或布局失败。最后调整独立加载与配置参数保留后，已重新构建并复验完整功能测试及专项布局。
