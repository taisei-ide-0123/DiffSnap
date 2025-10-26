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
 * 注意: これらのテストは実サイトに依存するため、
 * CI/CDでは警告モードで実行されます
 */

const waitForImageDetection = async (page: Page) => {
  // Content scriptが画像検出を完了するまで待機
  await page.waitForTimeout(2000)
}

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

    // 画像検出を待機
    await waitForImageDetection(page)

    // ポップアップを開く
    const startTime = Date.now()
    const popup = await openPopupForCurrentTab(page, extensionId)

    // プレビュー表示を確認（1秒以内）
    await expect(popup.locator('#root')).toBeVisible({ timeout: 1000 })
    const previewTime = Date.now() - startTime
    expect(previewTime).toBeLessThanOrEqual(1000)

    // 画像枚数を確認（30枚以上）
    // 実際のUIに応じて調整が必要
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

    await waitForImageDetection(page)

    const startTime = Date.now()
    const popup = await openPopupForCurrentTab(page, extensionId)

    await expect(popup.locator('#root')).toBeVisible({ timeout: 1000 })
    const previewTime = Date.now() - startTime
    expect(previewTime).toBeLessThanOrEqual(1000)

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

    await waitForImageDetection(page)

    const startTime = Date.now()
    const popup = await openPopupForCurrentTab(page, extensionId)

    await expect(popup.locator('#root')).toBeVisible({ timeout: 1000 })
    const previewTime = Date.now() - startTime
    expect(previewTime).toBeLessThanOrEqual(1000)

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

    await waitForImageDetection(page)

    const startTime = Date.now()
    const popup = await openPopupForCurrentTab(page, extensionId)

    await expect(popup.locator('#root')).toBeVisible({ timeout: 1000 })
    const previewTime = Date.now() - startTime
    expect(previewTime).toBeLessThanOrEqual(1000)

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

    await waitForImageDetection(page)

    const startTime = Date.now()
    const popup = await openPopupForCurrentTab(page, extensionId)

    await expect(popup.locator('#root')).toBeVisible({ timeout: 1000 })
    const previewTime = Date.now() - startTime
    expect(previewTime).toBeLessThanOrEqual(1000)

    const imageCount = await popup.locator('[data-testid="preview-image"]').count()
    expect(imageCount).toBeGreaterThanOrEqual(10)

    await popup.close()
    await page.close()
  })

  // NOTE: ダウンロード完了テストは機能実装後に有効化
  // test('ダウンロード完了が15秒以内に完了すること', async ({
  //   context,
  //   extensionId,
  // }) => {
  //   const page = await context.newPage()
  //   await page.goto('https://en.wikipedia.org/wiki/Photography', {
  //     waitUntil: 'networkidle',
  //   })
  //
  //   await waitForImageDetection(page)
  //
  //   const popup = await openPopupForCurrentTab(page, extensionId)
  //   await expect(popup.locator('#root')).toBeVisible()
  //
  //   const downloadStartTime = Date.now()
  //   const downloadButton = popup.locator('[data-testid="download-all-button"]')
  //   await downloadButton.click()
  //
  //   await popup.waitForSelector('[data-testid="download-complete"]', {
  //     timeout: 15000,
  //   })
  //
  //   const downloadTime = Date.now() - downloadStartTime
  //   expect(downloadTime).toBeLessThanOrEqual(15000)
  //
  //   await popup.close()
  //   await page.close()
  // })
})
