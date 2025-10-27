import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import {
  BlobUrlManager,
  getBlobUrlManager,
  createManagedBlobUrl,
  revokeManagedBlobUrl,
  revokeAllManagedBlobUrls,
  resetBlobUrlManager,
} from './blob-url-manager'

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

describe('BlobUrlManager', () => {
  let manager: BlobUrlManager

  beforeEach(() => {
    manager = new BlobUrlManager(1000) // 1秒タイムアウト
    vi.useFakeTimers()
    mockBlobUrls.clear()
    urlCounter = 0
  })

  afterEach(() => {
    manager.cleanup()
    vi.restoreAllMocks()
  })

  describe('create', () => {
    it('Blob URLを作成して追跡する', () => {
      const blob = new Blob(['test'], { type: 'text/plain' })
      const url = manager.create(blob)

      expect(url).toMatch(/^blob:/)
      expect(manager.has(url)).toBe(true)
      expect(manager.getCount()).toBe(1)
    })

    it('複数のBlob URLを作成できる', () => {
      const blob1 = new Blob(['test1'], { type: 'text/plain' })
      const blob2 = new Blob(['test2'], { type: 'text/plain' })

      const url1 = manager.create(blob1)
      const url2 = manager.create(blob2)

      expect(manager.getCount()).toBe(2)
      expect(manager.has(url1)).toBe(true)
      expect(manager.has(url2)).toBe(true)
    })

    it('カスタムタイムアウトを設定できる', () => {
      const blob = new Blob(['test'], { type: 'text/plain' })
      const url = manager.create(blob, 2000) // 2秒

      expect(manager.has(url)).toBe(true)

      // 1.5秒経過
      vi.advanceTimersByTime(1500)
      expect(manager.has(url)).toBe(true)

      // さらに0.6秒経過（合計2.1秒）
      vi.advanceTimersByTime(600)
      expect(manager.has(url)).toBe(false)
    })
  })

  describe('revoke', () => {
    it('Blob URLを解放する', () => {
      const blob = new Blob(['test'], { type: 'text/plain' })
      const url = manager.create(blob)

      manager.revoke(url)

      expect(manager.has(url)).toBe(false)
      expect(manager.getCount()).toBe(0)
    })

    it('存在しないURLの解放は無害', () => {
      expect(() => {
        manager.revoke('blob:nonexistent')
      }).not.toThrow()
    })

    it('タイムアウトをクリアする', () => {
      const blob = new Blob(['test'], { type: 'text/plain' })
      const url = manager.create(blob, 1000)

      manager.revoke(url)

      // タイムアウト経過後も再解放されない
      vi.advanceTimersByTime(1500)
      expect(manager.getCount()).toBe(0)
    })
  })

  describe('revokeAll', () => {
    it('すべてのBlob URLを解放する', () => {
      const blob1 = new Blob(['test1'], { type: 'text/plain' })
      const blob2 = new Blob(['test2'], { type: 'text/plain' })
      const blob3 = new Blob(['test3'], { type: 'text/plain' })

      manager.create(blob1)
      manager.create(blob2)
      manager.create(blob3)

      expect(manager.getCount()).toBe(3)

      manager.revokeAll()

      expect(manager.getCount()).toBe(0)
    })

    it('空の状態でrevokeAllしても問題ない', () => {
      expect(() => {
        manager.revokeAll()
      }).not.toThrow()
    })
  })

  describe('timeout behavior', () => {
    it('デフォルトタイムアウトで自動解放される', () => {
      const blob = new Blob(['test'], { type: 'text/plain' })
      const url = manager.create(blob)

      expect(manager.has(url)).toBe(true)

      // タイムアウト直前
      vi.advanceTimersByTime(999)
      expect(manager.has(url)).toBe(true)

      // タイムアウト経過
      vi.advanceTimersByTime(2)
      expect(manager.has(url)).toBe(false)
    })

    it('タイムアウト前に手動解放した場合、タイマーはクリアされる', () => {
      const blob = new Blob(['test'], { type: 'text/plain' })
      const url = manager.create(blob, 1000)

      manager.revoke(url)

      // タイムアウト経過しても問題ない
      vi.advanceTimersByTime(1500)
      expect(manager.getCount()).toBe(0)
    })
  })

  describe('getAllUrls', () => {
    it('すべての追跡中URLを返す', () => {
      const blob1 = new Blob(['test1'], { type: 'text/plain' })
      const blob2 = new Blob(['test2'], { type: 'text/plain' })

      const url1 = manager.create(blob1)
      const url2 = manager.create(blob2)

      const urls = manager.getAllUrls()
      expect(urls).toHaveLength(2)
      expect(urls).toContain(url1)
      expect(urls).toContain(url2)
    })
  })

  describe('cleanup', () => {
    it('すべてのリソースを解放する', () => {
      const blob1 = new Blob(['test1'], { type: 'text/plain' })
      const blob2 = new Blob(['test2'], { type: 'text/plain' })

      manager.create(blob1)
      manager.create(blob2)

      manager.cleanup()

      expect(manager.getCount()).toBe(0)
    })
  })
})

describe('Global blob url functions', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    revokeAllManagedBlobUrls()
    resetBlobUrlManager()
    vi.restoreAllMocks()
  })

  describe('getBlobUrlManager', () => {
    it('シングルトンインスタンスを返す', () => {
      const instance1 = getBlobUrlManager()
      const instance2 = getBlobUrlManager()

      expect(instance1).toBe(instance2)
    })
  })

  describe('createManagedBlobUrl', () => {
    it('Blob URLを作成する', () => {
      const blob = new Blob(['test'], { type: 'text/plain' })
      const url = createManagedBlobUrl(blob)

      expect(url).toMatch(/^blob:/)
      expect(getBlobUrlManager().has(url)).toBe(true)
    })
  })

  describe('revokeManagedBlobUrl', () => {
    it('Blob URLを解放する', () => {
      const blob = new Blob(['test'], { type: 'text/plain' })
      const url = createManagedBlobUrl(blob)

      revokeManagedBlobUrl(url)

      expect(getBlobUrlManager().has(url)).toBe(false)
    })
  })

  describe('revokeAllManagedBlobUrls', () => {
    it('すべてのBlob URLを解放する', () => {
      const blob1 = new Blob(['test1'], { type: 'text/plain' })
      const blob2 = new Blob(['test2'], { type: 'text/plain' })

      createManagedBlobUrl(blob1)
      createManagedBlobUrl(blob2)

      expect(getBlobUrlManager().getCount()).toBe(2)

      revokeAllManagedBlobUrls()

      expect(getBlobUrlManager().getCount()).toBe(0)
    })
  })
})
