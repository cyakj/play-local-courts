-- Enable realtime for hoa_applications table
ALTER TABLE public.hoa_applications REPLICA IDENTITY FULL;

-- Add to realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE public.hoa_applications;