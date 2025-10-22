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
}

export interface ScrollTimeoutMessage {
  type: 'SCROLL_TIMEOUT'
}

export type ContentToBackgroundMessage =
  | ImagesDetectedMessage
  | ScrollCompleteMessage
  | ScrollTimeoutMessage

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
  urls: string[]
}

export interface CheckDiffMessage {
  type: 'CHECK_DIFF'
  url: string
}

export type PopupToBackgroundMessage =
  | StartCollectionMessage
  | RetryFailedMessage
  | CheckDiffMessage

// コレクションオプション
export interface CollectionOptions {
  enableScroll: boolean // 自動スクロール有効化
  maxScrollDepth: number // デフォルト20画面
  scrollTimeout: number // デフォルト15000ms
}

// 実行状態（仮定義）
export interface RunState {
  status: 'idle' | 'detecting' | 'collecting' | 'completed' | 'error'
  progress?: number
  error?: string
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
}

export type BackgroundToContentMessage = StartScrollMessage
