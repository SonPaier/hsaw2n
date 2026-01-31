

# Plan implementacji - zaktualizowane zadania

## Podsumowanie zmian wg Twoich uwag

Na podstawie Twoich korekt, oto zaktualizowany plan dla wszystkich 11 zadań.

---

## 1. REFACTOR: Usunięcie statusu "released/wydaj" z flow rezerwacji

**Pliki do zmian**:

| Plik | Zmiana |
|------|--------|
| `src/components/admin/AdminCalendar.tsx` | Usunięcie `released` z funkcji `getStatusColor()` (linie 150-151, 176-178) - `completed` staje się kolorem szarym zamiast niebieskiego |
| `src/components/admin/AdminCalendar.tsx` | Aktualizacja legendy (linie 2297-2304) - usunięcie "Wydany", zmiana "Gotowy do wydania" na "Zakończony" z szarym kolorem |
| `src/components/admin/halls/HallReservationCard.tsx` | Usunięcie przycisku WYDAJ i `handleRelease` (linie 110-118, 201-213) |
| `src/components/admin/halls/HallReservationCard.tsx` | Usunięcie prop `onRelease` z interfejsu (linia 28) |
| `src/pages/HallView.tsx` | Usunięcie callback `onRelease` (linie 856-859) |
| `src/components/admin/ReservationDetailsDrawer.tsx` | Usunięcie przycisku "Wydaj pojazd" i logiki `released` |

**Zmiana kolorów statusów**:
```
completed: bg-sky-200 → bg-slate-200 (szary)
released: USUNIĘTY
```

**Nowa legenda**:
- Do potwierdzenia (żółty)
- Prośba o zmianę (czerwony)
- W trakcie (pomarańczowy)
- Potwierdzony (zielony)
- Zakończony (szary) ← było "Gotowy do wydania" + "Wydany"

---

## 2. REFACTOR: Bezpośrednie otwarcie aparatu/galerii

**Pliki do zmian**:

| Plik | Zmiana |
|------|--------|
| `src/components/admin/ReservationDetailsDrawer.tsx` | Zamiana menu item "Zdjęcia" na trigger hidden inputa `<input type="file" accept="image/*" capture="environment">` |
| `src/pages/HallView.tsx` | Usunięcie `ReservationPhotosDialog`, bezpośredni upload przez hidden input |
| `src/components/admin/halls/HallReservationCard.tsx` | `onAddPhotos` triggeruje input zamiast otwierania dialogu |

**Logika**:
- Ukryty `<input ref={fileInputRef} type="file" accept="image/*" capture="environment" multiple>`
- Kliknięcie przycisku "Zdjęcia" → `fileInputRef.current?.click()`
- `onChange` → bezpośredni upload zdjęć do storage + update `photo_urls`

---

## 3. BUG: Zdjęcia wgrane na tablecie nie widoczne + kafelki w HallReservationCard

**Przyczyna**: 
1. `photo_urls` nie jest pobierane w `HallView.tsx` przy fetchu rezerwacji
2. `currentPhotos={[]}` w `ReservationPhotosDialog` zamiast faktycznych zdjęć
3. `HallReservationCard` nie wyświetla kafelków zdjęć

**Pliki do zmian**:

| Plik | Zmiana |
|------|--------|
| `src/pages/HallView.tsx` | Dodanie `photo_urls` do selecta przy fetchu rezerwacji (linia ~402) |
| `src/pages/HallView.tsx` | Dodanie `photo_urls` do interfejsu `Reservation` |
| `src/pages/HallView.tsx` | Przekazanie `currentPhotos={photosDialogReservation?.photo_urls \|\| []}` (linia 872) |
| `src/pages/HallView.tsx` | Realtime UPDATE - fetch pełnych danych zamiast `payload.new` (linia 576) |
| `src/components/admin/halls/HallReservationCard.tsx` | Dodanie prop `photoUrls?: string[]` |
| `src/components/admin/halls/HallReservationCard.tsx` | Wyświetlenie kafelków zdjęć pod listą usług |

**Kafelki zdjęć w HallReservationCard**:
```tsx
{/* Zdjęcia rezerwacji - pod usługami */}
{photoUrls && photoUrls.length > 0 && (
  <div className="flex flex-wrap gap-2">
    {photoUrls.map((url, idx) => (
      <img 
        key={idx} 
        src={url} 
        className="w-16 h-16 object-cover rounded-lg cursor-pointer"
        onClick={() => setPreviewPhoto(url)}
      />
    ))}
  </div>
)}
```

---

## 4. FEATURE: Powiększenie fontów na tablecie (widok hall)

**Plik**: `src/components/admin/AdminCalendar.tsx`

**Zmiana wartości w hallMode**:

| Element | Było | Będzie |
|---------|------|--------|
| Czas (hall) | `text-[12px] md:text-[15px]` | `text-[13px] md:text-[16px]` |
| Pojazd/klient | `text-xs md:text-sm` | `text-[13px] md:text-[15px]` |
| Pillsy usług | `text-[9px] md:text-[10px]` | `text-[10px] md:text-[11px]` |
| Notatki | `text-[13px]` | `text-[14px]` |

---

## 5. FEATURE: Dropdown zamiast datepickera w wtyczce publicznej

**Pliki do zmian**:

| Plik | Zmiana |
|------|--------|
| `src/pages/EmbedLeadForm.tsx` | Zamiana `Popover+Calendar` na `Select` (linie 736-767) |
| `src/pages/EmbedLeadForm.tsx` | Zmiana typu `plannedDate: Date \| null` na `plannedTimeframe: string \| null` |
| `supabase/functions/submit-lead/index.ts` | Obsługa nowego pola `planned_timeframe` |

**Opcje dropdown (wg Twojego zamówienia)**:
```tsx
<Select value={formData.plannedTimeframe} onValueChange={(v) => setFormData(...)}>
  <SelectTrigger>
    <SelectValue placeholder="Wybierz (opcjonalne)" />
  </SelectTrigger>
  <SelectContent>
    <SelectItem value="asap">Jak najszybciej</SelectItem>
    <SelectItem value="1_3_months">W ciągu 1–3 miesięcy</SelectItem>
    <SelectItem value="later">Później niż za 3 miesiące</SelectItem>
    <SelectItem value="not_sure">Jeszcze nie wiem / chcę się tylko rozeznać</SelectItem>
  </SelectContent>
</Select>
```

---

## 6. BUG: Zmiana statusu na tablecie nie synchronizuje się

**Przyczyna**: Realtime w `HallView.tsx` przy UPDATE używa tylko `payload.new` bez pełnych danych (linia 576).

**Plik**: `src/pages/HallView.tsx`

**Naprawa** (linie 575-576):
```typescript
// PRZED (błędne):
} else if (payload.eventType === 'UPDATE') {
  setReservations(prev => prev.map(r => r.id === payload.new.id ? { ...r, ...payload.new } : r));
}

// PO (poprawne):
} else if (payload.eventType === 'UPDATE') {
  const { data } = await supabase
    .from('reservations')
    .select(`
      id, instance_id, customer_name, customer_phone, vehicle_plate,
      reservation_date, end_date, start_time, end_time, station_id,
      status, confirmation_code, price, service_ids, admin_notes,
      has_unified_services, photo_urls,
      stations:station_id (name, type)
    `)
    .eq('id', payload.new.id)
    .single();
    
  if (data) {
    setReservations(prev => prev.map(r => r.id === data.id ? {
      ...data,
      status: data.status || 'pending',
      station: data.stations ? { name: data.stations.name, type: data.stations.type } : undefined,
    } : r));
  }
}
```

---

## 7. FEATURE: Checkmark przy usługach

**Migracja bazy danych** (wymagana):
```sql
ALTER TABLE reservations 
ADD COLUMN IF NOT EXISTS checked_service_ids jsonb DEFAULT '[]'::jsonb;

COMMENT ON COLUMN reservations.checked_service_ids IS 'IDs usług oznaczonych jako wykonane';
```

**Pliki do zmian**:

| Plik | Zmiana |
|------|--------|
| `src/components/admin/ReservationDetailsDrawer.tsx` | Klikalne nazwy usług z toggle checkmark |
| `src/pages/HallView.tsx` | Obsługa `checked_service_ids` w realtime |

**UI usługi**:
- Niezaznaczona: normalna czcionka
- Zaznaczona: `text-muted-foreground` + zielony `<Check>` na końcu

---

## 8. BUG: Menu "Usuń" schowane pod ekranem

**Plik**: `src/components/admin/ReservationDetailsDrawer.tsx`

**Naprawa**:
```tsx
<DropdownMenuContent 
  align="end" 
  className="w-48"
  sideOffset={5}
  collisionPadding={16}
  avoidCollisions={true}
>
```

---

## 9. FEATURE: Przyciski Protokół i Zdjęcia zawsze widoczne w hall

**Plik**: `src/components/admin/halls/HallReservationCard.tsx`

**Zmiana**: Przeniesienie przycisków poza warunek `isPendingOrConfirmed` (linie 131-155) - mają być wyświetlane dla wszystkich statusów.

```tsx
// Przyciski zawsze widoczne (na górze przed akcjami statusowymi)
{(onAddProtocol || onAddPhotos) && (
  <div className="flex gap-2 mb-3">
    {onAddProtocol && (
      <Button variant="outline" className="flex-1 gap-2" onClick={() => onAddProtocol(reservation)}>
        <FileText className="w-5 h-5" />
        Protokół
      </Button>
    )}
    {onAddPhotos && (
      <Button variant="outline" className="flex-1 gap-2" onClick={() => onAddPhotos(reservation)}>
        <Camera className="w-5 h-5" />
        Zdjęcia
      </Button>
    )}
  </div>
)}

{/* Potem akcje statusowe */}
{renderActionButtons()}
```

---

## 10. FEATURE: Fullscreen podgląd zdjęć

**Pliki do zmian**:

| Plik | Zmiana |
|------|--------|
| `src/components/admin/ReservationPhotosDialog.tsx` | Dodanie onClick na miniaturkach → `PhotoFullscreenDialog` |
| `src/components/admin/halls/HallReservationCard.tsx` | Klikalne miniaturki → fullscreen dialog |
| `src/components/protocols/PhotoFullscreenDialog.tsx` | Istniejący komponent - reużycie |

---

## 11. FEATURE: Usuwanie zdjęć - X zawsze widoczny + confirmation

**Pliki do zmian**:

| Plik | Zmiana |
|------|--------|
| `src/components/admin/ReservationPhotosDialog.tsx` | Usunięcie `opacity-0 group-hover:opacity-100` z przycisku X |
| `src/components/admin/ReservationPhotosSection.tsx` | Usunięcie hover opacity |
| Oba pliki | Dodanie `AlertDialog` do potwierdzenia usunięcia |

---

## Kolejność implementacji

1. **Migracja bazy danych** - `checked_service_ids`
2. **Bug #6** - synchronizacja realtime (krytyczny)
3. **Bug #3** - zdjęcia nie widoczne + kafelki w HallReservationCard
4. **Refactor #1** - usunięcie "released" + zmiana kolorów + legenda
5. **Refactor #2** - bezpośredni aparat
6. **Bug #8** - menu schowane
7. **Feature #9** - przyciski zawsze widoczne
8. **Feature #7** - checkmark usług
9. **Feature #10** - fullscreen zdjęcia
10. **Feature #11** - usuwanie z confirmation
11. **Feature #4** - fonty
12. **Feature #5** - dropdown timeframe

