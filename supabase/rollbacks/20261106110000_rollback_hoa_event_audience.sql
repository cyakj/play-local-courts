-- Rollback for 20261106110000_hoa_event_audience.sql: restores the original resident policy (every active event visible to approved
-- members) and drops the column. WARNING: any event stored as audience='board' becomes visible to residents the moment the policy is
-- restored. Delete or cancel such events first (UPDATE public.hoa_events SET status='cancelled' WHERE audience='board').
DROP POLICY IF EXISTS "Residents view community events" ON public.hoa_events;
CREATE POLICY "Residents view community events" ON public.hoa_events FOR SELECT TO authenticated USING (
  status = 'active' AND EXISTS (SELECT 1 FROM public.hoa_memberships WHERE user_id = auth.uid() AND hoa_id = hoa_events.hoa_id AND status = 'approved')
);
ALTER TABLE public.hoa_events DROP CONSTRAINT IF EXISTS hoa_events_audience_check;
ALTER TABLE public.hoa_events DROP COLUMN IF EXISTS audience;
