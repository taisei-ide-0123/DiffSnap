import { create } from 'zustand'
import type { RunState, ImageCandidate, BackgroundToPopupMessage } from '../../shared/types'

// Popup専用のストア状態
interface PopupState extends RunState {
  candidates: ImageCandidate[] // プレビュー用の画像候補
  errorMessage?: string // エラーメッセージ
}

// ストアアクション
interface PopupActions {
  // 収集開始
  startCollection: (tabId: number, candidates: ImageCandidate[]) => void
  // 進捗更新（BackgroundからのSTATE_UPDATEメッセージ受信時）
  updateProgress: (update: Partial<RunState>) => void
  // ステータス設定
  setStatus: (status: RunState['status']) => void
  // エラーメッセージ設定（statusは変更しない）
  setErrorMessage: (message: string) => void
  // エラー設定（statusをerrorに設定）
  setError: (message: string) => void
  // リセット（idle状態に戻る）
  reset: () => void
  // 候補画像の追加（検出結果受信時）
  setCandidates: (candidates: ImageCandidate[]) => void
}

type PopupStore = PopupState & PopupActions

// 初期状態
const initialState: PopupState = {
  tabId: -1,
  status: 'idle',
  total: 0,
  completed: 0,
  failed: [],
  zipSize: 0,
  candidates: [],
  errorMessage: undefined,
}

export const usePopupStore = create<PopupStore>((set) => ({
  ...initialState,

  // 収集開始
  startCollection: (tabId, candidates) => {
    set({
      tabId,
      status: 'detecting',
      total: candidates.length,
      completed: 0,
      failed: [],
      zipSize: 0,
      candidates,
      errorMessage: undefined,
    })
  },

  // 進捗更新
  updateProgress: (update) => {
    set((state) => {
      // 状態遷移検証（statusが変更される場合のみ）
      if (update.status !== undefined && update.status !== state.status) {
        const isValidTransition = validateStatusTransition(state.status, update.status)

        if (!isValidTransition) {
          console.warn(`Invalid status transition: ${state.status} -> ${update.status}`)
          return state
        }
      }

      return {
        ...state,
        ...update,
      }
    })
  },

  // ステータス設定（updateProgressのラッパー）
  setStatus: (status) => {
    usePopupStore.getState().updateProgress({ status })
  },

  // エラーメッセージ設定
  setErrorMessage: (message) => {
    set((state) => ({
      ...state,
      errorMessage: message,
    }))
  },

  // エラー設定
  setError: (message) => {
    set((state) => ({
      ...state, // 既存のフィールド（total, completed等）を保持
      status: 'error',
      errorMessage: message,
    }))
  },

  // リセット
  reset: () => {
    set(initialState)
  },

  // 候補画像設定
  setCandidates: (candidates) => {
    set({ candidates, total: candidates.length })
  },
}))

// 状態遷移バリデーション
const validateStatusTransition = (from: RunState['status'], to: RunState['status']): boolean => {
  const transitions: Record<RunState['status'], RunState['status'][]> = {
    idle: ['detecting'],
    detecting: ['fetching', 'error'],
    fetching: ['zipping', 'error'],
    zipping: ['complete', 'error'],
    complete: ['idle'],
    error: ['idle', 'fetching'], // retry可能
  }

  return transitions[from]?.includes(to) ?? false
}

/**
 * Backgroundからのメッセージリスナーをセットアップ
 * Popup起動時にこの関数を呼び出す
 *
 * @returns クリーンアップ関数（useEffectのreturnで呼び出す）
 *
 * 状態遷移図:
 * idle → detecting → fetching → zipping → complete → idle
 *         ↓          ↓          ↓
 *         error ←----←----------←
 *         ↓
 *         idle (retry)
 */
export const setupBackgroundListener = () => {
  const listener = (message: BackgroundToPopupMessage) => {
    const store = usePopupStore.getState()

    switch (message.type) {
      case 'STATE_UPDATE':
        store.updateProgress(message.state)
        break
      case 'DIFF_RESULT':
        // Pro機能: 差分結果を反映
        // MVPでは未実装
        console.log('Diff result received:', message)
        break
      case 'ZIP_READY':
        // ZIP生成完了
        console.log('ZIP ready:', message.downloadId)
        break
    }
  }

  chrome.runtime.onMessage.addListener(listener)

  // クリーンアップ関数を返す（メモリリーク防止）
  return () => chrome.runtime.onMessage.removeListener(listener)
}
