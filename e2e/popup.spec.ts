import { test, expect, openPopup } from './helpers'

test.describe('Popup Basic Tests', () => {
  test('拡張機能がロードされること', async ({ extensionId }) => {
    expect(extensionId).toBeTruthy()
    expect(extensionId).toMatch(/^[a-z]{32}$/)
  })

  test('ポップアップが開くこと', async ({ context, extensionId }) => {
    const page = await openPopup(context, extensionId)
    await expect(page).toHaveTitle(/DiffSnap/)

    // ポップアップのメイン要素が存在することを確認
    const popupContent = page.locator('body')
    await expect(popupContent).toBeVisible()
  })

  test('ポップアップに基本UI要素が表示されること', async ({
    context,
    extensionId,
  }) => {
    const page = await openPopup(context, extensionId)

    // アプリケーションルートが存在することを確認
    const root = page.locator('#root')
    await expect(root).toBeVisible()
  })
})
