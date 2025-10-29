import { test, expect } from './helpers'
import type { Page } from '@playwright/test'

/**
 * 実サイトでのE2Eテスト
 * MVP対象の5サイトで画像収集機能を検証
 *
 * 要件:
 * - Amazon: ≥30枚
 * - Unsplash: ≥50枚
 * - CNN: ≥20枚
 * - Wikipedia: ≥10枚
 * - GitHub: ≥10枚
 * - プレビュー表示: ≤1秒
 * - ダウンロード完了: ≤15秒
 *
 * フロー（Issue #72対応 - Lazy Detection）:
 * 1. ページを開く
 * 2. Popupを開く
 * 3. ダウンロードボタンをクリック（START_COLLECTION発火）
 * 4. Background → Content: START_SCROLL送信
 * 5. Content: 画像検出開始
 * 6. 検出完了を待機
 *
 * 注意: これらのテストは実サイトに依存するため、
 * CI/CDでは警告モードで実行されます
 */

const openPopupForCurrentTab = async (page: Page, extensionId: string) => {
  const popupUrl = `chrome-extension://${extensionId}/src/popup/index.html`
  const popupPage = await page.context().newPage()
  await popupPage.goto(popupUrl)
  return popupPage
}

test.describe('Real Sites E2E Tests', () => {
  test.setTimeout(60000) // 各テスト60秒タイムアウト

  test('Amazon商品ページで30枚以上検出できること', async ({
    context,
    extensionId,
  }) => {
    // Amazon商品ページを開く
    const page = await context.newPage()
    await page.goto('https://www.amazon.com/dp/B08N5WRWNW', {
      waitUntil: 'networkidle',
    })

    // ポップアップを開く
    const popup = await openPopupForCurrentTab(page, extensionId)
    await expect(popup.locator('#root')).toBeVisible({ timeout: 1000 })

    // ダウンロードボタンをクリック（START_COLLECTION発火）
    const downloadButton = popup.locator('[data-testid="download-all-button"]')
    await downloadButton.click()

    // 画像検出完了を待機（プレビュー画像が表示される）
    await popup.waitForSelector('[data-testid="preview-image"]', { timeout: 10000 })

    // 画像枚数を確認（30枚以上）
    const imageCount = await popup.locator('[data-testid="preview-image"]').count()
    expect(imageCount).toBeGreaterThanOrEqual(30)

    await popup.close()
    await page.close()
  })

  test('Unsplashギャラリーで50枚以上検出できること', async ({
    context,
    extensionId,
  }) => {
    const page = await context.newPage()
    await page.goto('https://unsplash.com/t/wallpapers', {
      waitUntil: 'networkidle',
    })

    // スクロールして遅延読込をトリガー
    await page.evaluate(() => {
      window.scrollTo(0, document.body.scrollHeight / 2)
    })
    await page.waitForTimeout(1000)

    const popup = await openPopupForCurrentTab(page, extensionId)
    await expect(popup.locator('#root')).toBeVisible({ timeout: 1000 })

    // ダウンロードボタンをクリック（START_COLLECTION発火）
    const downloadButton = popup.locator('[data-testid="download-all-button"]')
    await downloadButton.click()

    // 画像検出完了を待機
    await popup.waitForSelector('[data-testid="preview-image"]', { timeout: 10000 })

    const imageCount = await popup.locator('[data-testid="preview-image"]').count()
    expect(imageCount).toBeGreaterThanOrEqual(50)

    await popup.close()
    await page.close()
  })

  test('CNNニュースページで20枚以上検出できること', async ({
    context,
    extensionId,
  }) => {
    const page = await context.newPage()
    await page.goto('https://www.cnn.com', {
      waitUntil: 'networkidle',
    })

    const popup = await openPopupForCurrentTab(page, extensionId)
    await expect(popup.locator('#root')).toBeVisible({ timeout: 1000 })

    // ダウンロードボタンをクリック（START_COLLECTION発火）
    const downloadButton = popup.locator('[data-testid="download-all-button"]')
    await downloadButton.click()

    // 画像検出完了を待機
    await popup.waitForSelector('[data-testid="preview-image"]', { timeout: 10000 })

    const imageCount = await popup.locator('[data-testid="preview-image"]').count()
    expect(imageCount).toBeGreaterThanOrEqual(20)

    await popup.close()
    await page.close()
  })

  test('Wikipedia記事で10枚以上検出できること', async ({
    context,
    extensionId,
  }) => {
    const page = await context.newPage()
    await page.goto('https://en.wikipedia.org/wiki/Image', {
      waitUntil: 'networkidle',
    })

    const popup = await openPopupForCurrentTab(page, extensionId)
    await expect(popup.locator('#root')).toBeVisible({ timeout: 1000 })

    // ダウンロードボタンをクリック（START_COLLECTION発火）
    const downloadButton = popup.locator('[data-testid="download-all-button"]')
    await downloadButton.click()

    // 画像検出完了を待機
    await popup.waitForSelector('[data-testid="preview-image"]', { timeout: 10000 })

    const imageCount = await popup.locator('[data-testid="preview-image"]').count()
    expect(imageCount).toBeGreaterThanOrEqual(10)

    await popup.close()
    await page.close()
  })

  test('GitHubリポジトリで10枚以上検出できること', async ({
    context,
    extensionId,
  }) => {
    const page = await context.newPage()
    await page.goto('https://github.com/microsoft/vscode', {
      waitUntil: 'networkidle',
    })

    const popup = await openPopupForCurrentTab(page, extensionId)
    await expect(popup.locator('#root')).toBeVisible({ timeout: 1000 })

    // ダウンロードボタンをクリック（START_COLLECTION発火）
    const downloadButton = popup.locator('[data-testid="download-all-button"]')
    await downloadButton.click()

    // 画像検出完了を待機
    await popup.waitForSelector('[data-testid="preview-image"]', { timeout: 10000 })

    const imageCount = await popup.locator('[data-testid="preview-image"]').count()
    expect(imageCount).toBeGreaterThanOrEqual(10)

    await popup.close()
    await page.close()
  })

  test('ダウンロード完了が15秒以内に完了すること', async ({
    context,
    extensionId,
  }) => {
    const page = await context.newPage()
    await page.goto('https://en.wikipedia.org/wiki/Photography', {
      waitUntil: 'networkidle',
    })

    const popup = await openPopupForCurrentTab(page, extensionId)
    await expect(popup.locator('#root')).toBeVisible({ timeout: 1000 })

    const downloadStartTime = Date.now()
    const downloadButton = popup.locator('[data-testid="download-all-button"]')
    await downloadButton.click()

    // ダウンロード完了を待機（15秒以内）
    await popup.waitForSelector('[data-testid="download-complete"]', {
      timeout: 15000,
    })

    const downloadTime = Date.now() - downloadStartTime
    expect(downloadTime).toBeLessThanOrEqual(15000)

    await popup.close()
    await page.close()
  })
})
