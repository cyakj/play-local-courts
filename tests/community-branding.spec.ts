/**
 * Community branding resolution: a community only ever gets its own logo.
 * Pure Node tests over the registry (the rendering is covered by the visual checks).
 */
import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

const root = path.resolve(__dirname, '..');
const read = (p: string) => fs.readFileSync(path.join(root, p), 'utf8');

const DBE_ID = 'f222b3de-2e6b-4f5e-999b-a7fcdd9750ae';
const GREENS_ID = 'cb6a0752-dee0-4a01-b74a-6fb25f47de98';

test.describe('community logo registry (source-level)', () => {
  const registry = read('src/config/communityBranding.ts');

  test('Dorado Beach artwork is keyed to its own community id only', () => {
    expect(registry).toContain(`'${DBE_ID}': require('@/assets/branding/dorado-beach-logo.png')`);
  });

  test('The Greens (and any unlisted community) has no bundled logo — it falls back to its name', () => {
    expect(registry).not.toContain(GREENS_ID);
    // exactly one bundled entry today
    expect((registry.match(/require\('@\/assets\/branding\//g) ?? []).length).toBe(1);
  });

  test('there is no default / wildcard logo', () => {
    expect(registry).not.toMatch(/\?\?\s*require/);
    expect(registry).toContain('return BUNDLED_COMMUNITY_LOGOS[hoaId] ?? null;');
  });
});

test.describe('header never hardcodes a community', () => {
  const logos = read('src/components/branding/BrandLogos.tsx');
  const header = read('src/components/ui/Header.tsx');

  test('no Dorado/Greens literals in header or logo components', () => {
    for (const src of [logos, header]) {
      expect(src).not.toMatch(/dorado/i);
      expect(src).not.toMatch(/the greens/i);
    }
  });

  test('a passed community name only reuses the active community logo when it matches', () => {
    expect(header).toContain('passedName === community?.name');
  });
});

test.describe('assets', () => {
  test('transparent logos exist and the supplied opaque originals are preserved separately', () => {
    for (const f of [
      'assets/branding/tenisx-logo.png',
      'assets/branding/dorado-beach-logo.png',
      'assets/branding/source/dorado-beach-logo-supplied-opaque.png',
      'assets/branding/source/tenisx-logo-supplied-opaque.png',
    ]) {
      expect(fs.existsSync(path.join(root, f)), f).toBe(true);
    }
  });

  test('PNG colour type 6 (RGBA) — i.e. the delivered logos carry an alpha channel', () => {
    for (const f of ['assets/branding/tenisx-logo.png', 'assets/branding/dorado-beach-logo.png']) {
      const buf = fs.readFileSync(path.join(root, f));
      expect(buf.subarray(1, 4).toString()).toBe('PNG');
      expect(buf[25]).toBe(6); // IHDR colour type
    }
  });
});
