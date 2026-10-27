'use client';

// A client component: in the App Router (v0, `npx shadcn add`) it runs in the browser. The Pages Router ignores this.
import { type KeyboardEvent, useCallback, useEffect, useRef, useState } from 'react';
import { useTheme } from 'next-themes';
import { MaximizeIcon, MinimizeIcon, MinusIcon, PlusIcon, RotateCcwIcon } from 'lucide-react';
import { ISO_CSS } from './iso-kit';
import { Plate } from './iso-react';
import { CountryFind } from './country-find';
import { Globe, SCALE_MOST, SCALE_STEP, type GlobeHandle, type GlobeState } from './live';
import { useFullscreen } from './use-fullscreen';
import styles from './world-globe.module.css';


/** The keyboard shortcuts, shown under the figure. They work once the globe has focus (click it or Tab to it). */
const KEYS: [string[], string][] = [
  [['←', '→'], 'turn it left or right'],
  [['↑', '↓'], 'turn it up or down'],
  [['S'], 'start or stop spinning'],
  [['B'], 'break apart or make whole'],
  [['Esc'], 'put every country back'],
  [['+', '−'], 'zoom'],
  [['0'], 'reset the view'],
  [['F'], 'full screen']
];

/**
 * A globe whose countries are separate plates: turn it any way, pull a country out of its socket, split it
 * into its states or provinces, or break the whole map apart. Drawn with the Anatomy kit (isometric SVG);
 * the ball is projected with d3-geo.
 */
export default function WorldGlobe() {
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const globe = useRef<GlobeHandle>(null);
  // Full screen takes the controls and the globe, not the legend under them.
  const stage = useRef<HTMLDivElement>(null);
  const { expanded, toggle: toggleFullscreen, mode } = useFullscreen(stage);
  const [state, setState] = useState<GlobeState>({ broken: false, spinning: true, pulled: 0, scale: 1, selected: -1, hint: '' });

  // Ready two frames after mounting, once the globe has drawn with the right theme.
  const [ready, setReady] = useState(false);
  useEffect(() => {
    setMounted(true);
    let frame = requestAnimationFrame(
      () =>
        (frame = requestAnimationFrame(() => {
          setReady(true);
          try {
            localStorage.setItem('world-globe:seen', '1');
          } catch {}
        }))
    );
    return () => cancelAnimationFrame(frame);
  }, []);
  const theme = mounted && resolvedTheme === 'dark' ? 'dark' : 'light';

  const onState = useCallback((next: GlobeState) => setState(next), []);

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    // Typing a country's name is not a shortcut.
    if ((event.target as HTMLElement).closest('input, textarea, select')) return;
    const step = event.shiftKey ? 45 : 15;
    if (event.key === 'ArrowLeft') globe.current?.turn(-step);
    else if (event.key === 'ArrowRight') globe.current?.turn(step);
    else if (event.key === 'ArrowUp') globe.current?.roll(-step);
    else if (event.key === 'ArrowDown') globe.current?.roll(step);
    else if (event.key === 'b' || event.key === 'B') globe.current?.setBroken(!state.broken);
    else if (event.key === 's' || event.key === 'S') globe.current?.setSpinning(!state.spinning);
    else if (event.key === 'Escape') globe.current?.putBack();
    else if (event.key === '+' || event.key === '=') globe.current?.scaleBy(SCALE_STEP);
    else if (event.key === '-' || event.key === '_') globe.current?.scaleBy(1 / SCALE_STEP);
    else if (event.key === '0' || event.key === 'Home') globe.current?.home();
    else if (event.key === 'f' || event.key === 'F') void toggleFullscreen();
    else return;
    event.preventDefault();
  };

  return (
    // Behind a skeleton until ready: before then the theme isn't known, and a dark page would flash light.
    <section className={`iso ${styles.root}`} data-theme={theme} data-booting={ready ? undefined : ''} aria-busy={!ready}>
      <style dangerouslySetInnerHTML={{ __html: ISO_CSS }} />
      {ready ? null : (
        <>
          <div className={styles.skeleton} aria-hidden="true" suppressHydrationWarning>
            <div className={styles.skeletonRow}>
              <span />
              <span />
              <span />
            </div>
            <div className={styles.skeletonFigure}>
              <span />
            </div>
          </div>
          {/* A visitor who has seen the block before skips the skeleton: it is drawn again in a blink. */}
          <script dangerouslySetInnerHTML={{ __html: `try{localStorage.getItem('world-globe:seen')&&(document.currentScript.previousElementSibling.style.display='none')}catch(e){}` }} />
        </>
      )}
      <div ref={stage} className={styles.stage} data-expanded={expanded ? mode : undefined} tabIndex={-1} onKeyDown={onKeyDown}>
      <div className={styles.toolbar}>
        <div className={styles.group} role="group" aria-label="The map">
          <button type="button" className={styles.chip} aria-pressed={!state.broken} onClick={() => globe.current?.setBroken(false)}>
            Whole
            <kbd className={styles.kbd}>B</kbd>
          </button>
          <button type="button" className={styles.chip} aria-pressed={state.broken} onClick={() => globe.current?.setBroken(true)}>
            Broken apart
            <kbd className={styles.kbd}>B</kbd>
          </button>
          <button type="button" className={styles.chip} aria-pressed={state.spinning} onClick={() => globe.current?.setSpinning(!state.spinning)}>
            {state.spinning ? 'Spinning' : 'Still'}
            <kbd className={styles.kbd}>S</kbd>
          </button>
        </div>
        <CountryFind onFind={(index) => globe.current?.find(index)}>
          <button type="button" className={styles.chip} disabled={!state.pulled && !state.broken} onClick={() => globe.current?.putBack()}>
            Put back
            <kbd className={styles.kbd}>Esc</kbd>
          </button>
        </CountryFind>
      </div>
      <Plate
        fig="Fig 1"
        title="A globe in pieces"
        hint={state.hint || 'Drag to turn it any way · click a country'}
        readout="Facing · axis 23.4°"
        keys={[
          { mark: 'lit', label: 'The country you picked' },
          { mark: 'raised', label: 'A country’s plate, set in the ball' },
          { mark: 'flat', label: 'Its socket, once the plate is out' }
        ]}
        caption={
          <>
            <span className={styles.keys} aria-label="Keyboard shortcuts, once the globe is focused">
              {KEYS.map(([keys, action]) => (
                <span key={action} className={styles.keyItem}>
                  {keys.map((key) => (
                    <kbd key={key} className={styles.kbd}>
                      {key}
                    </kbd>
                  ))}
                  {action}
                </span>
              ))}
            </span>
          </>
        }
      >
        <div className={styles.view} role="group" aria-label="View">
          <button type="button" className={styles.viewButton} onClick={() => globe.current?.scaleBy(SCALE_STEP)} disabled={state.scale >= SCALE_MOST} aria-label="Zoom in" title="Zoom in (+)">
            <PlusIcon aria-hidden="true" />
          </button>
          <button type="button" className={styles.viewButton} onClick={() => globe.current?.scaleBy(1 / SCALE_STEP)} disabled={state.scale <= 1} aria-label="Zoom out" title="Zoom out (−)">
            <MinusIcon aria-hidden="true" />
          </button>
          <button type="button" className={styles.viewButton} onClick={() => globe.current?.home()} aria-label="Reset view" title="Reset view (0)">
            <RotateCcwIcon aria-hidden="true" />
          </button>
          <button type="button" className={styles.viewButton} onClick={() => void toggleFullscreen()} aria-label={expanded ? 'Exit full screen' : 'Full screen'} title={expanded ? 'Exit full screen (F)' : 'Full screen (F)'}>
            {expanded ? <MinimizeIcon aria-hidden="true" /> : <MaximizeIcon aria-hidden="true" />}
          </button>
        </div>
        <div
          className={styles.stageFrame}
          role="group"
          tabIndex={0}
          aria-label="Globe. Arrow keys turn it any way, B breaks the map apart, S starts or stops its turning, Escape puts every country back, plus and minus zoom, F goes full screen, and 0 resets the view."
                  >
          <Globe ref={globe} onState={onState} />
        </div>
      </Plate>
      </div>
    </section>
  );
}
