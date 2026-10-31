// Pure rules for the Notifications list (no React / Supabase).
//
// Findings from the real data (2026-10-29 restore): most "duplicate-looking" rows are DIFFERENT events whose stored text is
// generic ("A new report was submitted", "Booking confirmed") - they refer to different reports / bookings. A few are the
// same event written twice within seconds. So: collapse only true duplicates (same type, same target, same text, close in
// time), and describe every row with what it is actually about.

export type NotificationKind = 'booking' | 'report' | 'member' | 'announcement' | 'other';

export function kindOf(type: string): NotificationKind {
  if (type.startsWith('booking')) return 'booking';
  if (type.startsWith('report')) return 'report';
  if (type.startsWith('member') || type.startsWith('membership')) return 'member';
  if (type === 'announcement' || type === 'survey_published') return 'announcement';
  return 'other';
}

// ── Navigation ───────────────────────────────────────────────────────────────

const UUID = '[0-9a-fA-F-]{36}';
const SAFE_ROUTE = new RegExp(`^/(reservation-detail/${UUID}|report-detail/${UUID}|my-reservations|my-reports|announcements)$`);
const UUID_ONLY = new RegExp(`^${UUID}$`);

const FALLBACK_ROUTE: Record<string, string> = {
  booking_review_needed: '/(admin)/manage-amenities',
  booking_pending: '/my-reservations', booking_confirmed: '/my-reservations', booking_cancelled: '/my-reservations',
  booking_rejected: '/my-reservations', booking_reminder: '/my-reservations',
  report_status_changed: '/my-reports', report_update: '/my-reports', report_unresolved: '/my-reports',
  announcement: '/announcements',
};

const REPORT_DETAIL_TYPES = new Set(['report_status_changed', 'report_update', 'report_unresolved', 'report_submitted']);
const RESERVATION_DETAIL_TYPES = new Set(['booking_pending', 'booking_confirmed', 'booking_rejected', 'booking_cancelled', 'booking_reminder']);

/** An explicit deep link (only the allowlisted in-app destinations), else the list screen for the type, else null. */
export function safeNotificationRoute(route: unknown, type: string): string | null {
  if (typeof route === 'string' && SAFE_ROUTE.test(route)) return route;
  return FALLBACK_ROUTE[type] ?? null;
}

/**
 * Where a tap goes. Preference: an allowlisted explicit route; else the detail screen derived from the ids the
 * notification carries (works without any database migration); else the list screen for the type; else nowhere.
 */
export function notificationRoute(type: string, metadata: Record<string, unknown> | null | undefined): string | null {
  // Management review requests also carry a booking_id and may carry a resident route: they always go to management.
  if (type === 'booking_review_needed') return FALLBACK_ROUTE[type];
  const explicit = metadata?.route;
  if (typeof explicit === 'string' && SAFE_ROUTE.test(explicit)) return explicit;
  const reportId = metadata?.report_id;
  const bookingId = metadata?.booking_id;
  if (REPORT_DETAIL_TYPES.has(type) && typeof reportId === 'string' && UUID_ONLY.test(reportId)) return `/report-detail/${reportId}`;
  // booking_review_needed is for MANAGEMENT (it also carries a booking_id) and must not open the resident's reservation screen.
  if (RESERVATION_DETAIL_TYPES.has(type) && typeof bookingId === 'string' && UUID_ONLY.test(bookingId)) return `/reservation-detail/${bookingId}`;
  return FALLBACK_ROUTE[type] ?? null;
}

// ── De-duplication ───────────────────────────────────────────────────────────

export interface ListItem {
  id: string;
  /** Every source row folded into this item (always includes `id`). */
  ids: string[];
  type: string;
  title: string;
  body: string;
  createdAt: string;
  read: boolean;
  metadata: Record<string, unknown> | null;
  /** How many identical rows were folded in (1 = none). */
  count: number;
}

export function targetKey(metadata: Record<string, unknown> | null | undefined): string {
  const m = metadata ?? {};
  return String(m.report_id ?? m.booking_id ?? m.membership_id ?? m.applicant_id ?? '');
}

export const DUPLICATE_WINDOW_MS = 2 * 60 * 1000;

/**
 * Folds rows that are the SAME event written more than once: same type, same target, same text, within the window of the
 * newest row of the group. Rows about different targets are never folded, however similar their text. Input order is kept
 * (newest first); the folded item keeps the newest row's time and is unread if ANY folded row is unread.
 */
export function collapseDuplicates(items: ListItem[], windowMs: number = DUPLICATE_WINDOW_MS): ListItem[] {
  const out: ListItem[] = [];
  for (const it of items) {
    const target = targetKey(it.metadata);
    // No verified target (announcements, surveys, metadata-free rows): two rows with the same text may be two real events.
    if (target === '') { out.push({ ...it, ids: [...it.ids] }); continue; }
    const key = `${it.type}|${target}|${it.title}|${it.body}`;
    const prev = out.find((o) => targetKey(o.metadata) !== '' && `${o.type}|${targetKey(o.metadata)}|${o.title}|${o.body}` === key
      && Math.abs(new Date(o.createdAt).getTime() - new Date(it.createdAt).getTime()) <= windowMs);
    if (prev) {
      prev.ids.push(...it.ids);
      prev.count += it.count;
      prev.read = prev.read && it.read;
      continue;
    }
    out.push({ ...it, ids: [...it.ids] });
  }
  return out;
}

// ── Describing a row ─────────────────────────────────────────────────────────

export interface ReportFacts { where: string | null; category: string }
export interface BookingFacts { court: string; date: string; start: string; end: string }

function fmt12(t: string): string {
  const [h, m] = t.split(':').map(Number);
  return `${h % 12 || 12}:${String(m ?? 0).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`;
}

export function bookingLine(b: BookingFacts): string {
  const [y, mo, d] = b.date.split('-').map(Number);
  const day = new Date(y, mo - 1, d).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  return `${b.court} · ${day} · ${fmt12(b.start)} – ${fmt12(b.end)}`;
}

export function reportLine(r: ReportFacts): string {
  return r.where ? `${r.where} · ${r.category}` : r.category;
}

// ── Time ─────────────────────────────────────────────────────────────────────

export function timeAgo(iso: string, nowMs: number = Date.now()): string {
  const mins = Math.floor((nowMs - new Date(iso).getTime()) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

/** Section header for a day: Today / Yesterday / "Mon, Oct 27". Local calendar days. */
export function dayLabel(iso: string, now: Date = new Date()): string {
  const d = new Date(iso);
  const start = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diffDays = Math.round((start(now) - start(d)) / 86400000);
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', ...(d.getFullYear() !== now.getFullYear() ? { year: 'numeric' } : {}) });
}

export interface Section<T> { label: string; items: T[] }

export function groupByDay<T extends { createdAt: string }>(items: T[], now: Date = new Date()): Section<T>[] {
  const sections: Section<T>[] = [];
  for (const it of items) {
    const label = dayLabel(it.createdAt, now);
    const last = sections[sections.length - 1];
    if (last && last.label === label) last.items.push(it);
    else sections.push({ label, items: [it] });
  }
  return sections;
}
