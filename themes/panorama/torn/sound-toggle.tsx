import { useContext, useEffect, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import { Volume2, VolumeX } from 'lucide-react';
import { ToolsSlot } from '../components/panorama-layout';
import { armAudio, setMuted, unlockAudio } from './sound';
import styles from '../panorama.module.css';

const SOUND_KEY = 'panorama-sound';
const listeners = new Set<() => void>();
let picked: boolean | null = null; // this visit's choice, which holds even where storage is blocked

// Storage can be unavailable, so it only ever adds to the default (on).
function readSound() {
  if (picked !== null) return picked;
  try {
    return window.localStorage.getItem(SOUND_KEY) !== 'off';
  } catch {
    return true;
  }
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/**
 * Switches the weld sounds on or off and remembers the choice. Sound is on by default; it starts
 * with the first click, tap or key press, since browsers keep audio off until then. It sits in
 * the header, beside the time of day.
 */
export function SoundToggle() {
  const sound = useSyncExternalStore(subscribe, readSound, () => true);
  const slot = useContext(ToolsSlot);

  useEffect(() => armAudio(), []);
  useEffect(() => setMuted(!sound), [sound]);

  const toggle = () => {
    if (!sound) unlockAudio();
    picked = !sound;
    try {
      window.localStorage.setItem(SOUND_KEY, sound ? 'off' : 'on');
    } catch {}
    listeners.forEach((listener) => listener());
  };

  if (!slot) return null;
  return createPortal(
    <button
      type="button"
      className={styles.tool}
      aria-pressed={sound}
      aria-label="Sound effects"
      title={sound ? 'Sound on' : 'Sound off'}
      onClick={toggle}
    >
      {sound ? <Volume2 size={14} strokeWidth={1.7} /> : <VolumeX size={14} strokeWidth={1.7} />}
    </button>,
    slot
  );
}
