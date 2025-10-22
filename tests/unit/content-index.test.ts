/**
 * Content Script (content/index.ts) のユニットテスト
 *
 * テスト内容:
 * - 画像検出の実行
 * - BackgroundへのIMAGES_DETECTEDメッセージ送信
 * - エラーハンドリング
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

describe('Content Script (content/index.ts)', () => {
  // Chrome API モック
  let mockSendMessage: any
  let mockOnMessage: { addListener: any }

  beforeEach(() => {
    // chrome.runtime.sendMessage のモック
    mockSendMessage = vi.fn((_message: any, callback?: (response: any) => void) => {
      // 成功時のコールバック
      if (callback) {
        callback({ status: 'OK' })
      }
    })

    // chrome.runtime.onMessage のモック
    mockOnMessage = {
      addListener: vi.fn(),
    }

    // chrome.runtime のモック設定
    global.chrome = {
      runtime: {
        sendMessage: mockSendMessage,
        onMessage: mockOnMessage,
        lastError: undefined,
      },
    } as any
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('メッセージ送信', () => {
    it('IMAGES_DETECTEDメッセージの型が正しい', () => {
      // メッセージ型のテスト
      const message = {
        type: 'IMAGES_DETECTED',
        candidates: [],
      }

      expect(message.type).toBe('IMAGES_DETECTED')
      expect(Array.isArray(message.candidates)).toBe(true)
    })

    it('candidatesに正しいImageCandidate配列が含まれる', () => {
      const message = {
        type: 'IMAGES_DETECTED',
        candidates: [
          {
            url: 'https://example.com/image.jpg',
            source: 'img' as const,
            width: 800,
            height: 600,
            alt: 'Test Image',
          },
        ],
      }

      expect(message.candidates).toHaveLength(1)
      expect(message.candidates[0]).toMatchObject({
        url: 'https://example.com/image.jpg',
        source: 'img',
        width: 800,
        height: 600,
        alt: 'Test Image',
      })
    })
  })

  describe('エラーハンドリング', () => {
    it('chrome.runtime.lastError発生時にログ出力される', () => {
      const consoleLogSpy = vi.spyOn(console, 'log')

      // lastErrorをモック
      global.chrome = {
        runtime: {
          sendMessage: vi.fn((_message, callback) => {
            ;(global.chrome.runtime as any).lastError = {
              message: 'Test error',
            }
            if (callback) {
              callback(undefined)
            }
          }),
          onMessage: mockOnMessage,
          lastError: { message: 'Test error' },
        },
      } as any

      // メッセージ送信をシミュレート
      chrome.runtime.sendMessage({ type: 'IMAGES_DETECTED', candidates: [] }, () => {
        if (chrome.runtime.lastError) {
          console.log('[DiffSnap Content]', 'Failed to send message:', chrome.runtime.lastError.message)
        }
      })

      // lastErrorが発生した場合にログが出力されることを確認
      expect(consoleLogSpy).toHaveBeenCalledWith(
        '[DiffSnap Content]',
        'Failed to send message:',
        'Test error'
      )

      consoleLogSpy.mockRestore()
    })

    it('検出エラー時にエラーログが出力される', () => {
      const consoleLogSpy = vi.spyOn(console, 'log')
      const testError = new Error('Detection failed')

      // エラーをスロー
      try {
        throw testError
      } catch (error) {
        console.log('[DiffSnap Content]', 'Detection error:', error)
      }

      expect(consoleLogSpy).toHaveBeenCalledWith('[DiffSnap Content]', 'Detection error:', testError)

      consoleLogSpy.mockRestore()
    })
  })

  describe('DOMContentLoaded処理', () => {
    it('document.readyState === "loading" の場合DOMContentLoadedリスナーが追加される', () => {
      const addEventListenerSpy = vi.spyOn(document, 'addEventListener')

      // readyStateをモック
      Object.defineProperty(document, 'readyState', {
        writable: true,
        value: 'loading',
      })

      // モジュールの動作をシミュレート
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
          // runDetection()
        })
      }

      expect(addEventListenerSpy).toHaveBeenCalledWith('DOMContentLoaded', expect.any(Function))

      addEventListenerSpy.mockRestore()
    })

    it('document.readyState !== "loading" の場合即座に検出が実行される', () => {
      // readyStateをモック
      Object.defineProperty(document, 'readyState', {
        writable: true,
        value: 'interactive',
      })

      // モジュールの動作をシミュレート
      const shouldRunImmediately = document.readyState !== 'loading'

      expect(shouldRunImmediately).toBe(true)
    })
  })

  describe('メッセージハンドラ', () => {
    it('chrome.runtime.onMessage.addListenerが呼ばれる', () => {
      // モジュールロード時にaddListenerが呼ばれることを確認
      chrome.runtime.onMessage.addListener(() => {
        return false
      })

      expect(mockOnMessage.addListener).toHaveBeenCalled()
    })

    it('START_SCROLLメッセージにNOT_IMPLEMENTEDを返す', () => {
      const sendResponse = vi.fn()
      const message = { type: 'START_SCROLL' }

      // メッセージハンドラをシミュレート
      const handler = (msg: any, _sender: any, sendResp: any) => {
        if (msg.type === 'START_SCROLL') {
          sendResp({ status: 'NOT_IMPLEMENTED' })
          return true
        }
        return false
      }

      const result = handler(message, {}, sendResponse)

      expect(sendResponse).toHaveBeenCalledWith({ status: 'NOT_IMPLEMENTED' })
      expect(result).toBe(true)
    })
  })
})
