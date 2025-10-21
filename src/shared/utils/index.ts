// Shared utility functions for DiffSnap

/**
 * Normalize URL for comparison
 */
export function normalizeUrl(url: string): string {
  try {
    const parsed = new URL(url);
    // Remove hash and sort query parameters
    parsed.hash = '';
    const params = new URLSearchParams(parsed.search);
    const sortedParams = new URLSearchParams(
      Array.from(params.entries()).sort(([a], [b]) => a.localeCompare(b))
    );
    parsed.search = sortedParams.toString();
    return parsed.toString();
  } catch {
    return url;
  }
}

/**
 * Generate SHA-256 hash from ArrayBuffer
 */
export async function generateHash(data: ArrayBuffer): Promise<string> {
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}
