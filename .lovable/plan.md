

# Plan: Widget na stronę (Publiczne API Iframe) - MVP Uproszczony

## Cel

Umożliwić osadzenie formularza zapytania ofertowego na stronie studia detailingowego. Formularz pozwala klientowi wybrać szablony (multi-select checkboxy), wprowadzić dane kontaktowe i pojazd, a następnie tworzy draft oferty w panelu admina.

## Architektura

```text
┌─────────────────────────────┐
│   Strona studia             │
│   <iframe src="             │
│     armcar.n2wash.com/embed │
│   "/>                       │
└──────────────┬──────────────┘
               │
               ▼
┌──────────────────────────────────────────────────────────────┐
│  /embed route (EmbedLeadForm.tsx)                            │
│  - Standalone page z własnym layoutem                        │
│  - CSS variables z brandingu instancji                       │
│  - Multi-select szablonów (checkboxy)                        │
└──────────────────────────────────────────────────────────────┘
               │
      ┌────────┴────────┐
      ▼                 ▼
GET /get-embed-config   POST /submit-lead
(config + szablony)     (tworzy draft oferty)
```

## Sekcje formularza (uproszczone)

1. **Header** - logo studia, nazwa
2. **Dane klienta**: imię, email, telefon
3. **Pojazd**: CarSearchAutocomplete + przebieg
4. **Pakiety**: multi-select checkboxy (szablony z has_unified_services=true)
5. **Budżet**: input numeric (opcjonalne)
6. **Notatki**: textarea (opcjonalne)
7. **RODO**: checkbox (wymagane)
8. **Submit button**

## Struktura zmian

### ETAP 1: Migracja bazy danych

**SQL migracji:**
```sql
-- Dodaj public_api_key do instances (auto-generowany)
ALTER TABLE public.instances 
ADD COLUMN IF NOT EXISTS public_api_key text UNIQUE;

-- Wygeneruj klucze dla istniejących instancji
UPDATE public.instances 
SET public_api_key = encode(gen_random_bytes(12), 'hex')
WHERE public_api_key IS NULL;

-- Trigger: auto-generuj przy INSERT
CREATE OR REPLACE FUNCTION generate_public_api_key()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.public_api_key IS NULL THEN
    NEW.public_api_key := encode(gen_random_bytes(12), 'hex');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_generate_public_api_key
BEFORE INSERT ON public.instances
FOR EACH ROW EXECUTE FUNCTION generate_public_api_key();

-- Dodaj budget_suggestion do offers
ALTER TABLE public.offers 
ADD COLUMN IF NOT EXISTS budget_suggestion numeric;

-- Indeks dla szybkiego lookup
CREATE UNIQUE INDEX IF NOT EXISTS idx_instances_public_api_key 
ON public.instances(public_api_key) WHERE public_api_key IS NOT NULL;
```

### ETAP 2: Edge Functions

#### 2.1 `get-embed-config`

**Response (uproszczony):**
```json
{
  "branding": {
    "bg_color": "#f8fafc",
    "primary_color": "#2563eb",
    "logo_url": "https://..."
  },
  "instance_info": {
    "name": "ARM CAR AUTO SPA",
    "address": "ul. Obrońców Wybrzeża 10B/67",
    "nip": "5842814958"
  },
  "templates": [
    { 
      "id": "uuid", 
      "name": "PPF Full Body", 
      "short_name": "Full Body",
      "description": "Pełne zabezpieczenie karoserii..."
    },
    { 
      "id": "uuid2", 
      "name": "Powłoka ceramiczna 5 lat", 
      "short_name": "Ceramika 5Y"
    }
  ]
}
```

#### 2.2 `submit-lead`

**Request (uproszczony):**
```json
{
  "customer_data": {
    "name": "Jan Kowalski",
    "email": "jan@example.com",
    "phone": "123456789",
    "gdpr_accepted": true
  },
  "vehicle_data": {
    "model_id": "uuid lub null",
    "custom_model_name": "Audi A6",
    "car_size": "L",
    "mileage": "15000"
  },
  "offer_details": {
    "template_ids": ["uuid1", "uuid2"],
    "budget_suggestion": 7000,
    "additional_notes": "Interesuje mnie też..."
  }
}
```

**Logika:**
1. Pobierz `instance_id` z hostname
2. Waliduj: `gdpr_accepted=true`, wymagane pola
3. Wygeneruj `offer_number`
4. Utwórz rekord `offers` z `status='draft'`, `source='website'`
5. Dla każdego `template_id` utwórz `offer_options` (bez cen)
6. Zwróć sukces

### ETAP 3: Frontend - Strona Embed

#### 3.1 `src/pages/EmbedLeadForm.tsx`

Standalone strona z prostym formularzem:
- Pobiera config z `get-embed-config`
- Styluje się CSS variables z brandingu
- Multi-select szablonów jako checkboxy/karty
- Submit do `submit-lead`
- Ekran sukcesu po wysłaniu

#### 3.2 Routing

W `App.tsx` dodaj route `/embed` w sekcji publicznych route'ów instancji.

### ETAP 4: Panel Admina

#### 4.1 Nowa zakładka: Widget w SettingsView

**Zawartość:**
- Nagłówek "Widget na stronę"
- Podgląd URL: `https://{slug}.n2wash.com/embed`
- Kod iframe do skopiowania
- Przycisk "Kopiuj kod"

#### 4.2 Badge "WWW" w OffersView

Dla ofert z `source='website'` wyświetl badge.

### ETAP 5: Tłumaczenia

Dodaj klucze dla zakładki widget i formularza embed w `pl.json`.

## Sekcja techniczna

### Pliki do utworzenia

| Plik | Opis |
|------|------|
| `supabase/functions/get-embed-config/index.ts` | Endpoint konfiguracyjny |
| `supabase/functions/submit-lead/index.ts` | Endpoint zapisu leada |
| `src/pages/EmbedLeadForm.tsx` | Strona formularza embed |
| `src/components/admin/WidgetSettings.tsx` | Zakładka widget |

### Pliki do modyfikacji

| Plik | Zmiana |
|------|--------|
| `src/App.tsx` | Route `/embed` |
| `src/components/admin/SettingsView.tsx` | Tab `widget` |
| `src/components/admin/OffersView.tsx` | Badge "WWW" |
| `src/i18n/locales/pl.json` | Tłumaczenia |
| `supabase/config.toml` | verify_jwt = false dla nowych funkcji |

### Bezpieczeństwo

- Identyfikacja instancji przez hostname (subdomain)
- CORS: zezwól na wszystkie originy (iframe musi działać wszędzie)
- Walidacja `gdpr_accepted=true` przed zapisem
- Edge Functions z service role (bez RLS)

