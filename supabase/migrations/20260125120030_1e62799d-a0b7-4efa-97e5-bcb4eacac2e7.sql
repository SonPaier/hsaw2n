-- Update the view check constraint to include 'full'
ALTER TABLE protocol_damage_points DROP CONSTRAINT protocol_damage_points_view_check;

ALTER TABLE protocol_damage_points ADD CONSTRAINT protocol_damage_points_view_check 
  CHECK (view = ANY (ARRAY['front'::text, 'rear'::text, 'left'::text, 'right'::text, 'full'::text]));