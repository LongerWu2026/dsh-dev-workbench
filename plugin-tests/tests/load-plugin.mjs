/**
 * 加载真实 client.js（与插件运行时同一份产物），返回 { plugin, WB, ctx-ish shopper }。
 * 与 apps 内运行的差别只在：React 用本仓库安装的 react 18，而不是宿主注入的版本。
 */
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const BUNDLE = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'client.js')

export function loadClientBundle() {
  let factory = null
  const window = {
    __ModuleLoader__: {
      load(entry) {
        factory = entry.factory
      },
    },
    addEventListener(...args) { globalThis.window?.addEventListener(...args) },
    removeEventListener(...args) { globalThis.window?.removeEventListener(...args) },
    matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }),
    navigator: { platform: 'Mac' },
    setTimeout,
    clearTimeout,
  }
  const source = readFileSync(BUNDLE, 'utf8')
  // eslint-disable-next-line no-new-func
  new Function('window', 'navigator', 'document', source)(window, window.navigator, globalThis.document || { createElement: () => ({ style: {} }) })
  if (!factory) throw new Error('bundle did not call __ModuleLoader__.load')
  const plugin = factory((id) => {
    if (id === 'react') return require('react')
    throw new Error('unexpected module import: ' + id)
  })
  return plugin
}
