
-- Check if RLS policies exist for match_preferences table and add them if missing
DO $$
BEGIN
    -- Check if policies already exist, if not create them
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'match_preferences' 
        AND policyname = 'Users can view their own match preferences'
    ) THEN
        CREATE POLICY "Users can view their own match preferences"
        ON public.match_preferences
        FOR SELECT
        USING (auth.uid() = user_id);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'match_preferences' 
        AND policyname = 'Users can insert their own match preferences'
    ) THEN
        CREATE POLICY "Users can insert their own match preferences"
        ON public.match_preferences
        FOR INSERT
        WITH CHECK (auth.uid() = user_id);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'match_preferences' 
        AND policyname = 'Users can update their own match preferences'
    ) THEN
        CREATE POLICY "Users can update their own match preferences"
        ON public.match_preferences
        FOR UPDATE
        USING (auth.uid() = user_id);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'match_preferences' 
        AND policyname = 'Users can delete their own match preferences'
    ) THEN
        CREATE POLICY "Users can delete their own match preferences"
        ON public.match_preferences
        FOR DELETE
        USING (auth.uid() = user_id);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'match_preferences' 
        AND policyname = 'Users can view others active match preferences'
    ) THEN
        CREATE POLICY "Users can view others active match preferences"
        ON public.match_preferences
        FOR SELECT
        USING (looking_to_play = true);
    END IF;
END $$;
