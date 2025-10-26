import { test as base, chromium, type BrowserContext } from '@playwright/test'
import path from 'path'
import { fileURLToPath } from 'url'
import fs from 'fs'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

export const test = base.extend<{
  context: BrowserContext
  extensionId: string
}>({
  // eslint-disable-next-line no-empty-pattern
  context: async ({}, use) => {
    const pathToExtension = path.join(__dirname, '..', 'dist')
    const context = await chromium.launchPersistentContext('', {
      headless: !!process.env.CI,
      args: [
        `--disable-extensions-except=${pathToExtension}`,
        `--load-extension=${pathToExtension}`,
        '--no-sandbox',
      ],
    })
    await use(context)
    await context.close()
  },
  extensionId: async ({ context }, use) => {
    let [background] = context.serviceWorkers()
    background ??= await context.waitForEvent('serviceworker')

    const parts = background.url().split('/')
    const extensionId = parts[2]
    if (!extensionId) {
      throw new Error('Extension ID not found in service worker URL')
    }
    await use(extensionId)
  },
})

export const expect = test.expect

/**
 * Chrome拡張のポップアップを開く
 */
export const openPopup = async (context: BrowserContext, extensionId: string) => {
  const popupUrl = `chrome-extension://${extensionId}/src/popup/index.html`
  const page = await context.newPage()
  await page.goto(popupUrl)
  return page
}

/**
 * Chrome拡張のSettingsページを開く
 */
export const openSettings = async (
  context: BrowserContext,
  extensionId: string,
) => {
  const settingsUrl = `chrome-extension://${extensionId}/src/settings/index.html`
  const page = await context.newPage()
  await page.goto(settingsUrl)
  return page
}

/**
 * スクリーンショットを撮影（テストデバッグ用）
 */
export const takeScreenshot = async (
  context: BrowserContext,
  name: string,
) => {
  const page = context.pages()[0]
  if (page) {
    const screenshotsDir = 'screenshots'
    if (!fs.existsSync(screenshotsDir)) {
      fs.mkdirSync(screenshotsDir, { recursive: true })
    }
    await page.screenshot({ path: `screenshots/${name}.png`, fullPage: true })
  }
}
