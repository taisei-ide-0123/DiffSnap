/**
 * Image utility functions for formatting and display
 */

/**
 * Format image dimensions as "width × height" string
 * @param width - Image width in pixels
 * @param height - Image height in pixels
 * @returns Formatted string like "800 × 600" or undefined if dimensions are missing or invalid
 */
export const formatImageSize = (width?: number, height?: number): string | undefined => {
  if (width && height && width > 0 && height > 0) {
    return `${width} × ${height}`
  }
  return undefined
}

/**
 * サムネイル生成オプション
 */
export interface ThumbnailOptions {
  maxWidth?: number // 最大幅（デフォルト: 200）
  maxHeight?: number // 最大高さ（デフォルト: 200）
  quality?: number // JPEG品質（0.0-1.0、デフォルト: 0.8）
  format?: 'image/jpeg' | 'image/webp' // 出力形式（デフォルト: image/jpeg）
}

/**
 * 画像URLからサムネイルを生成
 *
 * メモリ効率化のため、プレビュー用に縮小画像を生成します。
 *
 * @param imageUrl - 元画像のURL
 * @param options - サムネイル生成オプション
 * @returns サムネイル画像のBlob URL、失敗時はnull
 */
export const createThumbnail = async (
  imageUrl: string,
  options: ThumbnailOptions = {}
): Promise<string | null> => {
  const {
    maxWidth = 200,
    maxHeight = 200,
    quality = 0.8,
    format = 'image/jpeg',
  } = options

  try {
    // 画像を読み込む
    const img = new Image()
    img.crossOrigin = 'anonymous' // CORS対策

    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve()
      img.onerror = () => reject(new Error('Failed to load image'))
      img.src = imageUrl
    })

    // アスペクト比を維持してサイズ計算
    let { width, height } = img
    if (width > maxWidth || height > maxHeight) {
      const ratio = Math.min(maxWidth / width, maxHeight / height)
      width = Math.floor(width * ratio)
      height = Math.floor(height * ratio)
    }

    // Canvasで縮小
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')

    if (!ctx) {
      return null
    }

    // 高品質なダウンスケーリング
    ctx.imageSmoothingEnabled = true
    ctx.imageSmoothingQuality = 'high'
    ctx.drawImage(img, 0, 0, width, height)

    // Blobに変換
    return new Promise<string | null>((resolve) => {
      canvas.toBlob(
        (blob) => {
          if (blob) {
            resolve(URL.createObjectURL(blob))
          } else {
            resolve(null)
          }
        },
        format,
        quality
      )
    })
  } catch (error) {
    console.error('Failed to create thumbnail:', error)
    return null
  }
}

/**
 * Blobからデータサイズを取得（バイト単位）
 */
export const getBlobSize = (blob: Blob): number => {
  return blob.size
}

/**
 * バイト数を人間可読な形式に変換
 *
 * @param bytes - バイト数
 * @returns フォーマット済み文字列（例: "1.2 MB"）
 */
export const formatByteSize = (bytes: number): string => {
  if (bytes < 1024) {
    return `${bytes} B`
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`
  }
  if (bytes < 1024 * 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`
}
