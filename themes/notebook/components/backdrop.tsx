import { useEffect, useRef, useState } from 'react';
import { pixelTransitionSettled } from 'lib/pixel-transition';
import { NOTEBOOK_CONTENT } from '../content';
import styles from '../notebook.module.css';

/** A toy embedding space over the top of the page. Decorative only. */
export function Backdrop() {
  const hostRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const host = hostRef.current;
    const canvas = canvasRef.current;
    if (!host || !canvas) return;

    let cancelled = false;
    let destroy: (() => void) | undefined;
    Promise.all([import('../lib/embeddings-scene'), pixelTransitionSettled()])
      .then(([{ mountEmbeddings }]) => {
        if (cancelled) return;
        destroy = mountEmbeddings(canvas, {
          tokenSource: host,
          labelHost: host,
          classes: {
            label: styles.backdropLabel,
            small: styles.backdropSmall,
            block: styles.backdropBlock,
            head: styles.backdropHead,
            row: styles.backdropRow,
            box: styles.backdropBox
          },
          passage: NOTEBOOK_CONTENT.passage,
          onReady: () => !cancelled && setReady(true)
        });
      })
      .catch(() => {});

    return () => {
      cancelled = true;
      destroy?.();
    };
  }, []);

  return (
    <div
      ref={hostRef}
      className={styles.backdrop}
      aria-hidden
      data-ready={ready ? '' : undefined}
    >
      <canvas ref={canvasRef} />
    </div>
  );
}
