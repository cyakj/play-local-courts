-- Create hoa_memberships table for many-to-many user-HOA relationships
CREATE TABLE public.hoa_memberships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  hoa_id UUID NOT NULL REFERENCES public.hoas(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'resident' CHECK (role IN ('resident', 'admin')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  is_primary BOOLEAN NOT NULL DEFAULT false,
  last_active_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, hoa_id)
);

-- Create index for faster lookups
CREATE INDEX idx_hoa_memberships_user_id ON public.hoa_memberships(user_id);
CREATE INDEX idx_hoa_memberships_hoa_id ON public.hoa_memberships(hoa_id);
CREATE INDEX idx_hoa_memberships_user_status ON public.hoa_memberships(user_id, status);

-- Enable RLS
ALTER TABLE public.hoa_memberships ENABLE ROW LEVEL SECURITY;

-- Users can view their own memberships
CREATE POLICY "Users can view their own memberships"
ON public.hoa_memberships FOR SELECT
USING (auth.uid() = user_id);

-- HOA admins can view memberships in their HOAs
CREATE POLICY "HOA admins can view community memberships"
ON public.hoa_memberships FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.hoa_memberships m
    WHERE m.hoa_id = hoa_memberships.hoa_id
    AND m.user_id = auth.uid()
    AND m.role = 'admin'
    AND m.status = 'approved'
  )
);

-- Users can insert their own pending memberships (join requests)
CREATE POLICY "Users can request to join communities"
ON public.hoa_memberships FOR INSERT
WITH CHECK (
  auth.uid() = user_id 
  AND status = 'pending'
  AND role = 'resident'
);

-- Users can update their own membership (e.g., set primary, update last_active)
CREATE POLICY "Users can update their own memberships"
ON public.hoa_memberships FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (
  auth.uid() = user_id
  -- Users cannot change their own status or role
  AND status = (SELECT status FROM public.hoa_memberships WHERE id = hoa_memberships.id)
  AND role = (SELECT role FROM public.hoa_memberships WHERE id = hoa_memberships.id)
);

-- HOA admins can update memberships in their HOAs (approve/reject)
CREATE POLICY "HOA admins can manage community memberships"
ON public.hoa_memberships FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.hoa_memberships m
    WHERE m.hoa_id = hoa_memberships.hoa_id
    AND m.user_id = auth.uid()
    AND m.role = 'admin'
    AND m.status = 'approved'
  )
);

-- Users can delete their own pending memberships (cancel join request)
CREATE POLICY "Users can cancel their own pending requests"
ON public.hoa_memberships FOR DELETE
USING (auth.uid() = user_id AND status = 'pending');

-- Create trigger for updated_at
CREATE TRIGGER update_hoa_memberships_updated_at
BEFORE UPDATE ON public.hoa_memberships
FOR EACH ROW
EXECUTE FUNCTION public.handle_updated_at();

-- Function to migrate existing users to hoa_memberships
CREATE OR REPLACE FUNCTION public.migrate_existing_hoa_memberships()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Insert memberships for all users who have an hoa_id
  INSERT INTO public.hoa_memberships (user_id, hoa_id, role, status, is_primary)
  SELECT 
    id as user_id,
    hoa_id,
    COALESCE(hoa_role, 'resident') as role,
    COALESCE(hoa_status, 'pending') as status,
    true as is_primary
  FROM public.profiles
  WHERE hoa_id IS NOT NULL
  ON CONFLICT (user_id, hoa_id) DO NOTHING;
END;
$$;

-- Run the migration
SELECT public.migrate_existing_hoa_memberships();

-- Function to set active HOA
CREATE OR REPLACE FUNCTION public.set_active_hoa(target_hoa_id UUID)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Verify user has approved membership in this HOA
  IF NOT EXISTS (
    SELECT 1 FROM public.hoa_memberships
    WHERE user_id = auth.uid()
    AND hoa_id = target_hoa_id
    AND status = 'approved'
  ) THEN
    RAISE EXCEPTION 'User does not have approved membership in this HOA';
  END IF;

  -- Update last_active_at for the selected HOA
  UPDATE public.hoa_memberships
  SET last_active_at = now(), is_primary = true
  WHERE user_id = auth.uid() AND hoa_id = target_hoa_id;

  -- Remove primary flag from other memberships
  UPDATE public.hoa_memberships
  SET is_primary = false
  WHERE user_id = auth.uid() AND hoa_id != target_hoa_id;

  RETURN true;
END;
$$;

-- Function to request joining an HOA
CREATE OR REPLACE FUNCTION public.request_hoa_membership(target_hoa_id UUID, join_message TEXT DEFAULT NULL)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  new_membership_id UUID;
BEGIN
  -- Check if membership already exists
  IF EXISTS (
    SELECT 1 FROM public.hoa_memberships
    WHERE user_id = auth.uid() AND hoa_id = target_hoa_id
  ) THEN
    RAISE EXCEPTION 'Membership already exists for this HOA';
  END IF;

  -- Insert new pending membership
  INSERT INTO public.hoa_memberships (user_id, hoa_id, role, status)
  VALUES (auth.uid(), target_hoa_id, 'resident', 'pending')
  RETURNING id INTO new_membership_id;

  -- Also create a community_join_request for backward compatibility
  INSERT INTO public.community_join_requests (user_id, hoa_id, message, status)
  VALUES (auth.uid(), target_hoa_id, join_message, 'pending')
  ON CONFLICT DO NOTHING;

  RETURN new_membership_id;
END;
$$;

-- Function to approve HOA membership
CREATE OR REPLACE FUNCTION public.approve_hoa_membership(membership_id UUID)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  target_hoa_id UUID;
  target_user_id UUID;
BEGIN
  -- Get membership details
  SELECT hoa_id, user_id INTO target_hoa_id, target_user_id
  FROM public.hoa_memberships
  WHERE id = membership_id;

  -- Verify caller is admin of this HOA
  IF NOT EXISTS (
    SELECT 1 FROM public.hoa_memberships
    WHERE user_id = auth.uid()
    AND hoa_id = target_hoa_id
    AND role = 'admin'
    AND status = 'approved'
  ) THEN
    RAISE EXCEPTION 'Only HOA admins can approve memberships';
  END IF;

  -- Approve the membership
  UPDATE public.hoa_memberships
  SET status = 'approved', updated_at = now()
  WHERE id = membership_id;

  -- Also update community_join_requests for backward compatibility
  UPDATE public.community_join_requests
  SET status = 'approved', updated_at = now()
  WHERE user_id = target_user_id AND hoa_id = target_hoa_id;

  RETURN true;
END;
$$;

-- Function to reject HOA membership
CREATE OR REPLACE FUNCTION public.reject_hoa_membership(membership_id UUID)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  target_hoa_id UUID;
  target_user_id UUID;
BEGIN
  -- Get membership details
  SELECT hoa_id, user_id INTO target_hoa_id, target_user_id
  FROM public.hoa_memberships
  WHERE id = membership_id;

  -- Verify caller is admin of this HOA
  IF NOT EXISTS (
    SELECT 1 FROM public.hoa_memberships
    WHERE user_id = auth.uid()
    AND hoa_id = target_hoa_id
    AND role = 'admin'
    AND status = 'approved'
  ) THEN
    RAISE EXCEPTION 'Only HOA admins can reject memberships';
  END IF;

  -- Reject the membership
  UPDATE public.hoa_memberships
  SET status = 'rejected', updated_at = now()
  WHERE id = membership_id;

  -- Also update community_join_requests for backward compatibility
  UPDATE public.community_join_requests
  SET status = 'rejected', updated_at = now()
  WHERE user_id = target_user_id AND hoa_id = target_hoa_id;

  RETURN true;
END;
$$;