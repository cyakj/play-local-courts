
-- Update the check constraint to allow new amenity types
ALTER TABLE public.courts 
DROP CONSTRAINT IF EXISTS courts_court_type_check;

-- Add new check constraint with all amenity types
ALTER TABLE public.courts 
ADD CONSTRAINT courts_court_type_check 
CHECK (court_type IN ('tennis', 'pickleball', 'barbecue', 'jacuzzi', 'pool', 'gym', 'clubhouse'));
