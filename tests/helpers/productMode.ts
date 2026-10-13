/**
 * Product mode the app under test was built with. Mirrors src/config/productMode.ts:
 * EXPO_PUBLIC_PRODUCT_MODE=community → HOA-only build; anything else → full tennis product.
 * playwright.config.ts loads .env, and a variable already set in the shell wins, so a
 * tennis-mode run is: start Expo with EXPO_PUBLIC_PRODUCT_MODE=tennis and run the specs
 * with the same variable and PLAYWRIGHT_BASE_URL pointing at that server.
 */
export const PRODUCT_MODE: 'community' | 'tennis' =
  process.env.EXPO_PUBLIC_PRODUCT_MODE === 'community' ? 'community' : 'tennis';
export const isCommunityMode = PRODUCT_MODE === 'community';
export const isTennisMode = PRODUCT_MODE === 'tennis';
