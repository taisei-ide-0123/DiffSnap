/**
 * Message Router テストスイート
 *
 * このファイルはメッセージルーターの各ハンドラが
 * 正しく動作することを検証します。
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  handleMessage,
  sendStateUpdate,
  sendDiffResult,
  sendZipReady,
  sendToContent,
  activeCollections,
} from './message-router'
import type { RunState } from '../shared/types'
import type {
  ImagesDetectedMessage,
  ScrollCompleteMessage,
  ScrollTimeoutMessage,
  DetectionErrorMessage,
  StartCollectionMessage,
  RetryFailedMessage,
  CheckDiffMessage,
  ImageCandidate,
} from '../shared/types'

describe('Message Router', () => {
  let mockSendResponse: ReturnType<typeof vi.fn>
  let mockSender: chrome.runtime.MessageSender

  beforeEach(() => {
    mockSendResponse = vi.fn()
    mockSender = {
      tab: {
        id: 123,
      },
    } as chrome.runtime.MessageSender

    // console.logをモック
    vi.spyOn(console, 'log').mockImplementation(() => {})
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    // テスト間で状態をクリーンアップ
    activeCollections.clear()
  })

  describe('Content Script Messages', () => {
    beforeEach(() => {
      // chrome APIのモック
      global.chrome = {
        tabs: {
          get: vi.fn().mockResolvedValue({
            id: 123,
            url: 'https://example.com',
          }),
        },
      } as unknown as typeof chrome
    })

    it('should handle IMAGES_DETECTED message', () => {
      const tabId = 123

      // START_COLLECTIONで作成される状態を事前にセットアップ
      activeCollections.set(tabId, {
        tabId,
        url: 'https://example.com',
        candidates: [],
        options: {
          enableScroll: false,
          maxScrollDepth: 20,
          scrollTimeout: 15000,
        },
        startedAt: Date.now(),
      })

      const candidates: ImageCandidate[] = [
        {
          url: 'https://example.com/image1.jpg',
          source: 'img',
          width: 800,
          height: 600,
        },
        {
          url: 'https://example.com/image2.jpg',
          source: 'css-bg',
          width: 1200,
          height: 900,
        },
      ]

      const message: ImagesDetectedMessage = {
        type: 'IMAGES_DETECTED',
        candidates,
      }

      const result = handleMessage(message, mockSender, mockSendResponse)

      expect(result).toBe(true) // 非同期チャネルを使用
      expect(mockSendResponse).toHaveBeenCalledWith({
        status: 'OK',
        received: 2,
      })
    })

    it('should reject invalid IMAGES_DETECTED message', () => {
      const message = {
        type: 'IMAGES_DETECTED',
        candidates: null, // Invalid
      } as unknown as ImagesDetectedMessage

      const result = handleMessage(message, mockSender, mockSendResponse)

      expect(result).toBe(true)
      expect(mockSendResponse).toHaveBeenCalledWith({
        status: 'ERROR',
        error: 'Invalid candidates field',
      })
    })

    it('should handle SCROLL_COMPLETE message', () => {
      const message: ScrollCompleteMessage = {
        type: 'SCROLL_COMPLETE',
        result: {
          state: 'BOTTOM_REACHED',
          scrollCount: 15,
          finalHeight: 12000,
          elapsed: 8500,
        },
      }

      const result = handleMessage(message, mockSender, mockSendResponse)

      expect(result).toBe(true)
      expect(mockSendResponse).toHaveBeenCalledWith({ status: 'OK' })
    })

    it('should handle SCROLL_TIMEOUT message', () => {
      const message: ScrollTimeoutMessage = {
        type: 'SCROLL_TIMEOUT',
      }

      const result = handleMessage(message, mockSender, mockSendResponse)

      expect(result).toBe(true)
      expect(mockSendResponse).toHaveBeenCalledWith({ status: 'OK' })
    })

    it('should handle DETECTION_ERROR message', () => {
      const message: DetectionErrorMessage = {
        type: 'DETECTION_ERROR',
        error: 'Failed to parse DOM',
      }

      const result = handleMessage(message, mockSender, mockSendResponse)

      expect(result).toBe(true)
      expect(mockSendResponse).toHaveBeenCalledWith({ status: 'OK' })
    })
  })

  describe('Popup Messages', () => {
    beforeEach(() => {
      // chrome APIのモック（sendMessage以外も追加）
      global.chrome = {
        runtime: {
          sendMessage: vi.fn().mockResolvedValue(undefined),
        },
        tabs: {
          get: vi.fn().mockResolvedValue({
            id: 123,
            url: 'https://example.com',
          }),
          query: vi.fn().mockResolvedValue([{ id: 123, url: 'https://example.com' }]),
          sendMessage: vi.fn().mockResolvedValue(undefined),
        },
        downloads: {
          download: vi.fn().mockResolvedValue(12345),
        },
        storage: {
          sync: {
            get: vi.fn().mockResolvedValue({ namingTemplate: '{date}-{domain}-{index}' }),
          },
          local: {
            get: vi.fn().mockResolvedValue({}),
            set: vi.fn().mockResolvedValue(undefined),
          },
        },
      } as unknown as typeof chrome
    })

    it('should handle START_COLLECTION message', () => {
      // 別のtabIdを使用してIMAGES_DETECTEDテストとの競合を避ける
      const uniqueTabId = 999
      const message: StartCollectionMessage = {
        type: 'START_COLLECTION',
        tabId: uniqueTabId,
        options: {
          enableScroll: true,
          maxScrollDepth: 20,
          scrollTimeout: 15000,
        },
      }

      // chrome.tabs.getのモックを更新
      vi.mocked(chrome.tabs.get).mockResolvedValue({
        id: uniqueTabId,
        url: 'https://example.com',
      } as chrome.tabs.Tab)

      const result = handleMessage(message, mockSender, mockSendResponse)

      expect(result).toBe(true)
      expect(mockSendResponse).toHaveBeenCalledWith({
        status: 'OK',
        message: 'Collection request accepted',
      })
    })

    it('should handle RETRY_FAILED message', () => {
      const message: RetryFailedMessage = {
        type: 'RETRY_FAILED',
        failedImages: [
          {
            url: 'https://example.com/image1.jpg',
            error: 'CORS error',
            errorType: 'CORS',
            retryCount: 0,
            source: 'img',
          },
          {
            url: 'https://example.com/image2.jpg',
            error: 'Timeout',
            errorType: 'TIMEOUT',
            retryCount: 0,
            source: 'img',
          },
        ],
      }

      const result = handleMessage(message, mockSender, mockSendResponse)

      expect(result).toBe(true)
      expect(mockSendResponse).toHaveBeenCalledWith({
        status: 'OK',
        message: 'Retry request received',
        retryCount: 2,
      })
    })

    it('should handle CHECK_DIFF message', () => {
      const message: CheckDiffMessage = {
        type: 'CHECK_DIFF',
        url: 'https://example.com/products',
      }

      const result = handleMessage(message, mockSender, mockSendResponse)

      expect(result).toBe(true)
      expect(mockSendResponse).toHaveBeenCalledWith({
        status: 'OK',
        message: 'Diff check started (placeholder)',
      })
    })
  })

  describe('Special Messages', () => {
    it('should handle PING message', () => {
      const message = { type: 'PING' as const }

      const result = handleMessage(message, mockSender, mockSendResponse)

      expect(result).toBe(true)
      expect(mockSendResponse).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'OK',
          timestamp: expect.any(Number),
        })
      )
    })

    it('should handle unknown message type', () => {
      const message = { type: 'UNKNOWN_TYPE' as const }

      const result = handleMessage(
        message as unknown as { type: 'PING' },
        mockSender,
        mockSendResponse
      )

      expect(result).toBe(true)
      expect(mockSendResponse).toHaveBeenCalledWith({
        status: 'ERROR',
        error: 'Unknown message type',
      })
    })
  })

  describe('Helper Functions', () => {
    beforeEach(() => {
      // chrome.runtime.sendMessageとchrome.tabs.sendMessageをモック
      global.chrome = {
        runtime: {
          sendMessage: vi.fn().mockResolvedValue(undefined),
        },
        tabs: {
          sendMessage: vi.fn().mockResolvedValue(undefined),
        },
      } as unknown as typeof chrome
    })

    describe('sendStateUpdate', () => {
      it('should send STATE_UPDATE message', async () => {
        const state: RunState = {
          tabId: 1,
          status: 'fetching' as const,
          total: 100,
          completed: 50,
          failed: [],
          zipSize: 0,
        }

        await sendStateUpdate(state)

        expect(chrome.runtime.sendMessage).toHaveBeenCalledWith({
          type: 'STATE_UPDATE',
          state,
        })
      })

      it('should handle popup not open error gracefully', async () => {
        const error = new Error('Receiving end does not exist')
        vi.mocked(chrome.runtime.sendMessage).mockRejectedValue(error)

        const state: RunState = {
          tabId: 1,
          status: 'idle' as const,
          total: 0,
          completed: 0,
          failed: [],
          zipSize: 0,
        }

        // エラーをスローせずに完了すべき
        await expect(sendStateUpdate(state)).resolves.toBeUndefined()
      })

      it('should log other errors', async () => {
        const error = new Error('Network error')
        vi.mocked(chrome.runtime.sendMessage).mockRejectedValue(error)
        const consoleErrorSpy = vi.spyOn(console, 'error')

        const state: RunState = {
          tabId: 1,
          status: 'error' as const,
          total: 0,
          completed: 0,
          failed: [],
          zipSize: 0,
        }

        await sendStateUpdate(state)

        expect(consoleErrorSpy).toHaveBeenCalledWith('Failed to send STATE_UPDATE:', error)
      })
    })

    describe('sendDiffResult', () => {
      it('should send DIFF_RESULT message', async () => {
        const newImages = [
          {
            hash: 'abc123',
            url: 'https://example.com/new.jpg',
            width: 800,
            height: 600,
            firstSeenAt: Date.now(),
          },
        ]
        const existingImages = [
          {
            hash: 'def456',
            url: 'https://example.com/old.jpg',
            width: 1024,
            height: 768,
            firstSeenAt: Date.now() - 86400000,
          },
        ]

        await sendDiffResult(newImages, existingImages, false)

        expect(chrome.runtime.sendMessage).toHaveBeenCalledWith({
          type: 'DIFF_RESULT',
          new: newImages,
          existing: existingImages,
          isFirstVisit: false,
        })
      })
    })

    describe('sendZipReady', () => {
      it('should send ZIP_READY message', async () => {
        const downloadId = 12345

        await sendZipReady(downloadId)

        expect(chrome.runtime.sendMessage).toHaveBeenCalledWith({
          type: 'ZIP_READY',
          downloadId,
        })
      })
    })

    describe('sendToContent', () => {
      it('should send message to content script', async () => {
        const tabId = 123
        const message = {
          type: 'START_SCROLL' as const,
          options: {
            maxDepth: 20,
            timeout: 15000,
          },
        }

        await sendToContent(tabId, message)

        expect(chrome.tabs.sendMessage).toHaveBeenCalledWith(tabId, message)
      })

      it('should throw error when message sending fails', async () => {
        const error = new Error('Tab not found')
        vi.mocked(chrome.tabs.sendMessage).mockRejectedValue(error)

        const tabId = 999
        const message = {
          type: 'START_SCROLL' as const,
        }

        await expect(sendToContent(tabId, message)).rejects.toThrow('Tab not found')
      })

      it('should log message type and tabId', async () => {
        const consoleLogSpy = vi.spyOn(console, 'log')
        const tabId = 456
        const message = {
          type: 'START_SCROLL' as const,
        }

        await sendToContent(tabId, message)

        expect(consoleLogSpy).toHaveBeenCalledWith('Message sent to content script:', {
          tabId,
          type: 'START_SCROLL',
        })
      })
    })
  })
})
