-- Enable Supabase Realtime for platform reviewer queue tables

-- Ensure UPDATE events include full row data
ALTER TABLE public.hoa_applications REPLICA IDENTITY FULL;
ALTER TABLE public.hoa_application_notes REPLICA IDENTITY FULL;

-- Add tables to realtime publication if not already present
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'hoa_applications'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.hoa_applications';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'hoa_application_notes'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.hoa_application_notes';
  END IF;
END $$;