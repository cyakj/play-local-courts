-- ============================================================================
-- CRITICAL SECURITY FIX: Implement Proper Role-Based Access Control
-- ============================================================================

-- Phase 1: Create Proper User Roles System
-- ============================================================================

-- Step 1.1: Create app_role enum
CREATE TYPE public.app_role AS ENUM ('admin', 'resident', 'coach');

-- Step 1.2: Create user_roles table
CREATE TABLE public.user_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    role app_role NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    created_by UUID REFERENCES auth.users(id),
    UNIQUE (user_id, role)
);

-- Enable RLS on user_roles
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- RLS policies for user_roles
CREATE POLICY "Users can view their own roles"
ON public.user_roles
FOR SELECT
USING (auth.uid() = user_id);

-- Step 1.3: Create security definer function to check roles (prevents recursive RLS)
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- Step 1.4: Migrate existing role data from profiles.hoa_role to user_roles
INSERT INTO public.user_roles (user_id, role, created_by)
SELECT 
  id,
  CASE 
    WHEN hoa_role = 'admin' THEN 'admin'::app_role
    WHEN hoa_role = 'coach' THEN 'coach'::app_role
    ELSE 'resident'::app_role
  END,
  id
FROM public.profiles
WHERE hoa_role IS NOT NULL
ON CONFLICT (user_id, role) DO NOTHING;

-- Phase 2: Fix Profile Data Access (CRITICAL - Prevents PII Exposure)
-- ============================================================================

-- Drop the dangerous "Users can view all profiles" policy
DROP POLICY IF EXISTS "Users can view all profiles" ON public.profiles;

-- Create granular profile access policies
CREATE POLICY "Users can view their own profile"
ON public.profiles
FOR SELECT
USING (auth.uid() = id);

CREATE POLICY "Users can view profiles in their HOA"
ON public.profiles
FOR SELECT
USING (
  EXISTS (
    SELECT 1 
    FROM public.profiles AS viewer 
    WHERE viewer.id = auth.uid() 
      AND viewer.hoa_id = profiles.hoa_id
      AND viewer.hoa_status = 'approved'
  )
);

CREATE POLICY "Admins can view profiles in their HOA"
ON public.profiles
FOR SELECT
USING (
  public.has_role(auth.uid(), 'admin') 
  AND EXISTS (
    SELECT 1 
    FROM public.profiles AS admin 
    WHERE admin.id = auth.uid() 
      AND admin.hoa_id = profiles.hoa_id
  )
);

-- Phase 3: Prevent Privilege Escalation via Profile Updates
-- ============================================================================

-- Drop existing update policy
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;

-- Create new update policy that prevents role manipulation
CREATE POLICY "Users can update their own profile (excluding roles)"
ON public.profiles
FOR UPDATE
USING (auth.uid() = id)
WITH CHECK (
  auth.uid() = id 
  -- Prevent users from changing their role or status
  AND (
    (SELECT hoa_role FROM public.profiles WHERE id = auth.uid()) = hoa_role
    OR hoa_role IS NULL
  )
  AND (
    (SELECT hoa_status FROM public.profiles WHERE id = auth.uid()) = hoa_status
    OR hoa_status IS NULL
  )
);

-- Phase 4: Fix All RLS Policies to Use has_role Function
-- ============================================================================

-- Fix amenity_rules policies
DROP POLICY IF EXISTS "HOA admins can manage their amenity rules" ON public.amenity_rules;
CREATE POLICY "HOA admins can manage their amenity rules"
ON public.amenity_rules
FOR ALL
USING (
  public.has_role(auth.uid(), 'admin')
  AND EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() 
      AND hoa_id = amenity_rules.hoa_id
  )
);

-- Fix courts policies
DROP POLICY IF EXISTS "Admins can manage courts in their HOA" ON public.courts;
CREATE POLICY "Admins can manage courts in their HOA"
ON public.courts
FOR ALL
USING (
  public.has_role(auth.uid(), 'admin')
  AND EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() 
      AND hoa_id = courts.hoa_id
  )
);

-- Fix court_maintenance policies
DROP POLICY IF EXISTS "Admins can manage maintenance in their HOA" ON public.court_maintenance;
CREATE POLICY "Admins can manage maintenance in their HOA"
ON public.court_maintenance
FOR ALL
USING (
  public.has_role(auth.uid(), 'admin')
  AND EXISTS (
    SELECT 1 
    FROM public.profiles
    JOIN public.courts ON courts.id = court_maintenance.court_id
    WHERE profiles.id = auth.uid() 
      AND profiles.hoa_id = courts.hoa_id
  )
);

-- Fix bookings admin view policy
DROP POLICY IF EXISTS "Admins can view all bookings in their HOA" ON public.bookings;
CREATE POLICY "Admins can view all bookings in their HOA"
ON public.bookings
FOR SELECT
USING (
  public.has_role(auth.uid(), 'admin')
  AND EXISTS (
    SELECT 1 
    FROM public.profiles
    JOIN public.courts ON courts.id = bookings.court_id
    WHERE profiles.id = auth.uid() 
      AND profiles.hoa_id = courts.hoa_id
  )
);

-- Fix community_join_requests policies
DROP POLICY IF EXISTS "HOA admins can update requests for their communities" ON public.community_join_requests;
DROP POLICY IF EXISTS "HOA admins can view requests for their communities" ON public.community_join_requests;

CREATE POLICY "HOA admins can view requests for their communities"
ON public.community_join_requests
FOR SELECT
USING (
  public.has_role(auth.uid(), 'admin')
  AND EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid() 
      AND profiles.hoa_id = community_join_requests.hoa_id
  )
);

CREATE POLICY "HOA admins can update requests for their communities"
ON public.community_join_requests
FOR UPDATE
USING (
  public.has_role(auth.uid(), 'admin')
  AND EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid() 
      AND profiles.hoa_id = community_join_requests.hoa_id
  )
);

-- Fix maintenance_reports policies
DROP POLICY IF EXISTS "HOA admins can view all reports for their HOA" ON public.maintenance_reports;
DROP POLICY IF EXISTS "HOA admins can update reports for their HOA" ON public.maintenance_reports;

CREATE POLICY "HOA admins can view all reports for their HOA"
ON public.maintenance_reports
FOR SELECT
USING (
  public.has_role(auth.uid(), 'admin')
  AND EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() 
      AND hoa_id = maintenance_reports.hoa_id
  )
);

CREATE POLICY "HOA admins can update reports for their HOA"
ON public.maintenance_reports
FOR UPDATE
USING (
  public.has_role(auth.uid(), 'admin')
  AND EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() 
      AND hoa_id = maintenance_reports.hoa_id
  )
);

-- Fix ladders policies
DROP POLICY IF EXISTS "Admins can create ladders in their HOA" ON public.ladders;
CREATE POLICY "Admins can create ladders in their HOA"
ON public.ladders
FOR INSERT
WITH CHECK (
  public.has_role(auth.uid(), 'admin')
  AND EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() 
      AND hoa_id = ladders.hoa_id
  )
);

-- Phase 5: Fix Database Function Security (Add search_path)
-- ============================================================================

-- Update create_community function
CREATE OR REPLACE FUNCTION public.create_community(
  community_name text,
  community_type text DEFAULT 'hoa'::text,
  community_address text DEFAULT NULL::text,
  logo_url text DEFAULT NULL::text,
  description text DEFAULT NULL::text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  new_hoa_id UUID;
BEGIN
  INSERT INTO public.hoas (name, community_type, address, logo_url, description, admin_id)
  VALUES (community_name, community_type, community_address, logo_url, description, auth.uid())
  RETURNING id INTO new_hoa_id;
  
  UPDATE public.profiles 
  SET hoa_id = new_hoa_id, 
      hoa_status = 'approved'
  WHERE id = auth.uid();
  
  -- Add admin role to user_roles
  INSERT INTO public.user_roles (user_id, role, created_by)
  VALUES (auth.uid(), 'admin', auth.uid())
  ON CONFLICT (user_id, role) DO NOTHING;
  
  RETURN new_hoa_id;
END;
$function$;

-- Update request_join_community function
CREATE OR REPLACE FUNCTION public.request_join_community(
  target_hoa_id uuid,
  join_message text DEFAULT NULL::text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  request_id UUID;
BEGIN
  INSERT INTO public.community_join_requests (user_id, hoa_id, message)
  VALUES (auth.uid(), target_hoa_id, join_message)
  RETURNING id INTO request_id;
  
  RETURN request_id;
END;
$function$;

-- Update other functions with search_path
CREATE OR REPLACE FUNCTION public.calculate_ladder_points(
  winner_games integer,
  loser_games integer,
  super_tiebreak boolean DEFAULT false
)
RETURNS integer
LANGUAGE plpgsql
SET search_path = public
AS $function$
BEGIN
  IF super_tiebreak THEN
    RETURN 250;
  END IF;
  
  CASE loser_games
    WHEN 0 THEN RETURN 600;
    WHEN 1 THEN RETURN 550;
    WHEN 2 THEN RETURN 500;
    WHEN 3 THEN RETURN 450;
    WHEN 4 THEN RETURN 400;
    WHEN 5 THEN RETURN 350;
    WHEN 6 THEN RETURN 300;
    ELSE RETURN 0;
  END CASE;
END;
$function$;

CREATE OR REPLACE FUNCTION public.generate_round_robin_matches(ladder_id_param uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  team_record RECORD;
  team_ids UUID[];
  i INTEGER;
  j INTEGER;
  round_num INTEGER := 1;
  match_count INTEGER := 0;
  ladder_start_date DATE;
  match_date DATE;
BEGIN
  SELECT start_date INTO ladder_start_date 
  FROM public.ladders 
  WHERE id = ladder_id_param;
  
  SELECT ARRAY_AGG(id ORDER BY created_at) INTO team_ids
  FROM public.ladder_teams
  WHERE ladder_id = ladder_id_param;
  
  FOR i IN 1..array_length(team_ids, 1) LOOP
    FOR j IN (i+1)..array_length(team_ids, 1) LOOP
      match_date := ladder_start_date + (round_num - 1) * INTERVAL '7 days';
      
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
        match_date + INTERVAL '6 days'
      );
      
      match_count := match_count + 1;
      round_num := round_num + 1;
    END LOOP;
  END LOOP;
  
  RETURN match_count;
END;
$function$;

-- Phase 6: Create admin management function
-- ============================================================================

CREATE OR REPLACE FUNCTION public.grant_admin_role(target_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only existing admins can grant admin role
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Only admins can grant admin privileges';
  END IF;
  
  INSERT INTO public.user_roles (user_id, role, created_by)
  VALUES (target_user_id, 'admin', auth.uid())
  ON CONFLICT (user_id, role) DO NOTHING;
  
  RETURN true;
END;
$$;