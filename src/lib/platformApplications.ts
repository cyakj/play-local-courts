// Shared types/labels for the TenisX Platform Admin review flow (hoa_applications).

export type ApplicationStatus = 'pending' | 'needs_more_info' | 'approved' | 'rejected';

export interface HoaApplicationRow {
  id: string;
  applicant_id: string;
  hoa_name: string;
  community_location: string;
  estimated_residents: number;
  claimed_role: string;
  claimed_role_other: string | null;
  verification_documents: string[] | null;
  status: ApplicationStatus;
  submitted_at: string;
  reviewed_at: string | null;
  created_hoa_id?: string | null;
}

export const ROLE_LABEL: Record<string, string> = {
  board_member: 'Board member',
  property_manager: 'Property manager',
  administrator: 'Administrator',
  other: 'Other',
};

export function roleText(a: Pick<HoaApplicationRow, 'claimed_role' | 'claimed_role_other'>): string {
  return a.claimed_role === 'other' && a.claimed_role_other
    ? a.claimed_role_other
    : ROLE_LABEL[a.claimed_role] ?? a.claimed_role;
}
