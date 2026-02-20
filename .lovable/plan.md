
# Synchronizacja stylu detali szkolenia z detalami rezerwacji

## Podsumowanie zmian

Drawer szczegolol szkolenia (`TrainingDetailsDrawer.tsx`) zostanie przebudowany, aby wizualnie odpowiadal layoutowi detali rezerwacji (`ReservationDetailsDrawer.tsx`). Dodatkowo na kartach szkolen w kalendarzu pojawia sie notatki wewnetrzne.

---

## Lista poprawek

### 1. Layout sekcji w detalu szkolenia -- ikona + label + wartosc
Obecnie: ikona i label sa w jednym wierszu, wartosc pod spodem, ale brakuje gap-3 i struktury `<icon> <div><label><value></div>`.

Zmiana: Kazda sekcja (Status, Daty, Godzina, Stanowisko, Pracownicy) bedzie miala uklad:
```
<div class="flex items-start gap-3">
  <Icon class="w-5 h-5 text-muted-foreground mt-0.5" />
  <div>
    <div class="text-xs text-muted-foreground">Label</div>
    <div class="font-medium">Wartosc</div>
  </div>
</div>
```
-- identycznie jak w ReservationDetailsDrawer (Telefon, Kod rezerwacji, Samochod itd.).

### 2. "Pracownicy" --> "Przypisani pracownicy"
Zmiana labela z "Pracownicy" na "Przypisani pracownicy", identycznie jak w detalu rezerwacji.

### 3. Dodanie przycisku "+ Dodaj" przy pracownikach
W detalu rezerwacji obok chipow pracownikow jest przycisk `+ Dodaj` otwierajacy `EmployeeSelectionDrawer`. Taki sam przycisk zostanie dodany do detali szkolenia (tylko w trybie `!readOnly`). Po wybraniu pracownikow, lista `assigned_employee_ids` bedzie zapisywana do bazy.

### 4. Sekcja "Notatki wewnetrzne" w detalu szkolenia
Dodanie sekcji notatek wewnetrznych (pole `description` z modelu Training), wyswietlanej w tym samym stylu co w detalu rezerwacji:
- Label "Notatki wewnetrzne"
- Klikniecie otwiera textarea do edycji inline
- Zapis na `onBlur`
- Placeholder italic "Brak notatek wewnetrznych" gdy puste

### 5. Notatki na karcie szkolenia w kalendarzu
Dodanie wyswietlania `training.description` na karcie szkolenia w `AdminCalendar.tsx`, analogicznie do `admin_notes` na kartach rezerwacji -- widoczne gdy czas trwania > 30 minut.

### 6. Status -- przeniesienie do layoutu icon+label
Sekcja statusu (badge Otwarte/Zamkniete + switch) zostanie ulozona w tym samym wzorcu co inne sekcje: ikona po lewej, label + wartosc po prawej.

---

## Zmiany techniczne

### `src/components/admin/TrainingDetailsDrawer.tsx`
- Przebudowa layoutu wszystkich sekcji na wzorzec `flex items-start gap-3` z ikona 5x5 po lewej
- Label "Przypisani pracownicy" zamiast "Pracownicy"
- Dodanie przycisku `+ Dodaj` (Button size="sm" className="rounded-full") przy pracownikach
- Import i renderowanie `EmployeeSelectionDrawer`
- Stan `employeeDrawerOpen` + logika zapisu przypisanych pracownikow do bazy (`supabase.from('trainings').update(...)`)
- Sekcja "Notatki wewnetrzne" z edycja inline (textarea na klikniecie, zapis onBlur)
- Stan `editingNotes`, `localDescription`, `savingNotes`

### `src/components/admin/AdminCalendar.tsx`
- W sekcji renderowania kart szkolen (okolice linii 1930-1948): dodanie warunku `training.description && durationMinutes > 30` i wyswietlenie tekstu notatki w `div.text-[14px]` -- identyczny styl co notatki na kartach rezerwacji.
