-- Run on a database with all migrations applied (including 20261106140000). Prints PASS/FAIL lines, rolls back.
begin;
create temp table t_results(name text, ok boolean);
grant all on t_results to public;
do $$
declare f text; r record; n int := 0; bad int := 0;
begin
  -- 1. anon cannot execute the ten helpers; authenticated can
  foreach f in array array['public.has_role(uuid, public.app_role)','public.is_admin_in_same_hoa(uuid, uuid)','public.is_hoa_affiliated(uuid)','public.is_in_same_hoa(uuid, uuid)','public.can_create_ladder(uuid, uuid)','public.can_view_ladder_row(uuid, uuid, uuid)','public._is_listing_creator(uuid)','public._is_listing_participant(uuid)','public._listing_open_for_join(uuid)','public._listing_readable(uuid)'] loop
    insert into t_results values ('anon cannot execute '||f, not has_function_privilege('anon', f, 'execute'));
    insert into t_results values ('authenticated still executes '||f, has_function_privilege('authenticated', f, 'execute'));
  end loop;
  -- 2. anon can still read every table it could before without a permission error (no function-privilege regression)
  set local role anon;
  for r in select c.relname from pg_class c join pg_namespace s on s.oid=c.relnamespace where s.nspname='public' and c.relkind in ('r','v') and has_table_privilege('anon', c.oid, 'select') loop
    begin
      execute format('select 1 from public.%I limit 1', r.relname);
      n := n + 1;
    exception when insufficient_privilege then bad := bad + 1; raise notice 'anon permission error on %: %', r.relname, sqlerrm;
              when others then null;
    end;
  end loop;
  reset role;
  insert into t_results values ('anon reads of '||n||' tables raise no permission error ('||bad||' bad)', bad = 0);
end $$;
select case when ok then 'PASS ' else 'FAIL ' end || name from t_results;
select 'failures='||count(*) filter (where not ok)||' total='||count(*) from t_results;
rollback;
