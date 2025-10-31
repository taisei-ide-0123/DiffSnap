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
import type {
  ImagesDetectedMessage,
  BackgroundToContentMessage,
  ImageCandidate,
  ScrollResult,
} from '../shared/types'

const DEBUG = import.meta.env.DEV

const log = (...args: unknown[]) => {
  if (DEBUG) {
    console.log('[DiffSnap Content]', ...args)
  }
}

/**
 * Lazy Detection方式（Issue #72対応）
 *
 * 自動検出は行わず、Backgroundからの START_SCROLL メッセージを待機します。
 * これによりBackgroundの準備完了前にIMAGES_DETECTEDが送信される競合状態を回避します。
 *
 * フロー: ユーザークリック → START_COLLECTION → START_SCROLL → 画像検出開始
 * 詳細: https://github.com/taisei-ide-0123/DiffSnap/issues/72
 */

/**
 * IMAGES_DETECTEDメッセージを送信
 */
const sendImagesDetected = (candidates: ImageCandidate[]): void => {
  const message: ImagesDetectedMessage = {
    type: 'IMAGES_DETECTED',
    candidates,
  }

  chrome.runtime.sendMessage(message, (response) => {
    if (chrome.runtime.lastError) {
      log('Failed to send IMAGES_DETECTED:', chrome.runtime.lastError.message)
    } else {
      log('IMAGES_DETECTED sent successfully, response:', response)
    }
  })
}

/**
 * SCROLL_COMPLETEメッセージを送信
 */
const sendScrollComplete = (result: ScrollResult): void => {
  chrome.runtime.sendMessage({ type: 'SCROLL_COMPLETE', result }, () => {
    if (chrome.runtime.lastError) {
      log('Failed to send SCROLL_COMPLETE:', chrome.runtime.lastError.message)
    } else {
      log('SCROLL_COMPLETE sent successfully')
    }
  })
}

/**
 * DETECTION_ERRORメッセージを送信
 */
const sendDetectionError = (error: unknown): void => {
  chrome.runtime.sendMessage(
    {
      type: 'DETECTION_ERROR',
      error: error instanceof Error ? error.message : String(error),
    },
    () => {
      if (chrome.runtime.lastError) {
        log('Failed to send DETECTION_ERROR:', chrome.runtime.lastError.message)
      } else {
        log('DETECTION_ERROR sent successfully')
      }
    }
  )
}

/**
 * 画像検出を実行（スクロール有無に応じて）
 *
 * @param options - 検出オプション（enableScroll, maxDepth, timeout等）
 */
const runDetection = async (options: {
  enableScroll?: boolean
  maxDepth?: number
  timeout?: number
  scrollDelay?: number
}) => {
  log('Starting image detection...', { enableScroll: options.enableScroll })

  try {
    if (options.enableScroll) {
      // スクロール有効: 自動スクロールしてから画像検出
      log('Auto-scroll enabled, starting scroll...')
      const result = await autoScroll({
        maxDepth: options.maxDepth ?? 20,
        timeout: options.timeout ?? 15000,
        scrollDelay: options.scrollDelay ?? 500,
        onProgress: (scrollCount, state) => {
          log(`Scroll progress: ${scrollCount}, state: ${state}`)
          showScrollProgress(scrollCount, options.maxDepth ?? 20)
        },
        onMaxDepthReached: async () => {
          log('Max depth reached, showing dialog...')
          hideScrollProgress()
          const choice = await showMaxDepthDialog(options.maxDepth ?? 20)
          log('User choice:', choice)
          return choice
        },
      })

      log('Auto-scroll completed:', result)
      hideScrollProgress()

      const candidates = detectImages()
      log(`Detected ${candidates.length} images after scrolling`)

      sendImagesDetected(candidates)
      sendScrollComplete(result)
    } else {
      // スクロール無効: 即座に画像検出
      log('Auto-scroll disabled, detecting images immediately...')
      const candidates = detectImages()
      log(`Detected ${candidates.length} images without scrolling`)

      sendImagesDetected(candidates)
      // スクロール無効時はSCROLL_COMPLETEを送信しない
    }
  } catch (error) {
    log('Detection error:', error)
    sendDetectionError(error)
  } finally {
    hideScrollProgress()
  }
}

/**
 * Background/Popupからのメッセージハンドラ
 * 画像検出制御を実装
 */
chrome.runtime.onMessage.addListener(
  (message: BackgroundToContentMessage, _sender, sendResponse) => {
    log('Received message:', message)

    if (message.type === 'START_SCROLL') {
      // 画像検出実行（スクロール有無に応じて）
      runDetection({
        enableScroll: message.options?.enableScroll ?? false,
        maxDepth: message.options?.maxDepth ?? 20,
        timeout: message.options?.timeout ?? 15000,
        scrollDelay: message.options?.scrollDelay ?? 500,
      })

      sendResponse({ status: 'STARTED' })
      return true // 非同期チャネルを有効化
    }

    return false
  }
)

log('Content script loaded')
