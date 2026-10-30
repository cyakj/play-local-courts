// Pure rules that keep the Report Issue form bound to the community it was loaded for. Route params (amenity
// context) are only valid inside the community they were opened from; a community switch, or a slow load for a
// previous community, must never combine one community's id with another's amenity.

export interface ReportRouteContext {
  courtId: string | null;
  courtName: string | null;
  facilityType: string | null;
}

export const EMPTY_REPORT_CONTEXT: ReportRouteContext = { courtId: null, courtName: null, facilityType: null };

/** Route amenity context is honored only while the active community is the one it was opened under. */
export function resolveReportContext(
  route: ReportRouteContext,
  contextHoaId: string | null,
  activeHoaId: string | null,
): ReportRouteContext {
  if (!route.courtId) return EMPTY_REPORT_CONTEXT;
  if (contextHoaId && activeHoaId && contextHoaId !== activeHoaId) return EMPTY_REPORT_CONTEXT;
  return route;
}

/** True once the loaded data belongs to the community that is active right now. */
export function isReportReady(loadedHoaId: string, activeHoaId: string | null | undefined, loading: boolean): boolean {
  // An unresolved/absent active community is never "ready": the form must not guess a community.
  return !loading && !!loadedHoaId && !!activeHoaId && loadedHoaId === activeHoaId;
}

// maintenance_reports.category has a CHECK constraint (migration 20260529115108) that only allows these keys.
// Facility forms offer finer-grained choices; they map onto the persisted set (same mapping that migration used for
// its legacy rows) and the specific choice is kept in the description so management still sees it.
export const PERSISTED_REPORT_CATEGORIES = [
  'plumbing', 'electrical', 'structural', 'grounds_landscaping', 'equipment', 'safety', 'other',
] as const;

const FACILITY_TO_PERSISTED: Record<string, (typeof PERSISTED_REPORT_CATEGORIES)[number]> = {
  surface: 'equipment',
  net: 'equipment',
  lighting: 'electrical',
  fence_gate: 'structural',
  cleanliness: 'grounds_landscaping',
  water_quality: 'plumbing',
  deck_area: 'structural',
  furniture: 'equipment',
  climate_control: 'equipment',
  tv_audio: 'equipment',
  access: 'structural',
};

export function toPersistedCategory(key: string): (typeof PERSISTED_REPORT_CATEGORIES)[number] {
  if ((PERSISTED_REPORT_CATEGORIES as readonly string[]).includes(key)) return key as (typeof PERSISTED_REPORT_CATEGORIES)[number];
  return FACILITY_TO_PERSISTED[key] ?? 'other';
}

/** Keeps the specific facility issue visible when it had to be mapped onto a broader persisted category. */
export function describeReport(key: string, label: string | undefined, description: string): string {
  const text = description.trim();
  return toPersistedCategory(key) !== key && label ? `[${label}] ${text}` : text;
}
