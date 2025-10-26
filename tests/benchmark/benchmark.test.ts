/**
 * Performance Benchmark Tests
 *
 * 目標値（docs/specs/testing.md 7.3.1参照）:
 * - 100枚処理時間: P50 ≤10秒、P95 ≤15秒
 * - プレビュー表示時間: P50 ≤1秒
 * - メモリ使用量: <500MB (1000枚処理時)
 *
 * @module tests/benchmark
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { ImageCollector } from '@/background/collector'
import { createZip } from '@/background/zipper'
import type { ImageCandidate } from '@/shared/types'

/**
 * 統計計算ユーティリティ
 */

const percentile = (values: number[], p: number): number => {
  if (values.length === 0) return 0

  const sorted = [...values].sort((a, b) => a - b)
  const index = Math.ceil((p / 100) * sorted.length) - 1
  return sorted[Math.max(0, index)] ?? 0
}

const median = (values: number[]): number => percentile(values, 50)

const mean = (values: number[]): number => {
  if (values.length === 0) return 0
  return values.reduce((sum, val) => sum + val, 0) / values.length
}

const stdDev = (values: number[]): number => {
  if (values.length === 0) return 0
  const avg = mean(values)
  const variance = values.reduce((sum, val) => sum + (val - avg) ** 2, 0) / values.length
  return Math.sqrt(variance)
}

/**
 * ベンチマーク結果の型
 */
interface BenchmarkResult {
  iterations: number
  timesMs: number[]
  p50: number
  p95: number
  mean: number
  stdDev: number
  min: number
  max: number
}

/**
 * ベンチマーク結果のレポート生成
 */
const reportBenchmark = (name: string, result: BenchmarkResult, targetP50?: number, targetP95?: number): string => {
  const lines = [
    `\n📊 ${name}`,
    `   Iterations: ${result.iterations}`,
    `   P50: ${result.p50.toFixed(0)}ms${targetP50 ? ` (target: ≤${targetP50}ms) ${result.p50 <= targetP50 ? '✅' : '❌'}` : ''}`,
    `   P95: ${result.p95.toFixed(0)}ms${targetP95 ? ` (target: ≤${targetP95}ms) ${result.p95 <= targetP95 ? '✅' : '❌'}` : ''}`,
    `   Mean: ${result.mean.toFixed(0)}ms ± ${result.stdDev.toFixed(0)}ms`,
    `   Range: ${result.min.toFixed(0)}ms - ${result.max.toFixed(0)}ms`,
  ]
  return lines.join('\n')
}

/**
 * モック画像データ生成
 */
const createMockBlob = (sizeKB: number): Blob => {
  const bytes = new Uint8Array(sizeKB * 1024)
  // 圧縮性を模倣するため、パターンデータを生成
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = Math.floor(Math.random() * 256)
  }
  return new Blob([bytes], { type: 'image/jpeg' })
}

const createMockImageCandidates = (count: number): ImageCandidate[] => {
  return Array.from({ length: count }, (_, i) => ({
    url: `https://example.com/image-${i}.jpg`,
    source: 'img' as const,
    width: 800,
    height: 600,
    alt: `Mock image ${i}`,
  }))
}

/**
 * ベンチマーク実行ヘルパー
 */
const runBenchmark = async (
  _name: string,
  fn: () => Promise<void>,
  iterations: number
): Promise<BenchmarkResult> => {
  const timesMs: number[] = []

  for (let i = 0; i < iterations; i++) {
    const startTime = performance.now()
    await fn()
    const endTime = performance.now()
    timesMs.push(endTime - startTime)
  }

  return {
    iterations,
    timesMs,
    p50: percentile(timesMs, 50),
    p95: percentile(timesMs, 95),
    mean: mean(timesMs),
    stdDev: stdDev(timesMs),
    min: Math.min(...timesMs),
    max: Math.max(...timesMs),
  }
}

/**
 * ベンチマークテスト
 */
describe('Performance Benchmarks', () => {
  /**
   * 7.3.1 ベンチマーク - 100枚処理時間
   *
   * 目標: P50 ≤10秒、P95 ≤15秒
   * 反復: 50回（テスト環境では10回に削減）
   *
   * 注: jsdom環境ではBlobのarrayBuffer()が未サポートのため、
   * ZIP生成は除外してCollector処理のみをベンチマーク
   */
  describe('100 Images Processing', () => {
    // テスト環境では反復回数を削減（CI高速化）
    const ITERATIONS = process.env.CI ? 5 : 10
    const TARGET_P50_MS = 10_000
    const TARGET_P95_MS = 15_000

    it('should process 100 images within target time', async () => {
      // global.fetchをモック（単体テストなのでネットワークなし）
      global.fetch = async (_url: string | URL | Request) => {
        // 画像サイズを模倣（50KB）
        const blob = createMockBlob(50)
        return new Response(blob, {
          status: 200,
          headers: { 'Content-Type': 'image/jpeg' },
        })
      }

      const candidates = createMockImageCandidates(100)

      const result = await runBenchmark(
        '100 Images Processing',
        async () => {
          const collector = new ImageCollector()
          await collector.collect(candidates)
          // 注: ZIP生成はjsdom制限によりスキップ（実機テストで確認）
        },
        ITERATIONS
      )

      // レポート出力
      console.log(reportBenchmark('100 Images Processing', result, TARGET_P50_MS, TARGET_P95_MS))

      // アサーション（jsdom環境では収集のみなので目標値は半分程度）
      expect(result.p50).toBeLessThanOrEqual(TARGET_P50_MS)
      expect(result.p95).toBeLessThanOrEqual(TARGET_P95_MS)
    }, 180_000) // タイムアウト: 3分
  })

  /**
   * 7.3.1 ベンチマーク - プレビュー表示時間
   *
   * 目標: P50 ≤1秒
   * 反復: 50回（テスト環境では10回に削減）
   *
   * 注: 実際のReactコンポーネントレンダリングではなく、
   * データ準備（ObjectURL生成）のみを計測
   */
  describe('Preview Display Time', () => {
    const ITERATIONS = process.env.CI ? 5 : 10
    const TARGET_P50_MS = 1_000

    it('should prepare preview data within target time', async () => {
      // jsdom環境ではURL.createObjectURLが未実装なのでモック
      const mockUrlMap = new Map<Blob, string>()
      let urlCounter = 0

      if (!URL.createObjectURL) {
        URL.createObjectURL = (blob: Blob) => {
          const url = `blob:mock-${urlCounter++}`
          mockUrlMap.set(blob, url)
          return url
        }
        URL.revokeObjectURL = (_url: string) => {
          // モック実装（何もしない）
        }
      }

      const blobs = Array.from({ length: 100 }, () => createMockBlob(50))

      const result = await runBenchmark(
        'Preview Data Preparation',
        async () => {
          // ObjectURL生成（プレビュー表示の準備）
          const urls = blobs.map((blob) => URL.createObjectURL(blob))

          // クリーンアップ
          urls.forEach((url) => URL.revokeObjectURL(url))
        },
        ITERATIONS
      )

      console.log(reportBenchmark('Preview Display Time', result, TARGET_P50_MS))

      expect(result.p50).toBeLessThanOrEqual(TARGET_P50_MS)
    }, 60_000) // タイムアウト: 1分
  })

  /**
   * 7.3.1 ベンチマーク - メモリ使用量
   *
   * 目標: <500MB (1000枚処理時)
   * リーク検査: 処理前後の差分 <10MB
   *
   * 注: jsdom環境ではperformance.memory未サポート
   * 実機テストで確認が必要
   */
  describe('Memory Usage', () => {
    const TARGET_PEAK_MB = 500
    const TARGET_LEAK_MB = 10

    beforeEach(() => {
      // ガベージコレクション実行（可能な場合）
      if (global.gc) {
        global.gc()
      }
    })

    it('should stay within memory limits for 1000 images', async () => {
      // performance.memory未サポート環境のスキップ
      if (
        typeof performance === 'undefined' ||
        !('memory' in performance) ||
        !(performance as { memory?: { usedJSHeapSize?: number } }).memory
      ) {
        console.log('⚠️  Memory profiling not supported in test environment')
        console.log('   Please verify with Chrome DevTools in real extension')
        return
      }

      const performanceWithMemory = performance as { memory: { usedJSHeapSize: number } }
      const memoryBefore = performanceWithMemory.memory.usedJSHeapSize

      // 1000枚処理
      global.fetch = async () => {
        const blob = createMockBlob(50)
        return new Response(blob, {
          status: 200,
          headers: { 'Content-Type': 'image/jpeg' },
        })
      }

      const candidates = createMockImageCandidates(1000)
      const collector = new ImageCollector()
      const collectionResult = await collector.collect(candidates)

      // ZIP生成
      await createZip(collectionResult.images, {
        template: '{index}',
        pageUrl: 'https://example.com',
        zipFilename: 'memory-test',
      })

      const memoryAfter = performanceWithMemory.memory.usedJSHeapSize
      const memoryDeltaMB = (memoryAfter - memoryBefore) / (1024 * 1024)
      const peakMemoryMB = memoryAfter / (1024 * 1024)

      console.log(`\n💾 Memory Usage (1000 images)`)
      console.log(`   Peak: ${peakMemoryMB.toFixed(2)}MB (target: <${TARGET_PEAK_MB}MB) ${peakMemoryMB < TARGET_PEAK_MB ? '✅' : '❌'}`)
      console.log(`   Delta: ${memoryDeltaMB.toFixed(2)}MB (leak target: <${TARGET_LEAK_MB}MB) ${memoryDeltaMB < TARGET_LEAK_MB ? '✅' : '❌'}`)

      // アサーション
      expect(peakMemoryMB).toBeLessThan(TARGET_PEAK_MB)
      expect(memoryDeltaMB).toBeLessThan(TARGET_LEAK_MB)
    }, 300_000) // タイムアウト: 5分
  })

  /**
   * 統計計算のユニットテスト
   */
  describe('Statistics Utilities', () => {
    it('should calculate percentiles correctly', () => {
      const values = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]

      expect(percentile(values, 50)).toBe(5)
      expect(percentile(values, 95)).toBe(10)
      expect(percentile(values, 0)).toBe(1)
      expect(percentile(values, 100)).toBe(10)
    })

    it('should handle empty arrays', () => {
      expect(percentile([], 50)).toBe(0)
      expect(median([])).toBe(0)
      expect(mean([])).toBe(0)
      expect(stdDev([])).toBe(0)
    })

    it('should calculate mean and stdDev correctly', () => {
      const values = [2, 4, 6, 8, 10]

      expect(mean(values)).toBe(6)
      expect(stdDev(values)).toBeCloseTo(Math.sqrt(8), 5)
    })
  })
})
