-- Rollback of 20261101100000_announcement_urgency_and_category.sql. Drops the urgency/category metadata (announcement titles/bodies are untouched).
ALTER TABLE public.hoa_announcements DROP CONSTRAINT IF EXISTS hoa_announcements_category_check;
ALTER TABLE public.hoa_announcements DROP COLUMN IF EXISTS category;
ALTER TABLE public.hoa_announcements DROP COLUMN IF EXISTS is_urgent;
