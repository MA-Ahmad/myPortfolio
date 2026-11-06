import { type MutableRefObject, type RefObject, useId } from 'react';

export type Vec = [number, number];
type Leg = { hip: Vec; knee: Vec; foot: Vec; side: number };

// Left legs, head pointing up (-y). Right legs are mirrored.
const LEFT_LEGS = [
  { hip: [-2.2, -5.4], knee: [-7.5, -11], foot: [-9.5, -18] },
  { hip: [-2.9, -4.2], knee: [-10, -7.5], foot: [-15, -7] },
  { hip: [-2.9, -2.8], knee: [-10, -0.5], foot: [-14.5, 5.5] },
  { hip: [-2.3, -1.6], knee: [-7.5, 4.5], foot: [-10, 13] }
] as Array<Omit<Leg, 'side'>>;

export const LEGS: Leg[] = [
  ...LEFT_LEGS.map((leg) => ({ ...leg, side: -1 })),
  ...LEFT_LEGS.map(({ hip, knee, foot }) => ({
    hip: [-hip[0], hip[1]] as Vec,
    knee: [-knee[0], knee[1]] as Vec,
    foot: [-foot[0], foot[1]] as Vec,
    side: 1
  }))
];

const legPath = ({ hip, knee, foot }: Leg) =>
  `M${hip[0]} ${hip[1]}L${knee[0]} ${knee[1]}L${foot[0]} ${foot[1]}`;

/**
 * Poses the legs: an alternating tetrapod gait (L1 R2 L3 R4 swing together, the rest
 * opposite), `amp` degrees of swing, and `tuck` (0–1) drawing them in while hanging.
 */
export function poseLegs(legs: (SVGPathElement | null)[], gait: number, amp: number, tuck: number) {
  LEGS.forEach((leg, i) => {
    const el = legs[i];
    if (!el) return;
    const group = (i % 4) + (leg.side > 0 ? 1 : 0);
    const swing = Math.sin(gait + (group % 2) * Math.PI) * amp;
    const [hx, hy] = leg.hip;
    el.setAttribute(
      'transform',
      `translate(${hx} ${hy}) rotate(${swing.toFixed(2)}) scale(${(1 - tuck * 0.32).toFixed(3)}) translate(${-hx} ${-hy})`
    );
  });
}

/** The spider itself, drawn head-up around (0, 0). Colours come from the --spider-* tokens. */
export function SpiderArt({
  bodyRef,
  legRefs,
  hitRef,
  onActivate
}: {
  bodyRef: RefObject<SVGGElement | null>;
  legRefs: MutableRefObject<(SVGPathElement | null)[]>;
  hitRef: RefObject<SVGCircleElement | null>;
  onActivate: () => void;
}) {
  const sheen = `spider-sheen-${useId().replace(/:/g, '')}`;

  return (
    <g ref={bodyRef} transform="translate(-100 -100)">
      <defs>
        <radialGradient id={sheen} cx="35%" cy="30%" r="70%">
          <stop offset="0" stopColor="#fff" stopOpacity="0.22" />
          <stop offset="0.5" stopColor="#fff" stopOpacity="0.04" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </radialGradient>
      </defs>

      <g
        fill="none"
        stroke="var(--spider-leg)"
        strokeWidth={1.15}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {LEGS.map((leg, i) => (
          <path
            key={i}
            ref={(el) => {
              legRefs.current[i] = el;
            }}
            d={legPath(leg)}
          />
        ))}
        {/* pedipalps */}
        <path d="M-1.2 -7.4L-2 -9.6M1.2 -7.4L2 -9.6" strokeWidth={0.9} />
      </g>

      <g stroke="var(--spider-rim)" strokeWidth={0.6}>
        <ellipse cx={0} cy={5.6} rx={5.2} ry={6.6} fill="var(--spider-body)" />
        <ellipse cx={0} cy={5.6} rx={5.2} ry={6.6} fill={`url(#${sheen})`} stroke="none" />
        <ellipse cx={0} cy={-3.6} rx={3.3} ry={3.9} fill="var(--spider-body)" />
        <ellipse cx={0} cy={-3.6} rx={3.3} ry={3.9} fill={`url(#${sheen})`} stroke="none" />
      </g>

      {/* a hairline chevron, echoing the site's stroke details */}
      <path
        d="M-2.4 3.2L0 5L2.4 3.2M-2 6.4L0 8L2 6.4"
        fill="none"
        stroke="#fff"
        strokeOpacity={0.18}
        strokeWidth={0.5}
        strokeLinecap="round"
      />
      <circle cx={-0.9} cy={-6} r={0.45} fill="#fff" fillOpacity={0.6} />
      <circle cx={0.9} cy={-6} r={0.45} fill="#fff" fillOpacity={0.6} />

      {/* Generous, invisible hit area: clicking the spider hands it over to the keyboard. */}
      <circle
        ref={hitRef}
        r={20}
        fill="transparent"
        className="cursor-pointer"
        style={{ pointerEvents: 'none' }}
        onClick={onActivate}
      >
        <title>Take control of the spider</title>
      </circle>
    </g>
  );
}
