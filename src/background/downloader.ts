/**
 * ZIP file download functionality
 *
 * @module background/downloader
 */

export interface DownloadOptions {
  blob: Blob
  filename: string
  saveAs?: boolean
}

export interface DownloadResult {
  success: boolean
  downloadId?: number
  error?: string
}

const REVOKE_TIMEOUT_MS = 60000 // 60 seconds

/**
 * Download a blob as a file using chrome.downloads API
 *
 * @param options - Download options
 * @returns Promise that resolves with download result
 */
export const download = async (options: DownloadOptions): Promise<DownloadResult> => {
  const { blob, filename, saveAs = true } = options

  let blobUrl: string | null = null
  let revokeTimeoutId: number | null = null

  try {
    // Create blob URL
    blobUrl = URL.createObjectURL(blob)

    // Start download
    const downloadId = await chrome.downloads.download({
      url: blobUrl,
      filename,
      saveAs,
    })

    // Schedule URL cleanup after 60 seconds
    // Capture the URL value to avoid race conditions with closure
    const urlToRevoke = blobUrl
    revokeTimeoutId = setTimeout(() => {
      URL.revokeObjectURL(urlToRevoke)
    }, REVOKE_TIMEOUT_MS)

    return {
      success: true,
      downloadId,
    }
  } catch (error) {
    // Cancel scheduled revocation if it exists
    if (revokeTimeoutId !== null) {
      clearTimeout(revokeTimeoutId)
    }

    // Clean up blob URL immediately on error
    if (blobUrl) {
      URL.revokeObjectURL(blobUrl)
    }

    const errorMessage = error instanceof Error ? error.message : '不明なダウンロードエラー'

    return {
      success: false,
      error: errorMessage,
    }
  }
}

/**
 * Show a notification to the user
 *
 * @param title - Notification title
 * @param message - Notification message
 */
export const showNotification = async (title: string, message: string): Promise<void> => {
  try {
    await chrome.notifications.create({
      type: 'basic',
      iconUrl: 'assets/icon-128.png',
      title,
      message,
    })
  } catch (error) {
    console.error('Failed to show notification:', error)
  }
}

/**
 * Download with error handling and user notification
 *
 * @param options - Download options
 * @returns Promise that resolves with download result
 */
export const downloadWithNotification = async (
  options: DownloadOptions
): Promise<DownloadResult> => {
  const result = await download(options)

  if (result.success) {
    await showNotification(
      'ダウンロード成功',
      `${options.filename} をダウンロードしました`
    )
  } else {
    await showNotification(
      'ダウンロード失敗',
      `エラー: ${result.error}\n再試行してください`
    )
  }

  return result
}
