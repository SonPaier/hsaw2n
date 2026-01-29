-- Add hall_id column to user_roles for kiosk mode hall assignment
ALTER TABLE user_roles 
ADD COLUMN hall_id uuid REFERENCES halls(id) ON DELETE SET NULL;

COMMENT ON COLUMN user_roles.hall_id IS 
  'Przypisanie do konkretnej hali dla roli hall (kiosk mode)';