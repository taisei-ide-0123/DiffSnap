/**
 * @vitest-environment jsdom
 */
import { describe, it, expect } from 'vitest'
import {
  sanitize,
  guessExtension,
  deconflict,
  makeFilename,
  getPresetTemplate,
  PRESET_TEMPLATES,
} from './filename'
import type { ImageSnapshot } from '../shared/types'

describe('sanitize', () => {
  it('禁止文字を"-"に置換する', () => {
    const input = 'file<>:"/\\|?*name'
    const result = sanitize(input)
    expect(result).toBe('file-name')
  })

  it('制御文字を"-"に置換する', () => {
    const input = 'file\x00\x1Fname'
    const result = sanitize(input)
    expect(result).toBe('file-name')
  })

  it('連続する空白を単一ハイフンに置換する', () => {
    const input = 'file    name'
    const result = sanitize(input)
    expect(result).toBe('file-name')
  })

  it('連続するハイフンを単一ハイフンに置換する', () => {
    const input = 'file---name'
    const result = sanitize(input)
    expect(result).toBe('file-name')
  })

  it('先頭・末尾のハイフンを削除する', () => {
    const input = '-filename-'
    const result = sanitize(input)
    expect(result).toBe('filename')
  })

  it('50文字を超える場合は切り詰める', () => {
    const input = 'a'.repeat(60)
    const result = sanitize(input)
    expect(result.length).toBe(50)
  })

  it('空文字の場合はデフォルト名を返す', () => {
    const input = ''
    const result = sanitize(input)
    expect(result).toBe('image')
  })

  it('禁止文字のみの入力でもデフォルト名を返す', () => {
    const input = '<>:"/\\|?*'
    const result = sanitize(input)
    expect(result).toBe('image')
  })
})

describe('guessExtension', () => {
  it('data URLからMIMEタイプを読み取る: image/jpeg', () => {
    const url = 'data:image/jpeg;base64,/9j/4AAQ...'
    const result = guessExtension(url)
    expect(result).toBe('jpg')
  })

  it('data URLからMIMEタイプを読み取る: image/png', () => {
    const url = 'data:image/png;base64,iVBORw0KGgo...'
    const result = guessExtension(url)
    expect(result).toBe('png')
  })

  it('data URLからMIMEタイプを読み取る: image/webp', () => {
    const url = 'data:image/webp;base64,UklGR...'
    const result = guessExtension(url)
    expect(result).toBe('webp')
  })

  it('通常URLからパスの拡張子を読み取る: .jpg', () => {
    const url = 'https://example.com/images/photo.jpg'
    const result = guessExtension(url)
    expect(result).toBe('jpg')
  })

  it('通常URLからパスの拡張子を読み取る: .png', () => {
    const url = 'https://example.com/images/photo.png'
    const result = guessExtension(url)
    expect(result).toBe('png')
  })

  it('通常URLからパスの拡張子を読み取る: .gif', () => {
    const url = 'https://example.com/images/photo.gif'
    const result = guessExtension(url)
    expect(result).toBe('gif')
  })

  it('.jpegを.jpgに正規化する', () => {
    const url = 'https://example.com/images/photo.jpeg'
    const result = guessExtension(url)
    expect(result).toBe('jpg')
  })

  it('拡張子がない場合はデフォルトで.jpgを返す', () => {
    const url = 'https://example.com/images/photo'
    const result = guessExtension(url)
    expect(result).toBe('jpg')
  })

  it('不明な拡張子の場合はデフォルトで.jpgを返す', () => {
    const url = 'https://example.com/images/photo.txt'
    const result = guessExtension(url)
    expect(result).toBe('jpg')
  })

  it('無効なURLの場合はデフォルトで.jpgを返す', () => {
    const url = 'not-a-valid-url'
    const result = guessExtension(url)
    expect(result).toBe('jpg')
  })
})

describe('deconflict', () => {
  it('衝突しない場合はそのまま返す', () => {
    const existing = new Set(['file1.jpg', 'file2.jpg'])
    const result = deconflict('file3.jpg', existing)
    expect(result).toBe('file3.jpg')
  })

  it('衝突する場合は-1を付与する', () => {
    const existing = new Set(['image.jpg'])
    const result = deconflict('image.jpg', existing)
    expect(result).toBe('image-1.jpg')
  })

  it('複数回衝突する場合はカウンターを増やす', () => {
    const existing = new Set(['image.jpg', 'image-1.jpg', 'image-2.jpg'])
    const result = deconflict('image.jpg', existing)
    expect(result).toBe('image-3.jpg')
  })

  it('拡張子がない場合も動作する', () => {
    const existing = new Set(['image'])
    const result = deconflict('image', existing)
    expect(result).toBe('image-1')
  })

  it('空のexistingの場合はそのまま返す', () => {
    const existing = new Set<string>()
    const result = deconflict('image.jpg', existing)
    expect(result).toBe('image.jpg')
  })
})

describe('makeFilename', () => {
  const mockImage: ImageSnapshot = {
    hash: 'abc123',
    url: 'https://example.com/image.jpg',
    width: 800,
    height: 600,
    alt: 'Sample Image',
    context: 'Context text',
    firstSeenAt: Date.now(),
  }

  const pageUrl = 'https://example.com/products/item'

  it('デフォルトテンプレートで正しく生成される', () => {
    const template = PRESET_TEMPLATES.default
    const result = makeFilename(template, mockImage, 1, pageUrl)

    // YYYY-MM-DD-example.com-800x600-001.jpg
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}-example.com-800x600-001\.jpg$/)
  })

  it('simpleテンプレートで正しく生成される', () => {
    const template = PRESET_TEMPLATES.simple
    const result = makeFilename(template, mockImage, 5, pageUrl)

    expect(result).toBe('example.com-005.jpg')
  })

  it('detailedテンプレートで正しく生成される', () => {
    const template = PRESET_TEMPLATES.detailed
    const result = makeFilename(template, mockImage, 1, pageUrl)

    // YYYY-MM-DD-HH-MM-SS-example.com-products-item-800x600-001.jpg
    expect(result).toMatch(
      /^\d{4}-\d{2}-\d{2}-\d{2}-\d{2}-\d{2}-example.com-products-item-800x600-001\.jpg$/
    )
  })

  it('dimensionテンプレートで正しく生成される', () => {
    const template = PRESET_TEMPLATES.dimension
    const result = makeFilename(template, mockImage, 1, pageUrl)

    expect(result).toBe('800x600-example.com-001.jpg')
  })

  it('altテンプレートで正しく生成される', () => {
    const template = PRESET_TEMPLATES.alt
    const result = makeFilename(template, mockImage, 1, pageUrl)

    expect(result).toBe('Sample-Image-800x600-001.jpg')
  })

  it('altが存在しない場合は"noalt"になる', () => {
    const imageNoAlt: ImageSnapshot = {
      ...mockImage,
      alt: undefined,
    }

    const template = PRESET_TEMPLATES.alt
    const result = makeFilename(template, imageNoAlt, 1, pageUrl)

    expect(result).toBe('noalt-800x600-001.jpg')
  })

  it('連番が3桁ゼロ埋めされる', () => {
    const template = '{index}'
    expect(makeFilename(template, mockImage, 1, pageUrl)).toMatch(/001\.jpg$/)
    expect(makeFilename(template, mockImage, 10, pageUrl)).toMatch(/010\.jpg$/)
    expect(makeFilename(template, mockImage, 100, pageUrl)).toMatch(/100\.jpg$/)
  })

  it('pathが正しく抽出される', () => {
    const template = '{path}'
    const result = makeFilename(template, mockImage, 1, 'https://example.com/products/item')
    expect(result).toBe('products-item.jpg')
  })

  it('パスがルートの場合は"root"になる', () => {
    const template = '{path}'
    const result = makeFilename(template, mockImage, 1, 'https://example.com/')
    expect(result).toBe('root.jpg')
  })

  it('不正なURLの場合はデフォルト値が使用される', () => {
    const template = '{domain}-{path}'
    const result = makeFilename(template, mockImage, 1, 'not-a-valid-url')
    expect(result).toBe('unknown-root.jpg')
  })

  it('禁止文字を含むaltはサニタイズされる', () => {
    const imageWithBadAlt: ImageSnapshot = {
      ...mockImage,
      alt: 'Image<>:"/\\|?*Name',
    }

    const template = '{alt}'
    const result = makeFilename(template, imageWithBadAlt, 1, pageUrl)
    expect(result).toBe('Image-Name.jpg')
  })

  it('data URLの画像は正しく拡張子が推測される', () => {
    const imageWithDataUrl: ImageSnapshot = {
      ...mockImage,
      url: 'data:image/png;base64,iVBORw0KGgo...',
    }

    const template = '{index}'
    const result = makeFilename(template, imageWithDataUrl, 1, pageUrl)
    expect(result).toBe('001.png')
  })
})

describe('getPresetTemplate', () => {
  it('default プリセットを取得できる', () => {
    const result = getPresetTemplate('default')
    expect(result).toBe('{date}-{domain}-{w}x{h}-{index}')
  })

  it('simple プリセットを取得できる', () => {
    const result = getPresetTemplate('simple')
    expect(result).toBe('{domain}-{index}')
  })

  it('detailed プリセットを取得できる', () => {
    const result = getPresetTemplate('detailed')
    expect(result).toBe('{date}-{time}-{domain}-{path}-{w}x{h}-{index}')
  })

  it('dimension プリセットを取得できる', () => {
    const result = getPresetTemplate('dimension')
    expect(result).toBe('{w}x{h}-{domain}-{index}')
  })

  it('alt プリセットを取得できる', () => {
    const result = getPresetTemplate('alt')
    expect(result).toBe('{alt}-{w}x{h}-{index}')
  })
})
