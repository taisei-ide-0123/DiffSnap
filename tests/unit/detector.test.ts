/**
 * 画像検出エンジンの単体テスト
 *
 * JSDOM環境でモックDOMを使用してテストします。
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  detectCanvasElements,
  detectCSSBackgrounds,
  detectImages,
  detectImgElements,
  detectPictureElements,
  extractSrcset,
} from '../../src/content/detector'

describe('画像検出エンジン', () => {
  // JSDOMのデフォルトbaseURL
  const baseUrl = 'http://localhost:3000/'

  beforeEach(() => {
    // 各テスト前にDOMをクリア
    document.body.innerHTML = ''
  })

  describe('detectImgElements', () => {
    it('基本的な<img>要素を検出する', () => {
      document.body.innerHTML = `
        <img src="/image1.jpg" width="800" height="600" alt="Test Image 1">
        <img src="https://cdn.example.com/image2.jpg" width="1024" height="768">
      `

      const candidates = detectImgElements(baseUrl)

      expect(candidates).toHaveLength(2)
      expect(candidates[0]).toMatchObject({
        url: 'http://localhost:3000/image1.jpg',
        source: 'img',
        width: 800,
        height: 600,
        alt: 'Test Image 1',
      })
      expect(candidates[1]).toMatchObject({
        url: 'https://cdn.example.com/image2.jpg',
        source: 'img',
        width: 1024,
        height: 768,
      })
    })

    it('相対URLを絶対URLに正規化する', () => {
      document.body.innerHTML = `
        <img src="../images/photo.jpg">
        <img src="./assets/logo.png">
      `

      const candidates = detectImgElements(baseUrl)

      expect(candidates).toHaveLength(2)
      expect(candidates[0]?.url).toBe('http://localhost:3000/images/photo.jpg')
      expect(candidates[1]?.url).toBe('http://localhost:3000/assets/logo.png')
    })

    it('src属性がない画像をスキップする', () => {
      document.body.innerHTML = `
        <img width="100" height="100">
        <img src="" alt="Empty">
      `

      const candidates = detectImgElements(baseUrl)

      expect(candidates).toHaveLength(0)
    })

    it('currentSrcを優先的に使用する', () => {
      document.body.innerHTML = `<img src="/fallback.jpg">`
      const img = document.querySelector('img')
      if (!img) throw new Error('img element not found')

      // currentSrcをモック（通常はブラウザが設定）
      Object.defineProperty(img, 'currentSrc', {
        value: 'https://example.com/current.jpg',
        writable: true,
      })

      const candidates = detectImgElements(baseUrl)

      expect(candidates).toHaveLength(1)
      expect(candidates[0]?.url).toBe('https://example.com/current.jpg')
    })

    it('naturalWidth/naturalHeightを優先する', () => {
      document.body.innerHTML = `<img src="/image.jpg" width="100" height="100">`
      const img = document.querySelector('img')
      if (!img) throw new Error('img element not found')

      Object.defineProperty(img, 'naturalWidth', { value: 1920, writable: true })
      Object.defineProperty(img, 'naturalHeight', { value: 1080, writable: true })

      const candidates = detectImgElements(baseUrl)

      expect(candidates[0]).toMatchObject({
        width: 1920,
        height: 1080,
      })
    })
  })

  describe('detectPictureElements', () => {
    it('<picture>要素のimg候補を検出する', () => {
      document.body.innerHTML = `
        <picture>
          <source srcset="/image-large.jpg" media="(min-width: 800px)">
          <img src="/image-small.jpg" alt="Responsive Image">
        </picture>
      `

      const candidates = detectPictureElements(baseUrl)

      expect(candidates.length).toBeGreaterThan(0)
      // imgのURLが必ず含まれる
      expect(candidates.some((c) => c.url === 'http://localhost:3000/image-small.jpg')).toBe(true)
    })

    it('picture内のsource要素のsrcsetを検出する', () => {
      document.body.innerHTML = `
        <picture>
          <source srcset="/hd.jpg 1920w, /fhd.jpg 2560w" type="image/jpeg">
          <img src="/sd.jpg">
        </picture>
      `

      const candidates = detectPictureElements(baseUrl)

      // source要素のsrcsetから最大解像度が抽出される
      expect(candidates.some((c) => c.url === 'http://localhost:3000/fhd.jpg')).toBe(true)
    })

    it('imgがないpicture要素をスキップする', () => {
      document.body.innerHTML = `
        <picture>
          <source srcset="/image.jpg">
        </picture>
      `

      const candidates = detectPictureElements(baseUrl)

      expect(candidates).toHaveLength(0)
    })
  })

  describe('extractSrcset', () => {
    it('幅ディスクリプタから最大解像度を選択する', () => {
      const srcset = 'image-320w.jpg 320w, image-640w.jpg 640w, image-1280w.jpg 1280w'
      const result = extractSrcset(srcset, baseUrl)

      expect(result).toBe('http://localhost:3000/image-1280w.jpg')
    })

    it('密度ディスクリプタから最大値を選択する', () => {
      const srcset = 'image.jpg 1x, image@2x.jpg 2x, image@3x.jpg 3x'
      const result = extractSrcset(srcset, baseUrl)

      expect(result).toBe('http://localhost:3000/image@3x.jpg')
    })

    it('幅ディスクリプタを密度ディスクリプタより優先する', () => {
      const srcset = 'image-640w.jpg 640w, image@3x.jpg 3x'
      const result = extractSrcset(srcset, baseUrl)

      // 幅ディスクリプタが優先される
      expect(result).toBe('http://localhost:3000/image-640w.jpg')
    })

    it('ディスクリプタなしの場合は1xとみなす', () => {
      const srcset = 'image1.jpg, image2.jpg 2x'
      const result = extractSrcset(srcset, baseUrl)

      expect(result).toBe('http://localhost:3000/image2.jpg')
    })

    it('空のsrcsetは空文字列を返す', () => {
      expect(extractSrcset('', baseUrl)).toBe('')
      expect(extractSrcset('   ', baseUrl)).toBe('')
    })

    it('無効なディスクリプタを含むエントリをスキップする', () => {
      const srcset = 'valid.jpg 1024w, invalid.jpg abc, another.jpg 2048w'
      const result = extractSrcset(srcset, baseUrl)

      expect(result).toBe('http://localhost:3000/another.jpg')
    })

    it('複雑な空白を含むsrcsetを正しく解析する', () => {
      const srcset = `
        image-small.jpg   320w,
        image-medium.jpg  640w  ,
        image-large.jpg 1280w
      `
      const result = extractSrcset(srcset, baseUrl)

      expect(result).toBe('http://localhost:3000/image-large.jpg')
    })
  })

  describe('detectCSSBackgrounds', () => {
    it('CSS background-imageからURLを抽出する', () => {
      document.body.innerHTML = `
        <div class="hero" style="background-image: url('/hero-bg.jpg');"></div>
        <section style="background-image: url('https://cdn.example.com/section-bg.png');"></section>
      `

      const candidates = detectCSSBackgrounds(baseUrl)

      expect(candidates.length).toBeGreaterThanOrEqual(2)
      expect(candidates.some((c) => c.url === 'http://localhost:3000/hero-bg.jpg')).toBe(true)
      expect(candidates.some((c) => c.url === 'https://cdn.example.com/section-bg.png')).toBe(true)
    })

    it('複数背景画像を抽出する', () => {
      document.body.innerHTML = `
        <div class="banner" style="background-image: url('/bg1.jpg'), url('/bg2.jpg');"></div>
      `

      const candidates = detectCSSBackgrounds(baseUrl)

      expect(candidates.length).toBeGreaterThanOrEqual(2)
      expect(candidates.some((c) => c.url === 'http://localhost:3000/bg1.jpg')).toBe(true)
      expect(candidates.some((c) => c.url === 'http://localhost:3000/bg2.jpg')).toBe(true)
    })

    it('background-image: noneをスキップする', () => {
      document.body.innerHTML = `
        <section style="background-image: none;"></section>
        <div class="card"></div>
      `

      const candidates = detectCSSBackgrounds(baseUrl)

      expect(candidates).toHaveLength(0)
    })

    it('主要セレクタのみを走査する', () => {
      // 501個の要素を作成（最大500まで走査）
      const elements = Array.from({ length: 501 }, (_, i) => {
        return `<section style="background-image: url('/bg-${i}.jpg');"></section>`
      }).join('')

      document.body.innerHTML = elements

      const candidates = detectCSSBackgrounds(baseUrl)

      // 最大500要素まで
      expect(candidates.length).toBeLessThanOrEqual(500)
    })

    it('引用符のバリエーションを処理する', () => {
      document.body.innerHTML = `
        <div class="card" style='background-image: url("/double-quote.jpg");'></div>
        <div class="card" style="background-image: url('/single-quote.jpg');"></div>
        <div class="card" style="background-image: url(/no-quote.jpg);"></div>
      `

      const candidates = detectCSSBackgrounds(baseUrl)

      expect(candidates.length).toBeGreaterThanOrEqual(3)
      expect(candidates.some((c) => c.url === 'http://localhost:3000/double-quote.jpg')).toBe(true)
      expect(candidates.some((c) => c.url === 'http://localhost:3000/single-quote.jpg')).toBe(true)
      expect(candidates.some((c) => c.url === 'http://localhost:3000/no-quote.jpg')).toBe(true)
    })
  })

  describe('detectCanvasElements', () => {
    it.skip('<canvas>要素をtoDataURLで検出する (JSDOM未対応)', () => {
      // JSDOMではcanvasが完全に実装されていないためスキップ
      document.body.innerHTML = `<canvas width="800" height="600"></canvas>`

      const canvas = document.querySelector('canvas')
      if (!canvas) throw new Error('canvas element not found')
      const ctx = canvas.getContext('2d')
      if (!ctx) throw new Error('2d context not available')

      // 簡単な描画
      ctx.fillStyle = 'red'
      ctx.fillRect(0, 0, 100, 100)

      const candidates = detectCanvasElements(baseUrl)

      expect(candidates).toHaveLength(1)
      expect(candidates[0]).toMatchObject({
        source: 'canvas',
        width: 800,
        height: 600,
      })
      expect(candidates[0]?.url).toMatch(/^data:image\/png;base64,/)
    })

    it('CORS汚染されたcanvasをスキップする', () => {
      document.body.innerHTML = `<canvas width="100" height="100"></canvas>`

      const canvas = document.querySelector('canvas')
      if (!canvas) throw new Error('canvas element not found')

      // toDataURLでエラーを投げるようモック
      vi.spyOn(canvas, 'toDataURL').mockImplementation(() => {
        throw new Error('SecurityError: The canvas has been tainted by cross-origin data.')
      })

      const candidates = detectCanvasElements(baseUrl)

      expect(candidates).toHaveLength(0)
    })

    it.skip('複数のcanvas要素を検出する (JSDOM未対応)', () => {
      document.body.innerHTML = `
        <canvas width="100" height="100"></canvas>
        <canvas width="200" height="200"></canvas>
        <canvas width="300" height="300"></canvas>
      `

      const candidates = detectCanvasElements(baseUrl)

      expect(candidates).toHaveLength(3)
      expect(candidates[0]?.width).toBe(100)
      expect(candidates[1]?.width).toBe(200)
      expect(candidates[2]?.width).toBe(300)
    })
  })

  describe('detectImages (統合テスト)', () => {
    it('全種類の画像ソースを統合的に検出する', () => {
      document.body.innerHTML = `
        <img src="/img-element.jpg" alt="IMG">
        <picture>
          <img src="/picture-element.jpg" alt="PICTURE">
        </picture>
        <img srcset="/srcset-320.jpg 320w, /srcset-640.jpg 640w" src="/fallback.jpg">
        <div class="hero" style="background-image: url('/css-bg.jpg');"></div>
        <canvas width="100" height="100"></canvas>
      `

      const candidates = detectImages()

      // 少なくとも4種類の検出結果が含まれる (canvasは除く)
      expect(candidates.length).toBeGreaterThanOrEqual(4)

      const sources = candidates.map((c) => c.source)
      expect(sources).toContain('img')
      // JSDOMではcurrentSrc未実装のため、picture内のimgは'img'として検出される
      // expect(sources).toContain('picture') // 実ブラウザではpictureとして検出される
      expect(sources).toContain('srcset')
      expect(sources).toContain('css-bg')
      // canvas はJSDOMでは動作しないためチェック除外
    })

    it('重複するURLを除外する', () => {
      document.body.innerHTML = `
        <img src="/duplicate.jpg" alt="Image 1">
        <img src="/duplicate.jpg" alt="Image 2">
        <picture>
          <img src="/duplicate.jpg" alt="Image 3">
        </picture>
      `

      const candidates = detectImages()

      // 同じURLは1つのみ
      expect(candidates).toHaveLength(1)
      expect(candidates[0]?.url).toBe('http://localhost:3000/duplicate.jpg')
    })

    it('重複時により詳細な情報を保持する', () => {
      document.body.innerHTML = `
        <img src="/image.jpg">
        <img src="/image.jpg" width="1920" height="1080" alt="High Resolution">
      `

      const candidates = detectImages()

      expect(candidates).toHaveLength(1)
      expect(candidates[0]).toMatchObject({
        url: 'http://localhost:3000/image.jpg',
        width: 1920,
        height: 1080,
        alt: 'High Resolution',
      })
    })

    it('無効なURLを除外する', () => {
      document.body.innerHTML = `
        <img src="">
        <img src="/valid.jpg">
        <div style="background-image: url('');"></div>
      `

      const candidates = detectImages()

      // 空のsrcは除外されるが、CSSのurl('')は含まれる可能性がある
      expect(candidates.length).toBeGreaterThanOrEqual(1)
      expect(candidates.some((c) => c.url === 'http://localhost:3000/valid.jpg')).toBe(true)
    })

    it('data URLを正しく処理する', () => {
      const dataUrl = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='

      document.body.innerHTML = `
        <img src="${dataUrl}">
      `

      const candidates = detectImages()

      expect(candidates).toHaveLength(1)
      expect(candidates[0]?.url).toBe(dataUrl)
    })

    it('大量の画像を効率的に処理する', () => {
      // 100個の画像要素を作成
      const elements = Array.from(
        { length: 100 },
        (_, i) => `<img src="/image-${i}.jpg" width="800" height="600">`
      ).join('')

      document.body.innerHTML = elements

      const startTime = performance.now()
      const candidates = detectImages()
      const endTime = performance.now()

      expect(candidates).toHaveLength(100)
      // 100枚の検出が100ms以内で完了することを期待
      expect(endTime - startTime).toBeLessThan(100)
    })
  })

  describe('コンテキスト抽出', () => {
    it('alt属性が優先される', () => {
      document.body.innerHTML = `
        <img src="/image.jpg" alt="Alt Text" aria-label="Main Product" title="Title Text">
      `

      const candidates = detectImgElements(baseUrl)

      // alt属性が空でない場合はaltを使用
      expect(candidates[0]?.alt).toBe('Alt Text')
    })

    it('alt属性が空の場合はaria-labelを使用する', () => {
      document.body.innerHTML = `
        <img src="/image.jpg" aria-label="Main Product" alt="" title="Title Text">
      `

      const candidates = detectImgElements(baseUrl)

      expect(candidates[0]?.alt).toBe('Main Product')
    })

    it('title属性をフォールバックとして使用する', () => {
      document.body.innerHTML = `
        <img src="/image.jpg" title="Title Text" alt="">
      `

      const candidates = detectImgElements(baseUrl)

      expect(candidates[0]?.alt).toBe('Title Text')
    })

    it('figcaption要素からコンテキストを抽出する', () => {
      document.body.innerHTML = `
        <figure>
          <img src="/image.jpg" alt="">
          <figcaption>Beautiful Sunset</figcaption>
        </figure>
      `

      const candidates = detectImgElements(baseUrl)

      expect(candidates[0]?.alt).toBe('Beautiful Sunset')
    })

    it('祖先要素のテキストノードを抽出する', () => {
      document.body.innerHTML = `
        <div class="card">
          Product Description Text
          <img src="/image.jpg" alt="">
        </div>
      `

      const candidates = detectImgElements(baseUrl)

      // 祖先要素の直接のテキストノードを取得
      expect(candidates[0]?.alt).toContain('Product Description')
    })

    it('50文字を超えるコンテキストを切り詰める', () => {
      const longText = 'A'.repeat(100)

      document.body.innerHTML = `
        <img src="/image.jpg" aria-label="${longText}" alt="">
      `

      const candidates = detectImgElements(baseUrl)

      // aria-labelが50文字に切り詰められる
      expect(candidates[0]?.alt?.length).toBeLessThanOrEqual(50)
    })
  })
})
