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

// TenisX staff who review community registrations (user_roles.platform_reviewer). The role can only be
// granted by TenisX staff in the database (guard_platform_reviewer_role trigger), never from the app.
// Checked FIRST: a platform reviewer lands in the (platform) shell, not a community shell.
export function isPlatformReviewerRoutable(roles: string[]): boolean {
  return roles.includes('platform_reviewer');
}
