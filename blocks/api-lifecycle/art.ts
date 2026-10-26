import type { Geometry } from './geometry';
import { dotsSvg, faceTextSvg, lineSvg, solidSvg, wireSvg } from './iso-kit';
import { PROFILES } from './model';
import styles from './api-lifecycle.module.css';

/**
 * The bench's parts as SVG markup for one camera, in painter's order within each group. The live
 * component writes each string into its own group and writes them again when the camera turns,
 * so React never re-renders the drawing.
 */
export function artOf(g: Geometry) {
  const { BASE_ART, CACHE_ART, CARD_ART, CLIENT_ART, DB_ART, GATE_ART, RAIL_ART, SERVER_ART, SHUTTLE_ART } = g;
  const halo = (d: string) => `<path class="iso-halo" d="${d}"/>`;
  /** A wheel: its tread in shade, the face toward the viewer lighter, then tyre and hub rings. */
  const wheelSvg = (wheel: { tread: string; face: string; tyre: string; hub: string }) =>
    `<g class="iso-solid"><path class="iso-fill" d="${wheel.tread}"/><path class="iso-shade" data-shade="1" d="${wheel.tread}"/><path class="iso-line iso-edge" data-tone="mid" d="${wheel.tread}"/><path class="iso-shade" data-shade="3" d="${wheel.face}"/><path class="iso-line" data-tone="mid" d="${wheel.face}"/>${lineSvg(
      wheel.tyre,
      { tone: 'lo' }
    )}${lineSvg(wheel.hub, { tone: 'mid' })}</g>`;

  const base = [
    halo(BASE_ART.halo),
    ...BASE_ART.feet.map((parts) => `<g>${parts.map((paths, part) => solidSvg(paths, { tone: part ? 'mid' : 'lo' })).join('')}</g>`),
    solidSvg(BASE_ART.slab, { tone: 'mid', inner: lineSvg(BASE_ART.seam, { tone: 'faint' }) }),
    lineSvg(BASE_ART.groove, { tone: 'faint' }),
    lineSvg(BASE_ART.screwRings, { tone: 'lo' }),
    dotsSvg(BASE_ART.screws, { size: 0.5, tone: 'mid' }),
    solidSvg(BASE_ART.strip, { tone: 'lo', crease: 'none' }),
    lineSvg(BASE_ART.minor, { tone: 'lo' }),
    lineSvg(BASE_ART.major, { tone: 'mid' }),
    solidSvg(BASE_ART.label, { tone: 'lo', crease: 'none' }),
    lineSvg(BASE_ART.labelLine, { tone: 'faint' }),
    lineSvg(BASE_ART.labelRules, { tone: 'lo', free: true }),
    dotsSvg(BASE_ART.labelScrews, { size: 0.45, tone: 'mid' })
  ].join('');

  const client = [
    halo(CLIENT_ART.halo),
    solidSvg(CLIENT_ART.plinth, { tone: 'lo' }),
    solidSvg(CLIENT_ART.body, { tone: 'mid', inner: lineSvg(CLIENT_ART.seam, { tone: 'faint' }) }),
    lineSvg(CLIENT_ART.bezel, { tone: 'lo' }),
    `<path class="${styles.recessFloor}" d="${CLIENT_ART.recessFloor}"/>`,
    `<path class="${styles.recessWall}" d="${CLIENT_ART.recessWall}"/>`,
    lineSvg(CLIENT_ART.vents, { tone: 'lo' }),
    lineSvg(CLIENT_ART.power, { tone: 'lo' }),
    dotsSvg([CLIENT_ART.powerDot], { size: 0.6, tone: 'mid' }),
    lineSvg(CLIENT_ART.floppyBezel, { tone: 'faint' }),
    `<path class="${styles.slot}" d="${CLIENT_ART.floppy}"/>`,
    lineSvg(CLIENT_ART.floppyFlap, { tone: 'lo' }),
    lineSvg(CLIENT_ART.eject, { tone: 'lo' }),
    dotsSvg(CLIENT_ART.topScrews, { size: 0.5, tone: 'mid' }),
    wireSvg(CLIENT_ART.cord[0], CLIENT_ART.cord[1], { tone: 'lo', size: 0.9 }),
    solidSvg(CLIENT_ART.keyboard, { tone: 'mid' }),
    lineSvg(CLIENT_ART.keys, { tone: 'lo' })
  ].join('');

  const server = [
    halo(SERVER_ART.halo),
    solidSvg(SERVER_ART.plinth, { tone: 'lo' }),
    ...SERVER_ART.units.map(
      (paths, unit) =>
        `<g>${solidSvg(paths, { tone: 'mid' })}${lineSvg(SERVER_ART.unitMarks[unit], { tone: 'lo' })}${SERVER_ART.handles[unit]
          .map((handle) => solidSvg(handle, { tone: 'mid', crease: 'none' }))
          .join('')}</g>`
    ),
    dotsSvg(SERVER_ART.vents, { size: 0.45, tone: 'lo' }),
    dotsSvg(SERVER_ART.bayLeds, { size: 0.6, tone: 'mid' }),
    lineSvg(SERVER_ART.panelRules, { tone: 'lo', free: true }),
    dotsSvg(SERVER_ART.topScrews, { size: 0.5, tone: 'mid' }),
    solidSvg(SERVER_ART.dialBase, { tone: 'lo' }),
    solidSvg(SERVER_ART.dial, {
      tone: 'hi',
      crease: 'lo',
      inner: lineSvg(SERVER_ART.dialBand, { tone: 'faint' }) + lineSvg(SERVER_ART.dialKnurl, { tone: 'faint' })
    }),
    lineSvg(SERVER_ART.bezel, { tone: 'lo' }),
    lineSvg(SERVER_ART.dialMinor, { tone: 'lo' }),
    lineSvg(SERVER_ART.dialMajor, { tone: 'mid' }),
    dotsSvg([SERVER_ART.routeMark], { size: 0.6, tone: 'hi' }),
    // The status lights blink while a handler runs.
    ...SERVER_ART.statusLeds.map(
      ([x, y], index) => `<circle class="${styles.statusLed}" cx="${x}" cy="${y}" r="0.75" style="animation-delay:${index * 110}ms"/>`
    )
  ].join('');

  const gateBack = [
    solidSvg(GATE_ART.back.foot, { tone: 'lo' }),
    dotsSvg(GATE_ART.back.footScrews, { size: 0.45, tone: 'mid' }),
    solidSvg(GATE_ART.back.post, { tone: 'mid', inner: lineSvg(GATE_ART.back.seams, { tone: 'faint' }) }),
    lineSvg(GATE_ART.guide, { tone: 'lo' })
  ].join('');

  const cache = [
    halo(CACHE_ART.halo),
    solidSvg(CACHE_ART.plinth, { tone: 'lo' }),
    solidSvg(CACHE_ART.box, { tone: 'mid', inner: lineSvg(CACHE_ART.seam, { tone: 'faint' }) }),
    lineSvg(CACHE_ART.pockets, { tone: 'lo' }),
    lineSvg(CACHE_ART.pocketFloors, { tone: 'faint' }),
    lineSvg(CACHE_ART.ledRings, { tone: 'lo' }),
    solidSvg(CACHE_ART.label, { tone: 'lo', crease: 'none' }),
    lineSvg(CACHE_ART.labelRules, { tone: 'lo', free: true }),
    dotsSvg(CACHE_ART.screws, { size: 0.45, tone: 'mid' }),
    // One card per pocket, shown while the cache holds that user, and a light under each pocket.
    ...PROFILES.map(
      (_, index) =>
        `<g class="${styles.pocketCard}" data-pocket="${index}" data-hidden="">${solidSvg(CACHE_ART.cards[index], { tone: 'hi', crease: 'lo' })}${lineSvg(
          CACHE_ART.cardMarks[index],
          { tone: 'lo', free: true }
        )}</g>`
    ),
    ...CACHE_ART.leds.map(([x, y], index) => `<circle class="${styles.led}" data-pocket="${index}" cx="${x}" cy="${y}" r="0.8"/>`)
  ].join('');

  const db = [
    halo(DB_ART.halo),
    solidSvg(DB_ART.plinth, { tone: 'lo' }),
    solidSvg(DB_ART.body, { tone: 'mid', inner: lineSvg(DB_ART.sideSeams, { tone: 'faint' }) }),
    solidSvg(DB_ART.lip, { tone: 'mid' }),
    dotsSvg(DB_ART.topScrews, { size: 0.5, tone: 'mid' }),
    faceTextSvg(DB_ART.label, 'users', { size: 4, tone: 'lo', anchor: 'middle' }),
    lineSvg(DB_ART.openings, { tone: 'lo' })
  ].join('');

  const drawerFronts = DB_ART.drawers.map((drawer) =>
    [
      solidSvg(drawer.front, { tone: 'mid' }),
      lineSvg(drawer.holder, { tone: 'lo' }),
      lineSvg(drawer.holderCard, { tone: 'lo', free: true }),
      dotsSvg(drawer.rivets, { size: 0.45, tone: 'mid' }),
      solidSvg(drawer.handle, { tone: 'mid' }),
      dotsSvg(drawer.handlePosts, { size: 0.5, tone: 'mid' })
    ].join('')
  );

  const rail = [
    halo(RAIL_ART.halo),
    solidSvg(RAIL_ART.track, { tone: 'mid' }),
    lineSvg(RAIL_ART.groove, { tone: 'faint' }),
    dotsSvg(RAIL_ART.screws, { size: 0.45, tone: 'mid' }),
    ...RAIL_ART.stops.map((paths) => solidSvg(paths, { tone: 'mid' })),
    lineSvg(RAIL_ART.stopPads.join(''), { tone: 'lo' }),
    dotsSvg(RAIL_ART.stopScrews, { size: 0.45, tone: 'mid' })
  ].join('');

  const shuttle = [
    halo(SHUTTLE_ART.halo),
    ...SHUTTLE_ART.backWheels.map((wheel) => wheelSvg(wheel)),
    ...SHUTTLE_ART.hangers.map((paths) => solidSvg(paths, { tone: 'mid' })),
    ...SHUTTLE_ART.frontWheels.map((wheel) => wheelSvg(wheel)),
    // The front wheels' spokes turn as the shuttle rolls; the live component writes this path each frame.
    `<path class="iso-line" data-tone="mid" data-spokes="" d="${g.wheelSpokesOf(0)}"/>`,
    dotsSvg(
      SHUTTLE_ART.frontWheels.map((wheel) => wheel.hubDot),
      { size: 0.35, tone: 'hi' }
    ),
    ...SHUTTLE_ART.bumpers.map((paths) => solidSvg(paths, { tone: 'lo' })),
    solidSvg(SHUTTLE_ART.deck, { tone: 'hi', crease: 'lo', inner: lineSvg(SHUTTLE_ART.seam, { tone: 'faint' }) }),
    lineSvg(SHUTTLE_ART.seat, { tone: 'faint' }),
    dotsSvg(SHUTTLE_ART.rivets, { size: 0.45, tone: 'mid' }),
    solidSvg(SHUTTLE_ART.key, { tone: 'mid', inner: lineSvg(SHUTTLE_ART.keyKnurl, { tone: 'faint' }) }),
    lineSvg(SHUTTLE_ART.keyBow, { tone: 'lo' })
  ].join('');

  const slip = solidSvg(SHUTTLE_ART.slip, { tone: 'hi', crease: 'lo', lit: true }) + lineSvg(SHUTTLE_ART.slipRules, { tone: 'mid', free: true });

  const card = [
    solidSvg(CARD_ART.body, { tone: 'hi', crease: 'lo', lit: true }),
    lineSvg(CARD_ART.avatar, { tone: 'mid' }),
    lineSvg(CARD_ART.rules, { tone: 'mid', free: true })
  ].join('');

  const gateBeam = solidSvg(GATE_ART.beam, { tone: 'mid', inner: lineSvg(GATE_ART.beamSeam, { tone: 'faint' }) }) + dotsSvg(GATE_ART.beamScrews, { size: 0.5, tone: 'mid' });

  const gatePlate = solidSvg(GATE_ART.plate, { tone: 'hi', crease: 'lo', inner: lineSvg(GATE_ART.plateRibs, { tone: 'faint' }) });

  const gateFront = [
    solidSvg(GATE_ART.front.foot, { tone: 'lo' }),
    dotsSvg(GATE_ART.front.footScrews, { size: 0.45, tone: 'mid' }),
    solidSvg(GATE_ART.front.post, { tone: 'mid', inner: lineSvg(GATE_ART.front.seams, { tone: 'faint' }) }),
    lineSvg(GATE_ART.frontGuide, { tone: 'lo' }),
    solidSvg(GATE_ART.reader, { tone: 'mid', inner: lineSvg(GATE_ART.readerSeam, { tone: 'faint' }) }),
    lineSvg(GATE_ART.keyhole, { tone: 'lo' }),
    lineSvg(GATE_ART.keyway, { tone: 'lo' }),
    lineSvg(GATE_ART.ledRing, { tone: 'lo' })
  ].join('');

  return { base, client, server, gateBack, cache, db, drawerFronts, rail, shuttle, slip, card, gateBeam, gatePlate, gateFront };
}

export type Art = ReturnType<typeof artOf>;
