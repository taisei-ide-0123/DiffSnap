/**
 * Image Collector - Orchestrates fetching, hashing, and deduplication
 *
 * Responsibilities:
 * - Fetch images using ParallelController
 * - Hash-based deduplication
 * - Progress notification to Popup
 * - Error handling and retry coordination
 */

import { ParallelController, isFetchSuccess, type FetchResult } from './parallel-controller'
import type {
  ImageCandidate,
  ImageSnapshot,
  StateUpdateMessage,
  FailedImage,
} from '@/shared/types'

export interface CollectionProgress {
  total: number
  completed: number
  failed: number
  deduplicated: number
  failedImages: FailedImage[] // 失敗した画像の詳細リスト
}

export interface CollectedImage {
  candidate: ImageCandidate
  blob: Blob
  hash: string
  contentType: string
  snapshot: ImageSnapshot
}

export interface CollectionResult {
  images: CollectedImage[]
  failed: FailedImage[] // 失敗した画像の詳細（メタデータ保持）
  stats: {
    total: number
    fetched: number
    deduplicated: number
    failed: number
  }
}

export interface CollectorOptions {
  onProgress?: (progress: CollectionProgress) => void
  tabId?: number
}

/**
 * Image Collector class
 *
 * Orchestrates the collection process:
 * 1. Fetch images in parallel (via ParallelController)
 * 2. Deduplicate by hash
 * 3. Report progress
 * 4. Return collected images and metadata
 */
export class ImageCollector {
  private controller: ParallelController
  private options: CollectorOptions

  constructor(options: CollectorOptions = {}) {
    this.controller = new ParallelController()
    this.options = options
  }

  /**
   * Send progress update to Popup (if tabId provided)
   */
  private async notifyProgress(progress: CollectionProgress): Promise<void> {
    // Call custom progress callback
    this.options.onProgress?.(progress)

    // Send message to Popup if tabId is provided
    if (this.options.tabId !== undefined) {
      const message: StateUpdateMessage = {
        type: 'STATE_UPDATE',
        state: {
          tabId: this.options.tabId,
          status: 'fetching',
          total: progress.total,
          completed: progress.completed,
          failed: progress.failedImages, // 失敗詳細を送信
          zipSize: 0, // ZIP生成前なのでまだ0
        },
      }

      try {
        // Try to send to popup
        await chrome.runtime.sendMessage(message)
      } catch (err) {
        // Popup might be closed, ignore
        console.debug('Failed to send progress update:', err)
      }
    }
  }

  /**
   * Create ImageSnapshot from fetch result
   */
  private createSnapshot(result: FetchResult): ImageSnapshot | null {
    if (!isFetchSuccess(result)) {
      return null
    }

    const { candidate, hash } = result

    return {
      hash,
      url: candidate.url,
      width: candidate.width ?? 0,
      height: candidate.height ?? 0,
      alt: candidate.alt,
      context: undefined, // Will be populated in Phase 2
      firstSeenAt: Date.now(),
    }
  }

  /**
   * Collect images with deduplication
   *
   * Algorithm:
   * 1. Fetch all images in parallel using ParallelController
   * 2. As results arrive, deduplicate by hash
   * 3. Report progress after each batch
   * 4. Return deduplicated images and failure list
   */
  async collect(candidates: ImageCandidate[]): Promise<CollectionResult> {
    const total = candidates.length

    // Early return for empty input
    if (total === 0) {
      return {
        images: [],
        failed: [],
        stats: { total: 0, fetched: 0, deduplicated: 0, failed: 0 },
      }
    }

    let completed = 0
    let failed = 0
    let deduplicated = 0

    // Hash-based deduplication map
    const hashMap = new Map<string, CollectedImage>()
    const failureList: FailedImage[] = []

    // Initial progress
    await this.notifyProgress({ total, completed, failed, deduplicated, failedImages: [] })

    // Fetch all images in parallel
    const results = await this.controller.fetchAll(candidates)

    // Process results
    for (const result of results) {
      if (isFetchSuccess(result)) {
        const { candidate, blob, hash, contentType } = result

        // Check for duplicate hash
        if (hashMap.has(hash)) {
          deduplicated++
        } else {
          // Create snapshot
          const snapshot = this.createSnapshot(result)

          if (snapshot) {
            hashMap.set(hash, {
              candidate,
              blob,
              hash,
              contentType,
              snapshot,
            })
          }
        }

        completed++
      } else {
        // Fetch failed - FailedImageオブジェクトを作成（全メタデータを保持）
        const failedImage: FailedImage = {
          url: result.candidate.url,
          error: result.message ?? result.error,
          errorType: result.error,
          retryCount: 0,
          source: result.candidate.source,
          width: result.candidate.width,
          height: result.candidate.height,
          alt: result.candidate.alt,
        }
        failureList.push(failedImage)
        completed++
        failed++
      }

      // Report progress periodically (every 10 images)
      if (completed % 10 === 0) {
        await this.notifyProgress({ total, completed, failed, deduplicated, failedImages: failureList })
      }
    }

    // Final progress update
    await this.notifyProgress({ total, completed, failed, deduplicated, failedImages: failureList })

    return {
      images: Array.from(hashMap.values()),
      failed: failureList,
      stats: {
        total,
        fetched: hashMap.size,
        deduplicated,
        failed,
      },
    }
  }

  /**
   * Get controller stats (for debugging)
   */
  getStats() {
    return this.controller.getStats()
  }

  /**
   * Retry failed image fetches
   *
   * @param failedImages - Images that failed to fetch (with metadata)
   * @returns Collection result for retry attempt
   */
  async retryFailed(failedImages: FailedImage[]): Promise<CollectionResult> {
    // Convert FailedImage objects to ImageCandidate objects
    // 元のメタデータ（source, width, height, alt）を保持
    const candidates: ImageCandidate[] = failedImages.map((failed) => ({
      url: failed.url,
      source: failed.source,
      width: failed.width,
      height: failed.height,
      alt: failed.alt,
    }))

    return this.collect(candidates)
  }

  /**
   * Reset collector state (for testing)
   */
  reset() {
    this.controller.reset()
  }
}

/**
 * Convenience function for simple collection
 */
export const collectImages = async (
  candidates: ImageCandidate[],
  options?: CollectorOptions
): Promise<CollectionResult> => {
  const collector = new ImageCollector(options)
  return collector.collect(candidates)
}
