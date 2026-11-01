// Pure announcement helpers (no Supabase import) so Node tests can run them.

export type AnnouncementCategory = 'general' | 'maintenance' | 'service';

export interface AnnouncementRow {
  id: string;
  title: string;
  body: string;
  created_at: string | null;
  /** From hoa_announcements.is_urgent (migration 20261101100000). Absent on a server without the column: never inferred from text. */
  isUrgent: boolean;
  category: AnnouncementCategory;
}

export function normalizeCategory(raw: unknown): AnnouncementCategory {
  return raw === 'maintenance' || raw === 'service' ? raw : 'general';
}

export function categoryLabel(c: AnnouncementCategory): string | null {
  return c === 'maintenance' ? 'Maintenance' : c === 'service' ? 'Service' : null;
}

/** The ONE announcement the Home "Community Pulse" shows: urgent first, otherwise the newest. */
export function pickPulseAnnouncement<T extends { isUrgent: boolean; created_at: string | null }>(rows: readonly T[]): T | null {
  if (rows.length === 0) return null;
  const time = (r: T) => (r.created_at ? new Date(r.created_at).getTime() : 0);
  return [...rows].sort((a, b) => Number(b.isUrgent) - Number(a.isUrgent) || time(b) - time(a))[0];
}
