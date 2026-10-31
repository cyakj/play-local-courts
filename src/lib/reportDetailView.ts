// Pure presentation rules for the resident Report Detail screen (no React / Supabase).
// Pills carry their OWN light tint and dark text, so they stay readable on both the light and dark themes.

export interface Pill { bg: string; fg: string; label: string }

const GRAY: Pill = { bg: '#F2F4F7', fg: '#475467', label: '' };

export function statusPill(status: string): Pill {
  switch (status) {
    case 'open':
    case 'accepted':    return { bg: '#FEE4E2', fg: '#B42318', label: 'Open' };
    case 'in_progress': return { bg: '#FEF0C7', fg: '#93370D', label: 'In progress' };
    case 'resolved':
    case 'completed':   return { bg: '#D1FADF', fg: '#05603A', label: 'Resolved' };
    case 'closed':      return { ...GRAY, label: 'Closed' };
    case 'reopened':    return { bg: '#FEE4E2', fg: '#B42318', label: 'Reopened' };
    default:            return { ...GRAY, label: status ? status.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase()) : 'Unknown' };
  }
}

export function severityPill(priority: string | null | undefined): Pill | null {
  switch ((priority ?? '').toLowerCase()) {
    case 'low':      return { bg: '#D1FADF', fg: '#05603A', label: 'Low severity' };
    case 'medium':   return { bg: '#FEF0C7', fg: '#93370D', label: 'Medium severity' };
    case 'high':     return { bg: '#FFE6D5', fg: '#9C2A10', label: 'High severity' };
    case 'critical': return { bg: '#FEE4E2', fg: '#B42318', label: 'Critical severity' };
    default:         return null;
  }
}

const CATEGORY_LABELS: Record<string, string> = {
  plumbing: 'Water & Plumbing',
  electrical: 'Lighting & Electrical',
  structural: 'Buildings & Structures',
  grounds_landscaping: 'Grounds & Landscaping',
  equipment: 'Amenities & Equipment',
  safety: 'Safety',
  other: 'Other',
};

export function categoryLabel(cat: string): string {
  return CATEGORY_LABELS[cat] ?? (cat ? cat.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase()) : 'Other');
}

export interface TitleInput { report_type: string; location_text: string | null; amenity_name: string | null; category: string }

/** Headline: the amenity or place the report is about; falls back to the category. */
export function reportTitle(r: TitleInput): string {
  if (r.report_type === 'location' && r.location_text) return r.location_text.length > 60 ? `${r.location_text.slice(0, 60)}…` : r.location_text;
  return r.amenity_name ?? (r.location_text && r.location_text.trim() ? r.location_text : categoryLabel(r.category));
}

/** Where it is: the amenity name, else the free-text location, else null (row is omitted). */
export function reportWhere(r: Pick<TitleInput, 'location_text' | 'amenity_name'>): string | null {
  return r.amenity_name ?? (r.location_text && r.location_text.trim() ? r.location_text.trim() : null);
}

export function fmtDateTime(iso: string): string {
  return new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
}

/** "Last updated" is only worth a row when it differs from the submission time. */
export function showUpdated(createdIso: string, updatedIso: string): boolean {
  return Math.abs(new Date(updatedIso).getTime() - new Date(createdIso).getTime()) > 60_000;
}
