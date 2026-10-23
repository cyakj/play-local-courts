// "Latest wins" guard for async loads that publish into shared state. Every load calls begin() and checks the
// returned isStale() after each await; invalidate() (e.g. on sign-out / account change) marks all in-flight loads
// stale. Without it, a slow load for account A can finish after account B signed in and overwrite B's state.

export interface LatestGuard {
  /** Start a load. The returned function reports whether a newer load or an invalidate() has superseded it. */
  begin(): () => boolean;
  /** Supersede every load that is currently in flight. */
  invalidate(): void;
}

export function createLatestGuard(): LatestGuard {
  let current = 0;
  return {
    begin() {
      const mine = ++current;
      return () => mine !== current;
    },
    invalidate() {
      current++;
    },
  };
}
