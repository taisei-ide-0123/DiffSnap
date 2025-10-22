/**
 * SHA-256 Hash Utilities Test Suite
 */

import { describe, it, expect, vi } from 'vitest'
import { sha256, hashBlob } from '../../src/lib/hasher'

describe('hasher', () => {
  describe('sha256', () => {
    it('文字列入力のハッシュ化', async () => {
      const input = 'hello world'
      const hash = await sha256(input)

      // SHA-256は64文字の16進数文字列
      expect(hash).toHaveLength(64)
      expect(hash).toMatch(/^[0-9a-f]{64}$/)

      // 既知のハッシュ値と比較（"hello world"のSHA-256）
      expect(hash).toBe('b94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9')
    })

    it('空文字列のハッシュ化', async () => {
      const hash = await sha256('')

      // 空文字列の既知のSHA-256ハッシュ
      expect(hash).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855')
    })

    it('日本語文字列のハッシュ化（UTF-8対応）', async () => {
      const input = 'こんにちは世界'
      const hash = await sha256(input)

      expect(hash).toHaveLength(64)
      expect(hash).toMatch(/^[0-9a-f]{64}$/)

      // 既知のハッシュ値と比較
      expect(hash).toBe('c6a304536826fb57e1b1896fcd8c91693a746233ae6a286dc85a65c8ae1f416f')
    })

    it('ArrayBuffer入力のハッシュ化', async () => {
      const input = new TextEncoder().encode('hello world').buffer
      const hash = await sha256(input)

      // 文字列入力と同じハッシュ値
      expect(hash).toBe('b94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9')
    })

    it('Uint8Array入力のハッシュ化', async () => {
      const input = new Uint8Array([1, 2, 3, 4, 5])
      const hash = await sha256(input)

      expect(hash).toHaveLength(64)
      expect(hash).toMatch(/^[0-9a-f]{64}$/)

      // 既知のハッシュ値と比較
      expect(hash).toBe('74f81fe167d99b4cb41d6d0ccda82278caee9f3e2f25d5e5a3936ff3dcec60d0')
    })

    it('Uint16Array入力のハッシュ化', async () => {
      const input = new Uint16Array([256, 512, 1024])
      const hash = await sha256(input)

      expect(hash).toHaveLength(64)
      expect(hash).toMatch(/^[0-9a-f]{64}$/)
    })

    it('同一データで同一ハッシュを生成（冪等性）', async () => {
      const input = 'test data for idempotency'

      const hash1 = await sha256(input)
      const hash2 = await sha256(input)
      const hash3 = await sha256(input)

      expect(hash1).toBe(hash2)
      expect(hash2).toBe(hash3)
    })

    it('異なるデータで異なるハッシュを生成', async () => {
      const hash1 = await sha256('data1')
      const hash2 = await sha256('data2')
      const hash3 = await sha256('data3')

      expect(hash1).not.toBe(hash2)
      expect(hash2).not.toBe(hash3)
      expect(hash1).not.toBe(hash3)
    })

    it('大きなデータのハッシュ化（1MBデータ）', async () => {
      // 1MB（1,048,576バイト）のデータを生成
      const size = 1024 * 1024
      const largeData = new Uint8Array(size)

      // データを埋める（パターン化）
      for (let i = 0; i < size; i++) {
        largeData[i] = i % 256
      }

      const startTime = performance.now()
      const hash = await sha256(largeData)
      const endTime = performance.now()

      const duration = endTime - startTime

      expect(hash).toHaveLength(64)
      expect(hash).toMatch(/^[0-9a-f]{64}$/)

      // パフォーマンス要件: 1MBデータのハッシュ化 <100ms
      expect(duration).toBeLessThan(100)

      console.log(`1MB data hashing took ${duration.toFixed(2)}ms`)
    })
  })

  describe('hashBlob', () => {
    it('Blobのハッシュ化', async () => {
      const data = new TextEncoder().encode('hello world')
      const blob = new Blob([data], { type: 'text/plain' })

      const hash = await hashBlob(blob)

      // 文字列入力と同じハッシュ値
      expect(hash).toBe('b94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9')
    })

    it('画像Blobのシミュレーションでハッシュ化', async () => {
      // 画像風のバイナリデータを作成（PNG署名: 89 50 4E 47...）
      const pngSignature = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
      const blob = new Blob([pngSignature], { type: 'image/png' })

      const hash = await hashBlob(blob)

      expect(hash).toHaveLength(64)
      expect(hash).toMatch(/^[0-9a-f]{64}$/)
    })

    it('空Blobのハッシュ化', async () => {
      const blob = new Blob([], { type: 'application/octet-stream' })
      const hash = await hashBlob(blob)

      // 空データの既知のSHA-256ハッシュ
      expect(hash).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855')
    })

    it('大きなBlobのハッシュ化（1MB）', async () => {
      // 1MBのBlob生成
      const size = 1024 * 1024
      const largeData = new Uint8Array(size)

      for (let i = 0; i < size; i++) {
        largeData[i] = i % 256
      }

      const blob = new Blob([largeData], { type: 'application/octet-stream' })

      const startTime = performance.now()
      const hash = await hashBlob(blob)
      const endTime = performance.now()

      const duration = endTime - startTime

      expect(hash).toHaveLength(64)
      expect(hash).toMatch(/^[0-9a-f]{64}$/)

      // パフォーマンス要件: 1MBデータのハッシュ化 <100ms
      expect(duration).toBeLessThan(100)

      console.log(`1MB blob hashing took ${duration.toFixed(2)}ms`)
    })

    it('同一Blobで同一ハッシュを生成（冪等性）', async () => {
      const data = new TextEncoder().encode('test data')
      const blob = new Blob([data])

      const hash1 = await hashBlob(blob)
      const hash2 = await hashBlob(blob)
      const hash3 = await hashBlob(blob)

      expect(hash1).toBe(hash2)
      expect(hash2).toBe(hash3)
    })

    it('異なるBlobで異なるハッシュを生成', async () => {
      const blob1 = new Blob([new TextEncoder().encode('data1')])
      const blob2 = new Blob([new TextEncoder().encode('data2')])
      const blob3 = new Blob([new TextEncoder().encode('data3')])

      const hash1 = await hashBlob(blob1)
      const hash2 = await hashBlob(blob2)
      const hash3 = await hashBlob(blob3)

      expect(hash1).not.toBe(hash2)
      expect(hash2).not.toBe(hash3)
      expect(hash1).not.toBe(hash3)
    })
  })

  describe('Error handling', () => {
    it('crypto.subtle.digestエラー時に適切なエラーメッセージ', async () => {
      // crypto.subtle.digestをモック化してエラーを発生させる
      const originalDigest = crypto.subtle.digest
      const mockDigest = vi.fn().mockRejectedValue(new Error('Digest operation failed'))

      crypto.subtle.digest = mockDigest

      await expect(sha256('test')).rejects.toThrow('Failed to calculate SHA-256')
      await expect(sha256('test')).rejects.toThrow('Digest operation failed')

      // 元に戻す
      crypto.subtle.digest = originalDigest
    })

    it('無効なBlob入力でエラースロー', async () => {
      // nullやundefinedのBlob
      const invalidBlob = null as unknown as Blob

      await expect(hashBlob(invalidBlob)).rejects.toThrow('Failed to hash blob')
    })

    it('FileReaderエラー時にリソース解放とエラーメッセージ', async () => {
      // FileReaderのエラーをシミュレート
      const originalFileReader = global.FileReader
      const abortSpy = vi.fn()

      class MockFileReader {
        result: ArrayBuffer | null = null
        error: DOMException | null = new DOMException('Mock read error')

        readAsArrayBuffer() {
          // エラーイベントを非同期で発火
          setTimeout(() => {
            if (this.onerror) {
              this.onerror(new Event('error') as ProgressEvent<FileReader>)
            }
          }, 0)
        }

        abort = abortSpy
        onerror: ((this: FileReader, ev: ProgressEvent<FileReader>) => unknown) | null = null
        onload: ((this: FileReader, ev: ProgressEvent<FileReader>) => unknown) | null = null
      }

      // blob.arrayBufferが存在しない環境をシミュレート
      const blob = new Blob(['test'])
      // @ts-expect-error Testing fallback path
      blob.arrayBuffer = undefined

      // @ts-expect-error Mock implementation
      global.FileReader = MockFileReader

      await expect(hashBlob(blob)).rejects.toThrow('FileReader error')
      await expect(hashBlob(blob)).rejects.toThrow('Mock read error')

      // 元に戻す
      global.FileReader = originalFileReader
    })

    it('hashBlobでBlob読み込み中のエラー処理', async () => {
      // モックFileReaderで即座にエラー発生
      const originalFileReader = global.FileReader

      class ErrorFileReader {
        error = new DOMException('Read failed')
        abort = vi.fn()
        readAsArrayBuffer() {
          if (this.onerror) {
            this.onerror(new Event('error') as ProgressEvent<FileReader>)
          }
        }
        onerror: ((this: FileReader, ev: ProgressEvent<FileReader>) => unknown) | null = null
        onload: ((this: FileReader, ev: ProgressEvent<FileReader>) => unknown) | null = null
      }

      const blob = new Blob(['test data'])
      // @ts-expect-error Testing fallback
      blob.arrayBuffer = undefined

      // @ts-expect-error Mock
      global.FileReader = ErrorFileReader

      await expect(hashBlob(blob)).rejects.toThrow('Failed to hash blob')

      global.FileReader = originalFileReader
    })
  })

  describe('Integration tests', () => {
    it('sha256とhashBlobで同一データの同一ハッシュを生成', async () => {
      const text = 'integration test data'
      const textBuffer = new TextEncoder().encode(text)

      // sha256で文字列からハッシュ化
      const hash1 = await sha256(text)

      // sha256でArrayBufferからハッシュ化
      const hash2 = await sha256(textBuffer.buffer)

      // hashBlobでBlobからハッシュ化
      const blob = new Blob([textBuffer])
      const hash3 = await hashBlob(blob)

      // すべて同一のハッシュ値
      expect(hash1).toBe(hash2)
      expect(hash2).toBe(hash3)
    })

    it('画像去重シナリオのシミュレーション', async () => {
      // 同じ画像を2回fetchしたケースをシミュレート
      const imageData = new Uint8Array([0x89, 0x50, 0x4e, 0x47])

      const blob1 = new Blob([imageData], { type: 'image/png' })
      const blob2 = new Blob([imageData], { type: 'image/png' })

      const hash1 = await hashBlob(blob1)
      const hash2 = await hashBlob(blob2)

      // 去重判定: 同一ハッシュ → 重複画像として除外
      expect(hash1).toBe(hash2)
    })
  })
})
