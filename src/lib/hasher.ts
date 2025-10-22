/**
 * SHA-256 Hash Utilities
 *
 * Web Crypto APIを使用した高速ハッシュ計算
 * @module lib/hasher
 */

/**
 * BufferSourceまたは文字列のSHA-256ハッシュを計算
 *
 * @param data - ハッシュ化するデータ（BufferSource: Blob, ArrayBuffer, TypedArray または string）
 * @returns 64文字の16進数文字列のハッシュ
 *
 * @example
 * ```ts
 * // 文字列入力
 * const hash1 = await sha256("hello world")
 *
 * // ArrayBuffer入力
 * const buffer = new TextEncoder().encode("hello world").buffer
 * const hash2 = await sha256(buffer)
 *
 * // TypedArray入力
 * const uint8 = new Uint8Array([1, 2, 3])
 * const hash3 = await sha256(uint8)
 * ```
 */
export const sha256 = async (data: BufferSource | string): Promise<string> => {
  let buffer: ArrayBuffer

  if (typeof data === 'string') {
    // 文字列の場合はUTF-8エンコード
    buffer = new TextEncoder().encode(data).buffer
  } else if (data instanceof ArrayBuffer) {
    buffer = data
  } else if (ArrayBuffer.isView(data)) {
    // TypedArray (Uint8Array, etc.) の場合
    buffer = data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength)
  } else {
    // その他のBufferSource
    buffer = data as ArrayBuffer
  }

  // Web Crypto APIでSHA-256計算
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer)

  // ArrayBufferを16進数文字列に変換
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  const hashHex = hashArray.map((byte) => byte.toString(16).padStart(2, '0')).join('')

  return hashHex
}

/**
 * BlobオブジェクトのSHA-256ハッシュを計算
 *
 * @param blob - ハッシュ化するBlob（画像データなど）
 * @returns 64文字の16進数文字列のハッシュ
 *
 * @example
 * ```ts
 * // 画像Blobのハッシュ化
 * const response = await fetch(imageUrl)
 * const blob = await response.blob()
 * const hash = await hashBlob(blob)
 * ```
 */
export const hashBlob = async (blob: Blob): Promise<string> => {
  // BlobをArrayBufferに変換
  // blob.arrayBuffer()を使用（モダンブラウザ対応）
  // テスト環境（jsdom）ではFileReaderを使用
  let buffer: ArrayBuffer

  if (typeof blob.arrayBuffer === 'function') {
    // モダンブラウザ（Chrome拡張環境）
    buffer = await blob.arrayBuffer()
  } else {
    // フォールバック（テスト環境など）
    buffer = await new Promise<ArrayBuffer>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result as ArrayBuffer)
      reader.onerror = () => reject(reader.error)
      reader.readAsArrayBuffer(blob)
    })
  }

  // sha256関数を呼び出し
  return sha256(buffer)
}
