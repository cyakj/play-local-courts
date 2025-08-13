-- Create maintenance_reports table for the new reporting system
CREATE TABLE public.maintenance_reports (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  hoa_id UUID NOT NULL,
  amenity_id UUID NOT NULL,
  reporter_id UUID NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('lighting', 'surface_net', 'gate_access', 'plumbing', 'cleaning', 'other')),
  description TEXT NOT NULL,
  photo_url TEXT,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'resolved')),
  assignee TEXT,
  admin_notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.maintenance_reports ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can create their own reports" 
ON public.maintenance_reports 
FOR INSERT 
WITH CHECK (auth.uid() = reporter_id);

CREATE POLICY "Users can view their own reports" 
ON public.maintenance_reports 
FOR SELECT 
USING (auth.uid() = reporter_id);

CREATE POLICY "HOA admins can view all reports for their HOA" 
ON public.maintenance_reports 
FOR SELECT 
USING (EXISTS (
  SELECT 1 FROM profiles 
  WHERE profiles.id = auth.uid() 
  AND profiles.hoa_id = maintenance_reports.hoa_id 
  AND profiles.hoa_role = 'admin'
));

CREATE POLICY "HOA admins can update reports for their HOA" 
ON public.maintenance_reports 
FOR UPDATE 
USING (EXISTS (
  SELECT 1 FROM profiles 
  WHERE profiles.id = auth.uid() 
  AND profiles.hoa_id = maintenance_reports.hoa_id 
  AND profiles.hoa_role = 'admin'
));

-- Create trigger for updated_at
CREATE TRIGGER update_maintenance_reports_updated_at
BEFORE UPDATE ON public.maintenance_reports
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at();

-- Create indexes for performance
CREATE INDEX idx_maintenance_reports_hoa_id ON public.maintenance_reports(hoa_id);
CREATE INDEX idx_maintenance_reports_amenity_id ON public.maintenance_reports(amenity_id);
CREATE INDEX idx_maintenance_reports_status ON public.maintenance_reports(status);
CREATE INDEX idx_maintenance_reports_created_at ON public.maintenance_reports(created_at);