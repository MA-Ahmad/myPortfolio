import type { Backdrop } from '../components/sections';
import { SECTIONS } from '../content';
import { SoundToggle } from './sound-toggle';
import { createSheet } from './sheet';
import { SheetRunner, SheetSurface, TornPiece } from './torn-piece';
import type { WeldKind } from './welds';

/**
 * The sections as pieces of one sheet, torn apart where they meet. Opening a section welds the
 * seams to its left shut, leaving faint scars; the seams to its right stay torn.
 */
export function tornBackdrop(weld: WeldKind = 'torch'): Backdrop {
  const sheet = createSheet(SECTIONS.length);
  return {
    skin: 'torn',
    behind: (open) => (
      <>
        <SheetSurface open={open} count={sheet.count} />
        <SheetRunner sheet={sheet} weld={weld} open={open} />
        <SoundToggle />
      </>
    ),
    under: (index, _, select) => (
      <TornPiece
        sheet={sheet}
        index={index}
        weld={weld}
        onJoin={() => select(index + 1)}
        onTear={() => select(index)}
      />
    )
  };
}
