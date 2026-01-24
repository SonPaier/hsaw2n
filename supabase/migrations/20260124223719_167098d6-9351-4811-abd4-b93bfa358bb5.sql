-- Krok 1: Dodanie kolumny has_unified_services do offer_scopes
ALTER TABLE offer_scopes 
ADD COLUMN IF NOT EXISTS has_unified_services BOOLEAN DEFAULT false;

-- Oznacz wszystkie istniejące szablony jako legacy
UPDATE offer_scopes SET has_unified_services = false WHERE has_unified_services IS NULL;