
# Plan: Checkbox "is_popular" w formularzu usługi i pills w formularzu rezerwacji

## Cel

1. Dodać checkbox w sekcji zaawansowanej formularza usługi (`ServiceFormDialog.tsx`) z etykietą "Dodaj szybki skrót do tej usługi przy tworzeniu nowej rezerwacji" i ikoną info
2. Zapisywać pole `is_popular` do bazy danych
3. Zmienić wygląd pills w formularzu rezerwacji na niebieski z białym tekstem
4. Wyświetlać pills dla usług `is_popular` we WSZYSTKICH trybach rezerwacji (nie tylko yard mode)

## Struktura zmian

### 1. Modyfikacja: `src/components/admin/ServiceFormDialog.tsx`

**Zmiany w interfejsie `ServiceData`:**
- Dodanie pola `is_popular?: boolean | null`

**Zmiany w stanie formularza:**
- Dodanie `is_popular: service?.is_popular ?? false` do `formData`

**Zmiany w `handleSave`:**
- Dodanie `is_popular: formData.is_popular` do obiektu `serviceData`

**Nowy element UI w sekcji zaawansowanej (pod "Widoczność usługi"):**
```tsx
<div className="flex items-center gap-3">
  <Checkbox
    id="is_popular"
    checked={formData.is_popular}
    onCheckedChange={(checked) => 
      setFormData(prev => ({ ...prev, is_popular: !!checked }))
    }
  />
  <div className="flex items-center gap-1.5">
    <Label htmlFor="is_popular" className="text-sm cursor-pointer">
      {t('priceList.form.isPopularLabel')}
    </Label>
    <FieldInfo tooltip="..." />
  </div>
</div>
```

### 2. Modyfikacja: `src/components/admin/reservation-form/ServicesSection.tsx`

**Zmiany:**
1. Usunięcie warunku `isYardMode` - pills dla popularnych usług będą widoczne we wszystkich trybach
2. Zmiana stylów pills na niebieski z białym tekstem:
   - z: `bg-muted hover:bg-muted/80 text-foreground border border-border`
   - na: `bg-primary hover:bg-primary/90 text-primary-foreground`

**Kod przed:**
```tsx
{isYardMode &&
  services.filter((s) => s.is_popular && !selectedServices.includes(s.id)).length > 0 && (
```

**Kod po:**
```tsx
{services.filter((s) => s.is_popular && !selectedServices.includes(s.id)).length > 0 && (
```

### 3. Nowe tłumaczenia w `src/i18n/locales/pl.json`

```json
"priceList": {
  "form": {
    "isPopularLabel": "Dodaj szybki skrót do tej usługi przy tworzeniu nowej rezerwacji"
  }
}
```

### 4. Import Checkbox w ServiceFormDialog

Dodanie importu:
```tsx
import { Checkbox } from '@/components/ui/checkbox';
```

## Sekcja techniczna

### Przepływ danych is_popular

1. **Odczyt:** Pole `is_popular` jest już pobierane w `AddReservationDialogV2.tsx` w zapytaniu do `unified_services`
2. **Zapis:** Dodanie pola do obiektu zapisywanego w `handleSave()` w `ServiceFormDialog.tsx`
3. **Wyświetlanie:** Pills renderowane w `ServicesSection.tsx` bazując na `service.is_popular`

### Zachowanie UX pills

Gdy użytkownik kliknie pill:
1. Pill znika z widoku (usługa jest dodana do `selectedServices`)
2. Usługa pojawia się na liście wybranych usług (`SelectedServicesList`)
3. Drawer usług NIE otwiera się - to szybki skrót

### Pliki do modyfikacji

| Plik | Typ zmiany |
|------|------------|
| `src/components/admin/ServiceFormDialog.tsx` | Dodanie checkbox i logiki zapisu |
| `src/components/admin/reservation-form/ServicesSection.tsx` | Zmiana stylów i usunięcie ograniczenia isYardMode |
| `src/i18n/locales/pl.json` | Nowe tłumaczenie |
