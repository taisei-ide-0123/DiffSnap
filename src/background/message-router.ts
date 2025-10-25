/**
 * Message Router for Background Service Worker
 *
 * このモジュールはContent ScriptやPopupからのメッセージを受信し、
 * 適切なハンドラに振り分けます。
 *
 * メッセージフロー:
 * - Content → Background: 画像検出、スクロール完了、エラー通知
 * - Popup → Background: 収集開始、リトライ、差分チェック
 * - Background → Popup: 状態更新、差分結果、ZIP準備完了
 */

import type {
  ContentToBackgroundMessage,
  PopupToBackgroundMessage,
  BackgroundToPopupMessage,
  RunState,
  ImageSnapshot,
} from '../shared/types'

/**
 * メッセージハンドラの型定義
 */
type MessageHandler<T> = (
  message: T,
  sender: chrome.runtime.MessageSender,
  sendResponse: (response?: unknown) => void
) => boolean | void

/**
 * Content Scriptからのメッセージハンドラ
 */
const handleContentMessage: MessageHandler<ContentToBackgroundMessage> = (
  message,
  sender,
  sendResponse
) => {
  const tabId = sender.tab?.id

  switch (message.type) {
    case 'IMAGES_DETECTED': {
      // 候補配列の検証
      if (!message.candidates || !Array.isArray(message.candidates)) {
        console.error('Invalid IMAGES_DETECTED message:', message)
        sendResponse({ status: 'ERROR', error: 'Invalid candidates field' })
        return true
      }

      console.log(
        'Received IMAGES_DETECTED from tab:',
        tabId,
        'count:',
        message.candidates.length
      )

      // TODO: Issue #13で収集オーケストレーター連携実装
      // 現在は単純なACK応答のみ
      sendResponse({ status: 'OK', received: message.candidates.length })
      return true
    }

    case 'SCROLL_COMPLETE': {
      console.log('Scroll completed:', message.result)
      console.log(
        `  State: ${message.result.state}, Count: ${message.result.scrollCount}, ` +
          `Height: ${message.result.finalHeight}px, Elapsed: ${message.result.elapsed}ms`
      )

      // TODO: Issue #13で収集オーケストレーター連携実装
      sendResponse({ status: 'OK' })
      return true
    }

    case 'SCROLL_TIMEOUT': {
      console.warn('Scroll timeout from tab:', tabId)

      // TODO: Issue #13でタイムアウト処理実装
      sendResponse({ status: 'OK' })
      return true
    }

    case 'DETECTION_ERROR': {
      console.error('Detection error from tab:', tabId, 'error:', message.error)

      // TODO: Issue #13でエラーハンドリング実装
      sendResponse({ status: 'OK' })
      return true
    }

    default: {
      // 型安全性チェック（到達不可能）
      const _exhaustive: never = message
      console.warn('Unknown content message type:', _exhaustive)
      sendResponse({ status: 'ERROR', error: 'Unknown message type' })
      return true
    }
  }
}

/**
 * Popupからのメッセージハンドラ
 */
const handlePopupMessage: MessageHandler<PopupToBackgroundMessage> = (
  message,
  _sender,
  sendResponse
) => {
  switch (message.type) {
    case 'START_COLLECTION': {
      console.log('START_COLLECTION request:', {
        tabId: message.tabId,
        options: message.options,
      })

      // TODO: Issue #13で収集オーケストレーター実装
      // 現在は仮実装
      sendResponse({
        status: 'OK',
        message: 'Collection started (placeholder)',
      })
      return true
    }

    case 'RETRY_FAILED': {
      console.log('RETRY_FAILED request:', {
        count: message.urls.length,
        urls: message.urls,
      })

      // TODO: Issue #13でリトライ機構実装
      sendResponse({
        status: 'OK',
        message: 'Retry queued (placeholder)',
      })
      return true
    }

    case 'CHECK_DIFF': {
      console.log('CHECK_DIFF request:', { url: message.url })

      // TODO: Issue #14で差分エンジン実装
      sendResponse({
        status: 'OK',
        message: 'Diff check started (placeholder)',
      })
      return true
    }

    default: {
      // 型安全性チェック（到達不可能）
      const _exhaustive: never = message
      console.warn('Unknown popup message type:', _exhaustive)
      sendResponse({ status: 'ERROR', error: 'Unknown message type' })
      return true
    }
  }
}

/**
 * メッセージルーターのメインハンドラ
 *
 * Content ScriptとPopupの両方からのメッセージを受け付け、
 * 適切なハンドラに振り分けます。
 */
export const handleMessage = (
  message: ContentToBackgroundMessage | PopupToBackgroundMessage | { type: 'PING' },
  sender: chrome.runtime.MessageSender,
  sendResponse: (response?: unknown) => void
): boolean => {
  console.log('Background received message:', message.type, 'from:', sender.tab?.id ?? 'popup')

  // PINGメッセージ（接続確認用）
  if (message.type === 'PING') {
    sendResponse({ status: 'OK', timestamp: Date.now() })
    return true
  }

  // Content Scriptからのメッセージ
  if (
    message.type === 'IMAGES_DETECTED' ||
    message.type === 'SCROLL_COMPLETE' ||
    message.type === 'SCROLL_TIMEOUT' ||
    message.type === 'DETECTION_ERROR'
  ) {
    return handleContentMessage(message as ContentToBackgroundMessage, sender, sendResponse) ?? true
  }

  // Popupからのメッセージ
  if (
    message.type === 'START_COLLECTION' ||
    message.type === 'RETRY_FAILED' ||
    message.type === 'CHECK_DIFF'
  ) {
    return handlePopupMessage(message as PopupToBackgroundMessage, sender, sendResponse) ?? true
  }

  // 未知のメッセージタイプ
  console.warn('Unknown message type:', message)
  sendResponse({ status: 'ERROR', error: 'Unknown message type' })
  return true
}

/**
 * Popup向けメッセージ送信ヘルパー関数群
 */

/**
 * STATE_UPDATEメッセージをPopupに送信
 */
export const sendStateUpdate = async (state: RunState): Promise<void> => {
  const message: BackgroundToPopupMessage = {
    type: 'STATE_UPDATE',
    state,
  }

  try {
    await chrome.runtime.sendMessage(message)
    console.log('STATE_UPDATE sent to popup:', state.status)
  } catch (error) {
    // Popupが開いていない場合はエラーになるが、無視して良い
    if ((error as Error).message?.includes('Receiving end does not exist')) {
      // Popup未起動時は正常（エラーログ不要）
      return
    }
    console.error('Failed to send STATE_UPDATE:', error)
  }
}

/**
 * DIFF_RESULTメッセージをPopupに送信
 */
export const sendDiffResult = async (
  newImages: ImageSnapshot[],
  existingImages: ImageSnapshot[],
  isFirstVisit: boolean
): Promise<void> => {
  const message: BackgroundToPopupMessage = {
    type: 'DIFF_RESULT',
    new: newImages,
    existing: existingImages,
    isFirstVisit,
  }

  try {
    await chrome.runtime.sendMessage(message)
    console.log('DIFF_RESULT sent to popup:', {
      new: newImages.length,
      existing: existingImages.length,
      isFirstVisit,
    })
  } catch (error) {
    if ((error as Error).message?.includes('Receiving end does not exist')) {
      return
    }
    console.error('Failed to send DIFF_RESULT:', error)
  }
}

/**
 * ZIP_READYメッセージをPopupに送信
 */
export const sendZipReady = async (downloadId: number): Promise<void> => {
  const message: BackgroundToPopupMessage = {
    type: 'ZIP_READY',
    downloadId,
  }

  try {
    await chrome.runtime.sendMessage(message)
    console.log('ZIP_READY sent to popup, downloadId:', downloadId)
  } catch (error) {
    if ((error as Error).message?.includes('Receiving end does not exist')) {
      return
    }
    console.error('Failed to send ZIP_READY:', error)
  }
}

/**
 * Content Scriptへメッセージを送信
 */
export const sendToContent = async <T>(tabId: number, message: T): Promise<void> => {
  try {
    await chrome.tabs.sendMessage(tabId, message)
    console.log('Message sent to content script:', { tabId, type: (message as { type: string }).type })
  } catch (error) {
    console.error('Failed to send message to content script:', error)
    throw error
  }
}
