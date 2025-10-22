// Background Service Worker for DiffSnap
// Manifest V3 compliant

import type { ContentToBackgroundMessage } from '../shared/types'

console.log('DiffSnap background service worker initialized')

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
      console.log(
        'Received IMAGES_DETECTED from tab:',
        sender.tab?.id,
        'count:',
        message.candidates?.length || 0
      )
      sendResponse({ status: 'OK', received: message.candidates?.length || 0 })
      return true
    }

    return true // Keep message channel open for async responses
  }
)

// Extension installed/updated handler
chrome.runtime.onInstalled.addListener((details) => {
  console.log('DiffSnap installed/updated:', details.reason)

  if (details.reason === 'install') {
    // First install
    console.log('First time installation')
  } else if (details.reason === 'update') {
    // Extension updated
    console.log('Extension updated')
  }
})
