/**
 * Diff Engine
 *
 * 新規画像と既存画像を区別する差分検出エンジン
 * IndexedDBの差分台帳を使用してハッシュベースの比較を実行
 *
 * @module background/diff-engine
 */

import type { ImageSnapshot } from '../shared/types'
import { getRecord, saveRecord, cleanupOldRecords as dbCleanupOldRecords } from '../lib/db'
import { makeRecordId, extractQueryHashFromRecordId } from '../lib/url-utils'
import { hashBlob } from '../lib/hasher'

/**
 * 差分計算結果
 */
export interface DiffResult {
  /** 新規画像のスナップショット */
  newImages: ImageSnapshot[]
  /** 既存画像のスナップショット */
  existingImages: ImageSnapshot[]
  /** 初回訪問かどうか */
  isFirstVisit: boolean
}

/**
 * 画像データと候補情報を含むオブジェクト
 */
export interface ImageWithData {
  blob: Blob
  url: string
  width: number
  height: number
  alt?: string
  context?: string
}

/**
 * URLに対する差分計算を実行
 *
 * @param url - 対象ページのURL
 * @param currentImages - 現在検出された画像データの配列
 * @returns 差分計算結果（新規画像、既存画像、初回訪問フラグ）
 *
 * @example
 * ```ts
 * const images = [
 *   { blob: imageBlob1, url: 'https://example.com/img1.jpg', width: 800, height: 600 },
 *   { blob: imageBlob2, url: 'https://example.com/img2.jpg', width: 1024, height: 768 }
 * ]
 * const result = await computeDiff('https://example.com/product?id=123', images)
 * console.log(`新規: ${result.newImages.length}, 既存: ${result.existingImages.length}`)
 * ```
 */
export const computeDiff = async (
  url: string,
  currentImages: ImageWithData[]
): Promise<DiffResult> => {
  const recordId = await makeRecordId(url)
  const now = Date.now() // 同一スキャンセッション内では同じタイムスタンプを使用

  // recordIdが空の場合は無効なURLとして扱う
  if (!recordId) {
    return {
      newImages: [],
      existingImages: [],
      isFirstVisit: false,
    }
  }

  // 既存レコードを取得
  const existingRecord = await getRecord(recordId)

  // 初回訪問の場合
  if (!existingRecord) {
    // すべての画像を新規として扱う
    const snapshots = await Promise.all(
      currentImages.map(async (img) => {
        const hash = await hashBlob(img.blob)
        return {
          hash,
          url: img.url,
          width: img.width,
          height: img.height,
          alt: img.alt,
          context: img.context,
          firstSeenAt: now,
        } satisfies ImageSnapshot
      })
    )

    return {
      newImages: snapshots,
      existingImages: [],
      isFirstVisit: true,
    }
  }

  // 既存画像のハッシュセットを作成
  const existingHashes = new Set(existingRecord.images.map((img) => img.hash))

  // 現在の画像を分類（新規 or 既存）
  // Promise.allでmap-filter方式を使用し、配列pushの競合を回避
  const results = await Promise.all(
    currentImages.map(async (img) => {
      const hash = await hashBlob(img.blob)
      const isExisting = existingHashes.has(hash)

      if (isExisting) {
        const existingSnapshot = existingRecord.images.find((e) => e.hash === hash)
        return { type: 'existing' as const, snapshot: existingSnapshot }
      } else {
        return {
          type: 'new' as const,
          snapshot: {
            hash,
            url: img.url,
            width: img.width,
            height: img.height,
            alt: img.alt,
            context: img.context,
            firstSeenAt: now,
          } satisfies ImageSnapshot,
        }
      }
    })
  )

  const newImages = results
    .filter((r) => r.type === 'new' && r.snapshot)
    .map((r) => r.snapshot as ImageSnapshot)
  const existingImages = results
    .filter((r) => r.type === 'existing' && r.snapshot)
    .map((r) => r.snapshot as ImageSnapshot)

  return {
    newImages,
    existingImages,
    isFirstVisit: false,
  }
}

/**
 * 差分台帳のレコードを更新
 *
 * 新規画像を既存レコードに追加して保存します。
 * レコードが存在しない場合は新規作成します。
 *
 * @param url - 対象ページのURL
 * @param newImages - 新規画像のスナップショット配列
 *
 * @example
 * ```ts
 * await updateRecord('https://example.com/product?id=123', [
 *   { hash: 'abc123...', url: 'https://example.com/new.jpg', width: 800, height: 600, firstSeenAt: Date.now() }
 * ])
 * ```
 */
export const updateRecord = async (url: string, newImages: ImageSnapshot[]): Promise<void> => {
  const recordId = await makeRecordId(url)

  // recordIdが空の場合は何もしない
  if (!recordId) {
    return
  }

  let urlObj: URL
  try {
    urlObj = new URL(url)
  } catch (error) {
    if (import.meta.env.DEV) {
      console.debug('[updateRecord] Invalid URL:', url, error)
    }
    return
  }

  const existingRecord = await getRecord(recordId)

  if (existingRecord) {
    // 既存レコードに新規画像を追加
    const updatedRecord = {
      ...existingRecord,
      lastScanAt: Date.now(),
      images: [...existingRecord.images, ...newImages],
    }
    await saveRecord(updatedRecord)
  } else {
    // 新規レコードを作成
    await saveRecord({
      id: recordId,
      url,
      origin: urlObj.origin,
      pathname: urlObj.pathname,
      queryHash: extractQueryHashFromRecordId(recordId),
      domain: urlObj.hostname,
      lastScanAt: Date.now(),
      images: newImages,
    })
  }
}

/**
 * 90日以上未参照のレコードを削除
 *
 * Background起動時または定期的に実行されます。
 *
 * @param daysOld - 削除対象となる日数（デフォルト: 90日）
 * @returns 削除されたレコード数
 *
 * @example
 * ```ts
 * const deletedCount = await cleanupOldRecords(90)
 * console.log(`${deletedCount}件の古いレコードを削除しました`)
 * ```
 */
export const cleanupOldRecords = async (daysOld = 90): Promise<number> => {
  return dbCleanupOldRecords(daysOld)
}
