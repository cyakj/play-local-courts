// Pure decisions for the header account menu (V1-010). Roles always come from the backend (user_roles) via the same
// routing predicates the app already uses to pick a shell at sign-in, so the menu can never offer a shell the
// account is not entitled to. Each shell's own layout guard still re-validates on arrival.
import { isCMRoutable, isCoachRoutable, isPlatformReviewerRoutable } from '@/lib/roleRouting';

export type ShellKey = 'platform' | 'cm' | 'coach' | 'resident';

export interface Shell {
  key: ShellKey;
  label: string;
  href: string;
}

const LABEL: Record<ShellKey, string> = {
  platform: 'TenisX Platform',
  cm: 'HOA Manager',
  coach: 'Coach',
  resident: 'Resident',
};
const HREF: Record<ShellKey, string> = {
  platform: '/(platform)',
  cm: '/(cm)',
  coach: '/(coach)',
  resident: '/(resident)',
};

/** Shells this account may enter. `hasApprovedMembership` gates the resident shell (a manager with no home is not a resident). */
export function availableShells(roles: string[], hasApprovedMembership: boolean): Shell[] {
  const keys: ShellKey[] = [];
  if (isPlatformReviewerRoutable(roles)) keys.push('platform');
  if (isCMRoutable(roles)) keys.push('cm');
  if (isCoachRoutable(roles)) keys.push('coach');
  if (hasApprovedMembership) keys.push('resident');
  return keys.map((key) => ({ key, label: LABEL[key], href: HREF[key] }));
}

export function currentShell(firstSegment: string | undefined): ShellKey | null {
  switch (firstSegment) {
    case '(platform)': return 'platform';
    case '(cm)': return 'cm';
    case '(admin)': return 'cm';
    case '(coach)': return 'coach';
    case '(resident)': return 'resident';
    default: return null;
  }
}

export const showSwitchCommunity = (approvedCommunityCount: number) => approvedCommunityCount > 1;
export const showSwitchRole = (shells: Shell[]) => shells.length > 1;
