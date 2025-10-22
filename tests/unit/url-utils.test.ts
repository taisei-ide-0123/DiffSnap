import { describe, it, expect } from 'vitest'
import {
  resolveRelativeUrl,
  extractSignificantParams,
  hashQueryString,
  makeRecordId
} from '../../src/lib/url-utils'

describe('resolveRelativeUrl', () => {
  const baseUrl = 'https://example.com/page/view'

  it('相対URLを絶対URLに変換する', () => {
    expect(resolveRelativeUrl('../image.jpg', baseUrl)).toBe('https://example.com/image.jpg')
    expect(resolveRelativeUrl('./image.jpg', baseUrl)).toBe(
      'https://example.com/page/image.jpg'
    )
    expect(resolveRelativeUrl('image.jpg', baseUrl)).toBe(
      'https://example.com/page/image.jpg'
    )
    expect(resolveRelativeUrl('/absolute/image.jpg', baseUrl)).toBe(
      'https://example.com/absolute/image.jpg'
    )
  })

  it('絶対URLをそのまま返す', () => {
    const absoluteUrl = 'https://other.com/image.jpg'
    expect(resolveRelativeUrl(absoluteUrl, baseUrl)).toBe(absoluteUrl)
  })

  it('data URLをそのまま返す', () => {
    const dataUrl =
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='
    expect(resolveRelativeUrl(dataUrl, baseUrl)).toBe(dataUrl)
  })

  it('クエリパラメータを保持する', () => {
    expect(resolveRelativeUrl('image.jpg?v=2', baseUrl)).toBe(
      'https://example.com/page/image.jpg?v=2'
    )
    expect(resolveRelativeUrl('image.jpg?v=2&quality=high', baseUrl)).toBe(
      'https://example.com/page/image.jpg?v=2&quality=high'
    )
  })

  it('フラグメント（#）を削除する', () => {
    expect(resolveRelativeUrl('image.jpg#section', baseUrl)).toBe(
      'https://example.com/page/image.jpg'
    )
    expect(resolveRelativeUrl('image.jpg?v=2#section', baseUrl)).toBe(
      'https://example.com/page/image.jpg?v=2'
    )
  })

  it('無効なURLの場合は空文字列を返す', () => {
    expect(resolveRelativeUrl('', baseUrl)).toBe('')
    expect(resolveRelativeUrl('not-a-url', '')).toBe('')
    expect(resolveRelativeUrl('http://[invalid', baseUrl)).toBe('')
  })
})

describe('extractSignificantParams', () => {
  it('Amazon.comの重要パラメータ（dp, asin）を抽出する', () => {
    const query = new URLSearchParams('dp=B08XYZ&tag=abc&ref=xyz')
    const result = extractSignificantParams(query, 'amazon.com')

    expect(result.get('dp')).toBe('B08XYZ')
    expect(result.get('tag')).toBeNull()
    expect(result.get('ref')).toBeNull()
    expect(result.toString()).toBe('dp=B08XYZ')
  })

  it('Amazonサブドメインでも動作する', () => {
    const query = new URLSearchParams('dp=B08XYZ&tag=abc')
    const result = extractSignificantParams(query, 'www.amazon.com')

    expect(result.get('dp')).toBe('B08XYZ')
    expect(result.toString()).toBe('dp=B08XYZ')
  })

  it('YouTube.comの重要パラメータ（v）を抽出する', () => {
    const query = new URLSearchParams('v=dQw4w9WgXcQ&feature=share&t=42')
    const result = extractSignificantParams(query, 'youtube.com')

    expect(result.get('v')).toBe('dQw4w9WgXcQ')
    expect(result.get('feature')).toBeNull()
    expect(result.toString()).toBe('v=dQw4w9WgXcQ')
  })

  it('デフォルトルール（id, pid等）を適用する', () => {
    const query = new URLSearchParams('id=456&sort=price&page=2')
    const result = extractSignificantParams(query, 'example.com')

    expect(result.get('id')).toBe('456')
    expect(result.get('sort')).toBeNull()
    expect(result.toString()).toBe('id=456')
  })

  it('重要パラメータがない場合は全パラメータを返す（後方互換）', () => {
    const query = new URLSearchParams('date=2025-01-21&category=news')
    const result = extractSignificantParams(query, 'blog.com')

    expect(result.toString()).toBe('date=2025-01-21&category=news')
  })

  it('複数の重要パラメータを抽出する', () => {
    const query = new URLSearchParams('id=123&product_id=456&sort=price')
    const result = extractSignificantParams(query, 'shop.example.com')

    expect(result.get('id')).toBe('123')
    expect(result.get('product_id')).toBe('456')
    expect(result.get('sort')).toBeNull()
  })
})

describe('hashQueryString', () => {
  it('クエリ文字列をSHA-256ハッシュ化する', async () => {
    const hash = await hashQueryString('id=123')

    expect(hash).toHaveLength(32)
    expect(hash).toMatch(/^[0-9a-f]{32}$/)
  })

  it('同じ入力には常に同じハッシュを返す（冪等性）', async () => {
    const query = 'id=456&sort=price'
    const hash1 = await hashQueryString(query)
    const hash2 = await hashQueryString(query)

    expect(hash1).toBe(hash2)
  })

  it('異なる入力には異なるハッシュを返す', async () => {
    const hash1 = await hashQueryString('id=123')
    const hash2 = await hashQueryString('id=456')

    expect(hash1).not.toBe(hash2)
  })

  it('空文字列でもハッシュを生成する', async () => {
    const hash = await hashQueryString('')

    expect(hash).toHaveLength(32)
    expect(hash).toMatch(/^[0-9a-f]{32}$/)
  })

  it('マルチバイト文字を正しく処理する', async () => {
    const hash = await hashQueryString('query=日本語')

    expect(hash).toHaveLength(32)
    expect(hash).toMatch(/^[0-9a-f]{32}$/)
  })
})

describe('makeRecordId', () => {
  it('基本的なレコードIDを生成する', async () => {
    const recordId = await makeRecordId('https://example.com/page')

    expect(recordId).toBe('https://example.com/page')
  })

  it('クエリパラメータ付きURLのレコードIDを生成する', async () => {
    const recordId = await makeRecordId('https://example.com/page?id=123')

    expect(recordId).toMatch(/^https:\/\/example\.com\/page:[0-9a-f]{32}$/)
  })

  it('重要パラメータのみをハッシュ化する（Amazon）', async () => {
    const url1 = 'https://amazon.com/dp/B08XYZ?dp=B08XYZ&tag=abc&ref=xyz'
    const url2 = 'https://amazon.com/dp/B08XYZ?dp=B08XYZ&tag=different&ref=different'

    const recordId1 = await makeRecordId(url1)
    const recordId2 = await makeRecordId(url2)

    // 重要パラメータ（dp）が同じなので、レコードIDも同じになる
    expect(recordId1).toBe(recordId2)
    expect(recordId1).toMatch(/^https:\/\/amazon\.com\/dp\/B08XYZ:[0-9a-f]{32}$/)
  })

  it('追跡パラメータの違いを無視する', async () => {
    const url1 = 'https://example.com/product?id=456&utm_source=google'
    const url2 = 'https://example.com/product?id=456&utm_source=facebook'

    const recordId1 = await makeRecordId(url1)
    const recordId2 = await makeRecordId(url2)

    // idが同じなので、レコードIDも同じになる
    expect(recordId1).toBe(recordId2)
  })

  it('パラメータの順序が異なっても同じレコードIDを生成する', async () => {
    const url1 = 'https://example.com/page?id=123&product_id=456'
    const url2 = 'https://example.com/page?product_id=456&id=123'

    const recordId1 = await makeRecordId(url1)
    const recordId2 = await makeRecordId(url2)

    expect(recordId1).toBe(recordId2)
  })

  it('フラグメントは無視される', async () => {
    const url1 = 'https://example.com/page?id=123#section'
    const url2 = 'https://example.com/page?id=123'

    const recordId1 = await makeRecordId(url1)
    const recordId2 = await makeRecordId(url2)

    expect(recordId1).toBe(recordId2)
  })

  it('無効なURLの場合は空文字列を返す', async () => {
    expect(await makeRecordId('')).toBe('')
    expect(await makeRecordId('not-a-url')).toBe('')
    expect(await makeRecordId('://invalid')).toBe('')
  })

  it('レコードIDの形式が正しい', async () => {
    const recordId = await makeRecordId('https://example.com/page?id=123')

    // レコードIDは "https://example.com/page:ハッシュ" の形式
    expect(recordId).toMatch(/^https:\/\/example\.com\/page:[0-9a-f]{32}$/)

    // 最後のコロン以降がハッシュ
    const lastColonIndex = recordId.lastIndexOf(':')
    const hashPart = recordId.slice(lastColonIndex + 1)
    expect(hashPart).toMatch(/^[0-9a-f]{32}$/)
  })
})

describe('recordId collision test', () => {
  it('10,000個のレコードIDで衝突が発生しないことを検証する', async () => {
    const recordIds = new Set<string>()
    const baseUrl = 'https://example.com/product'

    // 10,000個の異なるURLを生成
    for (let i = 0; i < 10000; i++) {
      const url = `${baseUrl}?id=${i}&timestamp=${Date.now() + i}`
      const recordId = await makeRecordId(url)
      recordIds.add(recordId)
    }

    // 全て一意であることを確認
    expect(recordIds.size).toBe(10000)
  }, 30000) // タイムアウトを30秒に設定

  it('異なるドメインで同じパスとパラメータでも異なるレコードIDを生成する', async () => {
    const url1 = 'https://example.com/page?id=123'
    const url2 = 'https://other.com/page?id=123'

    const recordId1 = await makeRecordId(url1)
    const recordId2 = await makeRecordId(url2)

    expect(recordId1).not.toBe(recordId2)
  })

  it('同じドメインで異なるパスは異なるレコードIDを生成する', async () => {
    const url1 = 'https://example.com/page1?id=123'
    const url2 = 'https://example.com/page2?id=123'

    const recordId1 = await makeRecordId(url1)
    const recordId2 = await makeRecordId(url2)

    expect(recordId1).not.toBe(recordId2)
  })
})
