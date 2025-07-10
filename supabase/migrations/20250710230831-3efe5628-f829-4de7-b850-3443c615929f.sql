-- Add user_type field to profiles table to distinguish between HOA and non-HOA users
ALTER TABLE public.profiles 
ADD COLUMN user_type text DEFAULT 'hoa' CHECK (user_type IN ('hoa', 'non_hoa', 'coach'));

-- Update existing users to have the correct user_type
UPDATE public.profiles 
SET user_type = CASE 
  WHEN hoa_role = 'coach' THEN 'coach'
  WHEN hoa_id IS NULL THEN 'non_hoa'
  ELSE 'hoa'
END;