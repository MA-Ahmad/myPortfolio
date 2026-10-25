import { useEffect, useRef, useState } from 'react';
import { BLOCK_COMPONENTS } from 'blocks/components';
import { cn } from 'lib/cn';

// The block is laid out on a desktop-sized canvas, then scaled down to the card's width.
const CANVAS = { width: 1280, height: 800 };

/** A live, non-interactive render of a block, used as its card image. */
export function BlockThumbnail({ name, className }: { name: string; className?: string }) {
  const frameRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState<number | null>(null);
  const Block = BLOCK_COMPONENTS[name];

  useEffect(() => {
    const frame = frameRef.current;
    if (!frame) return;
    const observer = new ResizeObserver(([entry]) => setScale(entry.contentRect.width / CANVAS.width));
    observer.observe(frame);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={frameRef}
      className={cn('relative aspect-[16/10] overflow-hidden bg-background', className)}
      aria-hidden
    >
      {Block && scale !== null ? (
        // The transform also makes this the containing block for any fixed elements in the block.
        <div
          inert
          className="pointer-events-none origin-top-left select-none"
          style={{ width: CANVAS.width, height: CANVAS.height, transform: `scale(${scale})` }}
        >
          <Block />
        </div>
      ) : (
        <div className="diagonal-stripes absolute inset-0" />
      )}
    </div>
  );
}
