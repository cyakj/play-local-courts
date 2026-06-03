-- Fix maintenance_reports category constraint to match frontend category keys
-- Frontend uses: plumbing, electrical, structural, grounds_landscaping, equipment, safety, other
-- V2 backend keys (amenities_equipment etc.) never matched frontend → silent insert failures
-- IMPORTANT: drop constraint first — V2 constraint blocks the UPDATE statements

-- Step 1: drop old constraint so UPDATE statements aren't blocked
ALTER TABLE maintenance_reports DROP CONSTRAINT IF EXISTS maintenance_reports_category_check;

-- Step 2: migrate existing V2 rows to the canonical frontend keys
UPDATE maintenance_reports SET category = 'equipment'           WHERE category = 'amenities_equipment';
UPDATE maintenance_reports SET category = 'electrical'          WHERE category = 'lighting_electrical';
UPDATE maintenance_reports SET category = 'plumbing'            WHERE category = 'water_plumbing';
UPDATE maintenance_reports SET category = 'structural'          WHERE category = 'buildings_structures';
UPDATE maintenance_reports SET category = 'safety'              WHERE category = 'safety_other';
UPDATE maintenance_reports SET category = 'electrical'          WHERE category = 'lighting';
UPDATE maintenance_reports SET category = 'equipment'           WHERE category = 'surface_net';
UPDATE maintenance_reports SET category = 'equipment'           WHERE category = 'gate_access';
UPDATE maintenance_reports SET category = 'grounds_landscaping' WHERE category = 'cleaning';

-- Step 3: add new constraint with canonical keys
ALTER TABLE maintenance_reports ADD CONSTRAINT maintenance_reports_category_check
  CHECK (category IN (
    'plumbing',
    'electrical',
    'structural',
    'grounds_landscaping',
    'equipment',
    'safety',
    'other'
  ));
