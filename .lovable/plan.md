

## Poprawki w module protokolow

### 1. Labelka nad diagramem (CreateProtocolForm.tsx)

Zmiana tekstu labeli z:
"Zaznacz ewentualne usterki na diagramie pojazdu"
na:
"Zaznacz ewentualne usterki na diagramie pojazdu przetrzymujac palec w danym miejscu"

Linia 813 w `CreateProtocolForm.tsx`.

---

### 2. Klikanie na kompie nie dodaje usterki

**Problem**: W `VehicleDiagram.tsx` linia 50 sprawdza:
```
if (e.target !== e.currentTarget && !(e.target as HTMLElement).classList.contains('diagram-bg'))
```
Obraz `<img>` ma klase `diagram-bg`, ale ma tez `pointer-events-none` (linia ~155). To powoduje, ze klikniecia na obrazek "przelatuja" do kontenera -- co powinno dzialac. Jednak problem moze byc w tym, ze klikniecie trafia na wewnetrzny `<div>` (wrapper z `paddingBottom: 100%`), ktory **nie jest** `e.currentTarget` (zewnetrzny div) i **nie ma** klasy `diagram-bg`.

**Rozwiazanie**: Dodac klase `diagram-bg` rowniez do wewnetrznego diva z `paddingBottom`, lub zmienic warunek tak, aby akceptowal klikniecia na dowolnym elemencie wewnatrz kontenera, ktory nie jest kropka (damage point). Najlepsza opcja: uzyc `e.currentTarget.contains(e.target)` i wykluczyc tylko kropki damage points (ktore maja np. klase `damage-dot`).

---

### 3. Zdjecia w trybie edycji nie sa klikalne

Dwa miejsca wymagaja poprawki:

**a) CreateProtocolForm.tsx (linie 828-841)** -- sekcja "Zdjecia usterek" pod diagramem. Brak `onClick` i `cursor-pointer`. Trzeba dodac stan `fullscreenPhoto` + `PhotoFullscreenDialog` oraz `onClick={() => setFullscreenPhoto(url)}`.

**b) DamagePointDrawer.tsx (linie 237-240)** -- zdjecia w szufladzie edycji usterki. Tak samo brak `onClick` do powiekszania. Trzeba dodac `PhotoFullscreenDialog` i `onClick` na kazde zdjecie.

---

### 4. Przycisk X w PhotoFullscreenDialog

Komponent juz uzywa `z-[10000]` i bialego tla. Sprawdze czy styl jest odpowiedni -- wyglada poprawnie w kodzie. Problem mogl byc w tym, ze dialog nie byl w ogole otwierany (brak onClick na zdjeciach), co sprawia wrazenie ze "X nie dziala".

---

### Szczegoly techniczne

**Pliki do zmiany:**

1. **`src/components/protocols/VehicleDiagram.tsx`** -- poprawka warunku w `handlePointerDown` (linia 50), aby klikniecie mysza na wewnetrzny div tez dodawalo punkt.

2. **`src/components/protocols/CreateProtocolForm.tsx`**:
   - Zmiana labelki (linia 813)
   - Dodanie stanu `fullscreenPhoto` + import `PhotoFullscreenDialog`
   - Dodanie `onClick` + `cursor-pointer` do zdjec usterek (linie 832-838)
   - Render `PhotoFullscreenDialog` na koncu komponentu

3. **`src/components/protocols/DamagePointDrawer.tsx`**:
   - Dodanie stanu `fullscreenPhoto` + import `PhotoFullscreenDialog`
   - Dodanie `onClick` na zdjecia (linia 237-240)
   - Render `PhotoFullscreenDialog`

