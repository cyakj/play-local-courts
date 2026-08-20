// Shared role-based routing logic. Used by every entry point that decides
// which top-level shell (CM portfolio / coach / resident) a signed-in user
// lands in, so the "which roles route where" rule only lives in one place.
import { isCommunityMode } from '@/config/productMode';

const CM_ROLES = ['admin', 'condo_manager', 'manager', 'hoa_manager', 'board_admin'];

export function isCMRoutable(roles: string[]): boolean {
  return roles.some((r) => CM_ROLES.includes(r));
}

// The coach shell is a tennis-product concept — in Community mode a `coach`
// role never routes there, even if the account has the role.
export function isCoachRoutable(roles: string[]): boolean {
  return roles.includes('coach') && !isCommunityMode;
}
