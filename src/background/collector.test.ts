import { describe, it, expect, beforeEach, vi } from 'vitest'
import { ImageCollector, collectImages } from './collector'
import type { ImageCandidate } from '@/shared/types'

describe('ImageCollector', () => {
  let collector: ImageCollector

  beforeEach(() => {
    collector = new ImageCollector()
    vi.clearAllMocks()
  })

  describe('Basic Collection', () => {
    it('should fetch and collect images successfully', async () => {
      const candidates: ImageCandidate[] = [
        { url: 'https://example1.com/1.jpg', source: 'img' },
        { url: 'https://example2.com/2.jpg', source: 'img' },
      ]

      let callCount = 0
      global.fetch = vi.fn(async () => {
        callCount++
        // Pass content directly to Response, not as Blob
        return new Response(`content-${callCount}`, {
          status: 200,
          headers: { 'Content-Type': 'image/jpeg' },
        })
      })

      const result = await collector.collect(candidates)

      expect(result.stats.total).toBe(2)
      expect(result.stats.fetched).toBe(2)
      expect(result.stats.deduplicated).toBe(0)
      expect(result.stats.failed).toBe(0)
      expect(result.images).toHaveLength(2)
      expect(result.failed).toHaveLength(0)
    })

    it('should handle fetch failures', async () => {
      const candidates: ImageCandidate[] = [
        { url: 'https://example.com/1.jpg', source: 'img' },
        { url: 'https://example.com/2.jpg', source: 'img' },
      ]

      global.fetch = vi.fn(async (url) => {
        if (url === 'https://example.com/2.jpg') {
          return new Response(null, { status: 404 })
        }
        return new Response('test', {
          status: 200,
          headers: { 'Content-Type': 'image/jpeg' },
        })
      })

      const result = await collector.collect(candidates)

      expect(result.stats.total).toBe(2)
      expect(result.stats.fetched).toBe(1)
      expect(result.stats.failed).toBe(1)
      expect(result.images).toHaveLength(1)
      expect(result.failed).toHaveLength(1)
      expect(result.failed[0]?.error).toBe('HTTP_ERROR')
    })
  })

  describe('Deduplication', () => {
    it(
      'should deduplicate images with same hash',
      async () => {
        const candidates: ImageCandidate[] = [
          { url: 'https://example.com/1.jpg', source: 'img' },
          { url: 'https://example.com/2.jpg', source: 'img' },
          { url: 'https://example.com/3.jpg', source: 'img' },
        ]

        // All return the same content -> same hash
        global.fetch = vi.fn(async () =>
          new Response('same content', {
            status: 200,
            headers: { 'Content-Type': 'image/jpeg' },
          })
        )

        const result = await collector.collect(candidates)

        expect(result.stats.total).toBe(3)
        expect(result.stats.fetched).toBe(1) // Only one unique
        expect(result.stats.deduplicated).toBe(2) // 2 duplicates
        expect(result.stats.failed).toBe(0)
        expect(result.images).toHaveLength(1)
      },
      10000
    ) // Increase timeout

    it('should keep images with different hashes', async () => {
      const candidates: ImageCandidate[] = [
        { url: 'https://example.com/1.jpg', source: 'img' },
        { url: 'https://example.com/2.jpg', source: 'img' },
      ]

      let callCount = 0
      global.fetch = vi.fn(async () => {
        callCount++
        // Different content each time
        return new Response(`content-${callCount}`, {
          status: 200,
          headers: { 'Content-Type': 'image/jpeg' },
        })
      })

      const result = await collector.collect(candidates)

      expect(result.stats.total).toBe(2)
      expect(result.stats.fetched).toBe(2) // Both unique
      expect(result.stats.deduplicated).toBe(0)
      expect(result.images).toHaveLength(2)

      // Verify hashes are different
      expect(result.images[0]?.hash).not.toBe(result.images[1]?.hash)
    })
  })

  describe('Progress Notification', () => {
    it('should call progress callback', async () => {
      const progressCallback = vi.fn()
      const collectorWithProgress = new ImageCollector({
        onProgress: progressCallback,
      })

      const candidates: ImageCandidate[] = [
        { url: 'https://example.com/1.jpg', source: 'img' },
        { url: 'https://example.com/2.jpg', source: 'img' },
      ]

      let callCount = 0
      global.fetch = vi.fn(async () => {
        callCount++
        return new Response(`content-${callCount}`, {
          status: 200,
          headers: { 'Content-Type': 'image/jpeg' },
        })
      })

      await collectorWithProgress.collect(candidates)

      // Should be called at least twice: initial and final
      expect(progressCallback).toHaveBeenCalled()

      // Check final progress
      const lastCall = progressCallback.mock.calls[progressCallback.mock.calls.length - 1][0]
      expect(lastCall.total).toBe(2)
      expect(lastCall.completed).toBe(2)
    })

    it('should not crash if progress callback is not provided', async () => {
      const candidates: ImageCandidate[] = [
        { url: 'https://example.com/1.jpg', source: 'img' },
      ]

      global.fetch = vi.fn(
        async () => new Response('test', { status: 200, headers: { 'Content-Type': 'image/jpeg' } })
      )

      // Should not throw
      await expect(collector.collect(candidates)).resolves.toBeDefined()
    })
  })

  describe('Data URL Handling', () => {
    it('should handle data URLs correctly', async () => {
      const dataUrl =
        'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='

      const candidates: ImageCandidate[] = [
        { url: dataUrl, source: 'img' },
        { url: 'https://example.com/1.jpg', source: 'img' },
      ]

      // Mock fetch for normal URL only (data URLs are handled by browser fetch)
      const originalFetch = global.fetch
      let normalUrlCallCount = 0
      global.fetch = vi.fn(async (url) => {
        if (typeof url === 'string' && url.startsWith('data:')) {
          // Use real fetch for data URLs
          return originalFetch(url)
        }
        // Mock normal URLs with unique content
        normalUrlCallCount++
        return new Response(`content-${normalUrlCallCount}`, {
          status: 200,
          headers: { 'Content-Type': 'image/jpeg' },
        })
      })

      const result = await collector.collect(candidates)

      // Both should succeed
      expect(result.stats.fetched).toBe(2)
      expect(result.stats.failed).toBe(0)
    })
  })

  describe('Large Scale Collection', () => {
    it(
      'should handle 100 images efficiently',
      async () => {
        const candidates: ImageCandidate[] = Array.from({ length: 100 }, (_, i) => ({
          url: `https://example${i % 10}.com/image${i}.jpg`,
          source: 'img' as const,
        }))

        let callCount = 0
        global.fetch = vi.fn(async (url) => {
          callCount++
          // Unique content for each URL
          await new Promise((resolve) => setTimeout(resolve, 10)) // Simulate network delay
          return new Response(`content-${url}-${callCount}`, {
            status: 200,
            headers: { 'Content-Type': 'image/jpeg' },
          })
        })

        const startTime = Date.now()
        const result = await collector.collect(candidates)
        const duration = Date.now() - startTime

        expect(result.stats.total).toBe(100)
        expect(result.stats.fetched).toBe(100)
        expect(result.images).toHaveLength(100)

        // Should complete reasonably fast (parallel execution)
        // With 10ms delay per fetch, sequential would take 1000ms
        // Parallel (8 concurrent) should be ~150ms
        expect(duration).toBeLessThan(500)
      },
      10000
    ) // Increase timeout
  })

  describe('ImageSnapshot Creation', () => {
    it('should create proper snapshots with metadata', async () => {
      const candidates: ImageCandidate[] = [
        {
          url: 'https://example.com/test.jpg',
          source: 'img',
          width: 800,
          height: 600,
          alt: 'Test image',
        },
      ]

      global.fetch = vi.fn(
        async () => new Response('test', { status: 200, headers: { 'Content-Type': 'image/jpeg' } })
      )

      const result = await collector.collect(candidates)

      expect(result.images).toHaveLength(1)

      const snapshot = result.images[0]?.snapshot
      expect(snapshot?.url).toBe('https://example.com/test.jpg')
      expect(snapshot?.width).toBe(800)
      expect(snapshot?.height).toBe(600)
      expect(snapshot?.alt).toBe('Test image')
      expect(snapshot?.hash).toBeDefined()
      expect(snapshot?.firstSeenAt).toBeGreaterThan(0)
    })

    it('should handle missing dimensions gracefully', async () => {
      const candidates: ImageCandidate[] = [
        {
          url: 'https://example.com/test.jpg',
          source: 'img',
          // No width/height
        },
      ]

      global.fetch = vi.fn(
        async () => new Response('test', { status: 200, headers: { 'Content-Type': 'image/jpeg' } })
      )

      const result = await collector.collect(candidates)

      expect(result.images).toHaveLength(1)

      const snapshot = result.images[0]?.snapshot
      expect(snapshot?.width).toBe(0)
      expect(snapshot?.height).toBe(0)
    })
  })

  describe('Convenience Function', () => {
    it('should work with collectImages helper', async () => {
      const candidates: ImageCandidate[] = [
        { url: 'https://example.com/1.jpg', source: 'img' },
      ]

      global.fetch = vi.fn(
        async () => new Response('test', { status: 200, headers: { 'Content-Type': 'image/jpeg' } })
      )

      const result = await collectImages(candidates)

      expect(result.stats.fetched).toBe(1)
      expect(result.images).toHaveLength(1)
    })

    it('should accept options in helper function', async () => {
      const progressCallback = vi.fn()
      const candidates: ImageCandidate[] = [
        { url: 'https://example.com/1.jpg', source: 'img' },
      ]

      global.fetch = vi.fn(
        async () => new Response('test', { status: 200, headers: { 'Content-Type': 'image/jpeg' } })
      )

      await collectImages(candidates, { onProgress: progressCallback })

      expect(progressCallback).toHaveBeenCalled()
    })
  })

  describe('Error Scenarios', () => {
    it('should handle network timeout', async () => {
      const candidates: ImageCandidate[] = [
        { url: 'https://example.com/timeout.jpg', source: 'img' },
      ]

      global.fetch = vi.fn(async () => {
        // Simulate timeout by throwing AbortError
        const error = new Error('The operation was aborted')
        error.name = 'AbortError'
        throw error
      })

      const result = await collector.collect(candidates)

      expect(result.stats.failed).toBe(1)
      expect(result.failed[0]?.error).toBe('TIMEOUT')
    })

    it('should handle CORS errors', async () => {
      const candidates: ImageCandidate[] = [
        { url: 'https://example.com/cors-blocked.jpg', source: 'img' },
      ]

      global.fetch = vi.fn(async () => {
        throw new TypeError('Failed to fetch: CORS policy blocked')
      })

      const result = await collector.collect(candidates)

      expect(result.stats.failed).toBe(1)
      expect(result.failed[0]?.error).toBe('CORS')
    })

    it('should handle empty result gracefully', async () => {
      const candidates: ImageCandidate[] = []

      const result = await collector.collect(candidates)

      expect(result.stats.total).toBe(0)
      expect(result.stats.fetched).toBe(0)
      expect(result.images).toHaveLength(0)
      expect(result.failed).toHaveLength(0)
    })
  })
})
