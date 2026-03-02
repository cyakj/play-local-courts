
CREATE OR REPLACE FUNCTION public.generate_round_robin_matches(ladder_id_param uuid)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  team_ids UUID[];
  i INTEGER;
  j INTEGER;
  round_num INTEGER := 1;
  match_count INTEGER := 0;
  ladder_start_date DATE;
  ladder_play_by_days INTEGER;
  match_date DATE;
BEGIN
  SELECT start_date, COALESCE(play_by_deadline_days, 7) 
  INTO ladder_start_date, ladder_play_by_days
  FROM public.ladders 
  WHERE id = ladder_id_param;
  
  SELECT ARRAY_AGG(id ORDER BY created_at) INTO team_ids
  FROM public.ladder_teams
  WHERE ladder_id = ladder_id_param;
  
  FOR i IN 1..array_length(team_ids, 1) LOOP
    FOR j IN (i+1)..array_length(team_ids, 1) LOOP
      match_date := ladder_start_date + (round_num - 1) * (ladder_play_by_days * INTERVAL '1 day');
      
      INSERT INTO public.ladder_matches (
        ladder_id, 
        team1_id, 
        team2_id, 
        round_number,
        scheduled_date,
        deadline_date
      ) VALUES (
        ladder_id_param,
        team_ids[i],
        team_ids[j],
        round_num,
        match_date,
        match_date + (ladder_play_by_days - 1) * INTERVAL '1 day'
      );
      
      match_count := match_count + 1;
      round_num := round_num + 1;
    END LOOP;
  END LOOP;
  
  RETURN match_count;
END;
$function$;
