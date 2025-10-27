// Background Service Worker for DiffSnap
// Manifest V3 compliant

import type { ContentToBackgroundMessage, PopupToBackgroundMessage } from '../shared/types'
import { initKeepAlive, handleKeepAliveAlarm } from './keep-alive'
import { handleMessage } from './message-router'
import { revokeAllManagedBlobUrls } from '../lib/blob-url-manager'

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
  (
    message: ContentToBackgroundMessage | PopupToBackgroundMessage | { type: 'PING' },
    sender,
    sendResponse
  ) => {
    return handleMessage(message, sender, sendResponse)
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

// Service Worker終了時のベストエフォート・クリーンアップ
// MV3では onSuspend は非推奨かつ確実性が低い（メモリ不足時やクラッシュ時は発火しない）
// BlobUrlManager のタイムアウトベース自動解放（60秒）と併用することでメモリリークを防ぐ
// このリスナーはバックアップ機能として位置づけ、主要な解放はタイムアウトに依存する
if (chrome.runtime.onSuspend) {
  chrome.runtime.onSuspend.addListener(() => {
    console.log('[BlobUrlManager] Service Worker suspending (best-effort cleanup)')
    revokeAllManagedBlobUrls()
  })
}
