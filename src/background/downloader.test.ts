/**
 * Downloader Tests
 *
 * Test Coverage:
 * - Download functionality with chrome.downloads API
 * - Blob URL creation and cleanup
 * - Error handling and user notifications
 * - Memory leak prevention (URL revocation)
 * - Retry options
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { download, showNotification, downloadWithNotification } from './downloader'

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
    mockDownload.mockResolvedValue(123) // Mock download ID

    // Mock URL.createObjectURL and revokeObjectURL
    global.URL.createObjectURL = vi.fn(() => 'blob:mock-url-12345')
    global.URL.revokeObjectURL = vi.fn()

    // Mock setTimeout to control timing
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('should download blob successfully with default options', async () => {
    const blob = new Blob(['test-data'], { type: 'application/zip' })
    const filename = 'test-download.zip'

    const result = await download({ blob, filename })

    expect(result.success).toBe(true)
    expect(result.downloadId).toBe(123)
    expect(result.error).toBeUndefined()

    expect(URL.createObjectURL).toHaveBeenCalledWith(blob)
    expect(mockDownload).toHaveBeenCalledWith({
      url: 'blob:mock-url-12345',
      filename: 'test-download.zip',
      saveAs: true,
    })
  })

  it('should download with saveAs=false option', async () => {
    const blob = new Blob(['test-data'])
    const filename = 'auto-download.zip'

    const result = await download({ blob, filename, saveAs: false })

    expect(result.success).toBe(true)
    expect(mockDownload).toHaveBeenCalledWith({
      url: 'blob:mock-url-12345',
      filename: 'auto-download.zip',
      saveAs: false,
    })
  })

  it('should revoke blob URL after 60 seconds', async () => {
    const blob = new Blob(['test-data'])
    const filename = 'test.zip'

    await download({ blob, filename })

    // Initially, URL should not be revoked
    expect(URL.revokeObjectURL).not.toHaveBeenCalled()

    // Fast-forward to 59 seconds - should not revoke yet
    vi.advanceTimersByTime(59000)
    expect(URL.revokeObjectURL).not.toHaveBeenCalled()

    // Fast-forward to 60 seconds - should revoke
    vi.advanceTimersByTime(1000)
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:mock-url-12345')
  })

  it('should handle download errors gracefully', async () => {
    const downloadError = new Error('User cancelled download')
    mockDownload.mockRejectedValue(downloadError)

    const blob = new Blob(['test-data'])
    const filename = 'test.zip'

    const result = await download({ blob, filename })

    expect(result.success).toBe(false)
    expect(result.downloadId).toBeUndefined()
    expect(result.error).toBe('User cancelled download')
  })

  it('should revoke blob URL immediately on error', async () => {
    mockDownload.mockRejectedValue(new Error('Download failed'))

    const blob = new Blob(['test-data'])
    const filename = 'test.zip'

    await download({ blob, filename })

    // URL should be revoked immediately on error
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:mock-url-12345')

    // Should NOT schedule another revocation
    vi.advanceTimersByTime(60000)
    expect(URL.revokeObjectURL).toHaveBeenCalledTimes(1)
  })

  it('should handle unknown error types', async () => {
    mockDownload.mockRejectedValue('Unknown error')

    const blob = new Blob(['test-data'])
    const filename = 'test.zip'

    const result = await download({ blob, filename })

    expect(result.success).toBe(false)
    expect(result.error).toBe('Unknown download error')
  })

  it('should create unique blob URL for each download', async () => {
    let urlCounter = 0
    ;(global.URL.createObjectURL as unknown as ReturnType<typeof vi.fn>).mockImplementation(
      () => `blob:mock-url-${++urlCounter}`
    )

    const blob1 = new Blob(['data1'])
    const blob2 = new Blob(['data2'])

    await download({ blob: blob1, filename: 'file1.zip' })
    await download({ blob: blob2, filename: 'file2.zip' })

    expect(mockDownload).toHaveBeenNthCalledWith(1, {
      url: 'blob:mock-url-1',
      filename: 'file1.zip',
      saveAs: true,
    })
    expect(mockDownload).toHaveBeenNthCalledWith(2, {
      url: 'blob:mock-url-2',
      filename: 'file2.zip',
      saveAs: true,
    })
  })

  it('should handle large blob downloads', async () => {
    // Create a large blob (10MB)
    const largeData = new ArrayBuffer(10 * 1024 * 1024)
    const largeBlob = new Blob([largeData], { type: 'application/zip' })

    const result = await download({ blob: largeBlob, filename: 'large-file.zip' })

    expect(result.success).toBe(true)
    expect(URL.createObjectURL).toHaveBeenCalledWith(largeBlob)
  })

  it('should handle special characters in filename', async () => {
    const blob = new Blob(['test-data'])
    const filename = 'test-file_2025-01-15_特殊文字.zip'

    const result = await download({ blob, filename })

    expect(result.success).toBe(true)
    expect(mockDownload).toHaveBeenCalledWith({
      url: 'blob:mock-url-12345',
      filename: 'test-file_2025-01-15_特殊文字.zip',
      saveAs: true,
    })
  })
})

describe('showNotification', () => {
  const mockNotificationCreate = vi.fn()

  beforeEach(() => {
    global.chrome = {
      notifications: {
        create: mockNotificationCreate,
      },
    } as unknown as typeof chrome

    mockNotificationCreate.mockReset()
    mockNotificationCreate.mockResolvedValue('notification-id')
  })

  it('should show notification with correct parameters', async () => {
    await showNotification('Test Title', 'Test Message')

    expect(mockNotificationCreate).toHaveBeenCalledWith({
      type: 'basic',
      iconUrl: 'assets/icon-128.png',
      title: 'Test Title',
      message: 'Test Message',
    })
  })

  it('should handle notification errors gracefully', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    mockNotificationCreate.mockRejectedValue(new Error('Notification permission denied'))

    // Should not throw
    await expect(showNotification('Title', 'Message')).resolves.toBeUndefined()

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'Failed to show notification:',
      expect.any(Error)
    )

    consoleErrorSpy.mockRestore()
  })

  it('should handle long messages', async () => {
    const longMessage = 'A'.repeat(1000)

    await showNotification('Title', longMessage)

    expect(mockNotificationCreate).toHaveBeenCalledWith({
      type: 'basic',
      iconUrl: 'assets/icon-128.png',
      title: 'Title',
      message: longMessage,
    })
  })

  it('should handle special characters in messages', async () => {
    await showNotification('テスト', 'メッセージ\n改行あり')

    expect(mockNotificationCreate).toHaveBeenCalledWith({
      type: 'basic',
      iconUrl: 'assets/icon-128.png',
      title: 'テスト',
      message: 'メッセージ\n改行あり',
    })
  })
})

describe('downloadWithNotification', () => {
  const mockDownload = vi.fn()
  const mockNotificationCreate = vi.fn()

  beforeEach(() => {
    global.chrome = {
      downloads: {
        download: mockDownload,
      },
      notifications: {
        create: mockNotificationCreate,
      },
    } as unknown as typeof chrome

    mockDownload.mockReset()
    mockNotificationCreate.mockReset()

    mockDownload.mockResolvedValue(123)
    mockNotificationCreate.mockResolvedValue('notification-id')

    global.URL.createObjectURL = vi.fn(() => 'blob:mock-url')
    global.URL.revokeObjectURL = vi.fn()

    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('should show success notification on successful download', async () => {
    const blob = new Blob(['test-data'])
    const filename = 'test-images.zip'

    const result = await downloadWithNotification({ blob, filename })

    expect(result.success).toBe(true)
    expect(mockNotificationCreate).toHaveBeenCalledWith({
      type: 'basic',
      iconUrl: 'assets/icon-128.png',
      title: 'ダウンロード成功',
      message: 'test-images.zip をダウンロードしました',
    })
  })

  it('should show error notification on download failure', async () => {
    mockDownload.mockRejectedValue(new Error('Network error'))

    const blob = new Blob(['test-data'])
    const filename = 'test.zip'

    const result = await downloadWithNotification({ blob, filename })

    expect(result.success).toBe(false)
    expect(mockNotificationCreate).toHaveBeenCalledWith({
      type: 'basic',
      iconUrl: 'assets/icon-128.png',
      title: 'ダウンロード失敗',
      message: 'エラー: Network error\n再試行してください',
    })
  })

  it('should show error notification with unknown error message', async () => {
    mockDownload.mockRejectedValue('Unknown error')

    const blob = new Blob(['test-data'])
    const filename = 'test.zip'

    const result = await downloadWithNotification({ blob, filename })

    expect(result.success).toBe(false)
    expect(mockNotificationCreate).toHaveBeenCalledWith({
      type: 'basic',
      iconUrl: 'assets/icon-128.png',
      title: 'ダウンロード失敗',
      message: 'エラー: Unknown download error\n再試行してください',
    })
  })

  it('should return download result even if notification fails', async () => {
    mockNotificationCreate.mockRejectedValue(new Error('Notification failed'))
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    const blob = new Blob(['test-data'])
    const filename = 'test.zip'

    const result = await downloadWithNotification({ blob, filename })

    // Download should succeed even if notification fails
    expect(result.success).toBe(true)
    expect(result.downloadId).toBe(123)

    consoleErrorSpy.mockRestore()
  })

  it('should support all download options', async () => {
    const blob = new Blob(['test-data'])
    const filename = 'test.zip'

    await downloadWithNotification({ blob, filename, saveAs: false })

    expect(mockDownload).toHaveBeenCalledWith({
      url: 'blob:mock-url',
      filename: 'test.zip',
      saveAs: false,
    })
  })
})

describe('Memory leak prevention', () => {
  const mockDownload = vi.fn()

  beforeEach(() => {
    global.chrome = {
      downloads: {
        download: mockDownload,
      },
    } as unknown as typeof chrome

    mockDownload.mockReset()
    mockDownload.mockResolvedValue(123)

    global.URL.createObjectURL = vi.fn(() => 'blob:mock-url')
    global.URL.revokeObjectURL = vi.fn()

    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('should revoke URL exactly once after timeout', async () => {
    const blob = new Blob(['test-data'])

    await download({ blob, filename: 'test.zip' })

    // Advance time multiple times beyond timeout
    vi.advanceTimersByTime(60000)
    vi.advanceTimersByTime(60000)
    vi.advanceTimersByTime(60000)

    // Should only revoke once
    expect(URL.revokeObjectURL).toHaveBeenCalledTimes(1)
  })

  it('should revoke multiple blob URLs independently', async () => {
    let urlCounter = 0
    ;(global.URL.createObjectURL as unknown as ReturnType<typeof vi.fn>).mockImplementation(
      () => `blob:mock-url-${++urlCounter}`
    )

    const blob1 = new Blob(['data1'])
    const blob2 = new Blob(['data2'])
    const blob3 = new Blob(['data3'])

    await download({ blob: blob1, filename: 'file1.zip' })
    await download({ blob: blob2, filename: 'file2.zip' })
    await download({ blob: blob3, filename: 'file3.zip' })

    // All URLs should be scheduled for revocation
    vi.advanceTimersByTime(60000)

    expect(URL.revokeObjectURL).toHaveBeenCalledTimes(3)
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:mock-url-1')
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:mock-url-2')
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:mock-url-3')
  })

  it('should not revoke URL on error if already revoked', async () => {
    mockDownload.mockRejectedValue(new Error('Download failed'))

    const blob = new Blob(['test-data'])

    await download({ blob, filename: 'test.zip' })

    // Already revoked once immediately on error
    expect(URL.revokeObjectURL).toHaveBeenCalledTimes(1)

    // Advance time - should not revoke again
    vi.advanceTimersByTime(60000)
    expect(URL.revokeObjectURL).toHaveBeenCalledTimes(1)
  })
})
