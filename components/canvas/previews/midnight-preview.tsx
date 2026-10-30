import { GeistMono } from 'geist/font/mono';
import { GeistPixelSquare } from 'geist/font/pixel';
import { PROFILE } from 'data/profile';
import { cn } from 'lib/cn';

const TOP = [
  { id: 'canvas', left: 150, on: false },
  { id: 'concept', left: 244, on: true }
];
const BOTTOM = [24, 98, 172, 244];
const LEVELS = ['#1a1a1d', '#38383c', '#58585d', '#85858b'];

/** The midnight home page in miniature: pixel name, the little pipeline, a strip of commits and the dock. */
export function MidnightPreview() {
  return (
    <div
      className={cn(GeistMono.className, 'relative size-full overflow-hidden text-[10px]')}
      style={{ background: '#0b0b0d', color: '#9a9aa0' }}
    >
      <div className="px-3 pt-3">
        <p style={{ color: '#5c5c62' }}>Hey It&apos;s me</p>
        <p
          className="text-[15px] leading-tight"
          style={{ color: '#f3f3f4', fontFamily: GeistPixelSquare.style.fontFamily }}
        >
          {PROFILE.displayName.toUpperCase()}
        </p>
      </div>

      <div className="absolute inset-x-0 top-[56px] h-[70px]">
        <div className="absolute left-[170px] right-[48px] top-[9px] border-t border-dotted" style={{ borderColor: '#2a2a2f' }} />
        <div className="absolute left-[34px] right-[48px] top-[59px] border-t border-dotted" style={{ borderColor: '#2a2a2f' }} />
        {TOP.map((node) => (
          <Tile key={node.id} left={node.left} top={0} on={node.on} />
        ))}
        {BOTTOM.map((left) => (
          <Tile key={left} left={left} top={50} />
        ))}
      </div>

      <div className="absolute inset-x-3 top-[136px] grid grid-flow-col grid-rows-3 gap-[2px]">
        {Array.from({ length: 78 }, (_, i) => (
          <span
            key={i}
            className="aspect-square rounded-[1px]"
            style={{ background: LEVELS[(i * 7 + (i % 5)) % 4] }}
          />
        ))}
      </div>

      <div
        className="absolute bottom-2 left-1/2 flex -translate-x-1/2 gap-3 rounded-full border px-3 py-1"
        style={{ borderColor: '#25252a', background: '#141417', color: '#5c5c62' }}
      >
        <span style={{ color: '#f3f3f4' }}>Home</span>
        <span>Work</span>
        <span>Skills</span>
        <span>Blog</span>
      </div>
    </div>
  );
}

function Tile({ left, top, on }: { left: number; top: number; on?: boolean }) {
  return (
    <span
      className="absolute size-[18px] rounded-[5px] border"
      style={{ left, top, borderColor: '#2a2a2f', background: '#131316' }}
    >
      <span
        className="absolute right-[3px] top-[3px] size-[3px] rounded-full"
        style={{ background: on ? '#f5a524' : '#2b2b30' }}
      />
    </span>
  );
}
