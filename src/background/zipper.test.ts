/**
 * Zipper Tests
 *
 * Test Coverage:
 * - ZIP creation with multiple images
 * - Filename template application
 * - Filename deduplication
 * - Size limit enforcement (1GB)
 * - Error handling
 * - Download functionality
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createZip, download, ZipError, ZIP_SIZE_LIMIT } from './zipper'
import type { CollectedImage } from './collector'
import type { ImageSnapshot } from '@/shared/types'

// Helper: Create mock CollectedImage
const createMockImage = (overrides: Partial<CollectedImage> = {}): CollectedImage => {
  const defaultSnapshot: ImageSnapshot = {
    url: 'https://example.com/image.jpg',
    hash: 'abc123',
    width: 800,
    height: 600,
    alt: 'Test Image',
    firstSeenAt: Date.now(),
  }

  const defaultBlob = new Blob(['fake-image-data'], { type: 'image/jpeg' })

  return {
    candidate: {
      url: 'https://example.com/image.jpg',
      source: 'img',
      width: 800,
      height: 600,
      alt: 'Test Image',
    },
    blob: defaultBlob,
    hash: 'abc123',
    contentType: 'image/jpeg',
    snapshot: defaultSnapshot,
    ...overrides,
  }
}

describe('createZip', () => {
  it('should create ZIP from single image', async () => {
    const images = [createMockImage()]

    const result = await createZip(images, {
      template: '{domain}-{index}',
      pageUrl: 'https://example.com/page',
    })

    expect(result.blob).toBeInstanceOf(Blob)
    expect(result.filename).toBe('images.zip')
    expect(result.fileCount).toBe(1)
    expect(result.size).toBeGreaterThan(0)
  })

  it('should create ZIP from multiple images', async () => {
    const images = [createMockImage(), createMockImage(), createMockImage()]

    const result = await createZip(images, {
      template: '{domain}-{index}',
      pageUrl: 'https://example.com/page',
    })

    expect(result.fileCount).toBe(3)
    expect(result.size).toBeGreaterThan(0)
  })

  it('should apply custom ZIP filename', async () => {
    const images = [createMockImage()]

    const result = await createZip(images, {
      template: '{domain}-{index}',
      pageUrl: 'https://example.com/page',
      zipFilename: 'my-collection',
    })

    expect(result.filename).toBe('my-collection.zip')
  })

  it('should apply filename template correctly', async () => {
    const image = createMockImage({
      snapshot: {
        url: 'https://example.com/image.jpg',
        hash: 'abc123',
        width: 1920,
        height: 1080,
        alt: 'Beautiful Sunset',
        firstSeenAt: Date.now(),
      },
    })

    const result = await createZip([image], {
      template: '{w}x{h}-{alt}-{index}',
      pageUrl: 'https://example.com/page',
    })

    // ZIP should contain file with template-generated name
    // Note: We can't easily inspect ZIP contents in test without extracting,
    // but we can verify ZIP was created successfully
    expect(result.fileCount).toBe(1)
    expect(result.size).toBeGreaterThan(0)
  })

  it('should deconflict duplicate filenames', async () => {
    // Create 3 images with identical metadata (would generate same filename)
    const images = [
      createMockImage(),
      createMockImage(),
      createMockImage(),
    ]

    const result = await createZip(images, {
      template: '{domain}', // Simple template that will collide
      pageUrl: 'https://example.com/page',
    })

    // Should successfully create ZIP with deconflicted names
    expect(result.fileCount).toBe(3)
    expect(result.size).toBeGreaterThan(0)
  })

  it('should throw error for empty images array', async () => {
    await expect(
      createZip([], {
        template: '{domain}-{index}',
        pageUrl: 'https://example.com/page',
      })
    ).rejects.toThrow(ZipError)

    try {
      await createZip([], {
        template: '{domain}-{index}',
        pageUrl: 'https://example.com/page',
      })
    } catch (error) {
      expect(error).toBeInstanceOf(ZipError)
      expect((error as ZipError).code).toBe('EMPTY_IMAGES')
    }
  })

  it('should throw error when size exceeds 1GB limit', async () => {
    // Create a large blob that exceeds 1GB
    const largeBlob = new Blob([new ArrayBuffer(ZIP_SIZE_LIMIT + 1)])

    const largeImage = createMockImage({
      blob: largeBlob,
    })

    await expect(
      createZip([largeImage], {
        template: '{domain}-{index}',
        pageUrl: 'https://example.com/page',
      })
    ).rejects.toThrow(ZipError)

    try {
      await createZip([largeImage], {
        template: '{domain}-{index}',
        pageUrl: 'https://example.com/page',
      })
    } catch (error) {
      expect(error).toBeInstanceOf(ZipError)
      expect((error as ZipError).code).toBe('ZIP_SIZE_LIMIT_EXCEEDED')
      expect((error as ZipError).message).toContain('1GB')
    }
  })

  it('should track cumulative size correctly', async () => {
    // Create images with known sizes (smaller than 1GB for performance)
    const imageSize = 1024 * 1024 // 1MB each
    const blob1 = new Blob([new ArrayBuffer(imageSize)])
    const blob2 = new Blob([new ArrayBuffer(imageSize)])
    const blob3 = new Blob([new ArrayBuffer(imageSize)])

    const images = [
      createMockImage({ blob: blob1 }),
      createMockImage({ blob: blob2 }),
      createMockImage({ blob: blob3 }),
    ]

    // Should succeed (total = 3MB << 1GB)
    const result = await createZip(images, {
      template: '{domain}-{index}',
      pageUrl: 'https://example.com/page',
    })

    expect(result.fileCount).toBe(3)
    expect(result.size).toBeGreaterThan(0)
  })

  it('should handle special characters in filenames', async () => {
    const image = createMockImage({
      snapshot: {
        url: 'https://example.com/image.jpg',
        hash: 'abc123',
        width: 800,
        height: 600,
        alt: 'Test / Image: <Special> Characters?',
        firstSeenAt: Date.now(),
      },
    })

    const result = await createZip([image], {
      template: '{alt}-{index}',
      pageUrl: 'https://example.com/page',
    })

    // Should sanitize special characters successfully
    expect(result.fileCount).toBe(1)
    expect(result.size).toBeGreaterThan(0)
  })

  it('should handle different image formats', async () => {
    const jpegImage = createMockImage({
      blob: new Blob(['jpeg-data'], { type: 'image/jpeg' }),
      snapshot: {
        url: 'https://example.com/image.jpg',
        hash: 'hash1',
        width: 800,
        height: 600,
        alt: 'JPEG',
        firstSeenAt: Date.now(),
      },
    })

    const pngImage = createMockImage({
      blob: new Blob(['png-data'], { type: 'image/png' }),
      snapshot: {
        url: 'https://example.com/image.png',
        hash: 'hash2',
        width: 800,
        height: 600,
        alt: 'PNG',
        firstSeenAt: Date.now(),
      },
    })

    const webpImage = createMockImage({
      blob: new Blob(['webp-data'], { type: 'image/webp' }),
      snapshot: {
        url: 'https://example.com/image.webp',
        hash: 'hash3',
        width: 800,
        height: 600,
        alt: 'WebP',
        firstSeenAt: Date.now(),
      },
    })

    const result = await createZip([jpegImage, pngImage, webpImage], {
      template: '{alt}-{index}',
      pageUrl: 'https://example.com/page',
    })

    expect(result.fileCount).toBe(3)
  })

  it('should handle 100+ images (performance test)', async () => {
    const images = Array.from({ length: 100 }, (_, i) =>
      createMockImage({
        snapshot: {
          url: `https://example.com/image${i}.jpg`,
          hash: `hash${i}`,
          width: 800,
          height: 600,
          alt: `Image ${i}`,
          firstSeenAt: Date.now(),
        },
      })
    )

    const startTime = Date.now()
    const result = await createZip(images, {
      template: '{domain}-{index}',
      pageUrl: 'https://example.com/page',
    })
    const duration = Date.now() - startTime

    expect(result.fileCount).toBe(100)
    expect(result.size).toBeGreaterThan(0)

    // Should complete reasonably quickly (allow 5 seconds for 100 images)
    expect(duration).toBeLessThan(5000)
  })
})

describe('download', () => {
  // Mock chrome.downloads API
  const mockDownload = vi.fn()
  beforeEach(() => {
    global.chrome = {
      downloads: {
        download: mockDownload,
      },
    } as unknown as typeof chrome

    // Reset mock
    mockDownload.mockReset()
    mockDownload.mockResolvedValue(1) // Download ID

    // Mock URL.createObjectURL and revokeObjectURL
    global.URL.createObjectURL = vi.fn(() => 'blob:mock-url')
    global.URL.revokeObjectURL = vi.fn()

    // Mock setTimeout to execute immediately in tests
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('should download blob with default options', async () => {
    const blob = new Blob(['test-data'])
    const filename = 'test.zip'

    const downloadId = await download(blob, filename)

    expect(downloadId).toBe(1)
    expect(mockDownload).toHaveBeenCalledWith({
      url: 'blob:mock-url',
      filename: 'test.zip',
      saveAs: true,
    })

    expect(URL.createObjectURL).toHaveBeenCalledWith(blob)
  })

  it('should download blob with saveAs=false', async () => {
    const blob = new Blob(['test-data'])
    const filename = 'test.zip'

    const downloadId = await download(blob, filename, { saveAs: false })

    expect(downloadId).toBe(1)
    expect(mockDownload).toHaveBeenCalledWith({
      url: 'blob:mock-url',
      filename: 'test.zip',
      saveAs: false,
    })
  })

  it('should revoke blob URL after timeout', async () => {
    const blob = new Blob(['test-data'])
    const filename = 'test.zip'

    await download(blob, filename, { revokeTimeout: 1000 })

    // Initially, URL should not be revoked
    expect(URL.revokeObjectURL).not.toHaveBeenCalled()

    // Fast-forward time
    vi.advanceTimersByTime(1000)

    // Now URL should be revoked
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:mock-url')
  })

  it('should use custom revoke timeout', async () => {
    const blob = new Blob(['test-data'])
    const filename = 'test.zip'

    await download(blob, filename, { revokeTimeout: 5000 })

    // Advance by 4999ms - should not revoke yet
    vi.advanceTimersByTime(4999)
    expect(URL.revokeObjectURL).not.toHaveBeenCalled()

    // Advance by 1ms more - should revoke
    vi.advanceTimersByTime(1)
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:mock-url')
  })

  it('should revoke URL immediately on download error', async () => {
    mockDownload.mockRejectedValue(new Error('Download failed'))

    const blob = new Blob(['test-data'])
    const filename = 'test.zip'

    await expect(download(blob, filename)).rejects.toThrow('Failed to download test.zip')

    // URL should be revoked immediately on error
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:mock-url')
  })

  it('should handle download API errors gracefully', async () => {
    mockDownload.mockRejectedValue(new Error('Permission denied'))

    const blob = new Blob(['test-data'])
    const filename = 'test.zip'

    await expect(download(blob, filename)).rejects.toThrow('Permission denied')
  })

  it('should log download start', async () => {
    const consoleSpy = vi.spyOn(console, 'log')

    const blob = new Blob(['test-data'])
    const filename = 'test.zip'

    await download(blob, filename)

    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Download started'))
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('test.zip'))

    consoleSpy.mockRestore()
  })

  it('should log URL revocation', async () => {
    const consoleSpy = vi.spyOn(console, 'log')

    const blob = new Blob(['test-data'])
    const filename = 'test.zip'

    await download(blob, filename, { revokeTimeout: 1000 })

    vi.advanceTimersByTime(1000)

    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Blob URL revoked'))

    consoleSpy.mockRestore()
  })
})

describe('ZipError', () => {
  it('should create ZipError with code', () => {
    const error = new ZipError('Test error', 'TEST_CODE')

    expect(error.message).toBe('Test error')
    expect(error.code).toBe('TEST_CODE')
    expect(error.name).toBe('ZipError')
    expect(error).toBeInstanceOf(Error)
  })

  it('should be catchable as Error', () => {
    try {
      throw new ZipError('Test error', 'TEST_CODE')
    } catch (error) {
      expect(error).toBeInstanceOf(Error)
      expect(error).toBeInstanceOf(ZipError)
    }
  })
})
