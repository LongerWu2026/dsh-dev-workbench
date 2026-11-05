# 云之家检索入口与能力验收

## 入口与交互

顶部放大镜 / Cmd+K 默认只搜索本地已保存内容。输入关键词后点击“查询云之家”，进入完整结果页的“云之家”范围，默认查询联系人。完整页也可直接切换工作内容、云之家、互联网三个范围。

云之家类型包括：全部、联系人、消息、文档、群聊、日程、会议室、本人考勤。切换类型不自动发请求，只有点击搜索才查企业数据。“全部”查询联系人、消息、文档和群聊；日程、会议室和本人考勤单独选择，避免无关调用。

联系人姓名可点击查看部门与岗位。结果可交给普通 AI 助手对话继续，替换原引用；继续当前云之家查询对话时复用原会话，账号变化不会复用旧账号的查询会话。不会自动发送模型消息或修改企业数据。

## 官方 CLI 能力核对

已阅读 yzj-cli 技能及 contact / im / doc / calendar / attendance 参考，并在本机执行以下只读命令的 --help 核实参数：

| 类型 | 命令 | 边界 |
| --- | --- | --- |
| 联系人 | contact user search --keyword | 姓名/关键词；展示姓名、部门、岗位，兼容 oId / openId 与部门字段变体 |
| 消息 | im message search --keyword | 当前账号可见的消息，保留真实消息和群标识 |
| 文档 | doc search --keyword | 仅标题/文件名匹配，不宣称正文搜索，不构造未返回的文档链接 |
| 群聊 | im group search --keyword | 当前账号可见群聊，不猜群 ID |
| 日程 | calendar event list --start --end | 按日期查询并可筛选标题 |
| 会议室 | calendar room find --start --end | 所选时段的空闲会议室，不作预订 |
| 本人考勤 | attendance record list --start --end | 本人打卡流水；不推断迟到、缺卡或他人考勤 |

时间条件按北京时间校验；无效日期、倒置时间、超过 180 天的范围在 CLI 调用前拒绝。接口失败与无匹配分开显示，部分来源失败保留已返回结果。原有 work 混合搜索保持兼容，local 与 enterprise 均不会意外转入互联网。

## 验证证据

- 新增 tests/enterprise-search.mjs：14 项通过，覆盖各类型独立分派、英文长姓名、真实标识字段、日期和时区、空结果、局部失败、登录失败以及零写调用。
- global-search.test.jsx：19 项通过，覆盖本地默认、顶部云之家入口、联系人详情、显式查询、考勤范围、迟到结果隔离、实际 RPC 参数透传、AI 对话复用与不自动发消息。
- 本机 CLI 只读核验：身份可用，以本人姓名查询通讯录成功返回 1 条；日志只输出数量与字段名，没有输出凭据。
- 客户端已加载修复，通过“顶部搜索 → 查询云之家 → 联系人结果 → 姓名预览”实际返回 1 条，预览含姓名、部门和岗位。未为验收发送 AI 消息或创建真实沟通。
- pnpm build、pnpm check 通过。完整 pnpm test 退出码 0：后端链路通过，50 个界面文件、799 项通过。
- 完整回归使用带 node_modules 链接的独立临时父目录，供并行新增的正文解析依赖在测试 bundle 中解析，未修改其他功能实现。冒烟测试接口数量按已存在的 knowledgeCapture / radarArticle 两项并行新增接口校正为 124。
- 仅本次修改范围的 git diff --check 通过；其他成员的未提交文件保留。

日志：/tmp/enterprise-search-host.log、/tmp/enterprise-search-ui.log、/tmp/enterprise-search-full-test.log、/tmp/enterprise-search-final-check.log。
