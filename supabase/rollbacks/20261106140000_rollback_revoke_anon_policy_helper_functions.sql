-- Restores the previous (default) grants: anon may execute these helpers again. Re-runnable.
DO $$
DECLARE f text;
BEGIN
  FOREACH f IN ARRAY ARRAY[
    'public.has_role(uuid, public.app_role)','public.is_admin_in_same_hoa(uuid, uuid)','public.is_hoa_affiliated(uuid)',
    'public.is_in_same_hoa(uuid, uuid)','public.can_create_ladder(uuid, uuid)','public.can_view_ladder_row(uuid, uuid, uuid)',
    'public._is_listing_creator(uuid)','public._is_listing_participant(uuid)','public._listing_open_for_join(uuid)','public._listing_readable(uuid)'
  ] LOOP
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO anon', f);
  END LOOP;
END $$;
