-- Dodanie kolumn dla sekcji zaufania w ofertach
ALTER TABLE instances ADD COLUMN IF NOT EXISTS offer_trust_header_title TEXT;
ALTER TABLE instances ADD COLUMN IF NOT EXISTS offer_trust_description TEXT;
ALTER TABLE instances ADD COLUMN IF NOT EXISTS offer_trust_tiles JSONB;

-- Wypełnienie danych dla ARMCAR (obecne hardkodowane wartości)
UPDATE instances 
SET 
  offer_trust_header_title = 'Dlaczego warto nam zaufać?',
  offer_trust_description = 'Sprawdzone studio z ponad 800 opiniami w Google i średnią 5.0. Zajmujemy się profesjonalnym detailingiem i ochroną lakieru od lat, oferując najwyższą jakość usług.',
  offer_trust_tiles = '[
    {"icon": "star", "title": "Sprawdzone studio z doskonałą reputacją", "description": "Ponad 800 opinii w Google ze średnią 5.0 – zaufanie klientów to nasza wizytówka."},
    {"icon": "shield", "title": "Gwarancja na każdą usługę", "description": "Odpowiadamy za jakość – każda powłoka i folia objęta jest pełną gwarancją."},
    {"icon": "sparkles", "title": "Profesjonalne warunki aplikacji", "description": "Kabina lakiernicza, kontrolowane oświetlenie i temperatura – idealne środowisko dla perfekcyjnych efektów."},
    {"icon": "award", "title": "Autoryzowany aplikator premium marek", "description": "Certyfikowane szkolenia i dostęp do najlepszych produktów na rynku."},
    {"icon": "heart", "title": "Pasja do detalu", "description": "Każdy projekt traktujemy indywidualnie, dbając o każdy centymetr lakieru."},
    {"icon": "car", "title": "Doświadczenie z autami premium", "description": "Porsche, BMW, Mercedes, Audi – regularnie obsługujemy najbardziej wymagające pojazdy."}
  ]'::jsonb
WHERE id = '4ce15650-76c7-47e7-b5c8-32b9a2d1c321';