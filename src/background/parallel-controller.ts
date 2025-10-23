/**
 * Parallel Controller for Image Fetching
 *
 * Constraints:
 * - Global: max 8 concurrent fetches
 * - Per-domain: max 2 concurrent fetches per domain
 *
 * Retry logic:
 * - Max 3 retries
 * - Exponential backoff: 1s, 2s, 4s
 */

import type { ImageCandidate } from '@/shared/types'

// Fetch result types
export interface FetchSuccess {
  candidate: ImageCandidate
  blob: Blob
  hash: string
  contentType: string
}

export interface FetchFailure {
  candidate: ImageCandidate
  error: FetchErrorType
  message?: string
}

export type FetchErrorType = 'TIMEOUT' | 'CORS' | 'HTTP_ERROR' | 'NETWORK' | 'UNKNOWN'

export type FetchResult = FetchSuccess | FetchFailure

// Type guard
export const isFetchSuccess = (result: FetchResult): result is FetchSuccess => {
  return 'blob' in result
}

// Parallel controller class
export class ParallelController {
  private globalActiveCount = 0
  private domainCounts = new Map<string, number>()

  // For testing/monitoring
  private maxGlobalConcurrent = 0
  private maxDomainConcurrent = new Map<string, number>()

  // Queue for waiting fetches
  private globalQueue: Array<() => void> = []
  private domainQueues = new Map<string, Array<() => void>>()

  private readonly GLOBAL_LIMIT = 8
  private readonly DOMAIN_LIMIT = 2
  private readonly FETCH_TIMEOUT = 30000 // 30s

  /**
   * Extract domain from URL (MVP: hostname as-is)
   * Phase 2: CDN mapping support
   */
  private extractDomain(url: string): string {
    try {
      return new URL(url).hostname
    } catch {
      return 'unknown'
    }
  }

  /**
   * Wait for and acquire slot atomically
   */
  private async waitAndAcquireSlot(domain: string): Promise<void> {
    // Try immediate acquisition
    if (
      this.globalActiveCount < this.GLOBAL_LIMIT &&
      (this.domainCounts.get(domain) ?? 0) < this.DOMAIN_LIMIT
    ) {
      this.acquireSlot(domain)
      return
    }

    // Need to wait - create promises for both constraints
    const promises: Promise<void>[] = []

    if (this.globalActiveCount >= this.GLOBAL_LIMIT) {
      promises.push(new Promise<void>((resolve) => this.globalQueue.push(resolve)))
    }

    if ((this.domainCounts.get(domain) ?? 0) >= this.DOMAIN_LIMIT) {
      promises.push(
        new Promise<void>((resolve) => {
          const queue = this.domainQueues.get(domain) ?? []
          queue.push(resolve)
          this.domainQueues.set(domain, queue)
        })
      )
    }

    // Wait for constraints to be satisfied
    if (promises.length > 0) {
      await Promise.all(promises)
      // After waking up, recursively try again (another task might have taken the slot)
      return this.waitAndAcquireSlot(domain)
    }

    // Both constraints satisfied, acquire
    this.acquireSlot(domain)
  }

  /**
   * Acquire slot (increment counters) - private, only called by waitAndAcquireSlot
   */
  private acquireSlot(domain: string): void {
    this.globalActiveCount++
    this.domainCounts.set(domain, (this.domainCounts.get(domain) ?? 0) + 1)

    // Track max concurrency for monitoring
    this.maxGlobalConcurrent = Math.max(this.maxGlobalConcurrent, this.globalActiveCount)
    const domainCount = this.domainCounts.get(domain) ?? 0
    this.maxDomainConcurrent.set(
      domain,
      Math.max(this.maxDomainConcurrent.get(domain) ?? 0, domainCount)
    )
  }

  /**
   * Release slot (decrement counters and notify waiting tasks)
   */
  private releaseSlot(domain: string): void {
    this.globalActiveCount--
    const count = this.domainCounts.get(domain) ?? 0
    if (count > 0) {
      this.domainCounts.set(domain, count - 1)
    }

    // Notify waiting tasks
    if (this.globalQueue.length > 0) {
      const resolve = this.globalQueue.shift()
      resolve?.()
    }

    const domainQueue = this.domainQueues.get(domain)
    if (domainQueue && domainQueue.length > 0) {
      const resolve = domainQueue.shift()
      resolve?.()
    }
  }

  /**
   * Fetch single image with timeout
   */
  private async fetchImageOnce(candidate: ImageCandidate): Promise<FetchResult> {
    const { url } = candidate

    // Handle data URLs
    if (url.startsWith('data:')) {
      return this.fetchDataUrl(candidate)
    }

    // Fetch with timeout
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), this.FETCH_TIMEOUT)

    try {
      const response = await fetch(url, {
        credentials: 'include',
        mode: 'cors',
        signal: controller.signal,
      })

      clearTimeout(timeoutId)

      if (!response.ok) {
        return {
          candidate,
          error: 'HTTP_ERROR',
          message: `HTTP ${response.status}`,
        }
      }

      const blob = await response.blob()
      const contentType = blob.type || 'image/unknown' // type is empty string if unknown, so || is correct here

      // Calculate hash (using crypto API - will implement in hasher.ts)
      const hash = await this.calculateHash(blob)

      return {
        candidate,
        blob,
        hash,
        contentType,
      }
    } catch (err) {
      clearTimeout(timeoutId)

      if (err instanceof Error) {
        if (err.name === 'AbortError') {
          return { candidate, error: 'TIMEOUT' }
        }
        if (err.message.includes('CORS')) {
          return { candidate, error: 'CORS', message: err.message }
        }
        if (err.message.includes('Failed to fetch')) {
          return { candidate, error: 'NETWORK', message: err.message }
        }
      }

      return {
        candidate,
        error: 'UNKNOWN',
        message: err instanceof Error ? err.message : String(err),
      }
    }
  }

  /**
   * Fetch data URL (base64 decode)
   */
  private async fetchDataUrl(candidate: ImageCandidate): Promise<FetchResult> {
    try {
      // Parse data URL manually for better control
      const response = await fetch(candidate.url)
      const blob = await response.blob()

      // Validate blob
      if (!blob || blob.size === 0) {
        return {
          candidate,
          error: 'UNKNOWN',
          message: 'Empty data URL blob',
        }
      }

      const hash = await this.calculateHash(blob)
      const contentType = blob.type || this.inferContentType(candidate.url) // type can be empty string

      return {
        candidate,
        blob,
        hash,
        contentType,
      }
    } catch (err) {
      return {
        candidate,
        error: 'UNKNOWN',
        message: err instanceof Error ? err.message : String(err),
      }
    }
  }

  /**
   * Infer content type from data URL
   */
  private inferContentType(url: string): string {
    const match = url.match(/^data:([^;,]+)/)
    return match ? match[1] : 'image/unknown'
  }

  /**
   * Calculate SHA-256 hash of blob
   */
  private async calculateHash(blob: Blob): Promise<string> {
    const buffer = await blob.arrayBuffer()
    const hashBuffer = await crypto.subtle.digest('SHA-256', buffer)
    const hashArray = Array.from(new Uint8Array(hashBuffer))
    return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('')
  }

  /**
   * Fetch with retry logic (exponential backoff)
   */
  private async fetchWithRetry(candidate: ImageCandidate, maxRetries = 3): Promise<FetchResult> {
    let lastResult: FetchResult | null = null

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      const result = await this.fetchImageOnce(candidate)

      if (isFetchSuccess(result)) {
        return result
      }

      lastResult = result

      // Don't retry on non-retryable errors
      if (result.error === 'CORS' || result.error === 'HTTP_ERROR') {
        break
      }

      // Exponential backoff: 1s, 2s, 4s
      if (attempt < maxRetries - 1) {
        const delay = Math.pow(2, attempt) * 1000
        await new Promise((resolve) => setTimeout(resolve, delay))
      }
    }

    // lastResult is guaranteed to be set after at least one attempt
    if (!lastResult) {
      throw new Error('No result after retries')
    }
    return lastResult
  }

  /**
   * Fetch image with concurrency control and retry
   */
  async fetchImage(candidate: ImageCandidate): Promise<FetchResult> {
    const domain = this.extractDomain(candidate.url)

    // Wait for and acquire slot atomically
    await this.waitAndAcquireSlot(domain)

    try {
      return await this.fetchWithRetry(candidate)
    } finally {
      // Release slot
      this.releaseSlot(domain)
    }
  }

  /**
   * Fetch multiple images in parallel with concurrency control
   * The concurrency is handled by fetchImage's waitForSlot mechanism
   */
  async fetchAll(candidates: ImageCandidate[]): Promise<FetchResult[]> {
    return Promise.all(candidates.map((candidate) => this.fetchImage(candidate)))
  }

  /**
   * Get current stats (for debugging)
   */
  getStats() {
    return {
      globalActive: this.globalActiveCount,
      domainCounts: Object.fromEntries(this.domainCounts),
      maxGlobalConcurrent: this.maxGlobalConcurrent,
      maxDomainConcurrent: Object.fromEntries(this.maxDomainConcurrent),
    }
  }

  /**
   * Reset controller state (for testing)
   */
  reset() {
    this.globalActiveCount = 0
    this.domainCounts.clear()
    this.maxGlobalConcurrent = 0
    this.maxDomainConcurrent.clear()
    this.globalQueue = []
    this.domainQueues.clear()
  }
}
