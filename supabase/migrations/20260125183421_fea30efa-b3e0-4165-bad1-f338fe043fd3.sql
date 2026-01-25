-- Usuń stary FK constraint który wskazuje na tabelę services
ALTER TABLE public.reservations 
DROP CONSTRAINT IF EXISTS reservations_service_id_fkey;

-- Dodaj komentarz dla jasności
COMMENT ON COLUMN public.reservations.service_id IS 
  'Legacy: dla starych rezerwacji. Nowe (has_unified_services=true) używają service_ids array';