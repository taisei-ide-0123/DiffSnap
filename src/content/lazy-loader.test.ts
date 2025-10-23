import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { autoScroll, getScrollStateMessage, type ScrollState } from './lazy-loader'

describe('lazy-loader', () => {
  // モック用のタイマー
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.useRealTimers()
  })

  describe('autoScroll', () => {
    it('最下部到達時にBOTTOM_REACHEDを返す', async () => {
      // 固定高さのドキュメントをモック
      const mockScrollHeight = 1000
      Object.defineProperty(document.documentElement, 'scrollHeight', {
        configurable: true,
        get: () => mockScrollHeight,
      })

      // window.scrollToをモック
      // Note: window.scrollToは複雑なオーバーロード型のため、anyキャストが必要
      // 実行時の動作には影響しないため、テストでは許容可能
      window.scrollTo = vi.fn() as any

      const promise = autoScroll({ scrollDelay: 100 })

      // タイマーを進めて3回の判定をシミュレート
      for (let i = 0; i < 3; i++) {
        await vi.advanceTimersByTimeAsync(100)
      }

      const result = await promise

      expect(result.state).toBe('BOTTOM_REACHED')
      expect(result.scrollCount).toBeGreaterThan(0)
      expect(window.scrollTo).toHaveBeenCalledWith(0, 0) // トップ復帰確認
    })

    it('タイムアウト時にTIMEOUT_REACHEDを返す', async () => {
      // 無限に高さが増えるドキュメントをモック
      let scrollHeight = 1000
      Object.defineProperty(document.documentElement, 'scrollHeight', {
        configurable: true,
        get: () => {
          scrollHeight += 100
          return scrollHeight
        },
      })

      window.scrollTo = vi.fn() as any // オーバーロード型対応

      const promise = autoScroll({ timeout: 1000, scrollDelay: 100 })

      // タイムアウトまでタイマーを進める
      await vi.advanceTimersByTimeAsync(1100)

      const result = await promise

      expect(result.state).toBe('TIMEOUT_REACHED')
    })

    it('最大深度到達時にMAX_DEPTH_REACHEDを返す（コールバックなし）', async () => {
      // 無限に高さが増えるドキュメントをモック
      let scrollHeight = 1000
      Object.defineProperty(document.documentElement, 'scrollHeight', {
        configurable: true,
        get: () => {
          scrollHeight += 100
          return scrollHeight
        },
      })

      window.scrollTo = vi.fn() as any // オーバーロード型対応

      const promise = autoScroll({ maxDepth: 5, scrollDelay: 100, timeout: 10000 })

      // 5回分のスクロールをシミュレート
      for (let i = 0; i < 5; i++) {
        await vi.advanceTimersByTimeAsync(100)
      }

      const result = await promise

      expect(result.state).toBe('BOTTOM_REACHED') // コールバックなしの場合は停止
      expect(result.scrollCount).toBe(5)
    })

    it('最大深度到達時にユーザーがcontinueを選択すると継続する', async () => {
      // 無限に高さが増えるドキュメントをモック（7回で固定）
      let scrollHeight = 1000
      let callCount = 0
      Object.defineProperty(document.documentElement, 'scrollHeight', {
        configurable: true,
        get: () => {
          callCount++
          if (callCount > 7) {
            // 7回目以降は固定高さ（最下部到達をシミュレート）
            return scrollHeight
          }
          scrollHeight += 100
          return scrollHeight
        },
      })

      window.scrollTo = vi.fn() as any // オーバーロード型対応

      let maxDepthReachedCount = 0
      const onMaxDepthReached = vi.fn(async () => {
        maxDepthReachedCount++
        // 1回目はcontinue、2回目以降はstop
        return maxDepthReachedCount === 1 ? 'continue' : 'stop'
      })

      const promise = autoScroll({
        maxDepth: 3,
        scrollDelay: 100,
        timeout: 10000,
        onMaxDepthReached,
      })

      // 最初の3回
      for (let i = 0; i < 3; i++) {
        await vi.advanceTimersByTimeAsync(100)
      }

      // さらに4回継続（2回目の最大深度到達まで）
      for (let i = 0; i < 4; i++) {
        await vi.advanceTimersByTimeAsync(100)
      }

      const result = await promise

      // コールバックが呼ばれたことを確認
      expect(onMaxDepthReached).toHaveBeenCalled()
      expect(result.scrollCount).toBeGreaterThan(0)
    })

    it('最大深度到達時にユーザーがstopを選択すると終了する', async () => {
      // 無限に高さが増えるドキュメントをモック
      let scrollHeight = 1000
      Object.defineProperty(document.documentElement, 'scrollHeight', {
        configurable: true,
        get: () => {
          scrollHeight += 100
          return scrollHeight
        },
      })

      window.scrollTo = vi.fn() as any // オーバーロード型対応

      const onMaxDepthReached = vi.fn().mockResolvedValue('stop')

      const promise = autoScroll({
        maxDepth: 3,
        scrollDelay: 100,
        timeout: 10000,
        onMaxDepthReached,
      })

      // 3回分のスクロール
      for (let i = 0; i < 3; i++) {
        await vi.advanceTimersByTimeAsync(100)
      }

      const result = await promise

      expect(result.state).toBe('BOTTOM_REACHED')
      expect(result.scrollCount).toBe(3)
      expect(onMaxDepthReached).toHaveBeenCalled()
    })

    it('最大深度到達時にユーザーがcancelを選択すると終了する', async () => {
      // 無限に高さが増えるドキュメントをモック
      let scrollHeight = 1000
      Object.defineProperty(document.documentElement, 'scrollHeight', {
        configurable: true,
        get: () => {
          scrollHeight += 100
          return scrollHeight
        },
      })

      window.scrollTo = vi.fn() as any // オーバーロード型対応

      const onMaxDepthReached = vi.fn().mockResolvedValue('cancel')

      const promise = autoScroll({
        maxDepth: 3,
        scrollDelay: 100,
        timeout: 10000,
        onMaxDepthReached,
      })

      // 3回分のスクロール
      for (let i = 0; i < 3; i++) {
        await vi.advanceTimersByTimeAsync(100)
      }

      const result = await promise

      expect(result.state).toBe('CANCELLED')
      expect(result.scrollCount).toBe(3)
    })

    it('onProgressコールバックが呼ばれる', async () => {
      let scrollHeight = 1000
      Object.defineProperty(document.documentElement, 'scrollHeight', {
        configurable: true,
        get: () => {
          scrollHeight += 100
          return scrollHeight
        },
      })

      window.scrollTo = vi.fn() as any // オーバーロード型対応

      const onProgress = vi.fn()

      const promise = autoScroll({
        maxDepth: 3,
        scrollDelay: 100,
        timeout: 10000,
        onProgress,
      })

      // 3回分のスクロール
      for (let i = 0; i < 3; i++) {
        await vi.advanceTimersByTimeAsync(100)
      }

      await promise

      expect(onProgress).toHaveBeenCalled()
      expect(onProgress.mock.calls.length).toBeGreaterThan(0)
    })
  })

  describe('getScrollStateMessage', () => {
    it('各状態に対して正しいメッセージを返す', () => {
      const states: ScrollState[] = [
        'SCROLLING',
        'BOTTOM_REACHED',
        'TIMEOUT_REACHED',
        'MAX_DEPTH_REACHED',
        'CANCELLED',
      ]

      for (const state of states) {
        const message = getScrollStateMessage(state)
        expect(message).toBeTruthy()
        expect(typeof message).toBe('string')
      }
    })

    it('BOTTOM_REACHEDに対して成功メッセージを返す', () => {
      const message = getScrollStateMessage('BOTTOM_REACHED')
      expect(message).toContain('完了')
    })

    it('TIMEOUT_REACHEDに対してタイムアウトメッセージを返す', () => {
      const message = getScrollStateMessage('TIMEOUT_REACHED')
      expect(message).toContain('時間')
    })
  })
})
