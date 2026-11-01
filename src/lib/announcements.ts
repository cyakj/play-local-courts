import { db } from '@/lib/untypedDb';
import { isMissingColumnError } from '@/lib/communityTime';
import { normalizeCategory, type AnnouncementRow } from '@/lib/announcementsCore';

export * from '@/lib/announcementsCore';

/**
 * Announcements of ONE community (RLS already limits residents to their own approved community and audience), newest first.
 * Tolerates a server without is_urgent/category: then every row is general and not urgent.
 */
export async function fetchAnnouncements(hoaId: string, limit: number): Promise<{ rows: AnnouncementRow[]; error: { message: string } | null }> {
  const full = await db.from('hoa_announcements')
    .select('id, title, body, created_at, is_urgent, category')
    .eq('hoa_id', hoaId).order('created_at', { ascending: false }).limit(limit);
  let data = full.data as Record<string, unknown>[] | null;
  let error = full.error;
  if (error && isMissingColumnError(error)) {
    const legacy = await db.from('hoa_announcements')
      .select('id, title, body, created_at')
      .eq('hoa_id', hoaId).order('created_at', { ascending: false }).limit(limit);
    data = legacy.data as Record<string, unknown>[] | null;
    error = legacy.error;
  }
  if (error) return { rows: [], error: { message: error.message } };
  return {
    error: null,
    rows: (data ?? []).map((r) => ({
      id: r.id as string, title: r.title as string, body: r.body as string, created_at: (r.created_at as string | null) ?? null,
      isUrgent: r.is_urgent === true,
      category: normalizeCategory(r.category),
    })),
  };
}
