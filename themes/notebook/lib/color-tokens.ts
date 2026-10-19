export type Rgb = [number, number, number];

export type Tokens = { bg: Rgb; ink: Rgb; faint: Rgb; rule: Rgb };

let probe: CanvasRenderingContext2D | null = null;

/** Resolves any CSS color (including oklch) to sRGB in 0..1 by painting one pixel. */
function toRgb(color: string): Rgb {
  probe ??= document.createElement('canvas').getContext('2d', { willReadFrequently: true });
  if (!probe) return [0, 0, 0];
  probe.clearRect(0, 0, 1, 1);
  probe.fillStyle = color;
  probe.fillRect(0, 0, 1, 1);
  const { data } = probe.getImageData(0, 0, 1, 1);
  return [data[0] / 255, data[1] / 255, data[2] / 255];
}

export function readTokens(element: Element): Tokens {
  const style = getComputedStyle(element);
  const read = (name: string) => toRgb(style.getPropertyValue(name).trim());
  return {
    bg: read('--nb-bg'),
    ink: read('--nb-ink'),
    faint: read('--nb-faint'),
    rule: read('--nb-rule')
  };
}

/** Calls back when the main site's light/dark class on <html> changes. */
export function onSchemeChange(callback: () => void): () => void {
  const observer = new MutationObserver(callback);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
  return () => observer.disconnect();
}

export function prefersReducedMotion() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}
