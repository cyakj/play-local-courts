-- Update the check constraint to include pending_partner status
ALTER TABLE public.ladder_registration_requests 
DROP CONSTRAINT IF EXISTS ladder_registration_requests_status_check;

ALTER TABLE public.ladder_registration_requests 
ADD CONSTRAINT ladder_registration_requests_status_check 
CHECK (status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text, 'pending_partner'::text]));

-- Add image_url column to ladders table for admin photos
ALTER TABLE public.ladders 
ADD COLUMN IF NOT EXISTS image_url text;

-- Fix RLS for ladder_invitations to allow users to invite partners
DROP POLICY IF EXISTS "Ladder admins can create invitations" ON public.ladder_invitations;
DROP POLICY IF EXISTS "Users can create partner invitations" ON public.ladder_invitations;

-- Allow users to create invitations (for partner invites)
CREATE POLICY "Users can create partner invitations" 
ON public.ladder_invitations 
FOR INSERT 
WITH CHECK (auth.uid() = invited_by);