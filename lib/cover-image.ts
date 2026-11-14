/**
 * Blog cover images are Dev.to uploads: full-size PNGs of up to ~1 MB each. Served through
 * `next/image` they come back resized and re-encoded for the screen, which is what keeps the
 * blog list usable on a phone on a slow connection. Only the hosts listed in `next.config.js`
 * (`images.remotePatterns`) can go through the optimizer; anything else is shown as is.
 */
const OPTIMIZED_HOSTS = ['dev-to-uploads.s3.amazonaws.com', 'media.dev.to', 'media2.dev.to'];

export function canOptimizeCover(src: string) {
  try {
    const url = new URL(src);
    return url.protocol === 'https:' && OPTIMIZED_HOSTS.includes(url.hostname);
  } catch {
    return false;
  }
}
