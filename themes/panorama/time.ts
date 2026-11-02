import { useSyncExternalStore } from 'react';

export type TimeOfDay = 'morning' | 'afternoon' | 'night';

export const TIMES: TimeOfDay[] = ['morning', 'afternoon', 'night'];

/** The visitor's own clock: morning 5–11, afternoon 11–18, night otherwise. */
export function timeAt(date: Date): TimeOfDay {
  const hour = date.getHours();
  if (hour >= 5 && hour < 11) return 'morning';
  if (hour >= 11 && hour < 18) return 'afternoon';
  return 'night';
}

/* A tiny store: the clock's answer unless the visitor picked a time, remembered per browser. */

const KEY = 'panorama-time';

/**
 * Runs inline as the page is parsed, so the first paint already has the right time of day
 * instead of flashing the server's night. Mirrors timeAt and the stored pick.
 */
export const EARLY_TIME_SCRIPT = `(function(){var el=document.currentScript.parentElement.parentElement;var t;try{t=localStorage.getItem('${KEY}')}catch(e){}if(['morning','afternoon','night'].indexOf(t)<0){var h=new Date().getHours();t=h>=5&&h<11?'morning':h>=11&&h<18?'afternoon':'night'}el.setAttribute('data-time',t)})()`;
const listeners = new Set<() => void>();
let picked: TimeOfDay | null = null;
let clock: TimeOfDay = 'night';

function read() {
  try {
    const value = localStorage.getItem(KEY);
    picked = TIMES.includes(value as TimeOfDay) ? (value as TimeOfDay) : null;
  } catch {
    picked = null;
  }
}

let timer = 0;

function subscribe(listener: () => void) {
  if (!listeners.size) {
    read();
    clock = timeAt(new Date());
    // The hour can turn while the page is open.
    timer = window.setInterval(() => {
      const now = timeAt(new Date());
      if (now === clock) return;
      clock = now;
      listeners.forEach((notify) => notify());
    }, 60_000);
  }
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
    if (!listeners.size) window.clearInterval(timer);
  };
}

const snapshot = () => `${picked ?? clock}|${picked ? 'picked' : 'auto'}`;

export function pickTime(time: TimeOfDay | null) {
  picked = time;
  try {
    if (time) localStorage.setItem(KEY, time);
    else localStorage.removeItem(KEY);
  } catch {
    // Private windows can refuse storage; the pick still holds for this visit.
  }
  listeners.forEach((listener) => listener());
}

/** The time of day to draw, and whether it follows the clock. Night on the server. */
export function useTimeOfDay(): { time: TimeOfDay; auto: boolean } {
  const value = useSyncExternalStore(subscribe, snapshot, () => 'night|auto');
  const [time, mode] = value.split('|');
  return { time: time as TimeOfDay, auto: mode === 'auto' };
}
