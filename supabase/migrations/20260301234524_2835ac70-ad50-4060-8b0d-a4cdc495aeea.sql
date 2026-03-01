
-- Allow users to see ladders they are on a team for
CREATE POLICY "Users can view ladders they participate in"
  ON public.ladders FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM ladder_teams
      WHERE ladder_teams.ladder_id = ladders.id
        AND (ladder_teams.player1_id = auth.uid() OR ladder_teams.player2_id = auth.uid())
    )
  );

-- Allow users to see ladders they have pending registration for
CREATE POLICY "Users can view ladders they registered for"
  ON public.ladders FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM ladder_registration_requests
      WHERE ladder_registration_requests.ladder_id = ladders.id
        AND ladder_registration_requests.player_id = auth.uid()
    )
  );

-- Allow users to see ladders they were invited to
CREATE POLICY "Users can view ladders they were invited to"
  ON public.ladders FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM ladder_invitations
      WHERE ladder_invitations.ladder_id = ladders.id
        AND ladder_invitations.invited_user_id = auth.uid()
    )
  );

-- Allow team members to see their own teams regardless of HOA
CREATE POLICY "Players can view their own teams"
  ON public.ladder_teams FOR SELECT
  USING (player1_id = auth.uid() OR player2_id = auth.uid());

-- Allow match participants to see their matches regardless of HOA
CREATE POLICY "Players can view their own matches"
  ON public.ladder_matches FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM ladder_teams t
      WHERE (t.id = ladder_matches.team1_id OR t.id = ladder_matches.team2_id)
        AND (t.player1_id = auth.uid() OR t.player2_id = auth.uid())
    )
  );
