// Pure rules for the administrator "Post an announcement" screen. No React / Supabase: unit tested in Node.
import { isMissingColumnError } from '@/lib/communityTime';

export type AnnouncementCategory = 'general' | 'maintenance' | 'service';
export const ANNOUNCEMENT_CATEGORIES: { value: AnnouncementCategory; label: string }[] = [
  { value: 'general', label: 'General' },
  { value: 'maintenance', label: 'Maintenance' },
  { value: 'service', label: 'Service' },
];

export const TITLE_MAX = 120;
export const BODY_MAX = 2000;

export interface Draft { title: string; body: string; urgent: boolean; category: AnnouncementCategory }

/** First problem with the draft as a sentence for the administrator, or null when it can be posted. */
export function validateDraft(d: Draft): string | null {
  const title = d.title.trim();
  const body = d.body.trim();
  if (!title) return 'Enter a title.';
  if (title.length > TITLE_MAX) return `Keep the title under ${TITLE_MAX} characters.`;
  if (!body) return 'Enter the message residents should read.';
  if (body.length > BODY_MAX) return `Keep the message under ${BODY_MAX} characters.`;
  return null;
}

/**
 * Columns to insert. `is_urgent` / `category` (migration 20261101100000) are sent ONLY when they differ from the defaults, so an
 * ordinary notice still posts on a server that does not have them yet.
 */
export function buildInsert(d: Draft, hoaId: string, userId: string): Record<string, unknown> {
  return {
    hoa_id: hoaId, created_by: userId, title: d.title.trim(), body: d.body.trim(),
    ...(d.urgent ? { is_urgent: true } : {}),
    ...(d.category !== 'general' ? { category: d.category } : {}),
  };
}

/** Wording for a failed post. Never claims success; names the missing database update instead of a raw column error. */
export function postErrorMessage(err: { code?: string; message?: string } | null | undefined, d: Draft): string {
  if (!err) return 'Could not post the announcement.';
  if (isMissingColumnError(err) && (d.urgent || d.category !== 'general')) {
    return 'Marking an announcement urgent or choosing a category needs a database update that has not been applied yet. Post it as a general notice, or try again after the update.';
  }
  if (/row-level security|permission|42501/i.test(`${err.code ?? ''} ${err.message ?? ''}`)) {
    return 'You do not have permission to post announcements for this community.';
  }
  return err.message || 'Could not post the announcement.';
}

/** Wording for a failed removal. */
export function removeErrorMessage(err: { code?: string; message?: string } | null | undefined): string {
  if (!err) return 'Could not remove the announcement.';
  const text = `${err.code ?? ''} ${err.message ?? ''}`;
  if (err.code === 'PGRST202' || /could not find the function|archive_announcement.*does not exist|42883/i.test(text)) {
    return 'Removing announcements needs a database update that has not been applied yet.';
  }
  if (/42501|only community administrators/i.test(text)) return 'Only community administrators can remove announcements.';
  return err.message || 'Could not remove the announcement.';
}
