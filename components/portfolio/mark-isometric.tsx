import { useEffect, useId, useRef } from 'react';
import {
  motion,
  useInView,
  useMotionValue,
  useReducedMotion,
  useSpring,
  useTransform,
  type Transition
} from 'framer-motion';
import { playMetalClick } from 'lib/click-sound';

const transition: Transition = {
  type: 'spring',
  mass: 0.5,
  damping: 18,
  stiffness: 200
};

/**
 * From isometric_m_stencil_a_sleek.html, baked at the attached view:
 * tilt 8°, depth 35.
 */
const VIEW_W = 680;
const VIEW_H = 398;
const SHIFT_X = 36;
const SHIFT_Y = 28;

const FACE_FILLS = [
  'M53.5 246.0L53.5 36.0L113.5 44.4L226.0 177.2L338.5 76.1L398.5 84.5L398.5 294.5L338.5 286.1L338.5 154.1L226.0 255.2L113.5 122.4L113.5 254.4Z',
  'M431.5 299.1L505.6 99.5L552.4 106.1L478.3 305.7Z',
  'M568.0 108.3L626.5 326.5L579.7 320.0L540.7 191.5Z',
  'M509.5 256.1L552.4 262.1L560.2 287.2L501.7 279.0Z'
];

const SIDES: Array<[string, string]> = [
  [
    'M398.5 294.5L338.5 286.1L338.5 321.1L398.5 329.5Z',
    'M398.5 310.5L338.5 302.1L338.5 321.1L398.5 329.5Z'
  ],
  [
    'M338.5 154.1L226.0 255.2L226.0 290.2L338.5 189.1Z',
    'M338.5 170.1L226.0 271.2L226.0 290.2L338.5 189.1Z'
  ],
  [
    'M226.0 255.2L113.5 122.4L113.5 157.4L226.0 290.2Z',
    'M226.0 271.2L113.5 138.4L113.5 157.4L226.0 290.2Z'
  ],
  [
    'M113.5 254.4L53.5 246.0L53.5 281.0L113.5 289.4Z',
    'M113.5 270.4L53.5 262.0L53.5 281.0L113.5 289.4Z'
  ],
  [
    'M552.4 106.1L478.3 305.7L478.3 340.7L552.4 141.1Z',
    'M552.4 122.1L478.3 321.7L478.3 340.7L552.4 141.1Z'
  ],
  [
    'M478.3 305.7L431.5 299.1L431.5 334.1L478.3 340.7Z',
    'M478.3 321.7L431.5 315.1L431.5 334.1L478.3 340.7Z'
  ],
  [
    'M626.5 326.5L579.7 320.0L579.7 355.0L626.5 361.5Z',
    'M626.5 342.5L579.7 336.0L579.7 355.0L626.5 361.5Z'
  ],
  [
    'M579.7 320.0L540.7 191.5L540.7 226.5L579.7 355.0Z',
    'M579.7 336.0L540.7 207.5L540.7 226.5L579.7 355.0Z'
  ],
  [
    'M560.2 287.2L501.7 279.0L501.7 314.0L560.2 322.2Z',
    'M560.2 303.2L501.7 295.0L501.7 314.0L560.2 322.2Z'
  ]
];

const STROKE_NORMAL =
  'M53.5 246.0L53.5 36.0L113.5 44.4L226.0 177.2L338.5 76.1L398.5 84.5L398.5 294.5L338.5 286.1L338.5 154.1L226.0 255.2L113.5 122.4L113.5 254.4ZM398.5 294.5L338.5 286.1L338.5 321.1L398.5 329.5ZM338.5 154.1L226.0 255.2L226.0 290.2L338.5 189.1ZM226.0 255.2L113.5 122.4L113.5 157.4L226.0 290.2ZM113.5 254.4L53.5 246.0L53.5 281.0L113.5 289.4ZM431.5 299.1L505.6 99.5L552.4 106.1L478.3 305.7ZM552.4 106.1L478.3 305.7L478.3 340.7L552.4 141.1ZM478.3 305.7L431.5 299.1L431.5 334.1L478.3 340.7ZM568.0 108.3L626.5 326.5L579.7 320.0L540.7 191.5ZM626.5 326.5L579.7 320.0L579.7 355.0L626.5 361.5ZM579.7 320.0L540.7 191.5L540.7 226.5L579.7 355.0ZM509.5 256.1L552.4 262.1L560.2 287.2L501.7 279.0ZM560.2 287.2L501.7 279.0L501.7 314.0L560.2 322.2Z';

const STROKE_PRESSED =
  'M53.5 262.0L53.5 52.0L113.5 60.4L226.0 193.2L338.5 92.1L398.5 100.5L398.5 310.5L338.5 302.1L338.5 170.1L226.0 271.2L113.5 138.4L113.5 270.4ZM398.5 310.5L338.5 302.1L338.5 321.1L398.5 329.5ZM338.5 170.1L226.0 271.2L226.0 290.2L338.5 189.1ZM226.0 271.2L113.5 138.4L113.5 157.4L226.0 290.2ZM113.5 270.4L53.5 262.0L53.5 281.0L113.5 289.4ZM431.5 315.1L505.6 115.5L552.4 122.1L478.3 321.7ZM552.4 122.1L478.3 321.7L478.3 340.7L552.4 141.1ZM478.3 321.7L431.5 315.1L431.5 334.1L478.3 340.7ZM568.0 124.3L626.5 342.5L579.7 336.0L540.7 207.5ZM626.5 342.5L579.7 336.0L579.7 355.0L626.5 361.5ZM579.7 336.0L540.7 207.5L540.7 226.5L579.7 355.0ZM509.5 272.1L552.4 278.1L560.2 303.2L501.7 295.0ZM560.2 303.2L501.7 295.0L501.7 314.0L560.2 322.2Z';

const GUIDES = [
  'M-1729.12 -213.57L1836.12 285.57',
  'M-1729.12 31.43L1836.12 530.57'
];

export function MarkIsometric() {
  const rawId = useId().replace(/:/g, '');
  const ids = {
    facePattern: `ma-face-pattern-${rawId}`,
    faceFill: `ma-face-fill-${rawId}`,
    stroke: `ma-stroke-${rawId}`,
    radialGradient: `ma-radial-gradient-${rawId}`
  };

  const ref = useRef<SVGSVGElement>(null);
  const shouldReduceMotion = useReducedMotion();
  const isInView = useInView(ref, { margin: '80px' });
  const mouseX = useMotionValue(0.5);
  const mouseY = useMotionValue(0.5);
  const cx = useSpring(useTransform(mouseX, [0, 1], [0, VIEW_W]), {
    stiffness: 300,
    damping: 30,
    mass: 0.1
  });
  const cy = useSpring(useTransform(mouseY, [0, 1], [0, VIEW_H]), {
    stiffness: 300,
    damping: 30,
    mass: 0.1
  });

  useEffect(() => {
    if (shouldReduceMotion || !isInView) {
      return;
    }
    if (window.matchMedia('(hover: none)').matches) {
      return;
    }
    const handleMouseMove = (event: MouseEvent) => {
      mouseX.set(event.clientX / window.innerWidth);
      mouseY.set(event.clientY / window.innerHeight);
    };
    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, [shouldReduceMotion, isInView, mouseX, mouseY]);

  return (
    <motion.svg
      ref={ref}
      className="h-auto w-full cursor-pointer touch-manipulation overflow-visible [--pattern:color-mix(in_oklab,var(--foreground)_12%,var(--background))] [--stroke:color-mix(in_oklab,var(--foreground)_16%,var(--background))]"
      viewBox={`${SHIFT_X} ${SHIFT_Y} ${VIEW_W} ${VIEW_H}`}
      overflow="visible"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
      initial="normal"
      whileTap="pressed"
      onTap={() => playMetalClick()}
    >
      <defs>
        <pattern
          id={ids.facePattern}
          x="0"
          y="0"
          width="10"
          height="10"
          patternUnits="userSpaceOnUse"
        >
          <path
            d="M-1 1l2 -2M0 10l10 -10M9 11l2 -2"
            stroke="var(--pattern)"
            strokeWidth="1"
          />
        </pattern>

        <motion.g
          id={ids.faceFill}
          variants={{
            normal: { y: 0 },
            pressed: { y: 16 }
          }}
          transition={transition}
        >
          {FACE_FILLS.map((d) => (
            <path key={d} d={d} />
          ))}
        </motion.g>

        <motion.path
          id={ids.stroke}
          d={STROKE_NORMAL}
          variants={{
            normal: { d: STROKE_NORMAL },
            pressed: { d: STROKE_PRESSED }
          }}
          transition={transition}
        />

        <motion.radialGradient
          id={ids.radialGradient}
          cx={cx}
          cy={cy}
          r="200"
          gradientUnits="userSpaceOnUse"
        >
          <stop className="dark:[stop-color:#fff]" stopColor="#3f3f46" />
          <stop
            className="dark:[stop-color:#52525b]"
            offset="1"
            stopColor="#a1a1aa"
            stopOpacity="0"
          />
        </motion.radialGradient>
      </defs>

      <g className="stroke-line" strokeWidth="1" strokeDasharray="4 2">
        {GUIDES.map((d) => (
          <path key={d} d={d} />
        ))}
      </g>

      <g className="fill-background" fillRule="evenodd" clipRule="evenodd">
        {SIDES.map(([normal, pressed]) => (
          <motion.path
            key={normal}
            variants={{
              normal: { d: normal },
              pressed: { d: pressed }
            }}
            transition={transition}
          />
        ))}
      </g>

      <use href={`#${ids.faceFill}`} className="fill-background" />
      <use href={`#${ids.faceFill}`} fill={`url(#${ids.facePattern})`} />
      <use href={`#${ids.stroke}`} stroke="var(--stroke)" />
      <use href={`#${ids.stroke}`} stroke={`url(#${ids.radialGradient})`} />
    </motion.svg>
  );
}
