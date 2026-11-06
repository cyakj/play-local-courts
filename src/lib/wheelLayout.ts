// Pure layout rules for the time wheel's ends. Node-testable.
//
// The scroller pads its content by (wheelHeight - rowHeight) / 2 above and below so the first and last real time can sit
// in the centre band. That padding stays EMPTY (faded by the edge masks): an earlier "ghost row" filler rendered grey bars
// that looked like loading skeletons, so it was removed. Nothing outside operating hours is drawn or invented.

/** Space above the first real row and below the last, so either can be centred. */
export function wheelPad(wheelH: number, itemH: number): number {
  return Math.max(0, (wheelH - itemH) / 2);
}

/** Opacity of a row by its distance (in rows) from the centre; important rows stay readable (>= 0.3 within 3 rows). */
export const DRUM_OPACITY_STOPS = { distance: [0, 1, 2, 3, 4], opacity: [1, 0.85, 0.62, 0.42, 0.26] } as const;
