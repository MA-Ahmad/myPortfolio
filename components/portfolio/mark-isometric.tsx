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
 * Laid-down block M. Stems stay screen-vertical (i+j);
 * V arms sit on the iso layout axes so the construction
 * dashes run along both edges. Shifted up to sit in-frame.
 */
const FACE_FILLS = [
  'M-149.04 -12.02L-64.79 36.62L48.83 102.22L162.45 36.62L246.70 -12.02L246.70 195.98L162.45 244.62L162.45 133.90L48.83 199.50L-64.79 133.90L-64.79 244.62L-149.04 195.98Z'
];

const SIDES: Array<[string, string]> = [
  [
    'M-149.04 -12.02L-64.79 36.62L-64.79 68.62L-149.04 19.98Z',
    'M-149.04 3.98L-64.79 52.62L-64.79 68.62L-149.04 19.98Z'
  ],
  [
    'M-64.79 36.62L48.83 102.22L48.83 134.22L-64.79 68.62Z',
    'M-64.79 52.62L48.83 118.22L48.83 134.22L-64.79 68.62Z'
  ],
  [
    'M48.83 102.22L162.45 36.62L162.45 68.62L48.83 134.22Z',
    'M48.83 118.22L162.45 52.62L162.45 68.62L48.83 134.22Z'
  ],
  [
    'M162.45 36.62L246.70 -12.02L246.70 19.98L162.45 68.62Z',
    'M162.45 52.62L246.70 3.98L246.70 19.98L162.45 68.62Z'
  ],
  [
    'M246.70 -12.02L246.70 195.98L246.70 227.98L246.70 19.98Z',
    'M246.70 3.98L246.70 211.98L246.70 227.98L246.70 19.98Z'
  ],
  [
    'M246.70 195.98L162.45 244.62L162.45 276.62L246.70 227.98Z',
    'M246.70 211.98L162.45 260.62L162.45 276.62L246.70 227.98Z'
  ],
  [
    'M162.45 244.62L162.45 133.90L162.45 165.90L162.45 276.62Z',
    'M162.45 260.62L162.45 149.90L162.45 165.90L162.45 276.62Z'
  ],
  [
    'M162.45 133.90L48.83 199.50L48.83 231.50L162.45 165.90Z',
    'M162.45 149.90L48.83 215.50L48.83 231.50L162.45 165.90Z'
  ],
  [
    'M48.83 199.50L-64.79 133.90L-64.79 165.90L48.83 231.50Z',
    'M48.83 215.50L-64.79 149.90L-64.79 165.90L48.83 231.50Z'
  ],
  [
    'M-64.79 133.90L-64.79 244.62L-64.79 276.62L-64.79 165.90Z',
    'M-64.79 149.90L-64.79 260.62L-64.79 276.62L-64.79 165.90Z'
  ],
  [
    'M-64.79 244.62L-149.04 195.98L-149.04 227.98L-64.79 276.62Z',
    'M-64.79 260.62L-149.04 211.98L-149.04 227.98L-64.79 276.62Z'
  ],
  [
    'M-149.04 195.98L-149.04 -12.02L-149.04 19.98L-149.04 227.98Z',
    'M-149.04 211.98L-149.04 3.98L-149.04 19.98L-149.04 227.98Z'
  ]
];

const STROKE_NORMAL =
  'M-149.04 -12.02L-64.79 36.62L48.83 102.22L162.45 36.62L246.70 -12.02L246.70 195.98L162.45 244.62L162.45 133.90L48.83 199.50L-64.79 133.90L-64.79 244.62L-149.04 195.98L-149.04 -12.02M-149.04 -12.02L-149.04 19.98M-149.04 19.98L-64.79 68.62M-64.79 36.62L-64.79 68.62M-64.79 68.62L48.83 134.22M48.83 102.22L48.83 134.22M48.83 134.22L162.45 68.62M162.45 36.62L162.45 68.62M162.45 68.62L246.70 19.98M246.70 -12.02L246.70 19.98M246.70 19.98L246.70 227.98M246.70 195.98L246.70 227.98M246.70 227.98L162.45 276.62M162.45 244.62L162.45 276.62M162.45 133.90L162.45 165.90M162.45 165.90L48.83 231.50M48.83 199.50L48.83 231.50M-64.79 133.90L-64.79 165.90M-64.79 165.90L48.83 231.50M-64.79 165.90L-64.79 276.62M-64.79 244.62L-64.79 276.62M-64.79 276.62L-149.04 227.98M-149.04 195.98L-149.04 227.98';

const STROKE_PRESSED =
  'M-149.04 3.98L-64.79 52.62L48.83 118.22L162.45 52.62L246.70 3.98L246.70 211.98L162.45 260.62L162.45 149.90L48.83 215.50L-64.79 149.90L-64.79 260.62L-149.04 211.98L-149.04 3.98M-149.04 3.98L-149.04 19.98M-149.04 19.98L-64.79 68.62M-64.79 52.62L-64.79 68.62M-64.79 68.62L48.83 134.22M48.83 118.22L48.83 134.22M48.83 134.22L162.45 68.62M162.45 52.62L162.45 68.62M162.45 68.62L246.70 19.98M246.70 3.98L246.70 19.98M246.70 19.98L246.70 227.98M246.70 211.98L246.70 227.98M246.70 227.98L162.45 276.62M162.45 260.62L162.45 276.62M162.45 149.90L162.45 165.90M162.45 165.90L48.83 231.50M48.83 215.50L48.83 231.50M-64.79 149.90L-64.79 165.90M-64.79 165.90L48.83 231.50M-64.79 165.90L-64.79 276.62M-64.79 260.62L-64.79 276.62M-64.79 276.62L-149.04 227.98M-149.04 211.98L-149.04 227.98';

const GUIDES = [
  'M-1707.89 -912.02L1409.81 887.98',
  'M-1510.02 1002.22L1607.68 -797.78',
  'M-1510.01 1099.52L1607.67 -700.52'
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
  const cx = useSpring(useTransform(mouseX, [0, 1], [0, 556]), {
    stiffness: 300,
    damping: 30,
    mass: 0.1
  });
  const cy = useSpring(useTransform(mouseY, [0, 1], [0, 354]), {
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
      viewBox="0 0 556 354"
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
