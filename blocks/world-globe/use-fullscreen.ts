'use client';

import * as React from 'react';

/**
 * Expand an element to the whole screen. Uses the Fullscreen API where the browser allows it on an
 * element; elsewhere (iPhone Safari) it falls back to a fixed overlay over the page, with the page's
 * scroll locked. Either way Escape leaves, and focus goes back to where it was.
 */
export function useFullscreen<T extends HTMLElement>(ref: React.RefObject<T | null>) {
  const [mode, setMode] = React.useState<'off' | 'native' | 'overlay'>('off');
  const returnTo = React.useRef<HTMLElement | null>(null);

  React.useEffect(() => {
    const changed = () => {
      if (!document.fullscreenElement && mode === 'native') setMode('off');
    };
    document.addEventListener('fullscreenchange', changed);
    return () => document.removeEventListener('fullscreenchange', changed);
  }, [mode]);

  React.useEffect(() => {
    if (mode !== 'overlay') return;
    const { overflow } = document.body.style;
    document.body.style.overflow = 'hidden';
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMode('off');
    };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = overflow;
      window.removeEventListener('keydown', onKey);
    };
  }, [mode]);

  React.useEffect(() => {
    if (mode === 'off') {
      returnTo.current?.focus?.({ preventScroll: true });
      returnTo.current = null;
    } else ref.current?.focus({ preventScroll: true });
  }, [mode, ref]);

  const enter = React.useCallback(async () => {
    const node = ref.current;
    if (!node) return;
    returnTo.current = document.activeElement as HTMLElement | null;
    if (node.requestFullscreen && document.fullscreenEnabled) {
      try {
        await node.requestFullscreen({ navigationUI: 'hide' });
        setMode('native');
        return;
      } catch {
        // Refused (an iframe without permission, say): use the overlay instead.
      }
    }
    setMode('overlay');
  }, [ref]);

  const exit = React.useCallback(async () => {
    if (document.fullscreenElement) await document.exitFullscreen().catch(() => undefined);
    setMode('off');
  }, []);

  const toggle = React.useCallback(() => (mode === 'off' ? enter() : exit()), [mode, enter, exit]);

  return { expanded: mode !== 'off', mode, enter, exit, toggle };
}
