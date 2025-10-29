// Shared type definitions for DiffSnap

export interface ImageCandidate {
  url: string
  source: ImageSource
  width?: number
  height?: number
  alt?: string
}

export type ImageSource =
  | 'img'
  | 'picture'
  | 'srcset'
  | 'css-bg'
  | 'canvas'
  | 'svg'
  | 'video'
  | 'iframe'

// スクロール関連の型定義
export type UserChoice = 'continue' | 'stop' | 'cancel'

export type ScrollState =
  | 'SCROLLING' // スクロール中
  | 'BOTTOM_REACHED' // 最下部到達（成功）
  | 'TIMEOUT_REACHED' // タイムアウト到達
  | 'MAX_DEPTH_REACHED' // 最大深度到達（ユーザー選択待ち）
  | 'CANCELLED' // ユーザーによるキャンセル

export interface ScrollResult {
  state: ScrollState
  scrollCount: number
  finalHeight: number
  elapsed: number
}

export interface DetectionResult {
  candidates: ImageCandidate[]
  timestamp: number
  url: string
}

// メッセージ型定義
// Content → Background
export interface ImagesDetectedMessage {
  type: 'IMAGES_DETECTED'
  candidates: ImageCandidate[]
}

export interface ScrollCompleteMessage {
  type: 'SCROLL_COMPLETE'
  result: ScrollResult
}

export interface ScrollTimeoutMessage {
  type: 'SCROLL_TIMEOUT'
}

export interface DetectionErrorMessage {
  type: 'DETECTION_ERROR'
  error: string
}

export type ContentToBackgroundMessage =
  | ImagesDetectedMessage
  | ScrollCompleteMessage
  | ScrollTimeoutMessage
  | DetectionErrorMessage

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

export type BackgroundToPopupMessage = StateUpdateMessage | DiffResultMessage | ZipReadyMessage

// Popup → Background
export interface StartCollectionMessage {
  type: 'START_COLLECTION'
  tabId: number
  options: CollectionOptions
}

export interface RetryFailedMessage {
  type: 'RETRY_FAILED'
  failedImages: FailedImage[]
}

export interface CheckDiffMessage {
  type: 'CHECK_DIFF'
  url: string
}

export interface VerifyLicenseMessage {
  type: 'VERIFY_LICENSE'
  payload: {
    key: string
  }
}

export interface CleanupDataMessage {
  type: 'CLEANUP_DATA'
}

export type PopupToBackgroundMessage =
  | StartCollectionMessage
  | RetryFailedMessage
  | CheckDiffMessage
  | VerifyLicenseMessage
  | CleanupDataMessage

// Response types for Settings UI
export interface VerifyLicenseResponse {
  success: boolean
  error?: string
}

export interface CleanupDataResponse {
  success: boolean
  deletedCount?: number
}

// Response type for chrome.runtime.sendMessage
export interface MessageResponse {
  status: 'OK' | 'ERROR'
  error?: string
  message?: string
  retryCount?: number
  received?: number
}

// コレクションオプション
export interface CollectionOptions {
  enableScroll: boolean // 自動スクロール有効化
  maxScrollDepth: number // デフォルト20画面
  scrollTimeout: number // デフォルト15000ms
}

// 実行状態
// data-models.md:90-101 準拠
export interface RunState {
  tabId: number
  status: 'idle' | 'detecting' | 'fetching' | 'zipping' | 'complete' | 'error'
  total: number // 検出画像総数
  completed: number // fetch完了数
  failed: FailedImage[] // 失敗リスト
  zipSize: number // 累積ZIPサイズ（バイト）
}

// 画像スナップショット（差分台帳用）
// data-models.md:31-39 準拠
export interface ImageSnapshot {
  hash: string // SHA-256（Blobコンテンツ）
  url: string // 取得に使用したURL（クエリ保持）
  width: number // 画像の自然幅
  height: number // 画像の自然高
  alt?: string // altテキスト
  context?: string // 周辺テキスト（50文字）
  firstSeenAt: number // 初回検出時刻
}

// Background → Content メッセージ型（Phase 2で拡張）
export interface StartScrollMessage {
  type: 'START_SCROLL'
  options?: {
    maxDepth?: number
    timeout?: number
    scrollDelay?: number
  }
}

export type BackgroundToContentMessage = StartScrollMessage

// Keep-Alive & Checkpoint 型定義
export type ErrorType = 'CORS' | 'TIMEOUT' | 'HTTP_ERROR' | 'NETWORK' | 'UNKNOWN'

export interface FailedImage {
  url: string
  error: string
  errorType: ErrorType
  retryCount: number
  source: ImageSource // 元の画像ソースタイプを保持
  width?: number // 画像サイズ（あれば）
  height?: number
  alt?: string // 代替テキスト（あれば）
}

export interface ProcessingCheckpoint {
  tabId: number
  url: string
  candidates: ImageCandidate[]
  completedIndices: number[]
  failedCandidates: FailedImage[]
  lastCheckpointAt: number
  phase: 'fetching' | 'zipping'
}

// IndexedDB: DiffSnapDB データ型定義
// data-models.md:19-29 準拠
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

// chrome.storage.sync: 設定データ型定義
// data-models.md:64-70 準拠
export interface DomainProfile {
  domain: string // "example.com"
  includePattern?: string // 正規表現文字列（空なら全許可）
  excludePattern?: string // 正規表現文字列（空なら除外なし）
  minWidth?: number // 最小幅ピクセル（未指定なら0）
}

// data-models.md:55-62 準拠
export interface UserConfig {
  tier: 'free' | 'pro'
  licenseKey?: string // Pro購入時のライセンスキー
  namingTemplate: string // デフォルト: "{date}-{domain}-{w}x{h}-{index}"
  domainProfiles: DomainProfile[]
  monthlyCount?: number // Free制限用カウンタ（オプショナル - 初回は未設定）
  monthlyResetAt?: number // 次回リセット日時（オプショナル - 初回は未設定）
}
