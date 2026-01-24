-- Update category_type check constraint to allow 'both' value
ALTER TABLE unified_categories DROP CONSTRAINT unified_categories_category_type_check;
ALTER TABLE unified_categories ADD CONSTRAINT unified_categories_category_type_check 
  CHECK (category_type = ANY (ARRAY['reservation'::text, 'offer'::text, 'both'::text]));