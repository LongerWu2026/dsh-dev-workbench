/**
 * 工作台 GUI 走查：真实界面上的页面导航与控制台错误采集。
 * 每个页面截屏到 artifacts/，肉眼可以立即看出排版问题。
 *
 * 仅做确定性断言：不登录、不调模型、不等待 Agent 回复。
 */
import { test, expect, chromium } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const CDP = process.env.DSH_CDP_URL || 'http://127.0.0.1:9222'
const ARTIFACTS = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../artifacts')

const PAGES = ['今日简报', '任务中心', '搜索', 'Agent 中心', '开发工具箱', '研发协作', '知识空间', '连接与设置']

let context = null
let page = null
const consoleErrors = []

test.beforeAll(async () => {
  fs.mkdirSync(ARTIFACTS, { recursive: true })
  let browser
  try {
    browser = await chromium.connectOverCDP(CDP, { timeout: 8000 })
  } catch (error) {
    throw new Error(
      `无法连接 GUI（${CDP}）。请先用调试端口重启 DSH：\n` +
        '  1) 完全退出 DeepSeek Harness\n' +
        '  2) open -a "DeepSeek Harness" --args --remote-debugging-port=9222\n' +
        '  3) 再跑 DSH_CDP_URL=http://127.0.0.1:9222 pnpm test:e2e\n' +
        `原始错误：${error.message}`,
    )
  }
  context = browser.contexts()[0]
  page = context.pages()[0] || (await context.newPage())
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text().slice(0, 300))
  })
  page.on('pageerror', (error) => consoleErrors.push('pageerror: ' + String(error).slice(0, 300)))
})

/** 确保工作台面板真实打开：以 .wb-root 挂载与否为准，避免对话文本里的「今日简报」造成误判。 */
async function ensureWorkbenchOpen() {
  const opened = await page.evaluate(() => !!document.querySelector('.wb-root'))
  if (opened) return
  // 宿主全局面板里的插件入口按钮（已有 DOM 验证：button "智能工作台"）
  const icon = page.getByRole('button', { name: '智能工作台', exact: true }).first()
  await icon.click()
  await expect(page.locator('nav[aria-label="工作台导航"] button').first()).toBeVisible({ timeout: 20000 })
}

test.describe('工作台 GUI 走查', () => {
  for (const name of PAGES) {
    test(`页面走查：${name}`, async () => {
      await ensureWorkbenchOpen()
      // 二级导航（工作台内部）
      const nav = page.locator('nav[aria-label="工作台导航"] button', { hasText: name }).first()
      await nav.click()
      await page.waitForTimeout(400)
      // 页面标题存在
      await expect(page.getByText(name, { exact: false }).first()).toBeVisible()
      // 截屏供肉眼排查
      await page.screenshot({ path: path.join(ARTIFACTS, `page-${name}.png`) })
    })
  }

  test('助手抽屉打开/关闭并把消息区截屏', async () => {
    await ensureWorkbenchOpen()
    const openBtn = page.locator('button[aria-label*="工作台助手"], button[title*="工作台助手"]').first()
    await openBtn.click()
    await page.waitForTimeout(400)
    await expect(page.getByPlaceholder('输入指令，或让我帮你整理待办…')).toBeVisible()
    await page.screenshot({ path: path.join(ARTIFACTS, 'assistant-drawer.png') })
    await page.locator('button[aria-label="关闭助手"]').click()
  })

  test('搜索页输入关键词并走一次本地检索（不联网）', async () => {
    await ensureWorkbenchOpen()
    await page.locator('nav[aria-label="工作台导航"] button', { hasText: '搜索' }).first().click()
    await page.waitForTimeout(300)
    const snapshotFile = path.join(ARTIFACTS, 'search-before-typing.png')
    await page.screenshot({ path: snapshotFile })
    // 分类标注行新改版在搜索插件页面等待用户输入即可；输入框可由 placeholder 定位
    const input = page.locator('.wb-page input').first()
    await expect(input).toBeVisible({ timeout: 8000 })
    await input.fill('限流')
    await input.press('Enter')
    // 断言搜索插件的分类筛选行真的出现（工作台 DOM 内）
    await expect(page.locator('.wb-root').getByText('分类：', { exact: false })).toBeVisible({ timeout: 10000 })
    await page.screenshot({ path: path.join(ARTIFACTS, 'search-page.png') })
  })

  test('全程没有未捕获的 pageerror / 可疑 console.error', async () => {
    // 容忍少量已知噪音：缺 favicon、云之家 token 过期提示等
    const suspicious = consoleErrors.filter((line) => {
      if (/favicon|Failed to load resource/i.test(line)) return false
      // 宿主自己的遥测/推送通道（本地 9230/ingest），连不上不影响工作台
      if (/ws:\/\/127\.0\.0\.1:\d+\/ingest/i.test(line)) return false
      if (/无法读取 token|token 过期|未授权/i.test(line)) return false
      return true
    })
    if (suspicious.length > 0) {
      fs.writeFileSync(path.join(ARTIFACTS, 'console-errors.log'), consoleErrors.join('\n'))
    }
    await expect(suspicious, `控制台可疑报错：\n${suspicious.slice(0, 10).join('\n')}`).toEqual([])
  })
})
