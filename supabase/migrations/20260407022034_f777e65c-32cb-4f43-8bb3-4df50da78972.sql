
-- Add invite columns to hoas table
ALTER TABLE public.hoas 
  ADD COLUMN IF NOT EXISTS invite_code VARCHAR UNIQUE,
  ADD COLUMN IF NOT EXISTS invite_enabled BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS invite_expires_at TIMESTAMPTZ;

-- Add joined_via_invite and invite_code_used to hoa_memberships
ALTER TABLE public.hoa_memberships
  ADD COLUMN IF NOT EXISTS joined_via_invite BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS invite_code_used VARCHAR;

-- Function to generate invite code from community name
CREATE OR REPLACE FUNCTION public.generate_invite_code(_name text)
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  slug text;
  suffix text;
  code text;
BEGIN
  -- Create slug from name
  slug := lower(regexp_replace(trim(_name), '[^a-zA-Z0-9]+', '-', 'g'));
  slug := trim(both '-' from slug);
  slug := left(slug, 20);
  -- Generate random 6-char alphanumeric suffix
  suffix := substr(md5(random()::text || clock_timestamp()::text), 1, 6);
  code := slug || '-' || suffix;
  RETURN code;
END;
$$;

-- Generate invite codes for existing communities that don't have one
UPDATE public.hoas
SET invite_code = public.generate_invite_code(name)
WHERE invite_code IS NULL;

-- Trigger to auto-generate invite_code on new community creation
CREATE OR REPLACE FUNCTION public.auto_generate_invite_code()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.invite_code IS NULL THEN
    NEW.invite_code := public.generate_invite_code(NEW.name);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_invite_code ON public.hoas;
CREATE TRIGGER trg_auto_invite_code
  BEFORE INSERT ON public.hoas
  FOR EACH ROW EXECUTE FUNCTION public.auto_generate_invite_code();

-- Function to regenerate invite code
CREATE OR REPLACE FUNCTION public.regenerate_invite_code(_hoa_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  community_name text;
  new_code text;
BEGIN
  IF NOT public.check_hoa_admin(auth.uid(), _hoa_id) THEN
    RAISE EXCEPTION 'Only HOA admins can regenerate invite codes';
  END IF;
  
  SELECT name INTO community_name FROM public.hoas WHERE id = _hoa_id;
  new_code := public.generate_invite_code(community_name);
  
  UPDATE public.hoas SET invite_code = new_code WHERE id = _hoa_id;
  RETURN new_code;
END;
$$;

-- RLS: allow anyone to read hoas by invite_code (for join flow)
CREATE POLICY "Anyone can read hoa by invite_code"
  ON public.hoas
  FOR SELECT
  USING (true);
