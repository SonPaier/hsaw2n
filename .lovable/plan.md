

## Poprawki w widoku Zamowienia

### 1. Mock data (`salesMockData.ts`)
- Dodac `trackingNumber` do wszystkich zamowien ze statusem `'wysłany'` ktore go jeszcze nie maja (id: 5, 8, 12 -- te juz maja; sprawdzam ponownie -- wszystkie wyslane juz maja tracking). Aktualnie wyglada ok, kazde wyslane ma tracking.

### 2. Kolumna "Klient" wezsza (`SalesOrdersView.tsx`)
- Dodac `max-w-[200px]` lub `w-[200px]` do `TableHead` kolumny Klient, zeby byla 2x wezsza niz domyslna rozciagnieta.

### 3. Data wys. pod data utw. w komorkach
- Aktualnie daty wysylki sa juz wyswietlane pod data utworzenia -- to dziala poprawnie. Nic do zmiany tutaj.

---

### Szczegoly techniczne

**Plik: `src/components/sales/SalesOrdersView.tsx`**
- Linia 110: Zmienic `<TableHead>Klient</TableHead>` na `<TableHead className="w-[200px]">Klient</TableHead>` -- to zmniejszy kolumne klienta wzgledem reszty.

**Plik: `src/data/salesMockData.ts`**
- Nie wymaga zmian -- wszystkie zamowienia `wysłany` juz maja `trackingNumber`.

