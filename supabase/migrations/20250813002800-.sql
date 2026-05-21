-- Fix RLS issues by enabling RLS on all public tables that don't have it yet
ALTER TABLE public.likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.referral_leaderboard ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.match_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tournament_registrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tournaments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clubs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Add basic RLS policies for the new tables
-- Likes policies
CREATE POLICY "Users can create their own likes" ON public.likes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can view likes" ON public.likes FOR SELECT USING (true);
CREATE POLICY "Users can delete their own likes" ON public.likes FOR DELETE USING (auth.uid() = user_id);

-- Comments policies
CREATE POLICY "Users can create their own comments" ON public.comments FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can view comments" ON public.comments FOR SELECT USING (true);
CREATE POLICY "Users can update their own comments" ON public.comments FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own comments" ON public.comments FOR DELETE USING (auth.uid() = user_id);

-- Posts policies
CREATE POLICY "Users can create their own posts" ON public.posts FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can view posts" ON public.posts FOR SELECT USING (true);
CREATE POLICY "Users can update their own posts" ON public.posts FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own posts" ON public.posts FOR DELETE USING (auth.uid() = user_id);

-- Match requests policies
CREATE POLICY "Users can create match requests" ON public.match_requests FOR INSERT WITH CHECK (auth.uid() = challenger_id);
CREATE POLICY "Users can view match requests where they are involved" ON public.match_requests FOR SELECT USING (auth.uid() = challenger_id OR auth.uid() = opponent_id);
CREATE POLICY "Users can update match requests where they are involved" ON public.match_requests FOR UPDATE USING (auth.uid() = challenger_id OR auth.uid() = opponent_id);

-- Matches policies
CREATE POLICY "Users can view matches where they participate" ON public.matches FOR SELECT USING (auth.uid() IN (player1_id, player2_id, player3_id, player4_id));
CREATE POLICY "Users can create matches where they participate" ON public.matches FOR INSERT WITH CHECK (auth.uid() IN (player1_id, player2_id, player3_id, player4_id));
CREATE POLICY "Users can update matches where they participate" ON public.matches FOR UPDATE USING (auth.uid() IN (player1_id, player2_id, player3_id, player4_id));

-- Tournament policies
CREATE POLICY "Users can view tournaments" ON public.tournaments FOR SELECT USING (true);

-- Tournament registrations policies
CREATE POLICY "Users can register for tournaments" ON public.tournament_registrations FOR INSERT WITH CHECK (auth.uid() = player_id);
CREATE POLICY "Users can view their own registrations" ON public.tournament_registrations FOR SELECT USING (auth.uid() = player_id);

-- Profiles policies
CREATE POLICY "Users can view all profiles" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Users can update their own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- Clubs policies
CREATE POLICY "Users can view clubs" ON public.clubs FOR SELECT USING (true);
CREATE POLICY "Users can create clubs" ON public.clubs FOR INSERT WITH CHECK (auth.uid() = profile_id);
CREATE POLICY "Users can update their own clubs" ON public.clubs FOR UPDATE USING (auth.uid() = profile_id);

-- Referrals policies
CREATE POLICY "Users can view referrals" ON public.referrals FOR SELECT USING (true);

-- Referral leaderboard policies
CREATE POLICY "Users can view referral leaderboard" ON public.referral_leaderboard FOR SELECT USING (true);