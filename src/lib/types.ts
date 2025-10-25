/**
 * IndexedDB: DiffSnapDB データ型定義
 */

export interface ImageSnapshot {
  hash: string // SHA-256（Blobコンテンツ）
  url: string // 取得に使用したURL（クエリ保持）
  width: number // 画像の自然幅
  height: number // 画像の自然高
  alt?: string // altテキスト
  context?: string // 周辺テキスト（50文字）
  firstSeenAt: number // 初回検出時刻
}

export interface DiffRecord {
  id: string // makeRecordId(url)の戻り値: "${origin}${pathname}:${queryHash}"
  url: string // 完全URL（クエリ含む）
  origin: string // https://example.com
  pathname: string // /products/item
  queryHash: string // SHA-256(sortedQueryString)の32桁（128ビット）
  domain: string // example.com
  lastScanAt: number // Date.now() タイムスタンプ
  images: ImageSnapshot[] // 検出済み画像の配列
}

/**
 * chrome.storage.sync: 設定データ型定義
 */

export interface DomainProfile {
  domain: string // "example.com"
  includePattern?: string // 正規表現文字列（空なら全許可）
  excludePattern?: string // 正規表現文字列（空なら除外なし）
  minWidth?: number // 最小幅ピクセル（未指定なら0）
}

export interface UserConfig {
  tier: 'free' | 'pro'
  licenseKey?: string // Pro購入時のライセンスキー
  namingTemplate: string // デフォルト: "{date}-{domain}-{w}x{h}-{index}"
  domainProfiles: DomainProfile[]
  monthlyCount: number // Free制限用カウンタ
  monthlyResetAt: number // 次回リセット日時（Unixタイムスタンプ）
}

/**
 * chrome.storage.session: 実行時状態型定義
 */

export interface FailedImage {
  url: string
  reason: 'CORS' | 'HTTP_ERROR' | 'TIMEOUT' | 'UNKNOWN'
  source?: 'content' | 'background' // エラー発生場所
}

export interface RunState {
  tabId: number
  status: 'idle' | 'detecting' | 'fetching' | 'zipping' | 'complete' | 'error'
  total: number // 検出画像総数
  completed: number // fetch完了数
  failed: FailedImage[] // 失敗リスト
  zipSize: number // 累積ZIPサイズ（バイト）
}

/**
 * 内部通信メッセージ型定義
 */

export interface ImageCandidate {
  url: string // 正規化済みURL
  element: {
    tag: string // 'img' | 'canvas' | 'svg' | 'video' | 'div'
    alt?: string
    context?: string
  }
  dimensions: {
    width: number
    height: number
  }
}

// Content → Background
export interface ImagesDetectedMessage {
  type: 'IMAGES_DETECTED'
  candidates: ImageCandidate[]
}

export interface ScrollCompleteMessage {
  type: 'SCROLL_COMPLETE'
}

export interface ScrollTimeoutMessage {
  type: 'SCROLL_TIMEOUT'
}

// Background → Popup
export interface StateUpdateMessage {
  type: 'STATE_UPDATE'
  state: RunState
}

export interface DiffResultMessage {
  type: 'DIFF_RESULT'
  new: ImageSnapshot[]
  existing: ImageSnapshot[]
  isFirstVisit: boolean
}

export interface ZipReadyMessage {
  type: 'ZIP_READY'
  downloadId: number
}

// Popup → Background
export interface CollectionOptions {
  enableScroll: boolean // 自動スクロール有効化
  maxScrollDepth: number // デフォルト20画面
  scrollTimeout: number // デフォルト15000ms
}

export interface StartCollectionMessage {
  type: 'START_COLLECTION'
  tabId: number
  options: CollectionOptions
}

export interface RetryFailedMessage {
  type: 'RETRY_FAILED'
  urls: string[]
}

export interface CheckDiffMessage {
  type: 'CHECK_DIFF'
  url: string
}

export type ContentMessage =
  | ImagesDetectedMessage
  | ScrollCompleteMessage
  | ScrollTimeoutMessage

export type BackgroundMessage = StateUpdateMessage | DiffResultMessage | ZipReadyMessage

export type PopupMessage = StartCollectionMessage | RetryFailedMessage | CheckDiffMessage
