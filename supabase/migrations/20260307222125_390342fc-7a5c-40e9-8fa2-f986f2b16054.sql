-- Add condo_manager to the app_role enum
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'condo_manager';

-- Clean up leftover worker functions that reference dropped tables
DROP FUNCTION IF EXISTS public.is_own_worker(uuid);
DROP FUNCTION IF EXISTS public.is_worker_in_admin_hoa(uuid);