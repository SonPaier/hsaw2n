# Plan: Poprawa flow tworzenia szablonu przypomnień z usługi

## Status: ✅ ZAIMPLEMENTOWANO

## Problem

Gdy administrator w cenniku (`/admin/pricelist`) edytuje usługę i klika "Dodaj" przy dropdown szablonów przypomnień:

1. Nawigacja do `/admin/reminders/new?returnToService=true&serviceId=xxx` działa poprawnie
2. Po zapisaniu szablonu, system nawiguje do **`/admin/pricing`** zamiast **`/admin/pricelist`** (błędna ścieżka)
3. Dialog edycji usługi nie otwiera się automatycznie
4. Sekcja "Zaawansowane właściwości" nie jest rozwinięta
5. Nowy szablon nie jest przypisany do usługi w widoczny sposób

## Rozwiązanie

### Krok 1: ✅ Naprawa ścieżki nawigacji

**Plik: `src/pages/ReminderTemplateEditPage.tsx`**

Zmiana nawigacji po zapisaniu:
- ❌ `/admin/pricing?assignTemplate=xxx&serviceId=xxx`
- ✅ `/admin/pricelist?serviceId=xxx&assignedReminderId=xxx`

### Krok 2: ✅ Auto-otwarcie dialogu usługi

**Plik: `src/components/admin/PriceListSettings.tsx`**

Dodanie efektu reagującego na parametry URL:
- Gdy `serviceId` i `assignedReminderId` są w URL
- Przypisz szablon do usługi w bazie
- Odśwież listę usług
- Otwórz dialog edycji usługi z forceAdvancedOpen=true

### Krok 3: ✅ Auto-rozwinięcie sekcji zaawansowanej

**Plik: `src/components/admin/ServiceFormDialog.tsx`**

Dodanie nowego prop `forceAdvancedOpen`:
- Gdy zwracamy się z tworzenia szablonu, sekcja zaawansowana jest rozwinięta
- Użytkownik widzi przypisany szablon bez dodatkowych kliknięć

### Krok 4: ✅ Naprawa przycisku Wstecz

**Plik: `src/pages/ReminderTemplateEditPage.tsx`**

Zmiana funkcji `handleBack()`:
- ❌ `/admin/pricing`
- ✅ `/admin/pricelist`

---

## Flow po implementacji

```text
1. Admin otwiera usługę w cenniku
2. Klika "Dodaj" przy szablonach → /admin/reminders/new?returnToService=true&serviceId=xxx
3. Tworzy nowy szablon i klika "Zapisz"
4. System nawiguje → /admin/pricelist?serviceId=xxx&assignedReminderId=yyy
5. PriceListSettings:
   - Przypisuje szablon do usługi (UPDATE unified_services)
   - Odświeża listę usług
   - Otwiera dialog edycji usługi
   - Automatycznie rozwija sekcję "Zaawansowane właściwości"
6. Admin widzi przypisany szablon i klika "Zapisz" lub zamyka dialog
```
