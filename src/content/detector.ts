/**
 * 画像検出エンジン
 *
 * MVP実装: 5種類の画像ソースを検出
 * 1. <img>要素
 * 2. <picture>要素
 * 3. srcset属性（最大解像度選択）
 * 4. CSS background-image（主要セレクタのみ、最大500要素）
 * 5. <canvas>要素（toDataURL変換）
 */

import type { ImageCandidate } from '../shared/types'
import { normalizeUrl } from '../lib/url-utils'

/**
 * srcset属性のディスクリプタ種別
 */
interface SrcsetCandidate {
  url: string
  descriptor: string
  width?: number // 幅ディスクリプタ（Xw）
  density?: number // 密度ディスクリプタ（Xx）
}

/**
 * 画像周辺のコンテキスト情報を抽出します
 *
 * @param element - 画像要素
 * @returns 周辺テキスト（最大50文字）
 */
const extractContext = (element: Element): string => {
  // 優先度付き情報源
  // 1. aria-label
  const ariaLabel = element.getAttribute('aria-label')
  if (ariaLabel?.trim()) {
    return ariaLabel.trim().slice(0, 50)
  }

  // 2. title属性
  const title = element.getAttribute('title')
  if (title?.trim()) {
    return title.trim().slice(0, 50)
  }

  // 3. figcaption要素（親がfigureの場合）
  const parentFigure = element.closest('figure')
  if (parentFigure) {
    const figcaption = parentFigure.querySelector('figcaption')
    if (figcaption?.textContent?.trim()) {
      return figcaption.textContent.trim().slice(0, 50)
    }
  }

  // 4. 祖先要素のテキストノード（3階層まで）
  let currentElement: Element | null = element
  for (let i = 0; i < 3; i++) {
    currentElement = currentElement?.parentElement
    if (!currentElement) break

    // テキストノードを収集
    const textNodes = Array.from(currentElement.childNodes)
      .filter((node) => node.nodeType === Node.TEXT_NODE)
      .map((node) => node.textContent?.trim() ?? '')
      .filter((text) => text.length > 0)

    if (textNodes.length > 0) {
      const context = textNodes.join(' ').replace(/\s+/g, ' ')
      if (context) {
        return context.slice(0, 50)
      }
    }
  }

  // 5. フォールバック: URL最終セグメント
  return ''
}

/**
 * <img>要素から画像候補を検出します
 *
 * @param baseUrl - ベースURL（相対URL解決用）
 * @returns 画像候補の配列
 */
export const detectImgElements = (baseUrl: string): ImageCandidate[] => {
  const candidates: ImageCandidate[] = []
  const images = document.querySelectorAll('img')

  for (const img of images) {
    // currentSrc > src の優先順位
    const rawUrl = img.currentSrc || img.src
    if (!rawUrl || rawUrl.trim() === '') continue

    const url = normalizeUrl(rawUrl, baseUrl)
    // 空のURLまたはbaseURLと同じ場合はスキップ（<img src="">対策）
    if (!url || url === baseUrl) continue

    candidates.push({
      url,
      source: 'img',
      width: img.naturalWidth > 0 ? img.naturalWidth : img.width > 0 ? img.width : undefined,
      height: img.naturalHeight > 0 ? img.naturalHeight : img.height > 0 ? img.height : undefined,
      alt: img.alt && img.alt.trim() !== '' ? img.alt : extractContext(img),
    })
  }

  return candidates
}

/**
 * <picture>要素から画像候補を検出します
 *
 * @param baseUrl - ベースURL
 * @returns 画像候補の配列
 */
export const detectPictureElements = (baseUrl: string): ImageCandidate[] => {
  const candidates: ImageCandidate[] = []
  const pictures = document.querySelectorAll('picture')

  for (const picture of pictures) {
    // picture内のimg要素
    const img = picture.querySelector('img')
    if (!img) continue

    const rawUrl = img.currentSrc || img.src
    if (!rawUrl) continue

    const url = normalizeUrl(rawUrl, baseUrl)
    if (!url) continue

    candidates.push({
      url,
      source: 'picture',
      width: img.naturalWidth > 0 ? img.naturalWidth : img.width > 0 ? img.width : undefined,
      height: img.naturalHeight > 0 ? img.naturalHeight : img.height > 0 ? img.height : undefined,
      alt: img.alt && img.alt.trim() !== '' ? img.alt : extractContext(picture),
    })

    // source要素も走査
    const sources = picture.querySelectorAll('source')
    for (const source of sources) {
      const srcset = source.srcset
      if (!srcset) continue

      // srcsetから最大解像度を選択
      const bestUrl = extractSrcset(srcset, baseUrl)
      if (bestUrl && bestUrl !== url) {
        candidates.push({
          url: bestUrl,
          source: 'picture',
          width: undefined,
          height: undefined,
          alt: img.alt && img.alt.trim() !== '' ? img.alt : extractContext(picture),
        })
      }
    }
  }

  return candidates
}

/**
 * srcset属性を解析して最大解像度のURLを抽出します
 *
 * アルゴリズム:
 * 1. カンマ区切りで分割
 * 2. 各エントリを空白で分割 → [URL, descriptor]
 * 3. descriptor分類: "Xw" (幅) / "Xx" (密度) / なし (1x)
 * 4. 優先度ルール:
 *    - 幅ディスクリプタ優先
 *    - 同一形式内で最大値選択
 *
 * @param srcset - srcset属性値
 * @param baseUrl - ベースURL
 * @returns 最大解像度のURL、または空文字列
 *
 * @example
 * extractSrcset('image-320w.jpg 320w, image-640w.jpg 640w, image-1280w.jpg 1280w', baseUrl)
 * // => 'https://example.com/image-1280w.jpg'
 *
 * extractSrcset('image.jpg 1x, image@2x.jpg 2x, image@3x.jpg 3x', baseUrl)
 * // => 'https://example.com/image@3x.jpg'
 */
export const extractSrcset = (srcset: string, baseUrl: string): string => {
  if (!srcset.trim()) return ''

  const candidates: SrcsetCandidate[] = []

  // カンマ区切りで分割
  const entries = srcset.split(',').map((e) => e.trim())

  for (const entry of entries) {
    // 空白で分割 → [URL, descriptor?]
    const parts = entry.trim().split(/\s+/)
    if (parts.length === 0) continue

    const rawUrl = parts[0]
    const descriptor = parts[1] ?? '1x' // デフォルトは1x

    if (!rawUrl) continue

    const candidate: SrcsetCandidate = {
      url: rawUrl,
      descriptor,
    }

    // ディスクリプタ分類
    if (descriptor.endsWith('w')) {
      // 幅ディスクリプタ
      const width = Number.parseInt(descriptor.slice(0, -1), 10)
      if (!Number.isNaN(width)) {
        candidate.width = width
      }
    } else if (descriptor.endsWith('x')) {
      // 密度ディスクリプタ
      const density = Number.parseFloat(descriptor.slice(0, -1))
      if (!Number.isNaN(density)) {
        candidate.density = density
      }
    } else {
      // 数値のみの場合も密度とみなす
      const density = Number.parseFloat(descriptor)
      if (!Number.isNaN(density)) {
        candidate.density = density
      }
    }

    candidates.push(candidate)
  }

  if (candidates.length === 0) return ''

  // 優先度ルール: 幅ディスクリプタ優先
  const widthCandidates = candidates.filter((c) => c.width !== undefined)
  const densityCandidates = candidates.filter((c) => c.density !== undefined)

  let bestCandidate: SrcsetCandidate | undefined

  if (widthCandidates.length > 0) {
    // 幅ディスクリプタの最大値
    bestCandidate = widthCandidates.reduce((max, c) =>
      (c.width ?? 0) > (max.width ?? 0) ? c : max
    )
  } else if (densityCandidates.length > 0) {
    // 密度ディスクリプタの最大値
    bestCandidate = densityCandidates.reduce((max, c) =>
      (c.density ?? 0) > (max.density ?? 0) ? c : max
    )
  } else {
    // フォールバック: 最初の候補
    bestCandidate = candidates[0]
  }

  if (!bestCandidate) return ''

  return normalizeUrl(bestCandidate.url, baseUrl)
}

/**
 * CSS background-imageから画像候補を検出します
 *
 * パフォーマンス最適化:
 * - 主要セレクタのみ走査（最大500要素）
 * - セクション要素、カード要素、背景コンテナに限定
 *
 * @param baseUrl - ベースURL
 * @returns 画像候補の配列
 */
export const detectCSSBackgrounds = (baseUrl: string): ImageCandidate[] => {
  const candidates: ImageCandidate[] = []

  // 主要セレクタ（パフォーマンス最適化）
  const selectors = [
    'section',
    'article',
    'div[class*="hero"]',
    'div[class*="banner"]',
    'div[class*="card"]',
    'div[class*="item"]',
    'div[class*="background"]',
    'div[class*="cover"]',
  ]

  let elementCount = 0
  const MAX_ELEMENTS = 500

  for (const selector of selectors) {
    if (elementCount >= MAX_ELEMENTS) break

    const elements = document.querySelectorAll(selector)

    for (const el of elements) {
      if (elementCount >= MAX_ELEMENTS) break
      elementCount++

      const style = window.getComputedStyle(el)
      const bgImage = style.backgroundImage

      if (!bgImage || bgImage === 'none') continue

      // url()を正規表現で抽出（複数背景対応）
      const urlPattern = /url\(['"]?([^'"()]+)['"]?\)/g
      let match: RegExpExecArray | null

      while ((match = urlPattern.exec(bgImage)) !== null) {
        const rawUrl = match[1]
        if (!rawUrl) continue

        const url = normalizeUrl(rawUrl, baseUrl)
        if (!url) continue

        candidates.push({
          url,
          source: 'css-bg',
          // 注意: 背景画像の実寸は取得不可能なため、要素のサイズを記録
          // clientWidth/Heightは要素の表示サイズであり、画像の実寸ではない
          width: el.clientWidth > 0 ? el.clientWidth : undefined,
          height: el.clientHeight > 0 ? el.clientHeight : undefined,
          alt: extractContext(el),
        })
      }
    }
  }

  return candidates
}

/**
 * <canvas>要素から画像候補を検出します
 *
 * toDataURL()を使用してcanvasの内容を画像化します。
 * CORS汚染されたcanvasはスキップします。
 *
 * @param baseUrl - ベースURL（未使用、シグネチャ統一のため）
 * @returns 画像候補の配列
 */
export const detectCanvasElements = (_baseUrl: string): ImageCandidate[] => {
  const candidates: ImageCandidate[] = []
  const canvases = document.querySelectorAll('canvas')

  for (const canvas of canvases) {
    try {
      // canvas内容の有効性チェック
      const ctx = canvas.getContext('2d')
      if (!ctx) continue

      // 空canvas（未描画）のチェック
      // 1x1ピクセルをサンプリングして全ピクセルが透明または白/黒ならスキップ
      if (canvas.width > 0 && canvas.height > 0) {
        const imageData = ctx.getImageData(0, 0, 1, 1)
        const isEmpty = imageData.data.every((value, index) =>
          index % 4 === 3 ? value === 0 : value === 0 || value === 255
        )
        if (isEmpty) continue
      }

      // toDataURL()でcanvasの内容をdata URLに変換
      // CORS汚染がある場合はエラーが発生
      const dataUrl = canvas.toDataURL('image/png')

      if (!dataUrl?.startsWith('data:')) continue

      candidates.push({
        url: dataUrl,
        source: 'canvas',
        width: canvas.width || undefined,
        height: canvas.height || undefined,
        alt: extractContext(canvas),
      })
    } catch (error) {
      // CORS汚染やその他のエラーはスキップ
      if (import.meta.env.DEV) {
        console.debug('[detectCanvasElements] Failed to extract canvas:', error)
      }
    }
  }

  return candidates
}

/**
 * ページ内の全画像を検出します（メイン検出関数）
 *
 * 5種類の画像ソースを統合的に検出し、重複を除外します。
 *
 * @returns 検出された画像候補の配列（重複除外済み）
 */
export const detectImages = (): ImageCandidate[] => {
  const baseUrl = window.location.href

  // 各検出関数を実行
  const imgCandidates = detectImgElements(baseUrl)
  const pictureCandidates = detectPictureElements(baseUrl)
  const cssCandidates = detectCSSBackgrounds(baseUrl)
  const canvasCandidates = detectCanvasElements(baseUrl)

  // srcset検出（img要素のsrcset属性）
  const srcsetCandidates: ImageCandidate[] = []
  const images = document.querySelectorAll('img[srcset]')

  for (const img of images) {
    const srcset = img.getAttribute('srcset')
    if (!srcset) continue

    const url = extractSrcset(srcset, baseUrl)
    if (!url) continue

    const imgElement = img as HTMLImageElement
    srcsetCandidates.push({
      url,
      source: 'srcset',
      width:
        imgElement.naturalWidth > 0
          ? imgElement.naturalWidth
          : imgElement.width > 0
            ? imgElement.width
            : undefined,
      height:
        imgElement.naturalHeight > 0
          ? imgElement.naturalHeight
          : imgElement.height > 0
            ? imgElement.height
            : undefined,
      alt: imgElement.alt && imgElement.alt.trim() !== '' ? imgElement.alt : extractContext(img),
    })
  }

  // 全候補を統合
  const allCandidates = [
    ...imgCandidates,
    ...pictureCandidates,
    ...srcsetCandidates,
    ...cssCandidates,
    ...canvasCandidates,
  ]

  // 重複除外（URLをキーとしたMap使用）
  const uniqueMap = new Map<string, ImageCandidate>()

  for (const candidate of allCandidates) {
    const key = candidate.url

    if (!uniqueMap.has(key)) {
      uniqueMap.set(key, candidate)
    } else {
      // 既存の候補とマージ（より詳細な情報を優先）
      const existing = uniqueMap.get(key)
      if (!existing) continue // 念のためガード追加（型安全性）

      // width/heightが未設定なら更新
      if (!existing.width && candidate.width) {
        existing.width = candidate.width
      }
      if (!existing.height && candidate.height) {
        existing.height = candidate.height
      }

      // altが未設定なら更新
      if (!existing.alt && candidate.alt) {
        existing.alt = candidate.alt
      }
    }
  }

  return Array.from(uniqueMap.values())
}
