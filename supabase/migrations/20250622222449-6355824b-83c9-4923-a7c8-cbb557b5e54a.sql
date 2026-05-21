
-- Extend the hoas table to support community types and additional metadata
ALTER TABLE public.hoas ADD COLUMN IF NOT EXISTS community_type TEXT DEFAULT 'hoa';
ALTER TABLE public.hoas ADD COLUMN IF NOT EXISTS logo_url TEXT;
ALTER TABLE public.hoas ADD COLUMN IF NOT EXISTS description TEXT;

-- Create a community_join_requests table for handling join requests
CREATE TABLE IF NOT EXISTS public.community_join_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  hoa_id UUID NOT NULL REFERENCES public.hoas(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  message TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, hoa_id)
);

-- Enable RLS on the community_join_requests table
ALTER TABLE public.community_join_requests ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for community_join_requests
CREATE POLICY "Users can view their own join requests" 
  ON public.community_join_requests 
  FOR SELECT 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own join requests" 
  ON public.community_join_requests 
  FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "HOA admins can view requests for their communities" 
  ON public.community_join_requests 
  FOR SELECT 
  USING (
    EXISTS (
      SELECT 1 FROM public.hoas 
      WHERE hoas.id = community_join_requests.hoa_id 
      AND hoas.admin_id = auth.uid()
    )
  );

CREATE POLICY "HOA admins can update requests for their communities" 
  ON public.community_join_requests 
  FOR UPDATE 
  USING (
    EXISTS (
      SELECT 1 FROM public.hoas 
      WHERE hoas.id = community_join_requests.hoa_id 
      AND hoas.admin_id = auth.uid()
    )
  );

-- Add trigger for updated_at timestamp
CREATE TRIGGER community_join_requests_updated_at
  BEFORE UPDATE ON public.community_join_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- Update the hoas table to allow public read access for community search
CREATE POLICY "Anyone can view community names for search" 
  ON public.hoas 
  FOR SELECT 
  USING (true);

-- Create a function to create a new community with the user as admin
CREATE OR REPLACE FUNCTION public.create_community(
  community_name TEXT,
  community_type TEXT DEFAULT 'hoa',
  community_address TEXT DEFAULT NULL,
  logo_url TEXT DEFAULT NULL,
  description TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  new_hoa_id UUID;
BEGIN
  -- Insert the new HOA/community
  INSERT INTO public.hoas (name, community_type, address, logo_url, description, admin_id)
  VALUES (community_name, community_type, community_address, logo_url, description, auth.uid())
  RETURNING id INTO new_hoa_id;
  
  -- Update the user's profile to be linked to this HOA and set as admin
  UPDATE public.profiles 
  SET hoa_id = new_hoa_id, 
      hoa_role = 'admin', 
      hoa_status = 'approved'
  WHERE id = auth.uid();
  
  RETURN new_hoa_id;
END;
$$;

-- Create a function to request to join a community
CREATE OR REPLACE FUNCTION public.request_join_community(
  target_hoa_id UUID,
  join_message TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  request_id UUID;
BEGIN
  -- Insert the join request
  INSERT INTO public.community_join_requests (user_id, hoa_id, message)
  VALUES (auth.uid(), target_hoa_id, join_message)
  RETURNING id INTO request_id;
  
  RETURN request_id;
END;
$$;
