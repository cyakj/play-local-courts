-- Create table to track user policy agreements per amenity
CREATE TABLE public.amenity_policy_agreements (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  amenity_id UUID NOT NULL REFERENCES public.courts(id) ON DELETE CASCADE,
  rules_version TIMESTAMP WITH TIME ZONE NOT NULL,
  agreed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, amenity_id)
);

-- Enable Row Level Security
ALTER TABLE public.amenity_policy_agreements ENABLE ROW LEVEL SECURITY;

-- Users can view their own agreements
CREATE POLICY "Users can view their own policy agreements" 
ON public.amenity_policy_agreements 
FOR SELECT 
USING (auth.uid() = user_id);

-- Users can insert their own agreements
CREATE POLICY "Users can create their own policy agreements" 
ON public.amenity_policy_agreements 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

-- Users can update their own agreements (when rules change)
CREATE POLICY "Users can update their own policy agreements" 
ON public.amenity_policy_agreements 
FOR UPDATE 
USING (auth.uid() = user_id);