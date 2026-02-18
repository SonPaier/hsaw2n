

# Nadpisywanie end_time przy STOP (zaokraglanie do pelnych minut)

## Cel
Gdy uzytkownik klika STOP na rezerwacji, pole `end_time` zostaje nadpisane aktualnym czasem zaokraglonym do pelnych minut (np. 15:23, bez sekund). Karta na kalendarzu natychmiast sie skraca do rzeczywistego czasu pracy.

## Format czasu
Czas zapisywany jako `HH:MM` (bez sekund). Przyklad: jesli STOP klikniety o 15:23:47, zapisujemy `15:23`.

## Miejsca zmian

### 1. AdminDashboard.tsx -- `handleEndWork`
Dodanie `end_time` do update w bazie i aktualizacji lokalnego stanu.

### 2. AdminDashboard.tsx -- `handleStatusChange`
Gdy `newStatus === 'completed'`, rowniez dodajemy `end_time`.

### 3. HallView.tsx -- `onEndWork`
Analogiczna zmiana jak w AdminDashboard.

## Szczegoly techniczne

W kazdym z 3 miejsc:
1. Obliczamy aktualny czas:
```text
const now = new Date();
const currentEndTime = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;
```
2. Dodajemy `end_time: currentEndTime` do obiektu update wysylanego do bazy danych.
3. Dodajemy `end_time: currentEndTime` do aktualizacji lokalnego stanu (setReservations), zeby kafelek na kalendarzu natychmiast sie zmniejszyl.

## Bez zmian w bazie
Pole `end_time` (time without time zone) juz istnieje w tabeli `reservations`. Nie potrzeba migracji.

## Pliki do edycji
- `src/pages/AdminDashboard.tsx` (2 miejsca)
- `src/pages/HallView.tsx` (1 miejsce)

