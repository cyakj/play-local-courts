import type { ImageSourcePropType } from 'react-native';

// Per-community logo resolution, in priority order:
//   1. `hoas.logo_url`  — the community's own uploaded logo (preferred; set it and
//                         no app release is needed).
//   2. BUNDLED_COMMUNITY_LOGOS below — a stop-gap for communities whose logo ships
//                         with the app before it has been uploaded.
//   3. Text fallback    — the community name (what The Greens uses today).
//
// Keys are `hoas.id` (exact, rename-proof). Nothing here is a default: a community
// that is not listed never receives another community's logo.
export const BUNDLED_COMMUNITY_LOGOS: Record<string, ImageSourcePropType> = {
  // Dorado Beach (hoas.name = "DBE")
  'f222b3de-2e6b-4f5e-999b-a7fcdd9750ae': require('@/assets/branding/dorado-beach-logo.png'),
  // The Greens sits inside Dorado Beach. The schema has NO parent-brand relation (hoas has only logo_url, no
  // parent_id / brand_id), so until one exists the parent's artwork is mapped per community id here. FUTURE SCHEMA
  // REQUIREMENT: hoas.parent_brand_id -> brands(id, name, logo_url) so new communities inherit a parent logo without
  // an app release. A community's own hoas.logo_url always wins over this table.
  'cb6a0752-dee0-4a01-b74a-6fb25f47de98': require('@/assets/branding/dorado-beach-logo.png'),
};

export function bundledLogoFor(hoaId: string | null | undefined): ImageSourcePropType | null {
  if (!hoaId) return null;
  return BUNDLED_COMMUNITY_LOGOS[hoaId] ?? null;
}
