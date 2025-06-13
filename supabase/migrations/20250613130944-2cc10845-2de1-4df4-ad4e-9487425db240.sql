
-- Create the amenity_rules table to store custom rules for each amenity
CREATE TABLE public.amenity_rules (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  hoa_id UUID NOT NULL,
  amenity_id UUID NOT NULL,
  
  -- Booking time windows
  booking_start_time TIME DEFAULT '07:00:00',
  booking_end_time TIME DEFAULT '21:00:00',
  
  -- Duration and frequency limits
  max_duration_minutes INTEGER DEFAULT 60,
  max_reservations_per_day INTEGER DEFAULT 1,
  max_reservations_per_week INTEGER DEFAULT 3,
  min_time_between_reservations INTEGER DEFAULT 0, -- in minutes
  
  -- Advance booking
  advance_booking_days INTEGER DEFAULT 7,
  
  -- Guest and check-in policies
  allow_guests BOOLEAN DEFAULT true,
  checkin_required_minutes INTEGER DEFAULT 15,
  
  -- Cancellation policies
  min_cancellation_hours INTEGER DEFAULT 24,
  
  -- No-show rules
  max_no_shows INTEGER DEFAULT 3,
  no_show_restriction_days INTEGER DEFAULT 30,
  
  -- Peak hour restrictions
  enable_peak_hours BOOLEAN DEFAULT false,
  peak_start_time TIME DEFAULT '17:00:00',
  peak_end_time TIME DEFAULT '19:00:00',
  peak_max_duration_minutes INTEGER DEFAULT 30,
  
  -- Amenity-specific settings
  requires_admin_approval BOOLEAN DEFAULT false,
  security_deposit_required BOOLEAN DEFAULT false,
  security_deposit_amount DECIMAL(10,2) DEFAULT 0.00,
  max_guest_count INTEGER DEFAULT 4,
  requires_cleanup_agreement BOOLEAN DEFAULT false,
  allow_ball_machine BOOLEAN DEFAULT false,
  singles_only BOOLEAN DEFAULT false,
  doubles_only BOOLEAN DEFAULT false,
  requires_power_outlet BOOLEAN DEFAULT false,
  no_lifeguard_acknowledgment BOOLEAN DEFAULT false,
  
  -- Custom rules text
  custom_rules TEXT,
  
  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  
  -- Ensure one rule set per amenity per HOA
  CONSTRAINT unique_amenity_rules UNIQUE (hoa_id, amenity_id)
);

-- Add RLS policies
ALTER TABLE public.amenity_rules ENABLE ROW LEVEL SECURITY;

-- Policy for HOA admins to manage their own amenity rules
CREATE POLICY "HOA admins can manage their amenity rules" ON public.amenity_rules
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE profiles.id = auth.uid() 
    AND profiles.hoa_id = amenity_rules.hoa_id 
    AND profiles.hoa_role = 'admin'
  )
);

-- Policy for residents to view their HOA's amenity rules
CREATE POLICY "Residents can view their HOA amenity rules" ON public.amenity_rules
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE profiles.id = auth.uid() 
    AND profiles.hoa_id = amenity_rules.hoa_id
  )
);

-- Add trigger for updated_at
CREATE TRIGGER update_amenity_rules_updated_at
  BEFORE UPDATE ON public.amenity_rules
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- Add foreign key constraints
ALTER TABLE public.amenity_rules 
ADD CONSTRAINT amenity_rules_hoa_id_fkey 
FOREIGN KEY (hoa_id) REFERENCES public.hoas(id) ON DELETE CASCADE;

ALTER TABLE public.amenity_rules 
ADD CONSTRAINT amenity_rules_amenity_id_fkey 
FOREIGN KEY (amenity_id) REFERENCES public.courts(id) ON DELETE CASCADE;
