/** Node-only migration and routing checks; no browser, network or database. */
import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const read = (path: string) => readFileSync(join(__dirname, '..', path), 'utf8');
const previous = read('supabase/migrations/20261013110000_admin_blockouts_and_reservation_workflow.sql');
const sql = read('supabase/migrations/20261023100000_admin_booking_review_notifications.sql');
const screen = read('src/lib/notificationView.ts'); // route table moved out of the screen into the pure helper
const body = sql.match(/AS \$function\$([\s\S]*?)\$function\$;/)![1];

function checkTypes(source: string): string[] {
  const list = source.match(/CHECK\s*\(type = ANY\s*\(ARRAY\[([\s\S]*?)\]::text\[\]\)\)/)![1];
  return [...list.matchAll(/'([^']+)'/g)].map((m) => m[1]);
}

test.describe('admin booking review notifications', () => {
  test('preserves every existing notification type and adds only review needed', () => {
    expect(checkTypes(sql).sort()).toEqual([...checkTypes(previous), 'booking_review_needed'].sort());
    expect(sql).toContain('DROP CONSTRAINT IF EXISTS hoa_notifications_type_check');
  });

  test('only pending inserts trigger admin notifications', () => {
    expect(sql).toMatch(/DROP TRIGGER IF EXISTS trg_notify_admins_booking_review ON public\.bookings;/);
    expect(sql).toMatch(/CREATE TRIGGER trg_notify_admins_booking_review\s+AFTER INSERT ON public\.bookings\s+FOR EACH ROW WHEN \(NEW\.status = 'pending'\)\s+EXECUTE FUNCTION public\.notify_admins_on_booking_review\(\);/);
    expect(body).not.toMatch(/confirmed|cancelled|UPDATE|DELETE/i);
    expect(sql.match(/CREATE TRIGGER/g)).toHaveLength(1);
  });

  test('targets approved admins in the amenity community and excludes the booker', () => {
    expect(body).toMatch(/SELECT name, hoa_id INTO amenity_name, amenity_hoa_id FROM public\.courts WHERE id = NEW\.court_id/);
    expect(body).toMatch(/FROM public\.hoa_memberships m/);
    expect(body).toMatch(/m\.hoa_id = amenity_hoa_id/);
    expect(body).toMatch(/m\.role = 'admin'/);
    expect(body).toMatch(/m\.status = 'approved'/);
    expect(body).toMatch(/m\.user_id <> NEW\.user_id/);
    expect(body).toMatch(/SELECT m\.user_id, amenity_hoa_id, 'booking_review_needed'/);
  });

  test('secures the trigger function and deduplicates each admin and booking', () => {
    expect(sql).toMatch(/CREATE OR REPLACE FUNCTION public\.notify_admins_on_booking_review\(\)\s+RETURNS trigger\s+LANGUAGE plpgsql\s+SECURITY DEFINER\s+SET search_path TO 'public'/);
    expect(sql).toContain('REVOKE ALL ON FUNCTION public.notify_admins_on_booking_review() FROM PUBLIC, anon, authenticated;');
    expect(body).toMatch(/INSERT INTO public\.hoa_notifications \([^)]*dedupe_key\)/);
    expect(body).toContain("'admin_booking_review:' || NEW.id::text || ':' || m.user_id::text");
    expect(body).toContain('ON CONFLICT (user_id, dedupe_key) WHERE dedupe_key IS NOT NULL DO NOTHING');
  });

  test('includes the resident, amenity, formatted time and manager metadata', () => {
    expect(body).toContain("NULLIF(btrim(full_name), '')");
    expect(body).toContain("COALESCE(resident_name, 'A resident') || ' requested ' || COALESCE(amenity_name, 'Amenity')");
    expect(body).toContain("' on ' || when_txt || '.'");
    expect(body).toContain("to_char(NEW.date, 'FMMon FMDD')");
    expect(body).toContain("to_char(NEW.start_time, 'FMHH12:MI AM')");
    expect(body).toContain("'Reservation needs approval'");
    expect(body).toContain("jsonb_build_object('booking_id', NEW.id, 'court_id', NEW.court_id, 'route', '/(admin)/manage-amenities')");
  });

  test('routes review notifications to management and preserves resident booking routes', () => {
    const routes = screen.match(/const FALLBACK_ROUTE: Record<string, string> = \{([\s\S]*?)\};/)![1];
    expect(routes).toMatch(/booking_review_needed: '\/\(admin\)\/manage-amenities'/);
    for (const type of ['pending', 'confirmed', 'cancelled', 'rejected', 'reminder']) {
      expect(routes).toContain(`booking_${type}: '/my-reservations'`);
    }
    expect(screen).toContain('return FALLBACK_ROUTE[type] ?? null;');
  });
});
