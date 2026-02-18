

## Plan: Kolumny kalendarza, kolory stanowisk i tryb kompaktowy (Admin + Hala)

### 1. Migracja bazy danych
Dodanie kolumny `color` (text, nullable) do tabeli `stations`.

### 2. Ustawienia stanowisk (StationsSettings.tsx)
- Color picker w dialogu edycji/dodawania: 8 pastelowych bloczkow 32x32px + opcja "brak koloru"
- Kolory: `#E2EFFF`, `#E5D5F1`, `#FEE0D6`, `#FEF1D6`, `#D8EBE4`, `#F5E6D0`, `#E8E8E8`, `#FDDEDE`
- Zaznaczony bloczek ma obwodke i checkmark
- Zapis `color` do bazy przy save

### 3. Pobranie koloru stanowiska
- **useStations.ts**: dodanie `color` do `.select('id, name, type, color')`
- **HallView.tsx**: dodanie `color` do selecta stacji: `.select('id, name, type, color')`
- **Station interface** w AdminDashboard, HallView i AdminCalendar: rozszerzenie o `color?: string | null`

### 4. AdminCalendar.tsx - zmiany wspolne dla Admin i Hala

#### Minimalna szerokosc kolumn (desktop)
- Na desktop: kazda kolumna stanowiska dostaje `min-width: 220px`
- Na mobile: bez zmian (obecna logika 40% ekranu)
- Horizontal scroll gdy kolumny nie mieszcza sie na ekranie (naglowki i grid scrolluja razem)

#### Zawijanie nazw stanowisk
- Desktop: `whitespace-normal break-words` zamiast `truncate`
- Dluga nazwa np. "Myjnia stanowisko 1" zawinie sie na 2 linie

#### Kolory naglowkow i tla kolumn
- Naglowek stanowiska: tlo = kolor stanowiska (jesli ustawiony)
- Komorki gridu: tlo = kolor stanowiska zmieszany 5/95% z bialym
- Funkcja pomocnicza `getStationCellBg(color)`:
```text
r * 0.05 + 255 * 0.95 (analogicznie g, b)
```

#### Przycisk "Zwin" (tryb kompaktowy) - desktop, Admin i Hala
- Ikona w headerze kalendarza, obok "Plac", przed nia
- Dostepny tylko na desktop (ukryty na mobile)
- Dostepny zarowno w widoku Admin jak i w widoku Hala (hallMode)
- Stan `isCompact` w localStorage
- Gdy wlaczony: kolumny traca min-width 220px, dopasowuja sie do ekranu, brak scrolla
- Gdy wylaczony: min-width 220px, horizontal scroll jesli potrzebny

### 5. Pliki do modyfikacji

| Plik | Zmiany |
|------|--------|
| `supabase/migrations/` | Nowa migracja: `ALTER TABLE stations ADD COLUMN color text DEFAULT NULL` |
| `src/hooks/useStations.ts` | Dodanie `color` do select i interface |
| `src/components/admin/StationsSettings.tsx` | Color picker, zapis koloru |
| `src/components/admin/AdminCalendar.tsx` | min-width 220px, compact mode (widoczny w Admin i Hala), kolory naglowkow/tla, zawijanie nazw |
| `src/pages/AdminDashboard.tsx` | Rozszerzenie Station interface o `color` |
| `src/pages/HallView.tsx` | Rozszerzenie Station interface o `color`, dodanie `color` do selecta stacji |

### Szczegoly techniczne

- AdminCalendar jest wspolnym komponentem dla obu widokow (Admin i Hala), wiec zmiany CSS (min-width, kolory, compact mode) dzialaja automatycznie w obu kontekstach
- HallView pobiera stacje bezposrednio z bazy (nie uzywa hooka useStations), dlatego trzeba dodac `color` do selecta w HallView.tsx osobno
- Tryb kompaktowy jest dostepny zarowno w Admin jak i w Hala -- jedyny warunek ukrycia to mobile

