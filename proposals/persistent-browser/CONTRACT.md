# 内嵌持久化 Browser 拟议契约 v1

> 阶段更新：下文保留初始方案及当时边界；本地宿主现已接入并通过无账号验收，当前状态以[宿主实施记录](../../docs/WEB-AI-HOST-PERSISTENCE-2026-10-29.md)为准。真实账号与受控清理仍待办。

状态：**设计及隔离策略参考，尚未接入 Harness 主进程**。本目录不会随插件运行，不会修改已安装的软件。这里的 `browser.persistence` 是本项目提出的扩展，不是当前 Harness 官方 API。

## 调用边界

保留现有 `dshDesktop.protocolVersion === 1` 和 `browser.acquire/release/onOpenRequested`。仅在宿主注册并授权插件后额外提供：

```ts
browser.persistence = {
  protocolVersion: 1,
  acquire(request: {
    namespace: 'dsh-dev-workbench.web-ai',
    providerId: 'kimi' | 'glm' | 'doubao' | 'yuanbao' | 'qianwen' | 'chatgpt'
  }): Promise<{
    lease: string,
    partition: string, // MAIN 分配的 persist: 分区名
    persistence: 'persistent',
    providerId: string
  }>
}
```

请求不接受目录、partition、账号、Cookie、token、任意 origin 或任意插件ID。MAIN 用自己选择的 profile 以及插件注册身份派生存储账号。Client 验证返回模式、厂商及分区格式后，将宿主批准的原值用于 webview；持久化申请失败就显示错误，不悄悄回退内存，不另开窗口。

Client 不通过字符串拼接把现有内存 lease 改成 `persist:`。若只有当前官方接口，继续使用按厂商细分的内存范围并显示「完整退出后需要重新登录」。未知扩展版本不会被认定为支持持久化。

## 宿主需要实现的部分

1. **身份**：由 MAIN 的 profile manager 提供可信 profileDirectory，插件注册层绑定批准的 pluginId 与 window webContentsId。页面请求不能决定这些值。`session-policy.ts` 是分区身份参考，测试包含新 Node 进程、profile路径别名、六家分离、不同profile和不同窗口拒绝。
2. **分区**：对同一 profile＋插件＋厂商使用稳定的 `persist:dsh-workbench-web-ai-v1-<sha256>`。不含进程nonce、业务主题或提问ID。工作区问答数据隔离由现有业务层承担；同一个 Harness profile 下的不同问答可沿用该厂商登录。不同 profile 不共享。
3. **lease**：沿用现有 main-issued lease、精确 partition＋src＋所属窗口匹配和销毁机制；附加持久化租约种类。不得只在 Client 设置分区或放宽 `will-attach-webview` 的校验。同步更新 preload 的窄接口、MAIN IPC 校验及类型定义。
4. **承载**：仍在工作台的 webview 内运行，不创建外部 Chrome，不导入日常浏览器资料，不向渲染器暴露 Electron Session、Cookie枚举或任意IPC。
5. **导航与权限**：保留 sandbox、contextIsolation、Node 禁用、下载/设备权限的既有策略；每个持久分区绑定固定厂商域名。额外认证域名必须逐站核实后在 MAIN 的固定策略注册，不能由页面或配置表自由添加。未适配的弹窗提示待处理，不绕过安全页或打开外部窗口。
6. **释放与退出**：释放webview不清理磁盘分区；适当调用该 Session 的 `flushStorageData()` 与 `cookies.flushStore()`。应用退出使用有界的 flush/drain，不能无限阻止退出。异常退出按 Chromium 与官网现有恢复语义处理，不能把业务发送任务自动重放。
7. **注销与清理**：官网登录退出由官网正常处理。显式清除某厂商本机登录，需要内部确认后先封锁/失效旧lease，再销毁guest、清理该厂商分区，最后允许新lease，防止旧页面重新写入。卸载默认保留还是清除必须明确提示，不能自动递归删除profile或影响其他厂商。当前没有实现此清理入口。
8. **磁盘与迁移**：由 Electron profile 的浏览器资料目录管理，不放入工作台 `state.json`、知识库或导出包。分区名称不是凭据加密；不要未经核实声称使用系统钥匙串或端到端加密。迁移业务数据后重新登录；不自动搬运授权。

## 必须保留的验收

- 无账号的真实 Electron 测试：两个独立应用进程，仅用合成持久Cookie/localStorage/IndexedDB标记，检查保留和profile/厂商隔离；不使用普通 Chrome、Node JSON文件或固定分区名测试冒充存储验收。
- lease伪造、所属窗口不符、任意目录、任意域名、过期租约、权限/下载拒绝、退出flush失败、重复释放、崩溃与再次打开。
- 清理后不能由迟到的保存/页面回调恢复旧登录；不同厂商仍保留各自资料。
- 六家真实账号分别验证正常登录→完整退出→重开、账号过期/撤销、官网退出、切换账号、验证码及追问/采集。按本轮用户要求暂不登录，全部保留待办。

`tests/web-ai-session.mjs` 目前只证明身份策略及请求边界；Client的React测试只证明协商和拒绝回退。**两者都不能证明已安装 Harness 可以跨重启保留网页登录。**
