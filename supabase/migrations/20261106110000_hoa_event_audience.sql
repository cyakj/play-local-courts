-- Board-only events (executive / internal sessions).   NOT APPLIED to hosted (TENISX REAL).
--
-- hoa_events had no way to say "not for residents": the resident SELECT policy exposed EVERY active event of the community,
-- including board meetings, to every approved member. This adds an `audience` column and tightens ONLY the resident SELECT policy.
--   'residents' (default): visible to approved members, exactly as before -> every existing row keeps its current visibility.
--   'board':               visible only to community administrators (their existing "Admins manage events" FOR ALL policy).
--
-- RLS CHANGE (narrowing, by design): replaces policy "Residents view community events". A rollback restores the original.
-- Additive column with a default; nothing is back-filled. The resident app does not reference the column (RLS does the filtering),
-- so it works before and after this migration. The administrator app sends `audience` only when "Board only" is switched on.
-- Depends on: public.hoa_events, public.hoa_memberships. No dependency on any other pending migration.

ALTER TABLE public.hoa_events
  ADD COLUMN IF NOT EXISTS audience text NOT NULL DEFAULT 'residents';

ALTER TABLE public.hoa_events DROP CONSTRAINT IF EXISTS hoa_events_audience_check;
ALTER TABLE public.hoa_events
  ADD CONSTRAINT hoa_events_audience_check CHECK (audience IN ('residents', 'board'));

DROP POLICY IF EXISTS "Residents view community events" ON public.hoa_events;
CREATE POLICY "Residents view community events" ON public.hoa_events FOR SELECT TO authenticated USING (
  status = 'active'
  AND audience = 'residents'
  AND EXISTS (
    SELECT 1 FROM public.hoa_memberships
    WHERE user_id = auth.uid() AND hoa_id = hoa_events.hoa_id AND status = 'approved'
  )
);
