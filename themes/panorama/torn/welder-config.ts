import saved from './welder.json';

/**
 * How a seam is welded by hand (welder.tsx). `style` picks the process: each draws its own bead and
 * arc; the numbers tune it. Tuned at /dev/welder, which saves `welder.json`.
 */
export const WELD_STYLES = ['stick', 'mig', 'tig', 'laser', 'braze'] as const;

/** The welding device drawn at the pointer. */
export const WELD_DEVICES = [
  { key: 'pencil', label: 'Pencil' },
  { key: 'electrode', label: 'Electrode' },
  { key: 'tig', label: 'TIG torch' },
  { key: 'mig', label: 'MIG gun' },
  { key: 'laser', label: 'Laser pen' }
] as const;
export type WeldStyle = (typeof WELD_STYLES)[number];

export type WelderConfig = {
  style: string;
  /** The device drawn at the pointer: pencil, electrode, tig, mig or laser. */
  device: string;
  /** The bead's width, px. */
  width: number;
  /** How long the bead takes to cool from white-hot, ms. */
  cool: number;
  /** Once cool, how long the bead takes to dry and fade away, leaving the sheet's healed scar, ms. */
  dry: number;
  /** How much spatter, arc light and smoke (0 for none, 1 as tuned, up to 2). */
  spatter: number;
  glow: number;
  smoke: number;
  /** The length of the pencil's or electrode's rod, px. */
  pen: number;
  /** 1 to say "Hold to weld" beside the rod before the first weld. */
  hint: number;
};

export const WELDER_DEFAULTS: WelderConfig = saved;

/** Each process as it looks: the colour of its cooled bead and its arc. */
export const STYLE_LOOK: Record<
  WeldStyle,
  {
    label: string;
    metal: [number, number, number];
    /** The arc's light, and whether the bead shows a rainbow heat tint either side. */
    arc: [number, number, number];
    tint: boolean;
    /** Suggested knob values when the style is picked. */
    preset: Partial<WelderConfig>;
  }
> = {
  stick: {
    label: 'Stick',
    metal: [74, 78, 88],
    arc: [190, 205, 255],
    tint: false,
    preset: {
      width: 7,
      cool: 1100,
      spatter: 1.4,
      glow: 1,
      smoke: 1.4
    }
  },
  mig: {
    label: 'MIG',
    metal: [112, 117, 127],
    arc: [205, 215, 255],
    tint: false,
    preset: { width: 6, cool: 900, spatter: 1, glow: 1, smoke: 1 }
  },
  tig: {
    label: 'TIG',
    metal: [150, 156, 168],
    arc: [170, 190, 255],
    tint: true,
    preset: {
      width: 5,
      cool: 800,
      spatter: 0.2,
      glow: 1.1,
      smoke: 0.2
    }
  },
  laser: {
    label: 'Laser',
    metal: [196, 201, 212],
    arc: [255, 236, 210],
    tint: false,
    preset: { width: 2.6, cool: 500, spatter: 0.35, glow: 0.6, smoke: 0 }
  },
  braze: {
    label: 'Braze',
    metal: [196, 150, 72],
    arc: [255, 200, 140],
    tint: false,
    preset: {
      width: 6.5,
      cool: 1200,
      spatter: 0.3,
      glow: 0.8,
      smoke: 0.6
    }
  }
};

export const styleOf = (config: WelderConfig): WeldStyle =>
  (WELD_STYLES as readonly string[]).includes(config.style) ? (config.style as WeldStyle) : 'mig';

/* A tiny store, so the tuning page (/dev/welder) can change the welder live. */
let current: WelderConfig = WELDER_DEFAULTS;
const listeners = new Set<() => void>();
export const welderStore = {
  get: () => current,
  getServer: () => WELDER_DEFAULTS,
  set(next: WelderConfig) {
    current = next;
    listeners.forEach((listener) => listener());
  },
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }
};
