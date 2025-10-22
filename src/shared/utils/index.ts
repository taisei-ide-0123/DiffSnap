// Shared utility functions for DiffSnap

/**
 * Normalize URL for comparison
 *
 * クエリパラメータをソートし、ハッシュを削除してURL比較を可能にします。
 * 相対URL解決には`src/lib/url-utils.ts`の`normalizeUrl`を使用してください。
 *
 * @param url - 正規化するURL
 * @returns 比較用に正規化されたURL
 */
export const normalizeUrlForComparison = (url: string): string => {
  try {
    const parsed = new URL(url)
    // Remove hash and sort query parameters
    parsed.hash = ''
    const params = new URLSearchParams(parsed.search)
    const sortedParams = new URLSearchParams(
      Array.from(params.entries()).sort(([a], [b]) => a.localeCompare(b))
    )
    parsed.search = sortedParams.toString()
    return parsed.toString()
  } catch (error) {
    // Log invalid URL patterns for debugging
    console.warn('Failed to normalize URL:', url, error)
    return url
  }
}

/**
 * Generate SHA-256 hash from ArrayBuffer
 */
export const generateHash = async (data: ArrayBuffer): Promise<string> => {
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('')
}
