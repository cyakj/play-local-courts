// Pure. A day's availability may only be presented as fact once it has actually loaded.
export type LoadState = 'ok' | 'stale' | 'error' | undefined;

/**
 * What to show for a day given how its reservation fetch went:
 *  - undefined (never fetched / still loading) -> undefined: the caller renders its "checking" state, never "free"
 *  - 'error'  -> the `unknown` placeholder
 *  - 'stale'  -> the computed value with a "may be out of date" note appended to its detail text
 *  - 'ok'     -> the computed value unchanged
 * `compute` is only called when there is data to compute from.
 */
export function gateAvailability<T extends { detailText: string }>(load: LoadState, compute: () => T, unknown: T): T | undefined {
  if (load === undefined) return undefined;
  if (load === 'error') return unknown;
  const value = compute();
  return load === 'stale' ? { ...value, detailText: `${value.detailText} (may be out of date)`.trim() } : value;
}
