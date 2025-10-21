import { describe, it, expect } from 'vitest'
import { normalizeUrl, generateHash } from './index'

describe('normalizeUrl', () => {
  it('should normalize URL by removing hash', () => {
    const url = 'https://example.com/page#section'
    const normalized = normalizeUrl(url)
    expect(normalized).toBe('https://example.com/page')
  })

  it('should sort query parameters', () => {
    const url = 'https://example.com/page?b=2&a=1'
    const normalized = normalizeUrl(url)
    expect(normalized).toBe('https://example.com/page?a=1&b=2')
  })

  it('should handle invalid URLs gracefully', () => {
    const invalidUrl = 'not-a-url'
    const normalized = normalizeUrl(invalidUrl)
    expect(normalized).toBe(invalidUrl)
  })
})

describe('generateHash', () => {
  it('should generate SHA-256 hash', async () => {
    const data = new TextEncoder().encode('test data').buffer
    const hash = await generateHash(data)
    expect(hash).toHaveLength(64) // SHA-256 produces 64 hex characters
    expect(hash).toMatch(/^[a-f0-9]{64}$/)
  })

  it('should generate consistent hashes for same data', async () => {
    const data = new TextEncoder().encode('test data').buffer
    const hash1 = await generateHash(data)
    const hash2 = await generateHash(data)
    expect(hash1).toBe(hash2)
  })

  it('should generate different hashes for different data', async () => {
    const data1 = new TextEncoder().encode('test data 1').buffer
    const data2 = new TextEncoder().encode('test data 2').buffer
    const hash1 = await generateHash(data1)
    const hash2 = await generateHash(data2)
    expect(hash1).not.toBe(hash2)
  })
})
