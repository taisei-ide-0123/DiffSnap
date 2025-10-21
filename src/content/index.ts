// Content Script for DiffSnap
// Runs in the context of web pages

console.log('DiffSnap content script loaded')

// Message handler from popup/background
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  console.log('Content script received message:', message)

  if (message.type === 'DETECT_IMAGES') {
    // Placeholder for image detection logic
    sendResponse({ status: 'OK', images: [] })
  }

  return true // Keep message channel open for async responses
})

// Send ping to background to verify connection
chrome.runtime.sendMessage({ type: 'PING' }, (response) => {
  console.log('Content script connected to background:', response)
})
