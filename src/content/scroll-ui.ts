/**
 * スクロール制御用UI
 *
 * 最大深度到達時にユーザー選択肢を表示するオーバーレイUIを提供します。
 *
 * 選択肢:
 * - Continue +20: さらに20画面スクロール継続
 * - Stop and Download: 現在の結果でダウンロード
 * - Cancel: 処理中断
 */

import type { UserChoice } from '../shared/types'

/**
 * オーバーレイUIのスタイル定義
 */
const OVERLAY_STYLES = `
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.7);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 2147483647;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
`

const DIALOG_STYLES = `
  background: white;
  border-radius: 8px;
  padding: 24px;
  max-width: 400px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
`

const TITLE_STYLES = `
  margin: 0 0 16px 0;
  font-size: 18px;
  font-weight: 600;
  color: #1a1a1a;
`

const MESSAGE_STYLES = `
  margin: 0 0 24px 0;
  font-size: 14px;
  line-height: 1.5;
  color: #4a4a4a;
`

const BUTTON_CONTAINER_STYLES = `
  display: flex;
  flex-direction: column;
  gap: 8px;
`

const BUTTON_BASE_STYLES = `
  padding: 10px 16px;
  font-size: 14px;
  font-weight: 500;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  transition: background-color 0.2s;
`

const PRIMARY_BUTTON_STYLES = `
  ${BUTTON_BASE_STYLES}
  background: #2563eb;
  color: white;
`

const SECONDARY_BUTTON_STYLES = `
  ${BUTTON_BASE_STYLES}
  background: #f3f4f6;
  color: #1a1a1a;
`

const CANCEL_BUTTON_STYLES = `
  ${BUTTON_BASE_STYLES}
  background: transparent;
  color: #6b7280;
  border: 1px solid #d1d5db;
`

/**
 * オーバーレイUIを表示してユーザー選択を待つ
 *
 * @param scrollCount - 現在のスクロール回数
 * @returns ユーザーの選択
 */
export const showMaxDepthDialog = (scrollCount: number): Promise<UserChoice> => {
  return new Promise((resolve) => {
    // オーバーレイ作成
    const overlay = document.createElement('div')
    overlay.id = 'diffsnap-scroll-overlay'
    overlay.setAttribute('style', OVERLAY_STYLES)

    // ダイアログ作成
    const dialog = document.createElement('div')
    dialog.setAttribute('style', DIALOG_STYLES)

    // タイトル
    const title = document.createElement('h2')
    title.setAttribute('style', TITLE_STYLES)
    title.textContent = '最大深度に到達しました'

    // メッセージ
    const message = document.createElement('p')
    message.setAttribute('style', MESSAGE_STYLES)
    message.textContent = `${scrollCount}回のスクロールが完了しました。さらにコンテンツを読み込みますか？`

    // ボタンコンテナ
    const buttonContainer = document.createElement('div')
    buttonContainer.setAttribute('style', BUTTON_CONTAINER_STYLES)

    // Continue +20ボタン
    const continueButton = document.createElement('button')
    continueButton.setAttribute('style', PRIMARY_BUTTON_STYLES)
    continueButton.textContent = '続行 (+20画面)'
    continueButton.addEventListener('click', () => {
      cleanup()
      resolve('continue')
    })
    continueButton.addEventListener('mouseenter', () => {
      continueButton.style.backgroundColor = '#1d4ed8'
    })
    continueButton.addEventListener('mouseleave', () => {
      continueButton.style.backgroundColor = '#2563eb'
    })

    // Stop and Downloadボタン
    const stopButton = document.createElement('button')
    stopButton.setAttribute('style', SECONDARY_BUTTON_STYLES)
    stopButton.textContent = '停止してダウンロード'
    stopButton.addEventListener('click', () => {
      cleanup()
      resolve('stop')
    })
    stopButton.addEventListener('mouseenter', () => {
      stopButton.style.backgroundColor = '#e5e7eb'
    })
    stopButton.addEventListener('mouseleave', () => {
      stopButton.style.backgroundColor = '#f3f4f6'
    })

    // Cancelボタン
    const cancelButton = document.createElement('button')
    cancelButton.setAttribute('style', CANCEL_BUTTON_STYLES)
    cancelButton.textContent = 'キャンセル'
    cancelButton.addEventListener('click', () => {
      cleanup()
      resolve('cancel')
    })
    cancelButton.addEventListener('mouseenter', () => {
      cancelButton.style.backgroundColor = '#f9fafb'
    })
    cancelButton.addEventListener('mouseleave', () => {
      cancelButton.style.backgroundColor = 'transparent'
    })

    // DOM構築
    buttonContainer.appendChild(continueButton)
    buttonContainer.appendChild(stopButton)
    buttonContainer.appendChild(cancelButton)

    dialog.appendChild(title)
    dialog.appendChild(message)
    dialog.appendChild(buttonContainer)

    overlay.appendChild(dialog)

    // オーバーレイクリック時はキャンセル扱い
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        cleanup()
        resolve('cancel')
      }
    })

    // DOMに追加
    document.body.appendChild(overlay)

    // ESCキーでキャンセル
    const handleKeydown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        cleanup()
        resolve('cancel')
      }
    }
    document.addEventListener('keydown', handleKeydown)

    // クリーンアップ関数
    const cleanup = () => {
      overlay.remove()
      document.removeEventListener('keydown', handleKeydown)
    }
  })
}

/**
 * スクロール進捗インジケーターを表示
 *
 * @param scrollCount - 現在のスクロール回数
 * @param maxDepth - 最大深度
 */
export const showScrollProgress = (scrollCount: number, maxDepth: number): HTMLDivElement => {
  // 既存のインジケーターを削除
  const existing = document.getElementById('diffsnap-scroll-progress')
  if (existing) {
    existing.remove()
  }

  // 進捗インジケーター作成
  const progress = document.createElement('div')
  progress.id = 'diffsnap-scroll-progress'
  progress.setAttribute(
    'style',
    `
    position: fixed;
    bottom: 20px;
    right: 20px;
    background: rgba(0, 0, 0, 0.8);
    color: white;
    padding: 12px 16px;
    border-radius: 4px;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    font-size: 14px;
    z-index: 2147483646;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
  `
  )

  // Note: z-indexは最大値-1に設定（進捗インジケーターをダイアログより下に配置）
  // 通常は hideScrollProgress() で削除されるが、予期せぬエラー時の
  // 重複表示を考慮してダイアログ(2147483647)より低い値を使用

  progress.textContent = `スクロール中... ${scrollCount}/${maxDepth}`

  document.body.appendChild(progress)

  return progress
}

/**
 * スクロール進捗インジケーターを削除
 */
export const hideScrollProgress = (): void => {
  const progress = document.getElementById('diffsnap-scroll-progress')
  if (progress) {
    progress.remove()
  }
}
