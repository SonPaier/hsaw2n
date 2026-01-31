-- Dodanie pola checked_service_ids do rezerwacji (feature #7)
ALTER TABLE reservations 
ADD COLUMN IF NOT EXISTS checked_service_ids jsonb DEFAULT '[]'::jsonb;

COMMENT ON COLUMN reservations.checked_service_ids IS 'IDs usług oznaczonych jako wykonane';