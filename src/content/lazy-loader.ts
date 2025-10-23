/**
 * 遅延読込対応（自動スクロール）モジュール
 *
 * 無限スクロールページに対応した自動スクロール機能を提供します。
 *
 * 仕様:
 * - 最大深度: デフォルト20画面、ユーザー指定可能
 * - タイムアウト: デフォルト15秒
 * - スクロール待機: 500ms（コンテンツ読込待機）
 * - 最下部判定: 3回連続で高さ変化なし
 * - 終了後: トップへ自動復帰
 */

import type { ScrollState, ScrollResult } from '../shared/types'

// Re-export ScrollState for test files
export type { ScrollState }

/**
 * スクロールオプション
 */
export interface ScrollOptions {
  maxDepth?: number // 最大深度（デフォルト: 20画面）
  timeout?: number // タイムアウト（ms、デフォルト: 15000）
  scrollDelay?: number // スクロール待機時間（ms、デフォルト: 500）
  onProgress?: (scrollCount: number, state: ScrollState) => void // 進捗コールバック
  onMaxDepthReached?: () => Promise<'continue' | 'stop' | 'cancel'> // 最大深度到達時の処理
}

/**
 * ユーティリティ: 指定時間待機
 */
const delay = (ms: number): Promise<void> => {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * 現在のドキュメント高さを取得
 */
const getDocumentHeight = (): number => {
  return document.documentElement.scrollHeight
}

/**
 * ページ最下部にスクロール
 */
const scrollToBottom = (): void => {
  window.scrollTo(0, document.documentElement.scrollHeight)
}

/**
 * ページトップにスクロール
 */
const scrollToTop = (): void => {
  window.scrollTo(0, 0)
}

/**
 * スクロール状態を評価する
 *
 * 優先度順に判定を行い、新しい状態を返します。
 *
 * @param params - 判定に必要なパラメータ
 * @returns 新しい状態とnoChangeCountの更新値
 */
const evaluateScrollState = (params: {
  currentHeight: number
  previousHeight: number
  noChangeCount: number
  scrollCount: number
  maxDepth: number
  elapsed: number
  timeout: number
}): { newState: ScrollState; newNoChangeCount: number } => {
  const { currentHeight, previousHeight, noChangeCount, scrollCount, maxDepth, elapsed, timeout } =
    params

  // a. タイムアウト判定（最優先）
  if (elapsed >= timeout) {
    return { newState: 'TIMEOUT_REACHED', newNoChangeCount: noChangeCount }
  }

  // b. 最下部到達判定
  if (currentHeight === previousHeight) {
    const updatedNoChangeCount = noChangeCount + 1
    if (updatedNoChangeCount >= 3) {
      return { newState: 'BOTTOM_REACHED', newNoChangeCount: updatedNoChangeCount }
    }
    return { newState: 'SCROLLING', newNoChangeCount: updatedNoChangeCount }
  }

  // 高さが変化した場合はnoChangeCountをリセット
  const resetNoChangeCount = 0

  // c. 最大深度判定
  if (scrollCount >= maxDepth) {
    // Note: b判定を通過済みのため、この時点でcurrentHeight !== previousHeightは保証されている
    // つまり、高さが変化している = 無限スクロール継続中
    return { newState: 'MAX_DEPTH_REACHED', newNoChangeCount: resetNoChangeCount }
  }

  // d. 継続
  return { newState: 'SCROLLING', newNoChangeCount: resetNoChangeCount }
}

/**
 * 自動スクロール実行（状態マシン実装）
 *
 * アルゴリズム:
 * 1. 初期化: scrollCount=0, noChangeCount=0, previousHeight取得
 * 2. スクロールループ:
 *    a. タイムアウト判定（最優先）
 *    b. 最下部到達判定（3回連続変化なし）
 *    c. 最大深度判定（ユーザー選択）
 *    d. 継続
 * 3. 終了処理: トップ復帰
 *
 * @param options - スクロールオプション
 * @returns スクロール結果
 */
export const autoScroll = async (options: ScrollOptions = {}): Promise<ScrollResult> => {
  const {
    maxDepth = 20,
    timeout = 15000,
    scrollDelay = 500,
    onProgress,
    onMaxDepthReached,
  } = options

  // 状態初期化
  let state: ScrollState = 'SCROLLING'
  let scrollCount = 0
  let noChangeCount = 0
  let previousHeight = getDocumentHeight()
  const startTime = Date.now()
  let currentMaxDepth = maxDepth // 動的に変更可能なmaxDepth

  // スクロールループ
  while (state === 'SCROLLING') {
    // 1. 最下部にスクロール
    scrollToBottom()

    // 2. コンテンツ読込待機
    await delay(scrollDelay)

    // 3. スクロール完了後にカウント増加
    scrollCount++

    // 4. 進捗コールバック呼び出し
    onProgress?.(scrollCount, state)

    // 5. 現在の高さを取得
    const currentHeight = getDocumentHeight()
    const elapsed = Date.now() - startTime

    // 6. スクロール状態を評価
    const evaluation = evaluateScrollState({
      currentHeight,
      previousHeight,
      noChangeCount,
      scrollCount,
      maxDepth: currentMaxDepth,
      elapsed,
      timeout,
    })

    state = evaluation.newState
    noChangeCount = evaluation.newNoChangeCount

    // 最大深度到達時のユーザー選択処理
    if (state === 'MAX_DEPTH_REACHED') {
      if (onMaxDepthReached) {
        const userChoice = await onMaxDepthReached()

        if (userChoice === 'continue') {
          // +20画面継続: maxDepthを相対的に増加（scrollCountはリセットしない）
          currentMaxDepth += maxDepth
          state = 'SCROLLING'
        } else if (userChoice === 'stop') {
          state = 'BOTTOM_REACHED'
          break
        } else {
          // cancel
          state = 'CANCELLED'
          break
        }
      } else {
        // コールバックなしの場合は停止
        state = 'BOTTOM_REACHED'
        break
      }
    }

    // 状態がSCROLLING以外なら終了
    if (state !== 'SCROLLING') {
      break
    }

    // 継続: 高さ更新
    previousHeight = currentHeight
  }

  // 5. 終了処理: トップ復帰
  scrollToTop()

  return {
    state,
    scrollCount,
    finalHeight: getDocumentHeight(),
    elapsed: Date.now() - startTime,
  }
}

/**
 * スクロール状態の人間可読文字列を取得
 */
export const getScrollStateMessage = (state: ScrollState): string => {
  switch (state) {
    case 'SCROLLING':
      return 'スクロール中...'
    case 'BOTTOM_REACHED':
      return 'スクロール完了（最下部到達）'
    case 'TIMEOUT_REACHED':
      return '時間制限に達しました'
    case 'MAX_DEPTH_REACHED':
      return '最大深度に到達しました'
    case 'CANCELLED':
      return 'キャンセルされました'
  }
}
