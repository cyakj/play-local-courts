// Pure layout rules for the time wheel's ends. Node-testable.
//
// The scroller pads its content by (wheelHeight - rowHeight) / 2 above and below so the first and last real time can sit
// in the centre band. That padding used to be empty, so on the first/last time half of the drum was a blank box. The
// padding is now filled with non-interactive "ghost" rows (no time, no weather, never selectable) that roll like the real
// rows, so the drum keeps its shape at either end. Ghost rows are not times: nothing outside operating hours is invented.

/** Space above the first real row and below the last, so either can be centred. */
export function wheelPad(wheelH: number, itemH: number): number {
  return Math.max(0, (wheelH - itemH) / 2);
}

export interface GhostLayout {
  /** Ghost rows rendered above the first slot and below the last. */
  count: number;
  /** Remaining empty padding (px) after the ghosts, always >= 0 and < itemH. */
  remainder: number;
}

export function ghostLayout(wheelH: number, itemH: number): GhostLayout {
  const pad = wheelPad(wheelH, itemH);
  const count = Math.floor(pad / itemH);
  return { count, remainder: pad - count * itemH };
}

/** Row indexes of the ghost rows: negative above the first slot, >= slotCount below the last. Never a real slot index. */
export function ghostIndexes(count: number, slotCount: number): { top: number[]; bottom: number[] } {
  const top: number[] = [];
  const bottom: number[] = [];
  for (let i = count; i >= 1; i--) top.push(-i);
  for (let i = 0; i < count; i++) bottom.push(slotCount + i);
  return { top, bottom };
}

/** Opacity of a row by its distance (in rows) from the centre; important rows stay readable (>= 0.3 within 3 rows). */
export const DRUM_OPACITY_STOPS = { distance: [0, 1, 2, 3, 4], opacity: [1, 0.85, 0.62, 0.42, 0.26] } as const;
