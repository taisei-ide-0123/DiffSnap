/**
 * Content Script for DiffSnap
 * ページ側で実行され、画像を検出してBackgroundに送信します
 *
 * 機能:
 * - 画像検出エンジンの実行
 * - BackgroundへのIMAGES_DETECTEDメッセージ送信
 * - 自動スクロール（Phase 2で実装）
 */

import { detectImages } from './detector'
import type { ImagesDetectedMessage, BackgroundToContentMessage } from '../shared/types'

const DEBUG = import.meta.env.DEV

const log = (...args: unknown[]) => {
  if (DEBUG) {
    console.log('[DiffSnap Content]', ...args)
  }
}

/**
 * ページ読み込み完了時に画像検出を自動実行します
 */
const runDetection = () => {
  log('Starting image detection...')

  try {
    // 画像検出エンジン実行
    const candidates = detectImages()

    log(`Detected ${candidates.length} image candidates`)

    // BackgroundへIMAGES_DETECTEDメッセージ送信
    const message: ImagesDetectedMessage = {
      type: 'IMAGES_DETECTED',
      candidates,
    }

    chrome.runtime.sendMessage(message, (response) => {
      if (chrome.runtime.lastError) {
        log('Failed to send message:', chrome.runtime.lastError.message)
        return
      }

      log('Message sent successfully, response:', response)
    })
  } catch (error) {
    log('Detection error:', error)

    // Backgroundにエラー通知
    chrome.runtime.sendMessage(
      {
        type: 'DETECTION_ERROR',
        error: error instanceof Error ? error.message : String(error),
      },
      () => {
        if (chrome.runtime.lastError) {
          log('Failed to send error notification:', chrome.runtime.lastError.message)
        }
      }
    )
  }
}

/**
 * DOMContentLoadedまたはdocument_idle時に検出を開始
 */
if (document.readyState === 'loading') {
  // まだDOMが読み込み中
  document.addEventListener('DOMContentLoaded', runDetection)
} else {
  // DOMは既に読み込み済み（document_idleで実行される場合）
  runDetection()
}

/**
 * Background/Popupからのメッセージハンドラ
 * Phase 2でスクロール制御などを追加予定
 */
chrome.runtime.onMessage.addListener(
  (message: BackgroundToContentMessage, _sender, sendResponse) => {
    log('Received message:', message)

    // 将来の拡張用（スクロール制御など）
    if (message.type === 'START_SCROLL') {
      // Phase 2で実装
      sendResponse({ status: 'NOT_IMPLEMENTED' })
      return true // sendResponseを有効化
    }

    // 未知のメッセージタイプ
    return false
  }
)

log('Content script loaded')
