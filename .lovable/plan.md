
# Widok Zamowienia - Panel Sprzedazy

## Zakres

Stworzenie statycznego widoku "Zamowienia" w panelu Sales CRM z tabela zamowien, wyszukiwarka, przyciskiem dodawania i fejkowymi danymi opartymi o produkty ULTRAFIT.

## Co zostanie zrobione

### 1. Plik danych mockowych: `src/data/salesMockData.ts`

Nowy plik z typami i danymi:

- **Typ `SalesOrder`** -- nr zamowienia, data utworzenia, nazwa klienta, kwota netto/brutto, produkty (tablica), komentarz (opcjonalny), status (`nowy` | `wyslany`)
- **Typ `SalesOrderProduct`** -- nazwa produktu, ilosc, cena netto, cena brutto
- **~12 fejkowych zamowien** z produktami ULTRAFIT:
  - Folia ochronna PPF ULTRAFIT (rozne modele: Premium, Matte, Gloss)
  - Folia przyciemniajaca ULTRAFIT (IR Nano, Hybrid)
  - Folia ochronna przedniej szyby ULTRAFIT
  - Rozne ilosci produktow (1-4 na zamowienie)
  - Numery w formacie `45/12/26` (nr/miesiac/rok)
  - Statusy mieszane: czesc `nowy`, czesc `wyslany`

### 2. Komponent widoku: `src/components/sales/SalesOrdersView.tsx`

Nowy komponent zawierajacy:

- **Naglowek**: tytul "Zamowienia" po lewej
- **Toolbar**:
  - Lewa strona: pole wyszukiwania (Input z ikona Search) -- filtruje po nazwie klienta lub nr zamowienia
  - Prawa strona: przycisk "Dodaj zamowienie" (na razie bez akcji, ewentualnie toast "w przygotowaniu")
- **Tabela** (uzycie istniejacych komponentow Table/TableHeader/TableBody/TableRow/TableCell):
  - Kolumny: Nr zamowienia | Data utworzenia | Klient | Netto | Brutto | Produkty | Komentarz | Status
  - **Expandable rows**: jesli zamowienie ma wiecej niz 1 produkt, wyswietlany jest pierwszy + badge "+N", klikniecie rozwija wiersz z lista wszystkich produktow (Collapsible)
  - **Komentarz**: ikona MessageSquare jesli komentarz istnieje, hover/tooltip z trescia
  - **Status**: Badge kolorowy (`nowy` = zolty/outline, `wyslany` = zielony); klikniecie otwiera dropdown z mozliwoscia zmiany (DropdownMenu) -- zmiana lokalna w state
- **Filtrowanie**: proste `filter()` na tablicy mockow po `searchQuery`

### 3. Integracja z SalesDashboard

W `src/pages/SalesDashboard.tsx`:
- Import `SalesOrdersView`
- W `renderContent()` case `'orders'` zwraca `<SalesOrdersView />` zamiast placeholdera

## Szczegoly techniczne

- Uzycie istniejacych komponentow UI: `Table`, `Badge`, `Input`, `Button`, `DropdownMenu`, `Collapsible`, `Tooltip`
- Formatowanie kwot: `toLocaleString('pl-PL')` z sufksem "zl"
- Formatowanie dat: `date-fns` format `dd.MM.yyyy`
- Brak logiki backendowej -- wszystko statyczne/lokalne
- Responsive: na mobile tabela w `overflow-auto` kontenerze
