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

/**
 * スクロール状態
 */
export type ScrollState =
  | 'SCROLLING' // スクロール中
  | 'BOTTOM_REACHED' // 最下部到達（成功）
  | 'TIMEOUT_REACHED' // タイムアウト到達
  | 'MAX_DEPTH_REACHED' // 最大深度到達（ユーザー選択待ち）
  | 'CANCELLED' // ユーザーによるキャンセル

/**
 * スクロール結果
 */
export interface ScrollResult {
  state: ScrollState
  scrollCount: number
  finalHeight: number
  elapsed: number
}

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
 * 優先度順に判定を行い、新しい状態とループ継続判定を返します。
 *
 * @param params - 判定に必要なパラメータ
 * @returns 新しい状態とループを抜けるべきかの判定
 */
const evaluateScrollState = (params: {
  currentHeight: number
  previousHeight: number
  noChangeCount: number
  scrollCount: number
  maxDepth: number
  elapsed: number
  timeout: number
}): { newState: ScrollState; shouldBreak: boolean; newNoChangeCount: number } => {
  const { currentHeight, previousHeight, noChangeCount, scrollCount, maxDepth, elapsed, timeout } =
    params

  // a. タイムアウト判定（最優先）
  if (elapsed > timeout) {
    return { newState: 'TIMEOUT_REACHED', shouldBreak: true, newNoChangeCount: noChangeCount }
  }

  // b. 最下部到達判定
  if (currentHeight === previousHeight) {
    const updatedNoChangeCount = noChangeCount + 1
    if (updatedNoChangeCount >= 3) {
      return { newState: 'BOTTOM_REACHED', shouldBreak: true, newNoChangeCount: updatedNoChangeCount }
    }
    return { newState: 'SCROLLING', shouldBreak: false, newNoChangeCount: updatedNoChangeCount }
  }

  // 高さが変化した場合はnoChangeCountをリセット
  const resetNoChangeCount = 0

  // c. 最大深度判定
  if (scrollCount >= maxDepth) {
    if (currentHeight !== previousHeight) {
      // まだ変化している = 無限スクロール
      return { newState: 'MAX_DEPTH_REACHED', shouldBreak: false, newNoChangeCount: resetNoChangeCount }
    }
    // 変化なし = 最下部到達
    return { newState: 'BOTTOM_REACHED', shouldBreak: true, newNoChangeCount: resetNoChangeCount }
  }

  // d. 継続
  return { newState: 'SCROLLING', shouldBreak: false, newNoChangeCount: resetNoChangeCount }
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

  // スクロールループ
  while (state === 'SCROLLING') {
    // 1. 最下部にスクロール
    scrollToBottom()

    // 2. コンテンツ読込待機
    await delay(scrollDelay)

    // 3. 現在の高さを取得
    const currentHeight = getDocumentHeight()
    const elapsed = Date.now() - startTime

    // スクロールカウント増加（判定前に実行）
    scrollCount++

    // 進捗コールバック呼び出し
    onProgress?.(scrollCount, state)

    // 4. スクロール状態を評価
    const evaluation = evaluateScrollState({
      currentHeight,
      previousHeight,
      noChangeCount,
      scrollCount,
      maxDepth,
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
          // +20画面継続
          scrollCount = 0 // リセット（相対的に+20）
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

    // 状態変化で終了判定
    if (evaluation.shouldBreak) {
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
