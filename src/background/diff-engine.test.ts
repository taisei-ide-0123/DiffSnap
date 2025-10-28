/**
 * Diff Engine Tests
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { computeDiff, updateRecord, cleanupOldRecords, type ImageWithData } from './diff-engine'
import { clearDatabase, getRecord } from '../lib/db'

describe('diff-engine', () => {
  // 各テスト前にDBをクリア
  beforeEach(async () => {
    await clearDatabase()
  })

  // タイマーのクリア
  afterEach(() => {
    vi.clearAllTimers()
  })

  describe('computeDiff', () => {
    it('初回訪問時は全画像を新規として扱う', async () => {
      const url = 'https://example.com/product?id=123'
      const images: ImageWithData[] = [
        {
          blob: new Blob(['image1'], { type: 'image/jpeg' }),
          url: 'https://example.com/img1.jpg',
          width: 800,
          height: 600,
        },
        {
          blob: new Blob(['image2'], { type: 'image/jpeg' }),
          url: 'https://example.com/img2.jpg',
          width: 1024,
          height: 768,
        },
      ]

      const result = await computeDiff(url, images)

      expect(result.isFirstVisit).toBe(true)
      expect(result.newImages).toHaveLength(2)
      expect(result.existingImages).toHaveLength(0)
      expect(result.newImages[0]).toMatchObject({
        url: 'https://example.com/img1.jpg',
        width: 800,
        height: 600,
      })
      expect(result.newImages[0]?.hash).toBeTruthy()
      expect(result.newImages[0]?.firstSeenAt).toBeTruthy()
    })

    it('再訪問時は新規と既存を区別する', async () => {
      const url = 'https://example.com/product?id=123'

      // 初回訪問
      const initialImages: ImageWithData[] = [
        {
          blob: new Blob(['existing-image'], { type: 'image/jpeg' }),
          url: 'https://example.com/existing.jpg',
          width: 800,
          height: 600,
        },
      ]

      const firstResult = await computeDiff(url, initialImages)
      await updateRecord(url, firstResult.newImages)

      // 再訪問（既存画像1つ + 新規画像1つ）
      const secondImages: ImageWithData[] = [
        {
          blob: new Blob(['existing-image'], { type: 'image/jpeg' }),
          url: 'https://example.com/existing.jpg',
          width: 800,
          height: 600,
        },
        {
          blob: new Blob(['new-image'], { type: 'image/jpeg' }),
          url: 'https://example.com/new.jpg',
          width: 1024,
          height: 768,
        },
      ]

      const secondResult = await computeDiff(url, secondImages)

      expect(secondResult.isFirstVisit).toBe(false)
      expect(secondResult.existingImages).toHaveLength(1)
      expect(secondResult.newImages).toHaveLength(1)
      expect(secondResult.existingImages[0]?.url).toBe('https://example.com/existing.jpg')
      expect(secondResult.newImages[0]?.url).toBe('https://example.com/new.jpg')
    })

    it('無効なURLの場合は空の結果を返す', async () => {
      const invalidUrl = 'invalid-url'
      const images: ImageWithData[] = [
        {
          blob: new Blob(['image'], { type: 'image/jpeg' }),
          url: 'https://example.com/img.jpg',
          width: 800,
          height: 600,
        },
      ]

      const result = await computeDiff(invalidUrl, images)

      expect(result.newImages).toHaveLength(0)
      expect(result.existingImages).toHaveLength(0)
      expect(result.isFirstVisit).toBe(false)
    })

    it('空の画像配列の場合は空の結果を返す', async () => {
      const url = 'https://example.com/product?id=123'
      const images: ImageWithData[] = []

      const result = await computeDiff(url, images)

      expect(result.newImages).toHaveLength(0)
      expect(result.existingImages).toHaveLength(0)
    })

    it('同じコンテンツだがURLが異なる画像は既存として扱う', async () => {
      const url = 'https://example.com/product?id=123'

      // 初回訪問
      const initialImages: ImageWithData[] = [
        {
          blob: new Blob(['same-content'], { type: 'image/jpeg' }),
          url: 'https://example.com/img.jpg?v=1',
          width: 800,
          height: 600,
        },
      ]

      const firstResult = await computeDiff(url, initialImages)
      await updateRecord(url, firstResult.newImages)

      // 再訪問（同じコンテンツだが異なるURL）
      const secondImages: ImageWithData[] = [
        {
          blob: new Blob(['same-content'], { type: 'image/jpeg' }),
          url: 'https://example.com/img.jpg?v=2',
          width: 800,
          height: 600,
        },
      ]

      const secondResult = await computeDiff(url, secondImages)

      expect(secondResult.existingImages).toHaveLength(1)
      expect(secondResult.newImages).toHaveLength(0)
    })

    it('altとcontextを保持する', async () => {
      const url = 'https://example.com/product?id=123'
      const images: ImageWithData[] = [
        {
          blob: new Blob(['image'], { type: 'image/jpeg' }),
          url: 'https://example.com/img.jpg',
          width: 800,
          height: 600,
          alt: 'Product Image',
          context: 'Buy this amazing product',
        },
      ]

      const result = await computeDiff(url, images)

      expect(result.newImages[0]?.alt).toBe('Product Image')
      expect(result.newImages[0]?.context).toBe('Buy this amazing product')
    })
  })

  describe('updateRecord', () => {
    it('新規レコードを作成する', async () => {
      const url = 'https://example.com/product?id=123'
      const newImages = [
        {
          hash: 'abc123',
          url: 'https://example.com/img.jpg',
          width: 800,
          height: 600,
          firstSeenAt: Date.now(),
        },
      ]

      await updateRecord(url, newImages)

      const recordId = await import('../lib/url-utils').then((m) => m.makeRecordId(url))
      const record = await getRecord(recordId)

      expect(record).toBeTruthy()
      expect(record?.images).toHaveLength(1)
      expect(record?.domain).toBe('example.com')
      expect(record?.origin).toBe('https://example.com')
      expect(record?.pathname).toBe('/product')
    })

    it('既存レコードに画像を追加する', async () => {
      const url = 'https://example.com/product?id=123'

      // 初回保存
      const firstImages = [
        {
          hash: 'hash1',
          url: 'https://example.com/img1.jpg',
          width: 800,
          height: 600,
          firstSeenAt: Date.now(),
        },
      ]
      await updateRecord(url, firstImages)

      // 2回目保存
      const secondImages = [
        {
          hash: 'hash2',
          url: 'https://example.com/img2.jpg',
          width: 1024,
          height: 768,
          firstSeenAt: Date.now(),
        },
      ]
      await updateRecord(url, secondImages)

      const recordId = await import('../lib/url-utils').then((m) => m.makeRecordId(url))
      const record = await getRecord(recordId)

      expect(record?.images).toHaveLength(2)
      expect(record?.images.map((img) => img.hash)).toEqual(['hash1', 'hash2'])
    })

    it('lastScanAtを更新する', async () => {
      const url = 'https://example.com/product?id=123'

      // 初回保存
      const firstImages = [
        {
          hash: 'hash1',
          url: 'https://example.com/img1.jpg',
          width: 800,
          height: 600,
          firstSeenAt: Date.now(),
        },
      ]
      await updateRecord(url, firstImages)

      const recordId = await import('../lib/url-utils').then((m) => m.makeRecordId(url))
      const firstRecord = await getRecord(recordId)
      const firstScanAt = firstRecord?.lastScanAt

      // 少し待つ
      await new Promise((resolve) => setTimeout(resolve, 10))

      // 2回目保存
      await updateRecord(url, [])

      const secondRecord = await getRecord(recordId)
      expect(secondRecord?.lastScanAt).toBeGreaterThan(firstScanAt ?? 0)
    })

    it('無効なURLの場合は何もしない', async () => {
      const invalidUrl = 'invalid-url'
      const images = [
        {
          hash: 'hash1',
          url: 'https://example.com/img.jpg',
          width: 800,
          height: 600,
          firstSeenAt: Date.now(),
        },
      ]

      await expect(updateRecord(invalidUrl, images)).resolves.not.toThrow()
    })
  })

  describe('cleanupOldRecords', () => {
    it('指定日数より古いレコードを削除する', async () => {
      const now = Date.now()
      const ninetyOneDaysAgo = now - 91 * 24 * 60 * 60 * 1000

      // 古いレコードを作成
      const oldUrl = 'https://example.com/old?id=1'
      const oldImages = [
        {
          hash: 'old-hash',
          url: 'https://example.com/old.jpg',
          width: 800,
          height: 600,
          firstSeenAt: ninetyOneDaysAgo,
        },
      ]
      await updateRecord(oldUrl, oldImages)

      // lastScanAtを古い日付に変更
      const oldRecordId = await import('../lib/url-utils').then((m) => m.makeRecordId(oldUrl))
      const oldRecord = await getRecord(oldRecordId)
      if (oldRecord) {
        await import('../lib/db').then((m) =>
          m.saveRecord({
            ...oldRecord,
            lastScanAt: ninetyOneDaysAgo,
          })
        )
      }

      // 新しいレコードを作成
      const newUrl = 'https://example.com/new?id=2'
      const newImages = [
        {
          hash: 'new-hash',
          url: 'https://example.com/new.jpg',
          width: 800,
          height: 600,
          firstSeenAt: now,
        },
      ]
      await updateRecord(newUrl, newImages)

      // クリーンアップ実行
      const deletedCount = await cleanupOldRecords(90)

      expect(deletedCount).toBe(1)

      // 古いレコードが削除されていることを確認
      const oldRecordAfter = await getRecord(oldRecordId)
      expect(oldRecordAfter).toBeUndefined()

      // 新しいレコードは残っていることを確認
      const newRecordId = await import('../lib/url-utils').then((m) => m.makeRecordId(newUrl))
      const newRecordAfter = await getRecord(newRecordId)
      expect(newRecordAfter).toBeTruthy()
    })

    it('指定日数以内のレコードは削除しない', async () => {
      const now = Date.now()
      const recentUrl = 'https://example.com/recent?id=1'
      const recentImages = [
        {
          hash: 'recent-hash',
          url: 'https://example.com/recent.jpg',
          width: 800,
          height: 600,
          firstSeenAt: now,
        },
      ]
      await updateRecord(recentUrl, recentImages)

      const deletedCount = await cleanupOldRecords(90)

      expect(deletedCount).toBe(0)

      const recentRecordId = await import('../lib/url-utils').then((m) => m.makeRecordId(recentUrl))
      const recentRecord = await getRecord(recentRecordId)
      expect(recentRecord).toBeTruthy()
    })

    it('レコードが存在しない場合は0を返す', async () => {
      const deletedCount = await cleanupOldRecords(90)
      expect(deletedCount).toBe(0)
    })
  })
})
