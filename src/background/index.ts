// Background Service Worker for DiffSnap
// Manifest V3 compliant

import type { ContentToBackgroundMessage } from '../shared/types'
import { initKeepAlive, handleKeepAliveAlarm } from './keep-alive'

console.log('DiffSnap background service worker initialized')

// Keep-Alive初期化（リトライ機構付き）
const initWithRetry = async (retries = 3): Promise<void> => {
  for (let i = 0; i < retries; i++) {
    try {
      await initKeepAlive()
      console.log('Keep-Alive initialized successfully')
      return
    } catch (err) {
      console.error(`Keep-Alive init attempt ${i + 1}/${retries} failed:`, err)
      if (i === retries - 1) {
        throw new Error(`Failed to initialize Keep-Alive after ${retries} attempts`)
      }
      // 指数バックオフでリトライ（1秒、2秒、3秒）
      await new Promise((resolve) => setTimeout(resolve, 1000 * (i + 1)))
    }
  }
}

initWithRetry().catch((err) => {
  console.error('Keep-Alive initialization failed permanently:', err)
  // 致命的エラー: Service Workerは30秒で停止する可能性あり
})

// Message handler
chrome.runtime.onMessage.addListener(
  (message: ContentToBackgroundMessage | { type: 'PING' }, sender, sendResponse) => {
    console.log('Background received message:', message)

    // Handle different message types
    if (message.type === 'PING') {
      sendResponse({ status: 'OK' })
      return true
    }

    if (message.type === 'IMAGES_DETECTED') {
      // 簡易ハンドラ（Issue #8で完全実装予定）
      // 候補配列の検証
      if (!message.candidates || !Array.isArray(message.candidates)) {
        console.error('Invalid IMAGES_DETECTED message:', message)
        sendResponse({ status: 'ERROR', error: 'Invalid candidates field' })
        return true
      }

      console.log(
        'Received IMAGES_DETECTED from tab:',
        sender.tab?.id,
        'count:',
        message.candidates.length
      )
      sendResponse({ status: 'OK', received: message.candidates.length })
      return true
    }

    if (message.type === 'DETECTION_ERROR') {
      console.error('Detection error from tab:', sender.tab?.id, 'error:', message.error)
      sendResponse({ status: 'OK' })
      return true
    }

    if (message.type === 'SCROLL_COMPLETE') {
      console.log('Scroll completed:', message.result)
      console.log(
        `  State: ${message.result.state}, Count: ${message.result.scrollCount}, ` +
          `Height: ${message.result.finalHeight}px, Elapsed: ${message.result.elapsed}ms`
      )
      sendResponse({ status: 'OK' })
      return true
    }

    if (message.type === 'SCROLL_TIMEOUT') {
      console.warn('Scroll timeout from tab:', sender.tab?.id)
      sendResponse({ status: 'OK' })
      return true
    }

    // 未知のメッセージタイプ
    console.warn('Unknown message type:', message)
    sendResponse({ status: 'ERROR', error: 'Unknown message type' })
    return true // sendResponseを使用するため非同期チャネルを有効化
  }
)

// Alarms listener for Keep-Alive
chrome.alarms.onAlarm.addListener((alarm) => {
  handleKeepAliveAlarm(alarm).catch((err) => {
    console.error('Keep-Alive alarm handler error:', err)
  })
})

// Extension installed/updated handler
chrome.runtime.onInstalled.addListener((details) => {
  console.log('DiffSnap installed/updated:', details.reason)

  if (details.reason === 'install') {
    console.log('First time installation')
  } else if (details.reason === 'update') {
    console.log('Extension updated')
  }
  // Keep-Alive初期化は起動時に一度実行されるため、ここでは不要
})
