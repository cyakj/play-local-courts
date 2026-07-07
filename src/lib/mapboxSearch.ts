import { MAPBOX_ACCESS_TOKEN, MAPBOX_SEARCH_BASE_URL } from '@/config/mapbox';

export type LocationSuggestion = {
  mapboxId: string;
  name: string;
  placeFormatted: string;
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

export function createSessionToken(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

export async function suggestLocations(
  query: string,
  sessionToken: string,
  signal: AbortSignal,
): Promise<LocationSuggestion[]> {
  if (!MAPBOX_ACCESS_TOKEN) return [];

  const params = new URLSearchParams({
    q: query,
    access_token: MAPBOX_ACCESS_TOKEN,
    session_token: sessionToken,
    language: 'en',
    limit: '6',
    types: 'place,locality,neighborhood,address,postcode,region',
  });

  const res = await fetch(`${MAPBOX_SEARCH_BASE_URL}/suggest?${params.toString()}`, { signal });
  if (!res.ok) {
    throw new Error(`Mapbox suggest failed with status ${res.status}`);
  }
  const json = await res.json();
  const suggestions = Array.isArray(json?.suggestions) ? json.suggestions : [];

  return suggestions.map((s: any) => ({
    mapboxId: s.mapbox_id,
    name: s.name ?? '',
    placeFormatted: s.place_formatted ?? s.full_address ?? '',
  }));
}

export async function retrieveLocation(
  mapboxId: string,
  sessionToken: string,
  signal: AbortSignal,
): Promise<LocationValue | null> {
  if (!MAPBOX_ACCESS_TOKEN) return null;

  const params = new URLSearchParams({
    access_token: MAPBOX_ACCESS_TOKEN,
    session_token: sessionToken,
  });

  const res = await fetch(`${MAPBOX_SEARCH_BASE_URL}/retrieve/${mapboxId}?${params.toString()}`, { signal });
  if (!res.ok) {
    throw new Error(`Mapbox retrieve failed with status ${res.status}`);
  }
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
