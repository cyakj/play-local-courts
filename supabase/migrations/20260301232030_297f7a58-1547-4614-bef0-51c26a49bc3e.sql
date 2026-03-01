
-- Allow authenticated users to insert into ladder_teams when they are one of the players
CREATE POLICY "Players can join ladder teams"
ON public.ladder_teams
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = player1_id OR auth.uid() = player2_id
);
