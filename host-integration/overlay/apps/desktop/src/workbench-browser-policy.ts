/** Fixed consumer-site registration for the workbench's persistent embedded pages. */
import type { PersistentBrowserPolicy } from './browser-persistence.ts'

/** Main-owned allowlist; callers cannot add origins, directories, or providers over IPC. */
export const workbenchBrowserPolicy: PersistentBrowserPolicy = {
  namespace: 'dsh-dev-workbench.web-ai',
  providers: [
    { id: 'kimi', origins: ['https://www.kimi.com', 'https://kimi.com'] },
    { id: 'glm', origins: ['https://chatglm.cn'] },
    { id: 'doubao', origins: ['https://www.doubao.com'] },
    { id: 'yuanbao', origins: ['https://yuanbao.tencent.com'] },
    { id: 'qianwen', origins: ['https://www.qianwen.com', 'https://qianwen.com'] },
    { id: 'chatgpt', origins: ['https://chatgpt.com'] },
  ],
}
