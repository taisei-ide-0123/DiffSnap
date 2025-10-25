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
  BackgroundToContentMessage,
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

      // TODO(Issue #13): 収集オーケストレーター連携実装
      //   - 受信したcandidatesをIndexedDBに保存
      //   - collectorOrchestrator.start(tabId, candidates)を呼び出し
      //   - 進捗をsendStateUpdate()で通知
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
        count: message.failedImages.length,
        failedImages: message.failedImages,
      })

      // Issue #17: エラーハンドリング実装完了
      // UIからの再試行リクエストを受信
      // 実際の収集処理はIssue #13のCollectorオーケストレーター実装時に統合
      // 現在は受信確認のみ（Collector.retryFailed()メソッドは実装済み）
      sendResponse({
        status: 'OK',
        message: 'Retry request received',
        retryCount: message.failedImages.length,
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
 *
 * @param message - メッセージオブジェクト
 * @param sender - 送信元情報
 * @param sendResponse - レスポンス送信関数
 * @returns 非同期チャネルを使用する場合はtrue
 *
 * @example
 * chrome.runtime.onMessage.addListener((msg, sender, respond) => {
 *   return handleMessage(msg, sender, respond)
 * })
 */
export const handleMessage = (
  message: ContentToBackgroundMessage | PopupToBackgroundMessage | { type: 'PING' },
  sender: chrome.runtime.MessageSender,
  sendResponse: (response?: unknown) => void
): boolean => {
  const senderInfo = sender.tab?.id
    ? `tab:${sender.tab.id}`
    : sender.url?.includes('popup.html')
      ? 'popup'
      : 'unknown'
  console.log('Background received message:', message.type, 'from:', senderInfo)

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
    return (
      handleContentMessage(message as ContentToBackgroundMessage, sender, sendResponse) ?? true
    )
  }

  // Popupからのメッセージ
  if (
    message.type === 'START_COLLECTION' ||
    message.type === 'RETRY_FAILED' ||
    message.type === 'CHECK_DIFF'
  ) {
    return (
      handlePopupMessage(message as PopupToBackgroundMessage, sender, sendResponse) ?? true
    )
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
 *
 * @param state - 送信する実行状態
 *
 * @example
 * await sendStateUpdate({ status: 'collecting', progress: 50 })
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
    const isPopupClosed = (error as Error).message?.includes('Receiving end does not exist')
    if (isPopupClosed) {
      // Popup未起動時は正常（エラーログ不要）
      return
    }
    console.error('Failed to send STATE_UPDATE:', error)
  }
}

/**
 * DIFF_RESULTメッセージをPopupに送信
 *
 * @param newImages - 新規に検出された画像のスナップショット
 * @param existingImages - 既存の画像スナップショット
 * @param isFirstVisit - 初回訪問かどうか
 *
 * @example
 * await sendDiffResult([newImage1, newImage2], [existingImage1], false)
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
    const isPopupClosed = (error as Error).message?.includes('Receiving end does not exist')
    if (isPopupClosed) {
      return
    }
    console.error('Failed to send DIFF_RESULT:', error)
  }
}

/**
 * ZIP_READYメッセージをPopupに送信
 *
 * @param downloadId - ChromeダウンロードID
 *
 * @example
 * await sendZipReady(12345)
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
    const isPopupClosed = (error as Error).message?.includes('Receiving end does not exist')
    if (isPopupClosed) {
      return
    }
    console.error('Failed to send ZIP_READY:', error)
  }
}

/**
 * Content Scriptへメッセージを送信
 *
 * @param tabId - 送信先のタブID
 * @param message - 送信するメッセージ（BackgroundToContentMessage型）
 * @throws メッセージ送信に失敗した場合
 *
 * @example
 * await sendToContent(123, { type: 'START_SCROLL', options: { maxDepth: 20 } })
 */
export const sendToContent = async (
  tabId: number,
  message: BackgroundToContentMessage
): Promise<void> => {
  try {
    await chrome.tabs.sendMessage(tabId, message)
    console.log('Message sent to content script:', { tabId, type: message.type })
  } catch (error) {
    console.error('Failed to send message to content script:', error)
    throw error
  }
}
