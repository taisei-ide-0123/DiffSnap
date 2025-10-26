import { describe, it, expect } from 'vitest'
import {
  removeUnnecessaryKeys,
  compressArray,
  compressImageCandidate,
  compressImageSnapshot,
  compressCheckpointData,
  estimateDataSize,
  isWithinStorageLimit,
  cleanupOldData,
} from './storage-optimizer'

describe('storage-optimizer', () => {
  describe('removeUnnecessaryKeys', () => {
    it('指定されたキーを除去する', () => {
      const obj = {
        id: 1,
        name: 'test',
        unnecessary: 'remove this',
        alsoUnnecessary: 'and this',
      }

      const result = removeUnnecessaryKeys(obj, ['unnecessary', 'alsoUnnecessary'])

      expect(result).toEqual({
        id: 1,
        name: 'test',
      })
    })

    it('存在しないキーを指定しても問題ない', () => {
      const obj = { id: 1, name: 'test' }

      const result = removeUnnecessaryKeys(obj, ['nonexistent'])

      expect(result).toEqual({ id: 1, name: 'test' })
    })

    it('空のキーリストでは元のオブジェクトと同じ', () => {
      const obj = { id: 1, name: 'test' }

      const result = removeUnnecessaryKeys(obj, [])

      expect(result).toEqual(obj)
    })
  })

  describe('compressArray', () => {
    it('配列内の全オブジェクトから不要なキーを除去する', () => {
      const array = [
        { id: 1, name: 'test1', remove: 'a' },
        { id: 2, name: 'test2', remove: 'b' },
      ]

      const result = compressArray(array, ['remove'])

      expect(result).toEqual([
        { id: 1, name: 'test1' },
        { id: 2, name: 'test2' },
      ])
    })
  })

  describe('compressImageCandidate', () => {
    it('source と alt を除去する', () => {
      const candidate = {
        url: 'https://example.com/image.jpg',
        source: 'img',
        width: 800,
        height: 600,
        alt: 'Sample image description',
      }

      const result = compressImageCandidate(candidate)

      expect(result).toEqual({
        url: 'https://example.com/image.jpg',
        width: 800,
        height: 600,
      })
      expect(result).not.toHaveProperty('source')
      expect(result).not.toHaveProperty('alt')
    })
  })

  describe('compressImageSnapshot', () => {
    it('context を除去する', () => {
      const snapshot = {
        hash: 'abc123',
        url: 'https://example.com/image.jpg',
        width: 800,
        height: 600,
        firstSeenAt: Date.now(),
        context: 'some context data',
      }

      const result = compressImageSnapshot(snapshot)

      expect(result).toEqual({
        hash: 'abc123',
        url: 'https://example.com/image.jpg',
        width: 800,
        height: 600,
        firstSeenAt: snapshot.firstSeenAt,
      })
      expect(result).not.toHaveProperty('context')
    })
  })

  describe('compressCheckpointData', () => {
    it('ImageCandidate配列を圧縮する', () => {
      const checkpointData = {
        candidates: [
          {
            url: 'https://example.com/1.jpg',
            source: 'img',
            width: 800,
            height: 600,
            alt: 'Image 1',
          },
          {
            url: 'https://example.com/2.jpg',
            source: 'img',
            width: 640,
            height: 480,
            alt: 'Image 2',
          },
        ],
      }

      const result = compressCheckpointData(checkpointData)

      expect(result.candidates).toEqual([
        { url: 'https://example.com/1.jpg', width: 800, height: 600 },
        { url: 'https://example.com/2.jpg', width: 640, height: 480 },
      ])
    })

    it('ImageSnapshot配列を圧縮する', () => {
      const checkpointData = {
        snapshots: [
          {
            hash: 'abc123',
            url: 'https://example.com/1.jpg',
            width: 800,
            height: 600,
            firstSeenAt: Date.now(),
            context: 'context data',
          },
        ],
      }

      const result = compressCheckpointData(checkpointData)

      expect(Array.isArray(result.snapshots)).toBe(true)
      expect(result.snapshots).toHaveLength(1)
      const firstSnapshot = (result.snapshots as unknown[])[0]
      expect(firstSnapshot).not.toHaveProperty('context')
    })

    it('配列以外のデータはそのまま保持する', () => {
      const checkpointData = {
        tabId: 123,
        status: 'fetching',
        timestamp: Date.now(),
      }

      const result = compressCheckpointData(checkpointData)

      expect(result).toEqual(checkpointData)
    })
  })

  describe('estimateDataSize', () => {
    it('データサイズを概算できる', () => {
      const data = { id: 1, name: 'test' }

      const size = estimateDataSize(data)

      expect(size).toBeGreaterThan(0)
      expect(size).toBeLessThan(100) // 小さなオブジェクトなので100バイト未満
    })

    it('大きなデータではサイズが増加する', () => {
      const smallData = { id: 1 }
      const largeData = {
        id: 1,
        data: 'a'.repeat(1000),
      }

      const smallSize = estimateDataSize(smallData)
      const largeSize = estimateDataSize(largeData)

      expect(largeSize).toBeGreaterThan(smallSize)
    })
  })

  describe('isWithinStorageLimit', () => {
    it('制限内のデータはtrueを返す', () => {
      const data = { id: 1, name: 'test' }

      const result = isWithinStorageLimit(data, 1000)

      expect(result).toBe(true)
    })

    it('制限を超えるデータはfalseを返す', () => {
      const data = {
        largeData: 'a'.repeat(20000),
      }

      const result = isWithinStorageLimit(data, 10 * 1024)

      expect(result).toBe(false)
    })

    it('デフォルトは10KBの制限', () => {
      const data = {
        data: 'a'.repeat(15000),
      }

      const result = isWithinStorageLimit(data)

      expect(result).toBe(false)
    })
  })

  describe('cleanupOldData', () => {
    it('古いデータを削除する', () => {
      const now = Date.now()
      const data = [
        { id: 1, firstSeenAt: now - 100 * 24 * 60 * 60 * 1000 }, // 100日前（削除対象）
        { id: 2, firstSeenAt: now - 30 * 24 * 60 * 60 * 1000 }, // 30日前（保持）
        { id: 3, firstSeenAt: now - 1 * 24 * 60 * 60 * 1000 }, // 1日前（保持）
      ]

      const result = cleanupOldData(data, 90 * 24 * 60 * 60 * 1000)

      expect(result).toHaveLength(2)
      expect(result.map((item) => item.id)).toEqual([2, 3])
    })

    it('全て新しいデータの場合は全て保持', () => {
      const now = Date.now()
      const data = [
        { id: 1, firstSeenAt: now - 1 * 24 * 60 * 60 * 1000 },
        { id: 2, firstSeenAt: now - 2 * 24 * 60 * 60 * 1000 },
      ]

      const result = cleanupOldData(data, 90 * 24 * 60 * 60 * 1000)

      expect(result).toHaveLength(2)
    })

    it('全て古いデータの場合は全て削除', () => {
      const now = Date.now()
      const data = [
        { id: 1, firstSeenAt: now - 100 * 24 * 60 * 60 * 1000 },
        { id: 2, firstSeenAt: now - 200 * 24 * 60 * 60 * 1000 },
      ]

      const result = cleanupOldData(data, 90 * 24 * 60 * 60 * 1000)

      expect(result).toHaveLength(0)
    })

    it('カスタム保持期間を設定できる', () => {
      const now = Date.now()
      const data = [
        { id: 1, firstSeenAt: now - 40 * 24 * 60 * 60 * 1000 }, // 40日前
        { id: 2, firstSeenAt: now - 20 * 24 * 60 * 60 * 1000 }, // 20日前
      ]

      const result = cleanupOldData(data, 30 * 24 * 60 * 60 * 1000) // 30日保持

      expect(result).toHaveLength(1)
      expect(result[0]?.id).toBe(2)
    })
  })
})
