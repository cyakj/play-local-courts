/**
 * RequestLedger: when may an async response still be applied?
 * Node only:  npx playwright test -c playwright.logic.config.ts request-ledger
 */
import { test, expect } from '@playwright/test';
import { RequestLedger } from '../src/lib/requestLedger';

test.describe('RequestLedger', () => {
  test('a lone request is live', () => {
    const l = new RequestLedger();
    expect(l.live(l.begin(['d1:c1']))).toEqual(['d1:c1']);
  });
  test('REGRESSION: an older response for the same key cannot overwrite a newer request', () => {
    const l = new RequestLedger();
    const older = l.begin(['d1:c1']);
    const newer = l.begin(['d1:c1']);
    expect(l.live(older)).toEqual([]);
    expect(l.live(newer)).toEqual(['d1:c1']);
  });
  test('only the superseded keys of a multi-key request are dropped', () => {
    const l = new RequestLedger();
    const all = l.begin(['d1:c1', 'd1:c2']);
    l.begin(['d1:c2']);
    expect(l.live(all)).toEqual(['d1:c1']);
  });
  test('different dates do not supersede each other', () => {
    const l = new RequestLedger();
    const a = l.begin(['d1:c1']);
    const b = l.begin(['d2:c1']);
    expect(l.live(a)).toEqual(['d1:c1']);
    expect(l.live(b)).toEqual(['d2:c1']);
  });
  test('REGRESSION: a response that started before an account/community change is ignored', () => {
    const l = new RequestLedger();
    const t = l.begin(['d1:c1']);
    l.reset();
    expect(l.live(t)).toEqual([]);
    // a request begun after the reset is live again
    expect(l.live(l.begin(['d1:c1']))).toEqual(['d1:c1']);
  });
  test('REGRESSION: a late response for the previous account cannot repopulate the cache after a newer fetch for the same key', () => {
    const l = new RequestLedger();
    const previousAccount = l.begin(['d1:c1']);
    l.reset();
    const current = l.begin(['d1:c1']);
    expect(l.live(previousAccount)).toEqual([]);
    expect(l.live(current)).toEqual(['d1:c1']);
  });
});
