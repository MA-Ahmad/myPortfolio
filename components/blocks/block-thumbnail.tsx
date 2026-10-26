import { useEffect, useRef, useState } from 'react';
import { type BlockMeta } from 'blocks/registry';
import { BLOCK_COMPONENTS } from 'blocks/components';
import { cn } from 'lib/cn';

// The block is laid out on a desktop-sized canvas, then scaled down to the card's width.
const CANVAS = { width: 1280, height: 800 };

const STILL = 'absolute inset-0 size-full object-cover transition-transform duration-500 ease-out group-hover/block:scale-[1.03] motion-reduce:transition-none motion-reduce:group-hover/block:scale-100';

/**
 * A block's card image: its still from `block.images`, one per color mode when it has two, or a
 * live, non-interactive render of the block when it has none.
 */
export function BlockThumbnail({ block, className }: { block: BlockMeta; className?: string }) {
  const card = block.images?.card;

  if (card) {
    return (
      <div className={cn('relative aspect-[16/10] overflow-hidden bg-background', className)} aria-hidden>
        {typeof card === 'string' ? (
          <img src={card} alt="" width={CANVAS.width} height={CANVAS.height} loading="lazy" decoding="async" className={STILL} />
        ) : (
          // The hidden one is display: none, so a lazy image in the other color mode is never fetched.
          <>
            <img src={card.light} alt="" width={CANVAS.width} height={CANVAS.height} loading="lazy" decoding="async" className={cn(STILL, 'dark:hidden')} />
            <img src={card.dark} alt="" width={CANVAS.width} height={CANVAS.height} loading="lazy" decoding="async" className={cn(STILL, 'hidden dark:block')} />
          </>
        )}
      </div>
    );
  }

  return <LiveThumbnail name={block.name} className={className} />;
}

/** The block itself, scaled down, for a block without a still. */
function LiveThumbnail({ name, className }: { name: string; className?: string }) {
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
