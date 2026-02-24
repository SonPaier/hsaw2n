

## Kopiowanie szablonów przypomnień z armcar do demo + 20 fejkowych klientów

### Stan obecny
- **armcar** ma 10 szablonów przypomnień (Ceramika 12/24/36/48/60, PPF Folia, Tapicerka Alcantara/Skóra, Wosk 12/6 mies.)
- **demo** ma 0 szablonów przypomnień i 0 `customer_reminders`
- **demo** ma ~10 klientów — za mało, trzeba dorobić 20 nowych

### Plan krok po kroku

**Krok 1: Utworzenie 20 fejkowych klientów w `customers`**
- Polskie imiona i nazwiska, unikalne telefony (+48600200001 do +48600200020)
- `instance_id = 'b3c29bfe-f393-4e1a-a837-68dd721df420'` (demo)
- `source = 'admin'`

**Krok 2: Utworzenie pojazdów w `customer_vehicles`**
- Po 1 pojeździe na klienta (20 wpisów)
- Realne modele (BMW X5, Audi A4, Mercedes C, VW Passat itp.)
- Tablice rejestracyjne (GD 11111, KR 22222 itp.)

**Krok 3: Skopiowanie 10 szablonów do `reminder_templates`**
- INSERT 10 wierszy z armcar → demo (nowe UUID, ten sam `name`, `items`, `sms_template`)

**Krok 4: Wygenerowanie ~100 wierszy w `customer_reminders`**
- 10 klientów per szablon (losowo z puli 20)
- `scheduled_date` rozłożone od -2 do +8 miesięcy
- Mix statusów: ~40% `sent` (z `sent_at`), ~60% `scheduled`
- `months_after` i `service_type` pobrane z `items` szablonu

### Szczegóły techniczne

Tabele do zapisu:
- `customers` — 20 INSERT
- `customer_vehicles` — 20 INSERT  
- `reminder_templates` — 10 INSERT
- `customer_reminders` — ~100 INSERT

Łącznie ~150 operacji INSERT, zero zmian w schemacie (bez migracji).

