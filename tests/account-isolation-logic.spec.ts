/**
 * Account isolation: a slow async load for account A must never publish after account B signed in.
 * Pure interleaving tests for the guard + static guards that the shared community store uses it after every await.
 * Node only:  npx playwright test -c playwright.logic.config.ts account-isolation-logic
 */
import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { createLatestGuard } from '../src/lib/latestGuard';

test.describe('createLatestGuard', () => {
  test('a newer load makes the older one stale; the newer stays current', () => {
    const g = createLatestGuard();
    const a = g.begin();
    const b = g.begin();
    expect(a()).toBe(true);
    expect(b()).toBe(false);
  });
  test('invalidate (sign-out / account change) makes every in-flight load stale', () => {
    const g = createLatestGuard();
    const a = g.begin();
    const b = g.begin();
    g.invalidate();
    expect([a(), b()]).toEqual([true, true]);
    expect(g.begin()()).toBe(false); // loads started afterwards are fine
  });
  test('simulated race: account A is slower than account B and cannot overwrite B', async () => {
    const g = createLatestGuard();
    let published: string | null = null;
    const load = async (who: string, ms: number) => {
      const stale = g.begin();
      await new Promise((r) => setTimeout(r, ms));
      if (stale()) return;
      published = who;
    };
    const a = load('A', 40);
    g.invalidate(); // account switch
    const b = load('B', 5);
    await Promise.all([a, b]);
    expect(published).toBe('B');
  });
});

test.describe('shared community store (src/hooks/useActiveCommunity.ts)', () => {
  const src = readFileSync('src/hooks/useActiveCommunity.ts', 'utf8');
  const load = src.slice(src.indexOf('async function load()'), src.indexOf('export function refreshActiveCommunity'));
  test('every await in load() is followed by a staleness check before anything is published', () => {
    const awaits = load.match(/await /g)?.length ?? 0;
    const checks = load.match(/if \(isStale\(\)\) return;/g)?.length ?? 0;
    expect(awaits).toBe(4); // getSession, memberships, hoas, AsyncStorage
    expect(checks).toBe(awaits);
  });
  test('boundUserId is only assigned after the first staleness check', () => {
    expect(load.indexOf('if (isStale()) return;')).toBeLessThan(load.indexOf('boundUserId ='));
  });
  test('a failed or superseded load cannot mark the newer account loaded', () => {
    expect(load).toContain('if (!isStale()) emit({ ...snapshot, loaded: true });');
  });
  test('an account change invalidates in-flight loads before the store is cleared', () => {
    const handler = src.slice(src.indexOf('supabase.auth.onAuthStateChange'));
    expect(handler.indexOf('loadGuard.invalidate()')).toBeGreaterThan(-1);
    expect(handler.indexOf('loadGuard.invalidate()')).toBeLessThan(handler.indexOf("emit({ loaded: false"));
  });
  test('an older load finishing cannot clear a newer in-flight marker', () => {
    expect(src).toContain('if (inflight === run) inflight = null;');
  });
});
