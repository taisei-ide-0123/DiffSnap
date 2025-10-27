/**
 * Blob URL Manager - メモリリーク防止のためのBlob URL管理
 *
 * 機能:
 * - Blob URLの追跡と自動解放
 * - タイムアウトによる強制解放
 * - 使用完了時の即時解放
 */

interface BlobUrlEntry {
  url: string
  createdAt: number
  timeoutId?: ReturnType<typeof setTimeout>
}

/**
 * Blob URLマネージャークラス
 */
export class BlobUrlManager {
  private urls = new Map<string, BlobUrlEntry>()
  private defaultTimeout: number

  /**
   * @param defaultTimeout - デフォルトタイムアウト（ms、デフォルト: 60000 = 1分）
   */
  constructor(defaultTimeout = 60000) {
    this.defaultTimeout = defaultTimeout
  }

  /**
   * Blob URLを作成して追跡する
   *
   * @param blob - Blobオブジェクト
   * @param timeout - カスタムタイムアウト（ms）
   * @returns 作成されたBlob URL
   */
  create(blob: Blob, timeout?: number): string {
    const url = URL.createObjectURL(blob)
    const actualTimeout = timeout ?? this.defaultTimeout

    // 既存のエントリがある場合は古いタイムアウトをクリア
    const existingEntry = this.urls.get(url)
    if (existingEntry?.timeoutId) {
      clearTimeout(existingEntry.timeoutId)
    }

    // タイムアウトIDを設定
    const timeoutId = setTimeout(() => {
      this.revoke(url)
    }, actualTimeout)

    this.urls.set(url, {
      url,
      createdAt: Date.now(),
      timeoutId,
    })

    return url
  }

  /**
   * Blob URLを解放する
   *
   * @param url - 解放するBlob URL
   */
  revoke(url: string): void {
    const entry = this.urls.get(url)

    if (entry) {
      // タイムアウトをクリア
      if (entry.timeoutId) {
        clearTimeout(entry.timeoutId)
      }

      // Blob URLを解放
      URL.revokeObjectURL(url)

      // マップから削除
      this.urls.delete(url)
    }
  }

  /**
   * すべてのBlob URLを解放する
   */
  revokeAll(): void {
    for (const url of this.urls.keys()) {
      this.revoke(url)
    }
  }

  /**
   * 追跡中のBlob URL数を取得
   */
  getCount(): number {
    return this.urls.size
  }

  /**
   * 特定のBlob URLが追跡されているか確認
   */
  has(url: string): boolean {
    return this.urls.has(url)
  }

  /**
   * すべての追跡中URLのリストを取得（デバッグ用）
   */
  getAllUrls(): string[] {
    return Array.from(this.urls.keys())
  }

  /**
   * クリーンアップ（リソース解放）
   */
  cleanup(): void {
    this.revokeAll()
  }
}

/**
 * グローバルインスタンス（シングルトンパターン）
 */
let globalBlobUrlManager: BlobUrlManager | null = null

/**
 * グローバルBlobUrlManagerインスタンスを取得
 */
export const getBlobUrlManager = (): BlobUrlManager => {
  globalBlobUrlManager ??= new BlobUrlManager()
  return globalBlobUrlManager
}

/**
 * Blob URLを作成（グローバルマネージャー使用）
 */
export const createManagedBlobUrl = (blob: Blob, timeout?: number): string => {
  return getBlobUrlManager().create(blob, timeout)
}

/**
 * Blob URLを解放（グローバルマネージャー使用）
 */
export const revokeManagedBlobUrl = (url: string): void => {
  getBlobUrlManager().revoke(url)
}

/**
 * すべてのBlob URLを解放（グローバルマネージャー使用）
 */
export const revokeAllManagedBlobUrls = (): void => {
  getBlobUrlManager().revokeAll()
}

/**
 * グローバルBlobUrlManagerインスタンスをリセット（テスト用）
 *
 * テスト間でのBlob URL残留を防ぎ、テストの独立性を保証します。
 * 本番コードから呼び出す必要はありません。
 */
export const resetBlobUrlManager = (): void => {
  if (globalBlobUrlManager) {
    globalBlobUrlManager.cleanup()
    globalBlobUrlManager = null
  }
}
