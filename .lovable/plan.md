

# Plan Migracji: Unified Services - Fazy 1-2

## Co robimy teraz (bezpieczne przed 16:00)

### FAZA 1: Tworzenie nowych tabel

**1.1 Tabela `unified_categories`**
- Pola: id, instance_id, category_type, name, slug, description, sort_order, deleted_at
- Indeksy na instance_id i category_type
- RLS policy dla odczytu aktywnych kategorii

**1.2 Tabela `unified_services`**
- Pola bazowe: id, instance_id, category_id, name, short_name, description
- Ceny rezerwacji: price_small, price_medium, price_large
- Cena ofertowa: default_price
- Czasy: duration_small, duration_medium, duration_large
- Flagi: requires_size, is_popular, prices_are_net
- Warunki ofertowe: default_validity_days, default_payment_terms, default_warranty_terms, default_service_info
- Metadata JSONB i soft delete (deleted_at)
- Indeksy na instance_id, category_id, deleted_at

### FAZA 2: Migracja danych

**2.1 Kategorie rezerwacji** (service_categories → unified_categories)
- Kopiowanie z zachowaniem oryginalnych UUID
- category_type = 'reservation'

**2.2 Kategorie ofertowe** (products_library.category → unified_categories)
- Tworzenie nowych UUID dla unikalnych kombinacji (instance_id, category)
- category_type = 'offer'

**2.3 Usługi rezerwacji** (services → unified_services)
- Zachowanie oryginalnych UUID
- Przeniesienie prices_are_net z kategorii na usługę
- Metadata z legacy_subcategory

**2.4 Produkty ofertowe** (products_library → unified_services)
- Zachowanie oryginalnych UUID
- Linkowanie do nowych kategorii ofertowych
- Metadata z brand i unit

## Co zostawiamy na po 16:00

- Faza 3: Aktualizacja Foreign Keys
- Fazy 4-7: Aktualizacja kodu frontend i Edge Functions
- Fazy 8-10: Testy i cleanup

## Ryzyko

Brak - nowe tabele nie wpływają na działającą aplikację. Stare tabele pozostają nietknięte.

