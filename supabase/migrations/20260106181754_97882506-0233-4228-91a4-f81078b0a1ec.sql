-- Add NTRP rating to profiles for skill enforcement
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS ntrp_rating numeric;

-- Add ladder registration settings
ALTER TABLE public.ladders
ADD COLUMN IF NOT EXISTS auto_approve_registration boolean DEFAULT false;

-- Create ladder registration requests table for player self-registration
CREATE TABLE IF NOT EXISTS public.ladder_registration_requests (
    id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    ladder_id uuid NOT NULL REFERENCES public.ladders(id) ON DELETE CASCADE,
    player_id uuid NOT NULL,
    partner_id uuid,
    team_name text NOT NULL,
    status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    looking_for_partner boolean DEFAULT false,
    message text,
    admin_notes text,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS on ladder_registration_requests
ALTER TABLE public.ladder_registration_requests ENABLE ROW LEVEL SECURITY;

-- Players can view their own registration requests
CREATE POLICY "Users can view their own registration requests"
ON public.ladder_registration_requests
FOR SELECT
USING (auth.uid() = player_id OR auth.uid() = partner_id);

-- Ladder admins can view all requests for their ladders
CREATE POLICY "Ladder admins can view registration requests"
ON public.ladder_registration_requests
FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM public.ladders l
        WHERE l.id = ladder_id AND l.admin_id = auth.uid()
    )
);

-- Players can create registration requests
CREATE POLICY "Users can create registration requests"
ON public.ladder_registration_requests
FOR INSERT
WITH CHECK (auth.uid() = player_id);

-- Players can update their own pending requests
CREATE POLICY "Users can update their own pending requests"
ON public.ladder_registration_requests
FOR UPDATE
USING (auth.uid() = player_id AND status = 'pending');

-- Ladder admins can update any request for their ladders
CREATE POLICY "Ladder admins can update registration requests"
ON public.ladder_registration_requests
FOR UPDATE
USING (
    EXISTS (
        SELECT 1 FROM public.ladders l
        WHERE l.id = ladder_id AND l.admin_id = auth.uid()
    )
);

-- Players can delete their own pending requests
CREATE POLICY "Users can delete their own pending requests"
ON public.ladder_registration_requests
FOR DELETE
USING (auth.uid() = player_id AND status = 'pending');

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_ladder_registration_requests_ladder_id 
ON public.ladder_registration_requests(ladder_id);

CREATE INDEX IF NOT EXISTS idx_ladder_registration_requests_player_id 
ON public.ladder_registration_requests(player_id);

CREATE INDEX IF NOT EXISTS idx_ladder_registration_requests_status 
ON public.ladder_registration_requests(status);

-- Create index on profiles for NTRP filtering
CREATE INDEX IF NOT EXISTS idx_profiles_ntrp_rating 
ON public.profiles(ntrp_rating);

-- Create index on profiles for ZIP code filtering
CREATE INDEX IF NOT EXISTS idx_profiles_zip_code 
ON public.profiles(zip_code);