-- Drop the existing check constraint
ALTER TABLE maintenance_reports DROP CONSTRAINT IF EXISTS maintenance_reports_category_check;

-- Add the new check constraint with updated categories
ALTER TABLE maintenance_reports ADD CONSTRAINT maintenance_reports_category_check 
  CHECK (category IN ('amenities_equipment', 'lighting_electrical', 'water_plumbing', 'grounds_landscaping', 'buildings_structures', 'safety_other'));