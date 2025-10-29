import { describe, it, expect, beforeEach, vi } from 'vitest'
import { usePopupStore } from './index'
import type { ImageCandidate } from '../../shared/types'

describe('Popup Store', () => {
  beforeEach(() => {
    // ストアをリセット
    usePopupStore.getState().reset()
  })

  describe('初期状態', () => {
    it('idleステータスで初期化される', () => {
      const state = usePopupStore.getState()
      expect(state.status).toBe('idle')
      expect(state.tabId).toBe(-1)
      expect(state.total).toBe(0)
      expect(state.completed).toBe(0)
      expect(state.failed).toEqual([])
      expect(state.zipSize).toBe(0)
      expect(state.candidates).toEqual([])
      expect(state.errorMessage).toBeUndefined()
    })
  })

  describe('startCollection', () => {
    it('収集を開始し、状態をdetectingに遷移する', () => {
      const candidates: ImageCandidate[] = [
        { url: 'https://example.com/1.jpg', source: 'img' },
        { url: 'https://example.com/2.jpg', source: 'css-bg' },
      ]

      usePopupStore.getState().startCollection(123, candidates)

      const state = usePopupStore.getState()
      expect(state.status).toBe('detecting')
      expect(state.tabId).toBe(123)
      expect(state.total).toBe(2)
      expect(state.completed).toBe(0)
      expect(state.candidates).toEqual(candidates)
      expect(state.errorMessage).toBeUndefined()
    })

    it('既存のエラー状態をクリアする', () => {
      // 最初にエラー状態にする
      usePopupStore.getState().setError('Test error')

      const candidates: ImageCandidate[] = [{ url: 'https://example.com/1.jpg', source: 'img' }]
      usePopupStore.getState().startCollection(456, candidates)

      const state = usePopupStore.getState()
      expect(state.errorMessage).toBeUndefined()
      expect(state.status).toBe('detecting')
    })
  })

  describe('updateProgress', () => {
    beforeEach(() => {
      const candidates: ImageCandidate[] = [{ url: 'https://example.com/1.jpg', source: 'img' }]
      usePopupStore.getState().startCollection(123, candidates)
    })

    it('進捗を更新する', () => {
      usePopupStore.getState().updateProgress({
        completed: 5,
        total: 10,
      })

      const state = usePopupStore.getState()
      expect(state.completed).toBe(5)
      expect(state.total).toBe(10)
    })

    it('有効な状態遷移を許可する: detecting -> fetching', () => {
      usePopupStore.getState().updateProgress({
        status: 'fetching',
      })

      expect(usePopupStore.getState().status).toBe('fetching')
    })

    it('有効な状態遷移を許可する: fetching -> zipping', () => {
      usePopupStore.getState().updateProgress({ status: 'fetching' })
      usePopupStore.getState().updateProgress({ status: 'zipping' })

      expect(usePopupStore.getState().status).toBe('zipping')
    })

    it('有効な状態遷移を許可する: zipping -> complete', () => {
      usePopupStore.getState().updateProgress({ status: 'fetching' })
      usePopupStore.getState().updateProgress({ status: 'zipping' })
      usePopupStore.getState().updateProgress({ status: 'complete' })

      expect(usePopupStore.getState().status).toBe('complete')
    })

    it('無効な状態遷移を拒否する: detecting -> complete', () => {
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

      usePopupStore.getState().updateProgress({
        status: 'complete',
      })

      expect(usePopupStore.getState().status).toBe('detecting')
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        'Invalid status transition: detecting -> complete'
      )

      consoleWarnSpy.mockRestore()
    })

    it('無効な状態遷移を拒否する: fetching -> detecting', () => {
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

      usePopupStore.getState().updateProgress({ status: 'fetching' })
      usePopupStore.getState().updateProgress({ status: 'detecting' })

      expect(usePopupStore.getState().status).toBe('fetching')
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        'Invalid status transition: fetching -> detecting'
      )

      consoleWarnSpy.mockRestore()
    })

    it('エラー状態への遷移を常に許可する: fetching -> error', () => {
      usePopupStore.getState().updateProgress({ status: 'fetching' })
      usePopupStore.getState().updateProgress({ status: 'error' })

      expect(usePopupStore.getState().status).toBe('error')
    })

    it('エラー状態への遷移を常に許可する: detecting -> error', () => {
      const candidates: ImageCandidate[] = [{ url: 'https://example.com/1.jpg', source: 'img' }]
      usePopupStore.getState().startCollection(123, candidates)
      // detecting状態からerrorに遷移
      usePopupStore.getState().updateProgress({ status: 'error' })

      expect(usePopupStore.getState().status).toBe('error')
    })

    it('複数のフィールドを同時に更新できる', () => {
      usePopupStore.getState().updateProgress({
        status: 'fetching',
        completed: 3,
        zipSize: 1024,
      })

      const state = usePopupStore.getState()
      expect(state.status).toBe('fetching')
      expect(state.completed).toBe(3)
      expect(state.zipSize).toBe(1024)
    })
  })

  describe('setStatus', () => {
    it('有効な状態遷移を実行する: idle -> detecting', () => {
      usePopupStore.getState().setStatus('detecting')

      expect(usePopupStore.getState().status).toBe('detecting')
    })

    it('有効な状態遷移を実行する: detecting -> fetching', () => {
      usePopupStore.getState().setStatus('detecting')
      usePopupStore.getState().setStatus('fetching')

      expect(usePopupStore.getState().status).toBe('fetching')
    })

    it('無効な状態遷移を拒否する: idle -> complete', () => {
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

      usePopupStore.getState().setStatus('complete')

      expect(usePopupStore.getState().status).toBe('idle')
      expect(consoleWarnSpy).toHaveBeenCalledWith('Invalid status transition: idle -> complete')

      consoleWarnSpy.mockRestore()
    })

    it('無効な状態遷移を拒否する: fetching -> detecting', () => {
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

      usePopupStore.getState().setStatus('detecting')
      usePopupStore.getState().setStatus('fetching')
      usePopupStore.getState().setStatus('detecting')

      expect(usePopupStore.getState().status).toBe('fetching')
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        'Invalid status transition: fetching -> detecting'
      )

      consoleWarnSpy.mockRestore()
    })

    it('既存の状態フィールドを保持する', () => {
      const candidates: ImageCandidate[] = [{ url: 'https://example.com/1.jpg', source: 'img' }]
      usePopupStore.getState().startCollection(123, candidates)
      usePopupStore.getState().updateProgress({ completed: 5, total: 10 })

      usePopupStore.getState().setStatus('fetching')

      const state = usePopupStore.getState()
      expect(state.status).toBe('fetching')
      expect(state.tabId).toBe(123)
      expect(state.completed).toBe(5)
      expect(state.total).toBe(10)
      expect(state.candidates).toEqual(candidates)
    })
  })

  describe('setErrorMessage', () => {
    it('エラーメッセージを設定する（statusは変更しない）', () => {
      usePopupStore.getState().setErrorMessage('Test error message')

      const state = usePopupStore.getState()
      expect(state.errorMessage).toBe('Test error message')
      expect(state.status).toBe('idle')
    })

    it('既存の状態を保持する', () => {
      const candidates: ImageCandidate[] = [{ url: 'https://example.com/1.jpg', source: 'img' }]
      usePopupStore.getState().startCollection(123, candidates)
      usePopupStore.getState().updateProgress({ completed: 3 })

      usePopupStore.getState().setErrorMessage('Some warning message')

      const state = usePopupStore.getState()
      expect(state.errorMessage).toBe('Some warning message')
      expect(state.status).toBe('detecting')
      expect(state.tabId).toBe(123)
      expect(state.completed).toBe(3)
    })

    it('エラーメッセージを上書きできる', () => {
      usePopupStore.getState().setErrorMessage('First error')
      expect(usePopupStore.getState().errorMessage).toBe('First error')

      usePopupStore.getState().setErrorMessage('Second error')
      expect(usePopupStore.getState().errorMessage).toBe('Second error')
    })
  })

  describe('setError', () => {
    it('エラーメッセージを設定し、statusをerrorにする', () => {
      usePopupStore.getState().setError('Network error occurred')

      const state = usePopupStore.getState()
      expect(state.status).toBe('error')
      expect(state.errorMessage).toBe('Network error occurred')
    })

    it('任意の状態からエラー状態に遷移できる', () => {
      const candidates: ImageCandidate[] = [{ url: 'https://example.com/1.jpg', source: 'img' }]
      usePopupStore.getState().startCollection(123, candidates)
      usePopupStore.getState().updateProgress({ status: 'fetching' })

      usePopupStore.getState().setError('Critical error')

      expect(usePopupStore.getState().status).toBe('error')
    })
  })

  describe('reset', () => {
    it('全状態を初期状態にリセットする', () => {
      const candidates: ImageCandidate[] = [{ url: 'https://example.com/1.jpg', source: 'img' }]
      usePopupStore.getState().startCollection(123, candidates)
      usePopupStore.getState().updateProgress({
        status: 'fetching',
        completed: 5,
        zipSize: 2048,
      })

      usePopupStore.getState().reset()

      const state = usePopupStore.getState()
      expect(state.status).toBe('idle')
      expect(state.tabId).toBe(-1)
      expect(state.total).toBe(0)
      expect(state.completed).toBe(0)
      expect(state.failed).toEqual([])
      expect(state.zipSize).toBe(0)
      expect(state.candidates).toEqual([])
      expect(state.errorMessage).toBeUndefined()
    })
  })

  describe('setCandidates', () => {
    it('候補画像を設定し、totalを更新する', () => {
      const candidates: ImageCandidate[] = [
        { url: 'https://example.com/1.jpg', source: 'img' },
        { url: 'https://example.com/2.jpg', source: 'picture' },
        { url: 'https://example.com/3.jpg', source: 'srcset' },
      ]

      usePopupStore.getState().setCandidates(candidates)

      const state = usePopupStore.getState()
      expect(state.candidates).toEqual(candidates)
      expect(state.total).toBe(3)
    })

    it('空配列を設定できる', () => {
      usePopupStore.getState().setCandidates([])

      const state = usePopupStore.getState()
      expect(state.candidates).toEqual([])
      expect(state.total).toBe(0)
    })
  })

  describe('状態遷移フロー', () => {
    it('正常な収集フローが完了できる', () => {
      const candidates: ImageCandidate[] = [
        { url: 'https://example.com/1.jpg', source: 'img' },
        { url: 'https://example.com/2.jpg', source: 'img' },
      ]

      // 1. 開始
      usePopupStore.getState().startCollection(123, candidates)
      expect(usePopupStore.getState().status).toBe('detecting')

      // 2. 検出 -> 取得
      usePopupStore.getState().updateProgress({ status: 'fetching' })
      expect(usePopupStore.getState().status).toBe('fetching')

      // 3. 進捗更新
      usePopupStore.getState().updateProgress({ completed: 1 })
      expect(usePopupStore.getState().completed).toBe(1)

      usePopupStore.getState().updateProgress({ completed: 2 })
      expect(usePopupStore.getState().completed).toBe(2)

      // 4. ZIP生成
      usePopupStore.getState().updateProgress({ status: 'zipping' })
      expect(usePopupStore.getState().status).toBe('zipping')

      // 5. 完了
      usePopupStore.getState().updateProgress({ status: 'complete' })
      expect(usePopupStore.getState().status).toBe('complete')

      // 6. リセット
      usePopupStore.getState().reset()
      expect(usePopupStore.getState().status).toBe('idle')
    })

    it('エラーからのリトライフローが動作する', () => {
      const candidates: ImageCandidate[] = [{ url: 'https://example.com/1.jpg', source: 'img' }]

      // 1. 開始
      usePopupStore.getState().startCollection(123, candidates)

      // 2. 取得中にエラー
      usePopupStore.getState().updateProgress({ status: 'fetching' })
      usePopupStore.getState().setError('Network timeout')
      expect(usePopupStore.getState().status).toBe('error')

      // 3. リトライ（error -> fetching は許可されている）
      usePopupStore.getState().updateProgress({ status: 'fetching' })
      expect(usePopupStore.getState().status).toBe('fetching')

      // 4. 成功して完了
      usePopupStore.getState().updateProgress({ status: 'zipping' })
      usePopupStore.getState().updateProgress({ status: 'complete' })
      expect(usePopupStore.getState().status).toBe('complete')
    })

    it('complete -> idle 遷移が動作する', () => {
      const candidates: ImageCandidate[] = [{ url: 'https://example.com/1.jpg', source: 'img' }]

      usePopupStore.getState().startCollection(123, candidates)
      usePopupStore.getState().updateProgress({ status: 'fetching' })
      usePopupStore.getState().updateProgress({ status: 'zipping' })
      usePopupStore.getState().updateProgress({ status: 'complete' })

      // reset()を使うと全フィールドが初期化されるため通常は推奨だが、
      // 状態遷移としてcomplete -> idleも許可されている
      usePopupStore.getState().updateProgress({ status: 'idle' })
      expect(usePopupStore.getState().status).toBe('idle')
    })
  })
})
