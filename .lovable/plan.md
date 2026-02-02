# Plan: Rozszerzenie sekcji "Usługi" w szczegółach rezerwacji

## Status: ✅ UKOŃCZONE (v01.27.06)

## Podsumowanie zmian

Dodanie szybkiego dodawania i usuwania usług bezpośrednio z widoku szczegółów rezerwacji (bez wchodzenia w tryb edycji).

## Zmiany wizualne

1. ✅ **Większe pills usług** - z `px-2 py-0.5 text-xs` na `px-3 py-1.5 text-sm`
2. ✅ **Każdy pill z ikoną X** - kliknięcie natychmiast usuwa usługę i zapisuje rezerwację
3. ✅ **Pill "Dodaj"** - na końcu listy, niebieski (primary) z białym tekstem, otwiera drawer usług
4. ✅ **ServiceSelectionDrawer** - usunięcie sekcji "Zaznaczone" z góry drawera (nowy prop `hideSelectedSection`)

## Zmodyfikowane pliki

1. `src/components/admin/ReservationDetailsDrawer.tsx` - główna logika
2. `src/components/admin/ServiceSelectionDrawer.tsx` - nowy prop `hideSelectedSection`
3. `public/version.json` - wersja 01.27.06
