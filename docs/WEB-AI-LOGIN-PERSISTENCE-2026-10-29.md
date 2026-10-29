# 工作台内嵌登录跨重启方案

> 阶段更新：下文保留初始方案及当时边界；本地宿主现已接入并通过无账号验收，当前状态以[宿主实施记录](WEB-AI-HOST-PERSISTENCE-2026-10-29.md)为准。真实账号与受控清理仍待办。

日期：2026-10-29，Asia/Shanghai。范围仅 Kimi、国内智谱清言、豆包、元宝、千问和可选 ChatGPT。按用户要求优先内嵌，不打开额外浏览器窗口，需要账号的验证先保留。

## 结论

主路径选 **宿主管理的 Electron 持久化 Session＋现有工作台 webview**。用户在嵌入的官网正常登录，下一次启动仍打开同一厂商的持久分区，由官网判断登录是否有效。业务历史继续独立保存在工作台，账号资料留在宿主浏览器目录。

当前官方 Harness Browser 仍只提供进程内存分区，插件不能单靠改一个partition字符串获得宿主批准的持久化能力。本轮完成了客户端协商、按厂商细分内存范围、真实能力提示，以及宿主身份策略参考和测试；**尚未接入宿主MAIN，当前安装版仍不能承诺跨重启登录保留**。待办分开记录宿主工程接入与真实账号验收。

## 为什么这样选择

- [Harness Browser 官方文档](https://github.com/deepseek-ai/deepseek-harness/blob/master/packages/client/ui-sidebar-browser/README.md)明确当前桌面分区不跨应用重启保留Cookie和Web Storage；[现行类型](https://github.com/deepseek-ai/deepseek-harness/blob/master/packages/client/ui-sidebar-browser/src/types.ts)只有 acquire/release/onOpenRequested，没有持久化申请。
- [Electron Session 文档](https://www.electronjs.org/docs/latest/api/session#sessionfrompartitionpartition-options)规定 `persist:` 分区使用持久Session。它应由宿主MAIN建立并批准租约，不由插件绕过宿主的挂载校验。
- Host的凭据服务可以保存插件自己的服务授权；这与完整官网Session是不同能力。没有六站通用、稳定的授权恢复契约，不套用 DeepSeek 专用localStorage键，不扫描全部storage或复制HttpOnly Cookie。固定授权契约若未来有证据，再按站评估。
- 持久化不等于永不过期。站点的Cookie寿命、session cookie、风控、撤销及设备策略仍由官网决定，不延长授权期限，不绕过验证。

## 本轮代码变化

1. `browser-session.ts` 单独负责能力协商。普通官方接口显示「仅本次运行保留登录」，不把官网加载成功视为认证成功。
2. 为未来宿主扩展预留严格v1接入：只提交固定namespace和厂商；使用宿主返回的lease和分区；错误模式、错误厂商、伪持久化和空分区均拒绝并释放租约。**扩展是本项目拟议契约，当前官方没有提供，也没有在已安装软件中启用。**
3. 现有内存存储范围按厂商细分；同一厂商的不同问答沿用同一范围，切页仍保留网页。持久化路线由宿主进一步按profile隔离。
4. 移除另开专用浏览器的UI入口；旧 `webAIOpenExternal` Remote保留方法名但改为拒绝，防止旧客户端再次打开外部窗口。Host不再探测或创建Chrome连接。历史driver及单独测试文件未删除，生产服务不再引用。
5. 官网不兼容时提示当前内嵌限制，可保留原页或人工粘贴回答，不自动改走外部浏览器。

宿主接入契约、退出flush、权限、清理及迁移要求见[拟议契约](../proposals/persistent-browser/CONTRACT.md)。策略参考不是宿主补丁，也没有修改安装包。

## 验证与未完成项

无账号实机验证及自动化结果单独写入本轮证据。策略测试中的「新进程」仅指Node进程重新派生同一分区身份，不代表真实Electron数据存储或六家登录恢复测试。

本轮重新运行 `pnpm build`、`pnpm check`、`pnpm test` 和 `pnpm test:layout`，退出码均为0。网页AI Host/Runner 28项、宿主策略8项、React 79项（网页AI相关29项）及11页首屏渲染通过；布局103项无错误。源码135个模块无数字前缀、循环或层级违规。

通过正常 DeepSeek Harness 界面核验：当前宿主显示仅本次运行保留登录，展开兼容性后无外部浏览器入口；Kimi和千问在后台均成功填入 `【内嵌存储方案验收20261029】只填入草稿，不发送。`，展开官网核对实际输入框原文一致。没有登录或发送消息，也没有打开可见外部浏览器窗口。本轮未完整重启Harness，未将Node身份策略测试称为Electron持久化测试。

机器可读证据见[验收记录](evidence/web-ai-login-persistence-2026-10-29.json)。日志为 `/tmp/workbench-web-ai-persistence-20261029-tests.log` 和 `/tmp/workbench-web-ai-persistence-20261029-layout.log`。新的Host拒绝旧外部窗口Remote的行为已在隔离服务测试验证；现有Harness进程需完整重启才能确保加载新的Host实现，当前Client入口已移除。

- 已实现范围：客户端能力协商、真实状态提示、拒绝错误持久化模式、按厂商范围、外部窗口入口关闭、宿主策略参考。
- 待宿主接入：MAIN/preload/IPC/租约注册、真实Electron跨进程存储、flush、注销清理及权限生命周期。
- 待账号：六站登录、完整退出重开后的真实恢复、过期/撤销/切换账号、验证码与真实发送采集。按用户要求本轮不登录。

要在当前机器实际启用持久化，需要后续有明确宿主源码基线并完成上述接入、构建与部署；本轮没有用临时脚本篡改安装包或扩大现有宿主权限。
