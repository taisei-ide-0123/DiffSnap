// Shared type definitions for DiffSnap

export interface ImageCandidate {
  url: string
  source: ImageSource
  width?: number
  height?: number
  alt?: string
}

export type ImageSource =
  | 'img'
  | 'picture'
  | 'srcset'
  | 'css-bg'
  | 'canvas'
  | 'svg'
  | 'video'
  | 'iframe'

export interface DetectionResult {
  candidates: ImageCandidate[]
  timestamp: number
  url: string
}
