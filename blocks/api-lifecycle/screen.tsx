import * as React from 'react';
import type { Geometry } from './geometry';
import { followersText, ms, profileOf, type Plan, type Screen as Kind } from './model';
import { SCREEN } from './view';
import styles from './api-lifecycle.module.css';

/**
 * The terminal's screen, drawn in the plane of the glass (u right, v down, in world units) and
 * clipped to it. It changes a few times per request, so it keeps its own state and the bench
 * around it never re-renders.
 */

export interface ScreenHandle {
  show: (kind: Kind, plan: Plan | null) => void;
  /** Lay the screen on the glass as this camera sees it. */
  place: (geometry: Geometry) => void;
}

const W = SCREEN.w;
const H = SCREEN.h;
const CLIP = 'api-lifecycle-screen';

const initials = (name: string) =>
  name
    .split(' ')
    .map((part) => part[0])
    .join('');

function Body({ kind, plan }: { kind: Kind; plan: Plan | null }) {
  const id = plan?.request.id;
  if (kind === 'loading') {
    return (
      <g>
        <text className={styles.screenText} x={3} y={6} fontSize={2.6}>
          GET /users/{id}
        </text>
        <circle className={styles.skeleton} cx={9} cy={15} r={5} />
        {[
          [17, 12, 26],
          [17, 16.5, 16],
          [3, 24, 38],
          [3, 28, 28]
        ].map(([x, y, w], index) => (
          <rect key={index} className={styles.skeleton} x={x} y={y} width={w} height={2.2} rx={1.1} style={{ animationDelay: `${index * 90}ms` }} />
        ))}
      </g>
    );
  }
  if (kind === 'profile' && id !== undefined) {
    const profile = profileOf(id);
    if (!profile) return null;
    return (
      <g>
        <circle className={styles.avatar} cx={9} cy={10} r={5.6} />
        <text className={styles.avatarText} x={9} y={11.3} fontSize={3.6} textAnchor="middle">
          {initials(profile.name)}
        </text>
        <text className={styles.screenStrong} x={17.5} y={9} fontSize={3.4}>
          {profile.name}
        </text>
        <text className={styles.screenText} x={17.5} y={13.6} fontSize={2.5}>
          @{profile.handle}
        </text>
        <text className={styles.screenText} x={3} y={19.6} fontSize={2.4}>
          {profile.role}
        </text>
        {profile.github ? (
          <text className={styles.screenText} x={3} y={23} fontSize={2.2}>
            github.com/{profile.github}
          </text>
        ) : null}
        <text className={styles.screenText} x={3} y={26.4} fontSize={2.3}>
          {profile.repos} repos · {followersText(profile.followers)} followers
        </text>
        <line className={styles.screenRule} x1={3} x2={W - 3} y1={28} y2={28} />
        <text className={styles.screenDim} x={3} y={31} fontSize={2}>
          200 · {plan ? ms(plan.ms) : ''} · {plan?.outcome === 'hit' ? 'cache' : 'db'}
        </text>
      </g>
    );
  }
  if (kind === 'unauthorized' || kind === 'notFound') {
    const code = kind === 'unauthorized' ? '401' : '404';
    return (
      <g>
        <text className={styles.screenStrong} x={3} y={12} fontSize={8}>
          {code}
        </text>
        <text className={styles.screenText} x={3} y={19} fontSize={2.6}>
          {kind === 'unauthorized' ? 'Token expired' : `No user ${id}`}
        </text>
        <text className={styles.screenDim} x={3} y={23.5} fontSize={2.2}>
          {kind === 'unauthorized' ? 'Sign in again to continue' : 'Check the id and try again'}
        </text>
        <line className={styles.screenRule} x1={3} x2={W - 3} y1={27.4} y2={27.4} />
        <text className={styles.screenDim} x={3} y={30.4} fontSize={2}>
          {code} · {plan ? ms(plan.ms) : ''}
        </text>
      </g>
    );
  }
  return (
    <g>
      <text className={styles.screenText} x={3} y={6} fontSize={2.6}>
        GET /users/:id
      </text>
      <text className={styles.screenDim} x={3} y={11} fontSize={2.2}>
        pick a user, then send
      </text>
      <rect className={styles.cursor} x={3} y={13.2} width={1.6} height={2.6} />
    </g>
  );
}

export const Screen = React.forwardRef<ScreenHandle, { geometry: Geometry }>(function Screen({ geometry }, handle) {
  const [shown, setShown] = React.useState<{ kind: Kind; plan: Plan | null }>({ kind: 'idle', plan: null });
  const glass = React.useRef<SVGPathElement>(null);
  const face = React.useRef<SVGGElement>(null);
  const frame = React.useRef<SVGPathElement>(null);
  React.useImperativeHandle(
    handle,
    () => ({
      show: (kind, plan) => setShown({ kind, plan }),
      place: ({ CLIENT_ART }) => {
        glass.current?.setAttribute('d', CLIENT_ART.glass);
        face.current?.setAttribute('transform', CLIENT_ART.screenMatrix);
        frame.current?.setAttribute('d', CLIENT_ART.window);
      }
    }),
    []
  );
  // The first render uses the resting camera; later cameras are written by `place`.
  const { CLIENT_ART } = geometry;
  return (
    <g>
      <path ref={glass} className={styles.glass} d={CLIENT_ART.glass} />
      <g ref={face} transform={CLIENT_ART.screenMatrix}>
        <clipPath id={CLIP}>
          <rect x={0} y={0} width={W} height={H} />
        </clipPath>
        <g clipPath={`url(#${CLIP})`}>
          <rect className={styles.scan} x={0} y={0} width={W} height={H} />
          <Body kind={shown.kind} plan={shown.plan} />
        </g>
      </g>
      <path ref={frame} className="iso-line" data-tone="mid" d={CLIENT_ART.window} />
    </g>
  );
});
