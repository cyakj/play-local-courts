import { db } from '@/lib/untypedDb';
import { COMMUNITY_TIME_ZONE, isMissingColumnError, isValidTimeZone } from '@/lib/communityTime';

/**
 * Reservation time zone of each given community (hoas.timezone, migration 20261031100000), for manager portfolio screens that
 * span several communities. A server WITHOUT the column (legacy) answers Puerto Rico for every community; a community with no
 * zone yet (column present, NULL) also uses Puerto Rico for display math only - reservations there are refused by the database.
 * Any other read failure throws so the screen shows its normal error state instead of silently using the wrong zone.
 */
export async function loadHoaZones(hoaIds: readonly string[]): Promise<Map<string, string>> {
  const zones = new Map<string, string>();
  if (hoaIds.length === 0) return zones;
  const res = await db.from('hoas').select('id, timezone').in('id', [...hoaIds]);
  if (res.error) {
    if (isMissingColumnError(res.error)) { hoaIds.forEach((id) => zones.set(id, COMMUNITY_TIME_ZONE)); return zones; }
    throw res.error;
  }
  for (const id of hoaIds) zones.set(id, COMMUNITY_TIME_ZONE);
  for (const row of (res.data ?? []) as { id: string; timezone: string | null }[]) {
    if (isValidTimeZone(row.timezone)) zones.set(row.id, row.timezone);
  }
  return zones;
}
