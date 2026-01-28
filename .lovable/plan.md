# Rozbudowa Widgetu Lead Form

✅ **STATUS: ZAIMPLEMENTOWANE**

## Zmiany w bazie danych (migracja)

- `offer_scopes.price_from` - cena "od" wyświetlana w widgecie
- `instances.widget_config` (jsonb) - konfiguracja widgetu
- `offers.paint_color` - kolor lakieru od klienta
- `offers.paint_finish` - rodzaj lakieru (gloss/matte)
- `offers.planned_date` - planowany termin realizacji
- `offers.inquiry_notes` - treść zapytania klienta
- `paint_colors` - tabela referencyjna kolorów lakierów

## Nowe komponenty

1. **WidgetSettingsTab** - zakładka "Wtyczka" w ustawieniach ofert
   - Lewa strona: konfiguracja (szablony, ceny od, dodatki)
   - Prawa strona: podgląd widgetu

2. **EmbedLeadFormPreview** - podgląd widgetu w ustawieniach

3. **Rozbudowany EmbedLeadForm**:
   - Planowany termin realizacji (DatePicker)
   - Kolor lakieru (input tekstowy)
   - Rodzaj lakieru (Połysk/Mat toggle)
   - Walidacja email i telefonu (min 9 cyfr)
   - Przycisk zawsze aktywny, błędy na submit + scroll do góry
   - Opisy pod "Czytaj więcej..."
   - Sekcja dodatków

## Zmiany w OfferSettingsDialog

- 4 zakładki: Ogólne, Branding, Nagłówek, Wtyczka
- Fixed header i footer
- Scrollable content

## Edge Functions

- `get-embed-config` - zwraca extras i price_from z widget_config
- `submit-lead` - zapisuje paint_color, paint_finish, planned_date, inquiry_notes
