/**
 * URL正規化とレコードID生成ユーティリティ
 *
 * このモジュールは以下の機能を提供します:
 * - 相対URLを絶対URLに変換
 * - 差分台帳用の一意なレコードIDを生成
 * - クエリパラメータの正規化とハッシュ化
 */

/**
 * デフォルトの重要パラメータ
 */
const DEFAULT_PARAMS = ['id', 'pid', 'product_id', 'sku', 'item_id'] as const

/**
 * ドメイン別の重要パラメータマッピング
 *
 * 各ドメインで商品IDやコンテンツIDとして使用される
 * 重要なクエリパラメータを定義します。
 */
const SIGNIFICANT_PARAMS: Record<string, readonly string[]> = {
  'amazon.com': ['dp', 'asin'],
  'ebay.com': ['item'],
  'youtube.com': ['v'],
  'twitter.com': ['status'],
  'x.com': ['status'],
  default: DEFAULT_PARAMS,
}

/**
 * 相対URLを絶対URLに正規化します
 *
 * 画像検出時に相対パスを絶対URLに変換するために使用します。
 * クエリパラメータのソートや比較用の正規化には`src/shared/utils/index.ts`の
 * `normalizeUrlForComparison`を使用してください。
 *
 * @param rawUrl - 正規化するURL（相対または絶対）
 * @param baseUrl - ベースURL（相対URL解決用）
 * @returns 正規化された絶対URL。無効なURLの場合は空文字列を返す
 *
 * @example
 * normalizeUrl('../image.jpg', 'https://example.com/page/view')
 * // => 'https://example.com/image.jpg'
 *
 * normalizeUrl('data:image/png;base64,...', 'https://example.com/')
 * // => 'data:image/png;base64,...' (data URLはそのまま)
 */
export const normalizeUrl = (rawUrl: string, baseUrl: string): string => {
  // 空文字列の場合は早期リターン
  if (!rawUrl || !baseUrl) {
    return ''
  }

  try {
    // data URLはそのまま返す
    if (rawUrl.startsWith('data:')) {
      return rawUrl
    }

    // URLオブジェクトで相対URLを解決
    const url = new URL(rawUrl, baseUrl)

    // フラグメント（#）を削除
    url.hash = ''

    return url.href
  } catch (error) {
    // 開発時のみエラーログを出力
    if (import.meta.env.DEV) {
      console.debug('[normalizeUrl] Invalid URL:', rawUrl, error)
    }
    return ''
  }
}

/**
 * ホスト名から重要なクエリパラメータを抽出します
 *
 * @param query - URLSearchParamsオブジェクト
 * @param hostname - ドメイン名（例: 'amazon.com'）
 * @returns 重要パラメータのみを含むURLSearchParams
 *
 * @example
 * const params = new URLSearchParams('dp=B08XYZ&tag=abc&ref=xyz')
 * extractSignificantParams(params, 'amazon.com')
 * // => URLSearchParams { 'dp' => 'B08XYZ' }
 */
export const extractSignificantParams = (
  query: URLSearchParams,
  hostname: string
): URLSearchParams => {
  // ドメインに対応する重要パラメータリストを取得
  let significantKeys: readonly string[] = SIGNIFICANT_PARAMS.default ?? DEFAULT_PARAMS

  // 完全一致またはサブドメイン一致をチェック
  for (const [domain, keys] of Object.entries(SIGNIFICANT_PARAMS)) {
    if (domain === 'default' || !keys) continue
    if (hostname === domain || hostname.endsWith(`.${domain}`)) {
      significantKeys = keys
      break
    }
  }

  // 重要パラメータのみを抽出
  const filtered = new URLSearchParams()
  for (const key of significantKeys) {
    const value = query.get(key)
    if (value !== null) {
      filtered.set(key, value)
    }
  }

  // 重要パラメータが見つからない場合は全パラメータを返す（後方互換）
  if (filtered.toString() === '') {
    return query
  }

  return filtered
}

/**
 * クエリ文字列をSHA-256ハッシュ化します
 *
 * @param query - ハッシュ化するクエリ文字列
 * @returns 32桁の16進数ハッシュ文字列
 *
 * @example
 * await hashQueryString('id=123&sort=price')
 * // => 'a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6'
 */
export const hashQueryString = async (query: string): Promise<string> => {
  // UTF-8エンコード
  const encoder = new TextEncoder()
  const data = encoder.encode(query)

  // SHA-256ハッシュ計算
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)

  // ArrayBufferを16進数文字列に変換
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  const hashHex = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('')

  // 最初の32桁（128ビット）を返す
  return hashHex.slice(0, 32)
}

/**
 * URLから差分台帳用の一意なレコードIDを生成します
 *
 * レコードIDの形式: `${origin}${pathname}:${queryHash}`
 *
 * @param url - レコードIDを生成するURL
 * @returns 一意なレコードID
 *
 * @example
 * await makeRecordId('https://amazon.com/dp/B08XYZ?tag=abc&ref=xyz')
 * // => 'https://amazon.com/dp:a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6'
 */
export const makeRecordId = async (url: string): Promise<string> => {
  try {
    const urlObj = new URL(url)
    const { origin, pathname, search } = urlObj

    // クエリパラメータがない場合
    if (!search || search === '?') {
      return `${origin}${pathname}`
    }

    // 重要パラメータを抽出
    const query = new URLSearchParams(search)
    const significantParams = extractSignificantParams(query, urlObj.hostname)

    // パラメータをキーでソート
    const sortedParams = new URLSearchParams(
      Array.from(significantParams.entries()).sort(([a], [b]) => a.localeCompare(b))
    )

    // ソート済みクエリ文字列をハッシュ化
    const normalizedQuery = sortedParams.toString()
    const queryHash = await hashQueryString(normalizedQuery)

    return `${origin}${pathname}:${queryHash}`
  } catch (error) {
    // 開発時のみエラーログを出力
    if (import.meta.env.DEV) {
      console.debug('[makeRecordId] Invalid URL:', url, error)
    }
    return ''
  }
}

/**
 * recordIdからqueryHashを抽出します
 *
 * @param recordId - makeRecordIdで生成されたレコードID
 * @returns queryHash（存在しない場合は空文字列）
 *
 * @example
 * extractQueryHashFromRecordId('https://example.com/product:abc123')
 * // => 'abc123'
 *
 * extractQueryHashFromRecordId('https://example.com/product')
 * // => ''
 */
export const extractQueryHashFromRecordId = (recordId: string): string => {
  const parts = recordId.split(':')
  return parts.length > 1 ? parts[1] ?? '' : ''
}
