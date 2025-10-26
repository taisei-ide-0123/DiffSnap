/**
 * Image utility functions for formatting and display
 */

/**
 * Format image dimensions as "width × height" string
 * @param width - Image width in pixels
 * @param height - Image height in pixels
 * @returns Formatted string like "800 × 600" or undefined if dimensions are missing
 */
export const formatImageSize = (width?: number, height?: number): string | undefined => {
  if (width && height) {
    return `${width} × ${height}`
  }
  return undefined
}
