

## Dynamiczny zakres Select dropdownow dla time pickerow

### Co sie zmieni

Selecty do wyboru godzin (start/end time) beda generowaly opcje na podstawie godzin pracy instancji (cache z `useWorkingHours`, bez dodatkowych HTTP). Zostaja Select dropdowny.

### Zasady

| Komponent | Zakres | Krok |
|-----------|--------|------|
| AddReservationDialogV2 - start time | open ... close+1h | 15 min |
| AddReservationDialogV2 - end time | open ... close+1h | 15 min |
| AddTrainingDrawer - start/end | open ... close+1h | 30 min |

Fallback gdy brak workingHours: 06:00 - 22:00.

---

### Szczegoly techniczne

#### 1. Nowa funkcja `generateTimeSlots` w `src/lib/utils.ts`

```text
export function generateTimeSlots(min: string, max: string, stepMinutes: number): string[]
```

Generuje tablice np. `["09:00", "09:15", "09:30", ...]` od `min` do `max` wlacznie, z krokiem `stepMinutes`.

#### 2. `src/components/admin/AddReservationDialogV2.tsx`

Linie 966-985 - zamiana hardcoded petli na dynamiczne obliczanie zakresu:

- Wyciagniecie `open`/`close` z `workingHours` dla dnia wybranego w `dateRange.from`
- `timeMin` = `open` (np. "09:00")
- `timeMax` = `close + 1h` (np. "18:00" jesli close="17:00"), max "23:59"
- Fallback: "06:00" / "22:00"
- `startTimeOptions = generateTimeSlots(timeMin, timeMax, 15)`
- `endTimeOptions = generateTimeSlots(timeMin, timeMax, 15)` (zmiana z 5 min na 15 min)
- `yardTimeOptions` = `startTimeOptions` (bez zmian w logice)

#### 3. `src/components/admin/AddTrainingDrawer.tsx`

Linie 134-145 - zamiana `generateTimeOptions` (0-24h co 15min) na:

- Wyciagniecie `open`/`close` z `workingHoursData` dla dnia z `dateRange?.from` (fallback: monday)
- `timeMin` = `open`, `timeMax` = `close + 1h`
- Fallback: "06:00" / "22:00"
- `timeOptions = generateTimeSlots(timeMin, timeMax, 30)` - krok 30 min
- Uzycie `useMemo` z deps `[workingHoursData, dateRange?.from]`

#### 4. Pliki bez zmian

- `ReservationDateTimeSection.tsx` - interfejs props bez zmian (nadal `startTimeOptions: string[]`, `endTimeOptions: string[]`)
- `YardDateTimeSection.tsx` - bez zmian
- `WorkingHoursSettings.tsx`, `AddBreakDialog.tsx`, `WeeklySchedule.tsx` - bez zmian

### Kompatybilnosc wsteczna

Brak ryzyka - format `"HH:MM"` identyczny, zmiana dotyczy tylko zakresu i kroku opcji w Select.

