/**
 * Location search model: Puerto Rico fallback, provider-failure classification and the
 * resident-facing wording. Pure Node tests (no network).
 *
 * Background: the Mapbox token is URL-restricted, so native requests (no Referer) get
 * HTTP 403. The app used to show "Check your connection" for that.
 */
import { test, expect } from '@playwright/test';
import {
  LOCAL_ID_PREFIX,
  describeProviderFailure,
  failureKindFromStatus,
  isLocalLocationId,
  localLocationFromId,
  normalizeText,
  searchLocalLocations,
} from '../src/lib/locationSearch';
import { PUERTO_RICO_MUNICIPIOS } from '../src/data/puertoRicoMunicipios';

test.describe('bundled Puerto Rico municipios', () => {
  test('covers all 78 municipios, unique ids', () => {
    expect(PUERTO_RICO_MUNICIPIOS).toHaveLength(78);
    expect(new Set(PUERTO_RICO_MUNICIPIOS.map((m) => m.geoid)).size).toBe(78);
    for (const m of PUERTO_RICO_MUNICIPIOS) {
      expect(m.lat).toBeGreaterThan(17.5);
      expect(m.lat).toBeLessThan(18.6);
      expect(m.lng).toBeGreaterThan(-68);
      expect(m.lng).toBeLessThan(-65);
    }
  });

  test('searching "Dorado" returns Dorado first', () => {
    const r = searchLocalLocations('Dorado');
    expect(r[0].name).toBe('Dorado');
    expect(r[0].placeFormatted).toBe('Puerto Rico');
    expect(isLocalLocationId(r[0].mapboxId)).toBe(true);
  });

  test('case/accents/"PR" suffix are ignored', () => {
    expect(searchLocalLocations('dorado, pr')[0].name).toBe('Dorado');
    expect(searchLocalLocations('anasco')[0].name).toBe('Añasco');
    expect(searchLocalLocations('MAYAGUEZ')[0].name).toBe('Mayagüez');
    expect(normalizeText('Dorado, Puerto Rico')).toBe('dorado');
  });

  test('prefix matches rank before substring matches; short/empty queries return nothing', () => {
    const r = searchLocalLocations('san');
    expect(r.length).toBeGreaterThan(1);
    expect(r.every((x) => /san/i.test(x.name))).toBe(true);
    expect(searchLocalLocations('')).toEqual([]);
    expect(searchLocalLocations('d')).toEqual([]);
    expect(searchLocalLocations('zzzzqq')).toEqual([]);
  });

  test('selecting a suggestion yields a savable, restorable LocationValue', () => {
    const [dorado] = searchLocalLocations('Dorado');
    const value = localLocationFromId(dorado.mapboxId)!;
    expect(value).toMatchObject({
      display_name: 'Dorado',
      city: 'Dorado',
      state_region: 'Puerto Rico',
      mapbox_place_id: `${LOCAL_ID_PREFIX}72051`,
    });
    expect(typeof value.latitude).toBe('number');
    // Round-trips through the profile column (mapbox_place_id) used to restore the field.
    expect(localLocationFromId(value.mapbox_place_id)).toEqual(value);
    expect(localLocationFromId('local:pr-municipio:99999')).toBeNull();
    expect(localLocationFromId('dXJuOm1ieHBsYzpBb1M0')).toBeNull(); // a Mapbox id is not local
  });
});

test.describe('provider failure classification and wording', () => {
  test('HTTP statuses map to distinct kinds (403 is NOT a connection problem)', () => {
    expect(failureKindFromStatus(403)).toBe('denied');
    expect(failureKindFromStatus(401)).toBe('denied');
    expect(failureKindFromStatus(429)).toBe('rate-limited');
    expect(failureKindFromStatus(500)).toBe('server');
    expect(failureKindFromStatus(503)).toBe('server');
  });

  test('only a real offline failure mentions the connection', () => {
    for (const kind of ['denied', 'rate-limited', 'server', 'not-configured'] as const) {
      expect(describeProviderFailure(kind, false).message).not.toMatch(/connection|internet/i);
      expect(describeProviderFailure(kind, true).message).not.toMatch(/connection|internet/i);
    }
    expect(describeProviderFailure('offline', false).message).toMatch(/internet connection/i);
    expect(describeProviderFailure('offline', false).tone).toBe('error');
  });

  test('with local results the notice is informational, not an error', () => {
    const n = describeProviderFailure('denied', true);
    expect(n.tone).toBe('info');
    expect(n.message).toMatch(/Puerto Rico municipalities/);
  });

  test('without local results the error tells the resident what to try', () => {
    const n = describeProviderFailure('denied', false);
    expect(n.tone).toBe('error');
    expect(n.message).toMatch(/Dorado/);
  });
});
