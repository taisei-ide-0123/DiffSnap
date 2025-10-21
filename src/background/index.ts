// Background Service Worker for DiffSnap
// Manifest V3 compliant

console.log('DiffSnap background service worker initialized');

// Message handler
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  console.log('Background received message:', message);

  // Handle different message types
  if (message.type === 'PING') {
    sendResponse({ status: 'OK' });
  }

  return true; // Keep message channel open for async responses
});

// Extension installed/updated handler
chrome.runtime.onInstalled.addListener((details) => {
  console.log('DiffSnap installed/updated:', details.reason);

  if (details.reason === 'install') {
    // First install
    console.log('First time installation');
  } else if (details.reason === 'update') {
    // Extension updated
    console.log('Extension updated');
  }
});
