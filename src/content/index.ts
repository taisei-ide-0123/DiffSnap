/**
 * Content Script for DiffSnap
 * ページ側で実行され、画像を検出してBackgroundに送信します
 *
 * 機能:
 * - 画像検出エンジンの実行
 * - BackgroundへのIMAGES_DETECTEDメッセージ送信
 * - 自動スクロール（無限スクロール対応）
 */

import { detectImages } from './detector'
import { autoScroll } from './lazy-loader'
import { showMaxDepthDialog, showScrollProgress, hideScrollProgress } from './scroll-ui'
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
 * 自動スクロールを実行して画像を再検出
 *
 * @param options - スクロールオプション（maxDepth, timeout等）
 */
const runScrollAndDetect = async (options: {
  maxDepth?: number
  timeout?: number
  scrollDelay?: number
}) => {
  log('Starting auto-scroll...')

  try {
    // 自動スクロール実行
    const result = await autoScroll({
      maxDepth: options.maxDepth || 20,
      timeout: options.timeout || 15000,
      scrollDelay: options.scrollDelay || 500,
      onProgress: (scrollCount, state) => {
        log(`Scroll progress: ${scrollCount}, state: ${state}`)
        showScrollProgress(scrollCount, options.maxDepth || 20)
      },
      onMaxDepthReached: async () => {
        log('Max depth reached, showing dialog...')
        hideScrollProgress()
        const choice = await showMaxDepthDialog(options.maxDepth || 20)
        log('User choice:', choice)
        return choice
      },
    })

    // 進捗インジケーター削除
    hideScrollProgress()

    log('Auto-scroll completed:', result)

    // スクロール完了後、画像を再検出
    const candidates = detectImages()
    log(`Re-detected ${candidates.length} images after scrolling`)

    // Backgroundに結果を送信
    const message: ImagesDetectedMessage = {
      type: 'IMAGES_DETECTED',
      candidates,
    }

    chrome.runtime.sendMessage(message, (response) => {
      if (chrome.runtime.lastError) {
        log('Failed to send message:', chrome.runtime.lastError.message)
        return
      }

      log('Scroll complete message sent, response:', response)
    })

    // スクロール完了通知
    chrome.runtime.sendMessage(
      {
        type: 'SCROLL_COMPLETE',
        result,
      },
      () => {
        if (chrome.runtime.lastError) {
          log('Failed to send SCROLL_COMPLETE:', chrome.runtime.lastError.message)
        }
      }
    )
  } catch (error) {
    log('Auto-scroll error:', error)

    // エラー通知
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

    // 進捗インジケーター削除
    hideScrollProgress()
  }
}

/**
 * Background/Popupからのメッセージハンドラ
 * スクロール制御を実装
 */
chrome.runtime.onMessage.addListener(
  (message: BackgroundToContentMessage, _sender, sendResponse) => {
    log('Received message:', message)

    if (message.type === 'START_SCROLL') {
      // 自動スクロール実行（非同期）
      runScrollAndDetect({
        maxDepth: 20,
        timeout: 15000,
        scrollDelay: 500,
      })

      sendResponse({ status: 'STARTED' })
      return true // 非同期チャネルを有効化
    }

    return false
  }
)

log('Content script loaded')
