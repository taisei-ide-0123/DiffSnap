/**
 * ZIP Generation Module
 *
 * Responsibilities:
 * - Create ZIP files from collected images with JSZip
 * - Apply filename templates and deduplication
 * - Size limit enforcement (1GB)
 * - Download trigger via chrome.downloads API
 *
 * @module background/zipper
 */

import JSZip from 'jszip'
import type { CollectedImage } from './collector'
import { makeFilename, deconflict } from '@/lib/filename'

/**
 * ZIP generation error types
 */
export class ZipError extends Error {
  public cause?: unknown

  constructor(
    message: string,
    public code: string,
    cause?: unknown
  ) {
    super(message)
    this.name = 'ZipError'
    this.cause = cause
  }
}

/**
 * ZIP size limit (1GB)
 */
export const ZIP_SIZE_LIMIT = 1024 * 1024 * 1024

/**
 * ZIP generation options
 */
export interface CreateZipOptions {
  /**
   * Filename template string
   * @example "{date}-{domain}-{w}x{h}-{index}"
   */
  template: string

  /**
   * Page URL for template variable extraction
   */
  pageUrl: string

  /**
   * ZIP filename (without .zip extension)
   * @default "images"
   */
  zipFilename?: string
}

/**
 * ZIP generation result
 */
export interface CreateZipResult {
  /**
   * Generated ZIP file blob
   */
  blob: Blob

  /**
   * ZIP filename (with .zip extension)
   */
  filename: string

  /**
   * Number of files in ZIP
   */
  fileCount: number

  /**
   * Total ZIP size in bytes
   */
  size: number
}

/**
 * Create ZIP file from collected images
 *
 * Process:
 * 1. Create new JSZip instance
 * 2. For each image:
 *    - Generate filename from template
 *    - Check for name collisions and deconflict
 *    - Check cumulative size (throw if > 1GB)
 *    - Add to ZIP
 * 3. Generate ZIP blob with DEFLATE compression (level 6)
 * 4. Return result
 *
 * @param images - Collected images with blobs and metadata
 * @param options - ZIP generation options
 * @returns ZIP generation result
 * @throws {ZipError} EMPTY_IMAGES - When images array is empty
 * @throws {ZipError} ZIP_SIZE_LIMIT_EXCEEDED - When size exceeds 1GB
 * @throws {ZipError} ZIP_GENERATION_FAILED - When ZIP generation fails
 */
export const createZip = async (
  images: CollectedImage[],
  options: CreateZipOptions
): Promise<CreateZipResult> => {
  if (images.length === 0) {
    throw new ZipError('No images to create ZIP', 'EMPTY_IMAGES')
  }

  const zip = new JSZip()
  const existingFilenames = new Set<string>()
  let cumulativeSize = 0

  // Add each image to ZIP
  for (let i = 0; i < images.length; i++) {
    const image = images[i]
    if (!image) continue // Skip undefined entries (should never happen)

    // Generate filename from template
    let filename = makeFilename(options.template, image.snapshot, i + 1, options.pageUrl)

    // Deconflict filename
    filename = deconflict(filename, existingFilenames)
    existingFilenames.add(filename)

    // Check cumulative size BEFORE adding to ZIP
    const nextSize = cumulativeSize + image.blob.size
    if (nextSize > ZIP_SIZE_LIMIT) {
      throw new ZipError(
        `ZIP size would exceed limit of ${ZIP_SIZE_LIMIT} bytes (1GB)`,
        'ZIP_SIZE_LIMIT_EXCEEDED'
      )
    }

    // Add file to ZIP
    zip.file(filename, image.blob)
    cumulativeSize = nextSize
  }

  // Generate ZIP blob
  let blob: Blob
  try {
    blob = await zip.generateAsync({
      type: 'blob',
      compression: 'DEFLATE',
      compressionOptions: {
        level: 6,
      },
    })
  } catch (error) {
    throw new ZipError(
      `Failed to generate ZIP: ${error instanceof Error ? error.message : String(error)}`,
      'ZIP_GENERATION_FAILED',
      error
    )
  }

  const zipFilename = `${options.zipFilename ?? 'images'}.zip`

  return {
    blob,
    filename: zipFilename,
    fileCount: images.length,
    size: blob.size,
  }
}

