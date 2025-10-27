/**
 * Storage Optimizer - chrome.storage用のデータ圧縮ユーティリティ
 *
 * 機能:
 * - 不要なメタデータの除去
 * - データサイズの削減
 * - ストレージ制限の回避
 */

import type { ImageCandidate, ImageSnapshot, ImageSource } from '../shared/types'

/**
 * 有効なImageSource値の定数配列
 */
const VALID_IMAGE_SOURCES: readonly ImageSource[] = [
  'img',
  'picture',
  'srcset',
  'css-bg',
  'canvas',
  'svg',
  'video',
  'iframe',
] as const

/**
 * ImageCandidate型ガード
 */
export const isImageCandidate = (item: unknown): item is ImageCandidate => {
  if (typeof item !== 'object' || item === null) {
    return false
  }

  const candidate = item as Partial<ImageCandidate>

  return (
    typeof candidate.url === 'string' &&
    typeof candidate.source === 'string' &&
    VALID_IMAGE_SOURCES.includes(candidate.source as ImageSource)
  )
}

/**
 * ImageSnapshot型ガード
 */
export const isImageSnapshot = (item: unknown): item is ImageSnapshot => {
  return (
    typeof item === 'object' &&
    item !== null &&
    'hash' in item &&
    typeof (item as { hash: unknown }).hash === 'string' &&
    'firstSeenAt' in item &&
    typeof (item as { firstSeenAt: unknown }).firstSeenAt === 'number'
  )
}

/**
 * オブジェクトから不要なプロパティを除去
 *
 * @param obj - 元のオブジェクト
 * @param keysToRemove - 除去するキーのリスト
 * @returns 圧縮されたオブジェクト
 */
export const removeUnnecessaryKeys = <T extends Record<string, unknown>>(
  obj: T,
  keysToRemove: string[]
): Partial<T> => {
  const keysToRemoveSet = new Set(keysToRemove)
  const result = {} as Partial<T>

  for (const [key, value] of Object.entries(obj)) {
    if (!keysToRemoveSet.has(key)) {
      result[key as keyof T] = value as T[keyof T]
    }
  }

  return result
}

/**
 * 配列内の各オブジェクトから不要なプロパティを除去
 */
export const compressArray = <T extends Record<string, unknown>>(
  array: T[],
  keysToRemove: string[]
): Partial<T>[] => {
  return array.map((item) => removeUnnecessaryKeys(item, keysToRemove))
}

/**
 * ImageCandidateの圧縮（ストレージ保存用）
 *
 * 不要なメタデータを除去:
 * - source: 検出元情報（再利用しない）
 * - alt: alt属性（サイズが大きい場合がある）
 */
export const compressImageCandidate = (
  candidate: ImageCandidate
): Omit<ImageCandidate, 'source' | 'alt'> => {
  const { source: _source, alt: _alt, ...rest } = candidate
  return rest
}

/**
 * ImageSnapshotの圧縮（差分台帳保存用）
 *
 * 不要なメタデータを除去:
 * - context: Phase 2機能（MVP では未使用）
 *
 * @param snapshot - 圧縮前のImageSnapshot（contextが含まれる場合がある）
 * @returns 圧縮されたImageSnapshot（contextを必ず除去）
 */
export const compressImageSnapshot = (
  snapshot: ImageSnapshot
): Omit<ImageSnapshot, 'context'> => {
  const { context: _context, ...rest } = snapshot
  return rest
}

/**
 * チェックポイントデータの圧縮
 *
 * @param checkpointData - チェックポイントデータ
 * @returns 圧縮されたデータ
 */
export const compressCheckpointData = (
  checkpointData: Record<string, unknown>
): Record<string, unknown> => {
  const compressed: Record<string, unknown> = {}

  for (const [key, value] of Object.entries(checkpointData)) {
    // 配列の場合は各要素を圧縮
    if (Array.isArray(value)) {
      compressed[key] = value.map((item) => {
        if (isImageCandidate(item)) {
          return compressImageCandidate(item)
        }
        if (isImageSnapshot(item)) {
          return compressImageSnapshot(item)
        }
        return item
      })
    } else {
      compressed[key] = value
    }
  }

  return compressed
}

/**
 * データサイズを計算（概算、バイト単位）
 */
export const estimateDataSize = (data: unknown): number => {
  const jsonString = JSON.stringify(data)
  return new Blob([jsonString]).size
}

/**
 * ストレージ制限チェック
 *
 * @param data - 保存予定のデータ
 * @param limit - 制限サイズ（バイト、デフォルト: 10KB = chrome.storage.sync制限）
 * @returns 制限内ならtrue
 */
export const isWithinStorageLimit = (data: unknown, limit = 10 * 1024): boolean => {
  const size = estimateDataSize(data)
  return size <= limit
}

/**
 * 古いデータのクリーンアップ
 *
 * @param data - データ配列（firstSeenAtを持つオブジェクト）
 * @param maxAge - 最大保持期間（ミリ秒、デフォルト: 90日）
 * @returns クリーンアップ後のデータ
 */
export const cleanupOldData = <T extends { firstSeenAt: number }>(
  data: T[],
  maxAge = 90 * 24 * 60 * 60 * 1000 // 90日
): T[] => {
  const now = Date.now()
  return data.filter((item) => now - item.firstSeenAt < maxAge)
}
