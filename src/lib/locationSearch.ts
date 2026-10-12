// Location search model shared by the Mapbox provider and the bundled Puerto Rico
// fallback. Pure (no React Native / network imports) so it runs in Node tests.
import { PUERTO_RICO_MUNICIPIOS } from '@/data/puertoRicoMunicipios';

export type LocationSuggestion = {
  mapboxId: string;
  name: string;
  placeFormatted: string;
  source?: 'mapbox' | 'local';
};

export type LocationValue = {
  display_name: string;
  city: string | null;
  state_region: string | null;
  country: string | null;
  latitude: number;
  longitude: number;
  mapbox_place_id: string;
};

/** Why the online provider could not answer — each needs different wording for the resident. */
export type ProviderFailure = 'offline' | 'denied' | 'rate-limited' | 'server' | 'not-configured';

export class LocationProviderError extends Error {
  constructor(public kind: ProviderFailure, message: string) {
    super(message);
    this.name = 'LocationProviderError';
  }
}

export function failureKindFromStatus(status: number): ProviderFailure {
  if (status === 401 || status === 403) return 'denied';   // bad/restricted token — not the user's connection
  if (status === 429) return 'rate-limited';
  return 'server';
}

export const LOCAL_ID_PREFIX = 'local:pr-municipio:';
export const isLocalLocationId = (id: string) => id.startsWith(LOCAL_ID_PREFIX);

export function normalizeText(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/,?\s*(puerto rico|pr)\s*$/i, '')
    .replace(/[^a-z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Search the 78 Puerto Rico municipios (accent- and case-insensitive; prefix matches first). */
export function searchLocalLocations(query: string, limit = 6): LocationSuggestion[] {
  const q = normalizeText(query);
  if (q.length < 2) return [];
  const scored: { score: number; name: string; geoid: string }[] = [];
  for (const m of PUERTO_RICO_MUNICIPIOS) {
    const n = normalizeText(m.name);
    let score = -1;
    if (n === q) score = 0;
    else if (n.startsWith(q)) score = 1;
    else if (n.split(' ').some((w) => w.startsWith(q))) score = 2;
    else if (n.includes(q)) score = 3;
    if (score >= 0) scored.push({ score, name: m.name, geoid: m.geoid });
  }
  scored.sort((a, b) => a.score - b.score || a.name.localeCompare(b.name, 'es'));
  return scored.slice(0, limit).map((s) => ({
    mapboxId: `${LOCAL_ID_PREFIX}${s.geoid}`,
    name: s.name,
    placeFormatted: 'Puerto Rico',
    source: 'local' as const,
  }));
}

export function localLocationFromId(id: string): LocationValue | null {
  if (!isLocalLocationId(id)) return null;
  const geoid = id.slice(LOCAL_ID_PREFIX.length);
  const m = PUERTO_RICO_MUNICIPIOS.find((x) => x.geoid === geoid);
  if (!m) return null;
  return {
    display_name: m.name,
    city: m.name,
    state_region: 'Puerto Rico',
    country: 'United States',
    latitude: m.lat,
    longitude: m.lng,
    mapbox_place_id: id,
  };
}

export interface FailureNotice {
  tone: 'info' | 'error';
  message: string;
}

/** Resident-facing wording. Only a real connectivity failure may mention the connection. */
export function describeProviderFailure(kind: ProviderFailure, hasLocalResults: boolean): FailureNotice {
  if (hasLocalResults) {
    return {
      tone: 'info',
      message: kind === 'offline'
        ? 'You appear to be offline. Showing Puerto Rico municipalities saved in the app.'
        : 'Full address search is unavailable right now. Showing Puerto Rico municipalities.',
    };
  }
  if (kind === 'offline') {
    return { tone: 'error', message: 'Can’t reach the location service. Check your internet connection and try again.' };
  }
  if (kind === 'rate-limited') {
    return { tone: 'error', message: 'Location search is busy. Wait a moment and try again.' };
  }
  return {
    tone: 'error',
    message: 'Location search is temporarily unavailable. Try typing your municipality name, for example “Dorado”.',
  };
}
