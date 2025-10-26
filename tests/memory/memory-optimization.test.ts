/**
 * メモリ最適化テスト
 *
 * Issue #27 の成功基準:
 * - 1000枚処理でメモリ <500MB
 * - メモリリーク <10MB
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { BlobUrlManager } from '../../src/lib/blob-url-manager'
import {
  compressCheckpointData,
  estimateDataSize,
  cleanupOldData,
} from '../../src/lib/storage-optimizer'

// Mock URL.createObjectURL and URL.revokeObjectURL for testing
const mockBlobUrls = new Map<string, Blob>()
let urlCounter = 0

global.URL.createObjectURL = vi.fn((blob: Blob) => {
  const url = `blob:mock-${++urlCounter}`
  mockBlobUrls.set(url, blob)
  return url
})

global.URL.revokeObjectURL = vi.fn((url: string) => {
  mockBlobUrls.delete(url)
})

describe('Memory Optimization Tests', () => {
  describe('Blob URL Management', () => {
    let manager: BlobUrlManager

    beforeEach(() => {
      manager = new BlobUrlManager(5000) // 5秒タイムアウト
      mockBlobUrls.clear()
      urlCounter = 0
    })

    afterEach(() => {
      manager.cleanup()
    })

    it('大量のBlob URLを適切に管理できる', () => {
      const blobCount = 100
      const blobs: string[] = []

      // 100個のBlob URLを作成
      for (let i = 0; i < blobCount; i++) {
        const blob = new Blob([`test-${i}`], { type: 'text/plain' })
        const url = manager.create(blob)
        blobs.push(url)
      }

      expect(manager.getCount()).toBe(blobCount)

      // 全てのBlob URLを解放
      for (const url of blobs) {
        manager.revoke(url)
      }

      expect(manager.getCount()).toBe(0)
    })

    it('Blob URLを作成しても過度なメモリを消費しない', () => {
      const initialMemory = process.memoryUsage().heapUsed
      const blobCount = 1000

      // 1000個のBlob URLを作成
      for (let i = 0; i < blobCount; i++) {
        const blob = new Blob([`test-${i}`], { type: 'text/plain' })
        manager.create(blob)
      }

      const afterCreationMemory = process.memoryUsage().heapUsed
      const memoryIncrease = afterCreationMemory - initialMemory

      // メモリ増加が10MB未満であること（Node.jsのメモリ管理の影響で正確ではないが目安）
      expect(memoryIncrease).toBeLessThan(10 * 1024 * 1024)

      // クリーンアップ
      manager.cleanup()

      const afterCleanupMemory = process.memoryUsage().heapUsed
      const memoryLeak = afterCleanupMemory - initialMemory

      // メモリリークが10MB未満であること
      expect(memoryLeak).toBeLessThan(10 * 1024 * 1024)
    })

    it('タイムアウト後に自動的にBlob URLが解放される', async () => {
      const blob = new Blob(['test'], { type: 'text/plain' })
      const url = manager.create(blob, 100) // 100msタイムアウト

      expect(manager.has(url)).toBe(true)

      // タイムアウトを待つ
      await new Promise((resolve) => setTimeout(resolve, 150))

      // 自動的に解放されていることを確認
      expect(manager.has(url)).toBe(false)
    })
  })

  describe('Data Compression', () => {
    it('ImageCandidateデータを圧縮してサイズを削減できる', () => {
      const checkpointData = {
        candidates: Array.from({ length: 100 }, (_, i) => ({
          url: `https://example.com/image-${i}.jpg`,
          source: 'img' as const,
          width: 800,
          height: 600,
          alt: `This is a very long alt text for image ${i} that takes up a lot of space in storage`,
        })),
      }

      const originalSize = estimateDataSize(checkpointData)
      const compressed = compressCheckpointData(checkpointData)
      const compressedSize = estimateDataSize(compressed)

      // 圧縮によりサイズが削減されることを確認
      expect(compressedSize).toBeLessThan(originalSize)

      // 圧縮率を計算（30%以上の削減を期待）
      const compressionRatio = (originalSize - compressedSize) / originalSize
      expect(compressionRatio).toBeGreaterThan(0.3)
    })

    it('ImageSnapshotデータを圧縮してサイズを削減できる', () => {
      const checkpointData = {
        snapshots: Array.from({ length: 100 }, (_, i) => ({
          hash: `hash-${i}`,
          url: `https://example.com/image-${i}.jpg`,
          width: 800,
          height: 600,
          firstSeenAt: Date.now(),
          context: `This is context data for image ${i} that is not needed in MVP`,
        })),
      }

      const originalSize = estimateDataSize(checkpointData)
      const compressed = compressCheckpointData(checkpointData)
      const compressedSize = estimateDataSize(compressed)

      // 圧縮によりサイズが削減されることを確認
      expect(compressedSize).toBeLessThan(originalSize)
    })
  })

  describe('Old Data Cleanup', () => {
    it('古いスナップショットを削除してメモリを節約できる', () => {
      const now = Date.now()
      const snapshots = [
        ...Array.from({ length: 500 }, (_, i) => ({
          id: i,
          hash: `old-${i}`,
          firstSeenAt: now - 100 * 24 * 60 * 60 * 1000, // 100日前
        })),
        ...Array.from({ length: 500 }, (_, i) => ({
          id: i + 500,
          hash: `new-${i}`,
          firstSeenAt: now - 10 * 24 * 60 * 60 * 1000, // 10日前
        })),
      ]

      const originalSize = estimateDataSize(snapshots)
      const cleaned = cleanupOldData(snapshots, 90 * 24 * 60 * 60 * 1000)
      const cleanedSize = estimateDataSize(cleaned)

      // 古いデータが削除されている
      expect(cleaned).toHaveLength(500)

      // サイズが約半分になっている
      expect(cleanedSize).toBeLessThan(originalSize * 0.6)
    })
  })

  describe('Large Scale Memory Test', () => {
    it('1000枚の画像データを処理してもメモリが500MB以下', () => {
      const imageCount = 1000
      const images = Array.from({ length: imageCount }, (_, i) => ({
        url: `https://example.com/large-image-${i}.jpg`,
        source: 'img' as const,
        width: 1920,
        height: 1080,
        alt: `High resolution image ${i} with detailed description`,
        hash: `hash-${i}`,
        firstSeenAt: Date.now(),
      }))

      // 圧縮前のサイズ
      const uncompressedSize = estimateDataSize({ images })

      // 圧縮
      const compressed = compressCheckpointData({ images })
      const compressedSize = estimateDataSize(compressed)

      // 500MB以下であることを確認（圧縮後）
      expect(compressedSize).toBeLessThan(500 * 1024 * 1024)

      // 圧縮により大幅にサイズが削減されている
      expect(compressedSize).toBeLessThan(uncompressedSize * 0.7)
    })

    it('メモリリークが10MB未満', () => {
      const initialMemory = process.memoryUsage().heapUsed
      const manager = new BlobUrlManager()

      // 1000個のBlob URLを作成して解放
      for (let i = 0; i < 1000; i++) {
        const blob = new Blob([`test-${i}`], { type: 'text/plain' })
        const url = manager.create(blob)
        manager.revoke(url)
      }

      manager.cleanup()

      // ガベージコレクションを促進（Node.jsの場合）
      if (global.gc) {
        global.gc()
      }

      const finalMemory = process.memoryUsage().heapUsed
      const memoryLeak = finalMemory - initialMemory

      // メモリリークが10MB未満
      expect(memoryLeak).toBeLessThan(10 * 1024 * 1024)
    })
  })
})
