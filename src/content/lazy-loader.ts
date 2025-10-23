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

    // 進捗コールバック呼び出し
    onProgress?.(scrollCount, state)

    // 4. 判定ロジック（優先度順）

    // a. タイムアウト判定（最優先）
    if (elapsed > timeout) {
      state = 'TIMEOUT_REACHED'
      break
    }

    // b. 最下部到達判定
    if (currentHeight === previousHeight) {
      noChangeCount++
      if (noChangeCount >= 3) {
        state = 'BOTTOM_REACHED'
        break
      }
    } else {
      // 高さが変化したらリセット
      noChangeCount = 0
    }

    // c. 最大深度判定
    scrollCount++
    if (scrollCount >= maxDepth) {
      if (currentHeight !== previousHeight) {
        // まだ変化している = 無限スクロール
        state = 'MAX_DEPTH_REACHED'

        if (onMaxDepthReached) {
          const userChoice = await onMaxDepthReached()

          if (userChoice === 'continue') {
            // +20画面継続
            scrollCount = 0 // リセット（相対的に+20）
            state = 'SCROLLING'
          } else if (userChoice === 'stop') {
            // 現在の結果で終了
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
      } else {
        // 変化なし = 最下部到達
        state = 'BOTTOM_REACHED'
        break
      }
    }

    // d. 継続
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
