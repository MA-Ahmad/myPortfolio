import * as React from 'react';
import { BASE_ART, CACHE_ART, CARD_ART, CLIENT_ART, DB_ART, GATE_ART, RAIL_ART, SERVER_ART, SHUTTLE_ART } from './geometry';
import { Dots, FaceText, Line, Solid, Wire } from './iso-react';
import { PROFILES } from './model';
import styles from './api-lifecycle.module.css';

/**
 * The parts that never change shape, in painter's order within each group. The live component
 * places these groups back to front and moves the ones that travel.
 */

export const BASE = (
  <g key="base">
    <path className="iso-halo" d={BASE_ART.halo} />
    {BASE_ART.feet.map((parts, index) => (
      <g key={index}>
        {parts.map((paths, part) => (
          <Solid key={part} paths={paths} tone={part ? 'mid' : 'lo'} />
        ))}
      </g>
    ))}
    <Solid paths={BASE_ART.slab} tone="mid" inner={<Line d={BASE_ART.seam} tone="faint" />} />
    <Line d={BASE_ART.groove} tone="faint" />
    <Line d={BASE_ART.screwRings} tone="lo" />
    <Dots points={BASE_ART.screws} size={0.5} tone="mid" />
    <Solid paths={BASE_ART.strip} tone="lo" crease="none" />
    <Line d={BASE_ART.minor} tone="lo" />
    <Line d={BASE_ART.major} tone="mid" />
    <Solid paths={BASE_ART.label} tone="lo" crease="none" />
    <Line d={BASE_ART.labelLine} tone="faint" />
    <Line d={BASE_ART.labelRules} tone="lo" free />
    <Dots points={BASE_ART.labelScrews} size={0.45} tone="mid" />
  </g>
);

export const CLIENT = (
  <g key="client">
    <path className="iso-halo" d={CLIENT_ART.halo} />
    <Solid paths={CLIENT_ART.plinth} tone="lo" />
    <Solid paths={CLIENT_ART.body} tone="mid" inner={<Line d={CLIENT_ART.seam} tone="faint" />} />
    <Line d={CLIENT_ART.bezel} tone="lo" />
    <path className={styles.recessFloor} d={CLIENT_ART.recessFloor} />
    <path className={styles.recessWall} d={CLIENT_ART.recessWall} />
    <Line d={CLIENT_ART.vents} tone="lo" />
    <Line d={CLIENT_ART.power} tone="lo" />
    <Dots points={[CLIENT_ART.powerDot]} size={0.6} tone="mid" />
    <Solid paths={CLIENT_ART.slot} tone="lo" crease="none" flat />
    <Line d={CLIENT_ART.slotLip} tone="faint" />
    <path className={styles.slot} d={CLIENT_ART.slotLine} />
    <Dots points={CLIENT_ART.topScrews} size={0.5} tone="mid" />
    <Wire from={CLIENT_ART.cord[0]} to={CLIENT_ART.cord[1]} tone="lo" size={0.9} />
    <Solid paths={CLIENT_ART.keyboard} tone="mid" />
    <Line d={CLIENT_ART.keys} tone="lo" />
  </g>
);

export const SERVER = (
  <g key="server">
    <path className="iso-halo" d={SERVER_ART.halo} />
    <Solid paths={SERVER_ART.plinth} tone="lo" />
    {SERVER_ART.units.map((paths, unit) => (
      <g key={unit}>
        <Solid paths={paths} tone="mid" />
        <Line d={SERVER_ART.unitMarks[unit]} tone="lo" />
        {SERVER_ART.handles[unit].map((handle, index) => (
          <Solid key={index} paths={handle} tone="mid" crease="none" />
        ))}
      </g>
    ))}
    <Dots points={SERVER_ART.vents} size={0.45} tone="lo" />
    <Dots points={SERVER_ART.bayLeds} size={0.6} tone="mid" />
    <Line d={SERVER_ART.panelRules} tone="lo" free />
    <Dots points={SERVER_ART.topScrews} size={0.5} tone="mid" />
    <Solid paths={SERVER_ART.dialBase} tone="lo" />
    <Solid
      paths={SERVER_ART.dial}
      tone="hi"
      crease="lo"
      inner={
        <>
          <Line d={SERVER_ART.dialBand} tone="faint" />
          <Line d={SERVER_ART.dialKnurl} tone="faint" />
        </>
      }
    />
    <Line d={SERVER_ART.bezel} tone="lo" />
    <Line d={SERVER_ART.dialMinor} tone="lo" />
    <Line d={SERVER_ART.dialMajor} tone="mid" />
    <Dots points={[SERVER_ART.routeMark]} size={0.6} tone="hi" />
  </g>
);

/** The server's status lights, which blink while a handler runs. */
export const SERVER_LEDS = SERVER_ART.statusLeds.map(([x, y], index) => (
  <circle key={index} className={styles.statusLed} cx={x} cy={y} r={0.75} style={{ animationDelay: `${index * 110}ms` }} />
));

export const GATE_BACK = (
  <g key="gate-back">
    <Solid paths={GATE_ART.back.foot} tone="lo" />
    <Dots points={GATE_ART.back.footScrews} size={0.45} tone="mid" />
    <Solid paths={GATE_ART.back.post} tone="mid" inner={<Line d={GATE_ART.back.seams} tone="faint" />} />
    <Line d={GATE_ART.guide} tone="lo" />
  </g>
);

export const CACHE = (
  <g key="cache">
    <path className="iso-halo" d={CACHE_ART.halo} />
    <Solid paths={CACHE_ART.plinth} tone="lo" />
    <Solid paths={CACHE_ART.box} tone="mid" inner={<Line d={CACHE_ART.seam} tone="faint" />} />
    <Line d={CACHE_ART.pockets} tone="lo" />
    <Line d={CACHE_ART.pocketFloors} tone="faint" />
    <Line d={CACHE_ART.ledRings} tone="lo" />
    <Solid paths={CACHE_ART.label} tone="lo" crease="none" />
    <Line d={CACHE_ART.labelRules} tone="lo" free />
    <Dots points={CACHE_ART.screws} size={0.45} tone="mid" />
  </g>
);

/** One card per pocket; the live component shows the ones the cache holds. */
export const POCKET_CARDS = PROFILES.map((profile, index) => (
  <g key={profile.id} className={styles.pocketCard} data-pocket={index}>
    <Solid paths={CACHE_ART.cards[index]} tone="hi" crease="lo" />
    <Line d={CACHE_ART.cardMarks[index]} tone="lo" free />
  </g>
));

export const POCKET_LEDS = CACHE_ART.leds.map(([x, y], index) => (
  <circle key={index} className={styles.led} data-pocket={index} cx={x} cy={y} r={0.8} />
));

export const DB = (
  <g key="db">
    <path className="iso-halo" d={DB_ART.halo} />
    <Solid paths={DB_ART.plinth} tone="lo" />
    <Solid paths={DB_ART.body} tone="mid" inner={<Line d={DB_ART.sideSeams} tone="faint" />} />
    <Solid paths={DB_ART.lip} tone="mid" />
    <Dots points={DB_ART.topScrews} size={0.5} tone="mid" />
    <FaceText transform={DB_ART.label} size={4} tone="lo" anchor="middle">
      users
    </FaceText>
    <Line d={DB_ART.openings} tone="lo" />
  </g>
);

/** A drawer's front, handle and label holder; the live component slides it out. */
export const DRAWER_FRONTS = DB_ART.drawers.map((drawer, index) => (
  <g key={index}>
    <Solid paths={drawer.front} tone="mid" />
    <Line d={drawer.holder} tone="lo" />
    <Line d={drawer.holderCard} tone="lo" free />
    <Dots points={drawer.rivets} size={0.45} tone="mid" />
    <Solid paths={drawer.handle} tone="mid" />
    <Dots points={drawer.handlePosts} size={0.5} tone="mid" />
  </g>
));

export const RAIL = (
  <g key="rail">
    <path className="iso-halo" d={RAIL_ART.halo} />
    <Solid paths={RAIL_ART.track} tone="mid" />
    <Line d={RAIL_ART.groove} tone="faint" />
    <Dots points={RAIL_ART.screws} size={0.45} tone="mid" />
    {RAIL_ART.stops.map((paths, index) => (
      <Solid key={index} paths={paths} tone="mid" />
    ))}
    <Line d={RAIL_ART.stopPads.join('')} tone="lo" />
    <Dots points={RAIL_ART.stopScrews} size={0.45} tone="mid" />
  </g>
);

export const SHUTTLE_BODY = (
  <g key="shuttle-body">
    <path className="iso-halo" d={SHUTTLE_ART.halo} />
    {SHUTTLE_ART.skirts.map((paths, index) => (
      <Solid key={index} paths={paths} tone="mid" />
    ))}
    <Line d={SHUTTLE_ART.wheels.join('')} tone="lo" />
    <Dots points={SHUTTLE_ART.hubs} size={0.5} tone="mid" />
    {SHUTTLE_ART.bumpers.map((paths, index) => (
      <Solid key={index} paths={paths} tone="lo" />
    ))}
    <Solid paths={SHUTTLE_ART.deck} tone="hi" crease="lo" inner={<Line d={SHUTTLE_ART.seam} tone="faint" />} />
    <Line d={SHUTTLE_ART.seat} tone="faint" />
    <Dots points={SHUTTLE_ART.rivets} size={0.45} tone="mid" />
    <Solid paths={SHUTTLE_ART.key} tone="mid" inner={<Line d={SHUTTLE_ART.keyKnurl} tone="faint" />} />
    <Line d={SHUTTLE_ART.keyBow} tone="lo" />
  </g>
);

export const SLIP = (
  <g key="slip">
    <Solid paths={SHUTTLE_ART.slip} tone="hi" crease="lo" lit />
    <Line d={SHUTTLE_ART.slipRules} tone="mid" free />
  </g>
);

export const CARD = (
  <g key="card">
    <Solid paths={CARD_ART.body} tone="hi" crease="lo" lit />
    <Line d={CARD_ART.avatar} tone="mid" />
    <Line d={CARD_ART.rules} tone="mid" free />
  </g>
);

export const GATE_BEAM = (
  <g key="gate-beam">
    <Solid paths={GATE_ART.beam} tone="mid" inner={<Line d={GATE_ART.beamSeam} tone="faint" />} />
    <Dots points={GATE_ART.beamScrews} size={0.5} tone="mid" />
  </g>
);

export const GATE_PLATE = (
  <g key="gate-plate">
    <Solid paths={GATE_ART.plate} tone="hi" crease="lo" inner={<Line d={GATE_ART.plateRibs} tone="faint" />} />
  </g>
);

export const GATE_FRONT = (
  <g key="gate-front">
    <Solid paths={GATE_ART.front.foot} tone="lo" />
    <Dots points={GATE_ART.front.footScrews} size={0.45} tone="mid" />
    <Solid paths={GATE_ART.front.post} tone="mid" inner={<Line d={GATE_ART.front.seams} tone="faint" />} />
    <Line d={GATE_ART.frontGuide} tone="lo" />
    <Solid paths={GATE_ART.reader} tone="mid" inner={<Line d={GATE_ART.readerSeam} tone="faint" />} />
    <Line d={GATE_ART.keyhole} tone="lo" />
    <Line d={GATE_ART.keyway} tone="lo" />
    <Line d={GATE_ART.ledRing} tone="lo" />
  </g>
);
