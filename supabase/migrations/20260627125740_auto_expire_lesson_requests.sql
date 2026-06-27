-- Auto-expire pending lesson requests whose preferred time has passed.
--
-- Creates a function + pg_cron job that runs every 15 minutes.
-- Falls back gracefully if pg_cron is not available (just the function is created).
-- The client-side hook also handles expiration on fetch for reliability.

create or replace function expire_past_lesson_requests()
returns void
language plpgsql
security definer
as $$
begin
  update lesson_requests
  set
    status       = 'expired',
    responded_at = now()
  where
    status        = 'pending'
    and (preferred_date || 'T' || preferred_time_start)::timestamptz < now();
end;
$$;

-- Schedule if pg_cron extension is available
do $$
begin
  if exists (
    select 1 from pg_extension where extname = 'pg_cron'
  ) then
    perform cron.schedule(
      'expire-lesson-requests',
      '*/15 * * * *',
      'select expire_past_lesson_requests()'
    );
  end if;
end;
$$;

-- Index to make the expiration query fast
create index if not exists idx_lesson_requests_pending_date
  on lesson_requests (status, preferred_date, preferred_time_start)
  where status = 'pending';
