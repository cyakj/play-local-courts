const RAW_TOKEN = process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN;

export const MAPBOX_ACCESS_TOKEN = RAW_TOKEN && RAW_TOKEN.length > 0 ? RAW_TOKEN : null;

export const isMapboxConfigured = MAPBOX_ACCESS_TOKEN !== null;

export const MAPBOX_SEARCH_BASE_URL = 'https://api.mapbox.com/search/searchbox/v1';

if (!isMapboxConfigured && __DEV__) {
  // eslint-disable-next-line no-console
  console.warn(
    '[mapbox] EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN is not set — location autocomplete is disabled. ' +
    'Add it to your .env file to enable it.',
  );
}
