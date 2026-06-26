-- Safe additive migration: add nullable package_id to lesson_requests
-- ON DELETE SET NULL means deleting a package never breaks existing lesson requests
ALTER TABLE public.lesson_requests
  ADD COLUMN IF NOT EXISTS package_id UUID
    REFERENCES public.lesson_packages(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_lesson_requests_package_id
  ON public.lesson_requests(package_id);
