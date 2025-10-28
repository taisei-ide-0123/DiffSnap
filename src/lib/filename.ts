/**
 * ファイル名生成ユーティリティ
 *
 * テンプレートベースのファイル名生成、サニタイズ、衝突回避を提供
 *
 * @module lib/filename
 */

import type { ImageSnapshot } from '../shared/types'

/**
 * プリセットテンプレート定義
 */
export const PRESET_TEMPLATES = {
  default: '{date}-{domain}-{w}x{h}-{index}',
  simple: '{domain}-{index}',
  detailed: '{date}-{time}-{domain}-{path}-{w}x{h}-{index}',
  dimension: '{w}x{h}-{domain}-{index}',
  alt: '{alt}-{w}x{h}-{index}',
} as const

export type PresetTemplateName = keyof typeof PRESET_TEMPLATES

/**
 * テンプレート変数のコンテキスト
 */
export interface FilenameContext {
  date: string
  time: string
  domain: string
  path: string
  w: number
  h: number
  alt: string
  index: string
}

/**
 * ファイル名サニタイズ（変数値用）
 *
 * 禁止文字を"-"に置換し、50文字以内に切り詰める
 *
 * @param text - サニタイズ対象のテキスト
 * @param maxLength - 最大文字数（デフォルト: 50）
 * @returns サニタイズ済みテキスト
 */
export const sanitize = (text: string, maxLength = 50): string => {
  // 禁止文字と制御文字を"-"に置換
  // eslint-disable-next-line no-control-regex
  let sanitized = text.replace(/[<>:"/\\|?*\x00-\x1F]/g, '-')

  // 連続する空白またはハイフンを単一ハイフンに
  sanitized = sanitized.replace(/[\s-]+/g, '-')

  // 先頭・末尾のハイフン削除
  sanitized = sanitized.replace(/^-+|-+$/g, '')

  // 最大長に切り詰め
  if (maxLength > 0 && sanitized.length > maxLength) {
    sanitized = sanitized.slice(0, maxLength)
  }

  // 空文字の場合はデフォルト名
  if (!sanitized) {
    sanitized = 'image'
  }

  return sanitized
}

/**
 * URLから拡張子を推測
 *
 * @param url - 画像URL
 * @returns 拡張子（ドット含まない、例: "jpg", "png"）
 */
export const guessExtension = (url: string): string => {
  // data URLの場合
  if (url.startsWith('data:')) {
    const match = url.match(/^data:image\/([a-z]+);/)
    if (match?.[1]) {
      const mime = match[1]
      // MIME to extension mapping
      const mimeMap: Record<string, string> = {
        jpeg: 'jpg',
        png: 'png',
        gif: 'gif',
        webp: 'webp',
        svg: 'svg',
        bmp: 'bmp',
      }
      return mimeMap[mime] ?? 'jpg'
    }
    return 'jpg'
  }

  // 通常URLの場合
  try {
    const urlObj = new URL(url)
    const pathname = urlObj.pathname
    const match = pathname.match(/\.([a-z0-9]+)$/i)
    if (match?.[1]) {
      const ext = match[1].toLowerCase()
      // 画像拡張子かチェック
      const validExts = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp', 'ico']
      if (validExts.includes(ext)) {
        return ext === 'jpeg' ? 'jpg' : ext
      }
    }
  } catch {
    // URLパース失敗時
  }

  // デフォルト
  return 'jpg'
}

/**
 * 衝突回避
 *
 * 既存のファイル名セットと照合し、重複しない名前を生成
 *
 * @param name - 元のファイル名（拡張子含む）
 * @param existing - 既存のファイル名セット
 * @returns 衝突しないファイル名
 */
export const deconflict = (name: string, existing: Set<string>): string => {
  if (!existing.has(name)) {
    return name
  }

  // 拡張子とベース名に分割
  const lastDotIndex = name.lastIndexOf('.')
  let base: string
  let ext: string

  if (lastDotIndex > 0) {
    base = name.slice(0, lastDotIndex)
    ext = name.slice(lastDotIndex)
  } else {
    base = name
    ext = ''
  }

  // カウンターを増やしながら衝突しない名前を探す
  let counter = 1
  let candidate = `${base}-${counter}${ext}`

  while (existing.has(candidate)) {
    counter++
    candidate = `${base}-${counter}${ext}`
  }

  return candidate
}

/**
 * テンプレート文字列を評価してファイル名を生成
 *
 * @param template - テンプレート文字列（例: "{date}-{domain}-{index}"）
 * @param image - 画像スナップショット
 * @param index - 連番（1始まり）
 * @param pageUrl - ページURL（domainとpath抽出用）
 * @returns 生成されたファイル名（拡張子含む）
 */
export const makeFilename = (
  template: string,
  image: ImageSnapshot,
  index: number,
  pageUrl: string
): string => {
  const now = new Date()

  // URLからdomain, path抽出
  let domain = 'unknown'
  let path = ''
  try {
    const url = new URL(pageUrl)
    domain = url.hostname
    path = url.pathname.split('/').filter(Boolean).join('-')
  } catch {
    // URLパース失敗時
  }

  // テンプレート変数の値を準備
  const context: FilenameContext = {
    date: now.toISOString().split('T')[0] ?? '', // YYYY-MM-DD
    time: now.toTimeString().split(' ')[0]?.replace(/:/g, '-') ?? '', // HH-MM-SS
    domain,
    path: path || 'root',
    w: image.width,
    h: image.height,
    alt: image.alt ? sanitize(image.alt) : 'noalt',
    index: String(index).padStart(3, '0'), // 001, 002, ...
  }

  // テンプレート変数を置換
  let filename = template
  for (const [key, value] of Object.entries(context)) {
    const placeholder = `{${key}}`
    filename = filename.replace(
      new RegExp(placeholder.replace(/[{}]/g, '\\$&'), 'g'),
      String(value)
    )
  }

  // 最終的なファイル名全体をサニタイズ（長さ制限なし）
  filename = sanitize(filename, 0)

  // 拡張子を付与
  const ext = guessExtension(image.url)

  return `${filename}.${ext}`
}

/**
 * プリセットテンプレート名から実際のテンプレート文字列を取得
 *
 * @param presetName - プリセット名
 * @returns テンプレート文字列
 */
export const getPresetTemplate = (presetName: PresetTemplateName): string => {
  return PRESET_TEMPLATES[presetName]
}
