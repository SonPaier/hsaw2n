-- Rozszerzenie constraint service_type o wartość 'both'
ALTER TABLE unified_services DROP CONSTRAINT unified_services_service_type_check;

ALTER TABLE unified_services ADD CONSTRAINT unified_services_service_type_check 
CHECK (service_type = ANY (ARRAY['reservation'::text, 'offer'::text, 'both'::text]));