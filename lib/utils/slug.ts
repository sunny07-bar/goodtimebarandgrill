/**
 * Fully decodes a URI component that may have been encoded multiple times
 * e.g. "docking%2520" -> "docking%20" -> "docking "
 */
export function fullyDecodeSlug(slug: string): string {
  if (!slug) return ''
  let decoded = slug
  try {
    while (decoded && decoded.includes('%')) {
      const next = decodeURIComponent(decoded)
      if (next === decoded) break
      decoded = next
    }
  } catch {
    // Return current progress if malformed URI
  }
  return decoded
}

/**
 * Safely encodes a slug ensuring it is first normalized/decoded so it is never double encoded.
 * e.g. "docking%2520" -> "docking%20"
 * e.g. "docking " -> "docking%20"
 * e.g. "docking" -> "docking"
 */
export function safeEncodeSlug(slug: string): string {
  if (!slug) return ''
  const decoded = fullyDecodeSlug(slug)
  return encodeURIComponent(decoded)
}

