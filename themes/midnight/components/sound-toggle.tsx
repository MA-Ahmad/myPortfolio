import { useEffect, useState } from 'react';
import { Volume2, VolumeX } from 'lucide-react';
import { setMuted, unlockAudio } from '../lib/weld-sound';
import styles from '../midnight.module.css';

const SOUND_KEY = 'midnight-sound';

/** Switches the pipeline's sound effects on or off, and remembers the choice across visits. */
export function SoundToggle() {
  const [sound, setSound] = useState(true);

  // Storage can be unavailable, so it only ever adds to the default (on).
  useEffect(() => {
    try {
      if (window.localStorage.getItem(SOUND_KEY) === 'off') {
        setSound(false);
        setMuted(true);
      }
    } catch {}
  }, []);

  const toggle = () => {
    const next = !sound;
    setSound(next);
    setMuted(!next);
    if (next) unlockAudio();
    try {
      window.localStorage.setItem(SOUND_KEY, next ? 'on' : 'off');
    } catch {}
  };

  return (
    <button
      type="button"
      className={styles.soundToggle}
      aria-pressed={sound}
      aria-label="Sound effects"
      title={sound ? 'Sound on' : 'Sound off'}
      onClick={toggle}
    >
      {sound ? <Volume2 size={14} strokeWidth={1.7} /> : <VolumeX size={14} strokeWidth={1.7} />}
    </button>
  );
}
