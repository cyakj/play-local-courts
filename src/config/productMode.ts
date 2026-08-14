// Single source of truth for which product mode this build runs in.
// Set EXPO_PUBLIC_PRODUCT_MODE=community for The Greens / HOA-only launches.
// Omit or set to anything else for the full TenisX tennis product.
// Disabled-mode screens/routes are never deleted — only hidden from navigation.
export type ProductMode = 'community' | 'tennis';

export const PRODUCT_MODE: ProductMode =
  process.env.EXPO_PUBLIC_PRODUCT_MODE === 'community' ? 'community' : 'tennis';

export const isCommunityMode = PRODUCT_MODE === 'community';
export const isTennisMode = PRODUCT_MODE === 'tennis';
