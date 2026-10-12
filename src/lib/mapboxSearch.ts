import { MAPBOX_ACCESS_TOKEN, MAPBOX_SEARCH_BASE_URL } from '@/config/mapbox';
import {
  LocationProviderError,
  failureKindFromStatus,
  type LocationSuggestion,
  type LocationValue,
} from '@/lib/locationSearch';

// fetch() rejects only when the request never completed (offline, DNS, TLS). An HTTP
// status is a provider answer and must not be reported as a connection problem.
async function providerFetch(url: string, signal: AbortSignal): Promise<Response> {
  let res: Response;
  try {
    res = await fetch(url, { signal });
  } catch (e: any) {
    if (e?.name === 'AbortError') throw e;
    throw new LocationProviderError('offline', 'Network request failed');
  }
  if (!res.ok) {
    throw new LocationProviderError(failureKindFromStatus(res.status), `Location provider responded ${res.status}`);
  }
  return res;
}

export type { LocationSuggestion, LocationValue } from '@/lib/locationSearch';

export function createSessionToken(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

export async function suggestLocations(
  query: string,
  sessionToken: string,
  signal: AbortSignal,
): Promise<LocationSuggestion[]> {
  if (!MAPBOX_ACCESS_TOKEN) throw new LocationProviderError('not-configured', 'Mapbox token not set');

  const params = new URLSearchParams({
    q: query,
    access_token: MAPBOX_ACCESS_TOKEN,
    session_token: sessionToken,
    language: 'en',
    limit: '6',
    types: 'place,locality,neighborhood,address,postcode,region',
  });

  const res = await providerFetch(`${MAPBOX_SEARCH_BASE_URL}/suggest?${params.toString()}`, signal);
  const json = await res.json();
  const suggestions = Array.isArray(json?.suggestions) ? json.suggestions : [];

  return suggestions.map((s: any) => ({
    mapboxId: s.mapbox_id,
    name: s.name ?? '',
    placeFormatted: s.place_formatted ?? s.full_address ?? '',
    source: 'mapbox' as const,
  }));
}

export async function retrieveLocation(
  mapboxId: string,
  sessionToken: string,
  signal: AbortSignal,
): Promise<LocationValue | null> {
  if (!MAPBOX_ACCESS_TOKEN) throw new LocationProviderError('not-configured', 'Mapbox token not set');

  const params = new URLSearchParams({
    access_token: MAPBOX_ACCESS_TOKEN,
    session_token: sessionToken,
  });

  const res = await providerFetch(`${MAPBOX_SEARCH_BASE_URL}/retrieve/${mapboxId}?${params.toString()}`, signal);
  const json = await res.json();
  const feature = json?.features?.[0];
  if (!feature) return null;

  const [longitude, latitude] = feature.geometry?.coordinates ?? [null, null];
  if (typeof latitude !== 'number' || typeof longitude !== 'number') return null;

  const context = feature.properties?.context ?? {};

  return {
    display_name: feature.properties?.name_preferred ?? feature.properties?.name ?? feature.properties?.full_address ?? '',
    city: context.place?.name ?? context.locality?.name ?? null,
    state_region: context.region?.name ?? null,
    country: context.country?.name ?? null,
    latitude,
    longitude,
    mapbox_place_id: feature.properties?.mapbox_id ?? mapboxId,
  };
}
