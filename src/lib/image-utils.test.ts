import { describe, it, expect } from 'vitest'
import { formatImageSize } from './image-utils'

describe('formatImageSize', () => {
  it('should format valid dimensions', () => {
    expect(formatImageSize(800, 600)).toBe('800 × 600')
  })

  it('should return undefined for missing width', () => {
    expect(formatImageSize(undefined, 600)).toBeUndefined()
  })

  it('should return undefined for missing height', () => {
    expect(formatImageSize(800, undefined)).toBeUndefined()
  })

  it('should return undefined for zero width', () => {
    expect(formatImageSize(0, 600)).toBeUndefined()
  })

  it('should return undefined for zero height', () => {
    expect(formatImageSize(800, 0)).toBeUndefined()
  })

  it('should return undefined for negative width', () => {
    expect(formatImageSize(-800, 600)).toBeUndefined()
  })

  it('should return undefined for negative height', () => {
    expect(formatImageSize(800, -600)).toBeUndefined()
  })

  it('should return undefined for both dimensions missing', () => {
    expect(formatImageSize(undefined, undefined)).toBeUndefined()
  })

  it('should return undefined for both dimensions zero', () => {
    expect(formatImageSize(0, 0)).toBeUndefined()
  })
})
