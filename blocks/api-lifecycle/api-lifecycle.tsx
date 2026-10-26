import { type KeyboardEvent, useCallback, useEffect, useRef, useState } from 'react';
import { useTheme } from 'next-themes';
import { ISO_CSS } from './iso-kit';
import { Plate } from './iso-react';
import { Bench, type BenchHandle } from './live';
import { MISSING_ID, NETWORK, PROFILES, QUERY, TOTALS, ms, type Request } from './model';
import styles from './api-lifecycle.module.css';

const USERS = [...PROFILES.map((profile) => ({ id: profile.id, name: `@${profile.handle}` })), { id: MISSING_ID, name: 'unknown' }];

const CAPTION = `A GET /users/:id on one bench. Cold, the request takes ${ms(TOTALS.miss)}, and ${TOTALS.network} ms of that is the network there and back (${NETWORK} ms each way); the database lookup by primary key is ${QUERY} ms. Asked again, the row comes from the cache in ${ms(TOTALS.hit)}. An expired token is turned away at the gate in ${ms(TOTALS.expired)}, before the server does any work. The bench is slowed down so you can follow it; the clock in the corner keeps real time.`;

/**
 * The life of one API call, fetching a user's profile, built as a request bench: a shuttle carries
 * the request from the client terminal through an auth gate to the app server, the cache and the
 * database, and brings the row back. Drawn with the Anatomy kit (isometric SVG, one model).
 */
export default function ApiLifecycle() {
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const bench = useRef<BenchHandle>(null);
  const [user, setUser] = useState(PROFILES[0].id);
  const [token, setToken] = useState<Request['token']>('valid');
  const [busy, setBusy] = useState(false);
  const [cached, setCached] = useState<number[]>([]);
  const [zoomed, setZoomed] = useState(false);

  useEffect(() => setMounted(true), []);
  const theme = mounted && resolvedTheme === 'dark' ? 'dark' : 'light';

  // The bench never re-renders, so it reads the request to send from a ref.
  const request = useRef<Request>({ id: user, token });
  request.current = { id: user, token };
  const send = useCallback(() => bench.current?.send(request.current), []);
  // A request in flight has already been sent with its user and token, and has already asked the
  // cache, so the controls that shape a request wait for it to land. The ref catches a key pressed
  // in the same instant a request starts, before React has re-rendered with `busy`.
  const flying = useRef(false);
  const onBusy = useCallback((value: boolean) => {
    flying.current = value;
    setBusy(value);
  }, []);
  const pick = (id: number) => {
    if (flying.current) return;
    setUser(id);
    bench.current?.touch();
  };
  const toggleToken = () => {
    if (flying.current) return;
    setToken((current) => (current === 'valid' ? 'expired' : 'valid'));
    bench.current?.touch();
  };
  const flush = () => {
    if (flying.current) return;
    bench.current?.flush();
  };
  const onTour = useCallback((request: Request) => {
    setUser(request.id);
    setToken(request.token);
  }, []);

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const digit = Number(event.key);
    const step = event.shiftKey ? 18 : 6;
    if (event.key === 'Enter' || event.key === ' ') send();
    else if (event.key === 'ArrowLeft') bench.current?.turn(-step);
    else if (event.key === 'ArrowRight') bench.current?.turn(step);
    else if (event.key === 'Home') bench.current?.home();
    else if (event.key === 'z' || event.key === 'Z' || event.key === 'm' || event.key === 'M') bench.current?.zoom();
    else if (event.key === 'Escape' && zoomed) bench.current?.zoom(false);
    else if (digit >= 1 && digit <= USERS.length) pick(USERS[digit - 1].id);
    else if (event.key === 't' || event.key === 'T') toggleToken();
    else if (event.key === 'c' || event.key === 'C') flush();
    else return;
    event.preventDefault();
  };

  return (
    <section className={`iso ${styles.root}`} data-theme={theme}>
      <style dangerouslySetInnerHTML={{ __html: ISO_CSS }} />
      <div className={styles.toolbar}>
        <div className={styles.group} role="group" aria-label="User to fetch">
          <span className={styles.groupLabel}>User</span>
          {USERS.map((option) => (
            <button
              key={option.id}
              type="button"
              className={styles.chip}
              aria-pressed={user === option.id}
              data-cached={cached.includes(option.id) ? '' : undefined}
              disabled={busy}
              onClick={() => pick(option.id)}
            >
              {option.name}
              <span className={styles.chipId}>#{option.id}</span>
            </button>
          ))}
        </div>
        <div className={styles.group}>
          <button type="button" className={styles.chip} aria-pressed={token === 'expired'} disabled={busy} onClick={toggleToken}>
            {token === 'valid' ? 'Token valid' : 'Token expired'}
          </button>
          <button type="button" className={styles.chip} onClick={flush} disabled={busy || !cached.length}>
            Flush cache
          </button>
          <button type="button" className={styles.chip} aria-pressed={zoomed} onClick={() => bench.current?.zoom()}>
            {zoomed ? 'Back to bench' : 'Monitor'}
          </button>
          <button type="button" className={styles.send} onClick={send} disabled={busy}>
            {busy ? 'In flight…' : `GET /users/${user}`}
          </button>
        </div>
      </div>
      <Plate
        fig="Fig 1"
        title="Fetch a user profile"
        hint={zoomed ? 'Click or Esc to step back' : 'Drag to turn · click the monitor'}
        readout="GET /users/:id · ready"
        keys={[
          { mark: 'lit', label: 'What travels: the request ticket, and the row card that answers it' },
          { mark: 'green', label: 'Token accepted, pocket read' },
          { mark: 'red', label: 'Token rejected' }
        ]}
        caption={CAPTION}
      >
        <div
          className={styles.stageFrame}
          role="group"
          tabIndex={0}
          aria-label="Request bench. Enter sends the request, 1 to 3 pick a user, T toggles the token, C flushes the cache. Left and right arrows turn the bench, Home resets the view, Z moves in to the monitor and Escape steps back."
          onKeyDown={onKeyDown}
        >
          <Bench ref={bench} onBusy={onBusy} onCache={setCached} onTour={onTour} onSend={send} onZoom={setZoomed} />
        </div>
      </Plate>
    </section>
  );
}
