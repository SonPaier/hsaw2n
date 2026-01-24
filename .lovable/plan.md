

# Plan testów jednostkowych dla ServiceFormDialog - FINALNA WERSJA

## Zmiany względem poprzedniej wersji

1. **Usunięto SVC-U-041c** - nie testujemy `service_type !== 'both'` (legacy nie będzie edytowane)
2. **Dodano walidację unikalności** - nowe testy dla nazwy i skrótu

---

## Wymagane zmiany w kodzie przed testami

### 1. Nowy prop `existingServices` w ServiceFormDialog

```typescript
interface ServiceFormDialogProps {
  // ... istniejące propsy
  existingServices?: Array<{ id?: string; name: string; short_name: string | null }>;
}
```

### 2. Walidacja w handleSave

```typescript
// Sprawdź czy nazwa już istnieje (pomijając edytowaną usługę)
const nameExists = existingServices?.some(
  s => s.id !== service?.id && s.name.toLowerCase().trim() === formData.name.toLowerCase().trim()
);
if (nameExists) {
  setNameError(true);
  toast.error('Usługa o takiej nazwie już istnieje');
  return;
}

// Sprawdź czy skrót już istnieje (jeśli podany)
if (formData.short_name?.trim()) {
  const shortNameExists = existingServices?.some(
    s => s.id !== service?.id && 
         s.short_name?.toLowerCase().trim() === formData.short_name?.toLowerCase().trim()
  );
  if (shortNameExists) {
    setShortNameError(true);
    toast.error('Usługa o takim skrócie już istnieje');
    return;
  }
}
```

### 3. Przekazanie services z PriceListSettings

```typescript
<ServiceFormDialog
  // ... istniejące propsy
  existingServices={services.map(s => ({ 
    id: s.id, 
    name: s.name, 
    short_name: s.shortcut 
  }))}
/>
```

---

## Przypadki testowe - FINALNA LISTA

### Grupa 1: Renderowanie formularza (10 testów)

| ID | Opis | Viewport |
|----|------|----------|
| SVC-U-001 | Wyświetla tytuł "Nowa usługa" gdy brak service prop | Desktop |
| SVC-U-002 | Wyświetla tytuł "Edytuj usługę" gdy przekazano service prop | Desktop |
| SVC-U-003 | Wyświetla pole "Pełna, oficjalna nazwa usługi" z gwiazdką (*) | Desktop |
| SVC-U-004 | Wyświetla pole "Twoja nazwa lub skrót" | Desktop |
| SVC-U-005 | Wyświetla select kategorii z opcją "Bez kategorii" | Desktop |
| SVC-U-006 | Wyświetla radio buttons netto/brutto | Desktop |
| SVC-U-007 | Wyświetla pole ceny bazowej domyślnie | Desktop |
| SVC-U-008 | Wyświetla pole opisu z przyciskiem "Wygeneruj przez AI" | Desktop |
| SVC-U-009 | Mobile: Renderuje jako Drawer zamiast Dialog | Mobile |
| SVC-U-010 | Mobile: Pola są w układzie jednokolumnowym | Mobile |

### Grupa 2: Walidacja wymaganych pól (9 testów)

| ID | Opis | Viewport |
|----|------|----------|
| SVC-U-011 | Przycisk "Zapisz" jest zawsze aktywny (nie disabled) | Desktop |
| SVC-U-012 | Kliknięcie "Zapisz" bez nazwy pokazuje error "Nazwa usługi jest wymagana" | Desktop |
| SVC-U-012b | Kliknięcie "Zapisz" z nazwą tylko whitespace pokazuje error | Desktop |
| SVC-U-013 | Kliknięcie "Zapisz" bez nazwy pokazuje toast error | Desktop |
| SVC-U-014 | Po błędzie walidacji - pole nazwy ma czerwoną ramkę (border-destructive) | Desktop |
| SVC-U-015 | Po wpisaniu nazwy - error znika, ramka wraca do normy | Desktop |
| SVC-U-015b | Po wpisaniu samych spacji - error pozostaje | Desktop |
| SVC-U-016 | Focus wraca do pola nazwy po błędzie walidacji | Desktop |
| SVC-U-018 | Puste pole ceny jest akceptowane (cena opcjonalna) | Desktop |

### Grupa 2b: Walidacja unikalności (8 testów) - NOWE

| ID | Opis | Viewport |
|----|------|----------|
| SVC-U-019a | Duplikat nazwy (case-insensitive) → error "Usługa o takiej nazwie już istnieje" | Desktop |
| SVC-U-019b | Duplikat nazwy → pole nazwy ma czerwoną ramkę | Desktop |
| SVC-U-019c | Duplikat nazwy z różnymi spacjami (trim) → wykrywa jako duplikat | Desktop |
| SVC-U-019d | Ta sama nazwa w trybie edycji (własna usługa) → OK, nie blokuje | Desktop |
| SVC-U-019e | Duplikat skrótu (case-insensitive) → error "Usługa o takim skrócie już istnieje" | Desktop |
| SVC-U-019f | Duplikat skrótu → pole skrótu ma czerwoną ramkę | Desktop |
| SVC-U-019g | Pusty skrót gdy inny pusty → OK, nie blokuje (puste są dozwolone) | Desktop |
| SVC-U-019h | Ten sam skrót w trybie edycji (własna usługa) → OK, nie blokuje | Desktop |

### Grupa 3: Interakcje z polami (14 testów)

| ID | Opis | Viewport |
|----|------|----------|
| SVC-U-020 | Wpisanie nazwy aktualizuje wartość pola | Desktop |
| SVC-U-021 | Wpisanie skrótu konwertuje na UPPERCASE | Desktop |
| SVC-U-022 | Skrót ma limit 10 znaków | Desktop |
| SVC-U-023 | Zmiana radio netto/brutto aktualizuje label ceny | Desktop |
| SVC-U-024 | Kliknięcie "Cena zależna od wielkości" pokazuje pola S/M/L | Desktop |
| SVC-U-025 | Kliknięcie "Użyj jednej ceny" ukrywa pola S/M/L | Desktop |
| SVC-U-026 | Wpisanie ceny aktualizuje wartość | Desktop |
| SVC-U-027 | Zmiana kategorii w select aktualizuje wartość | Desktop |
| SVC-U-027b | Zmiana kategorii na "Bez kategorii" ustawia pusty string | Desktop |
| SVC-U-028 | Wpisanie opisu aktualizuje wartość | Desktop |
| SVC-U-029 | Kliknięcie info icon pokazuje tooltip | Desktop |
| SVC-U-030 | Tooltip nie otwiera się automatycznie przy focus | Desktop |
| SVC-U-031 | Wyczyszczenie pola ceny ustawia null (nie 0) | Desktop |
| SVC-U-032 | Wyczyszczenie pola duration ustawia null | Desktop |

### Grupa 4: Sekcja zaawansowana (14 testów)

| ID | Opis | Viewport |
|----|------|----------|
| SVC-U-040 | Sekcja "Zaawansowane" jest domyślnie zwinięta dla nowej usługi | Desktop |
| SVC-U-041 | Sekcja rozwinięta gdy usługa ma duration_minutes | Desktop |
| SVC-U-041b | Sekcja rozwinięta gdy usługa ma duration_small/medium/large | Desktop |
| SVC-U-041d | Sekcja rozwinięta gdy reminder_template_id istnieje | Desktop |
| SVC-U-042 | Kliknięcie rozwija/zwija sekcję zaawansowaną | Desktop |
| SVC-U-043 | Wyświetla pole "Czas trwania" po rozwinięciu | Desktop |
| SVC-U-044 | Kliknięcie "Czas zależny od wielkości" pokazuje pola S/M/L | Desktop |
| SVC-U-045 | Wyświetla select "Widoczność usługi" z 3 opcjami | Desktop |
| SVC-U-046 | Domyślna widoczność to "Wszędzie" (both) | Desktop |
| SVC-U-047 | Wyświetla select szablonu przypomnień gdy są dostępne | Desktop |
| SVC-U-047c | Nie wyświetla selecta szablonu gdy brak szablonów | Desktop |
| SVC-U-048 | Po wybraniu szablonu pokazuje listę przypomnień | Desktop |
| SVC-U-048b | Wybrany szablon bez items - lista nie pokazuje się | Desktop |
| SVC-U-048f | Template item z is_paid=true wyświetla ", płatne" | Desktop |

### Grupa 5: Tryb edycji (10 testów)

| ID | Opis | Viewport |
|----|------|----------|
| SVC-U-060 | Wypełnia pole nazwy danymi usługi | Desktop |
| SVC-U-061 | Wypełnia pole skrótu danymi usługi | Desktop |
| SVC-U-062 | Wybiera kategorię z danych usługi | Desktop |
| SVC-U-063 | Ustawia cenę z danych usługi | Desktop |
| SVC-U-064 | Ustawia opis z danych usługi | Desktop |
| SVC-U-065 | Pokazuje ceny S/M/L gdy usługa je ma | Desktop |
| SVC-U-066 | Pokazuje czasy S/M/L gdy usługa je ma | Desktop |
| SVC-U-067 | Wyświetla przycisk "Usuń" w trybie edycji gdy onDelete przekazane | Desktop |
| SVC-U-067b | Nie wyświetla "Usuń" w edycji gdy brak onDelete callback | Desktop |
| SVC-U-068 | Nie wyświetla przycisku "Usuń" dla nowej usługi | Desktop |

### Grupa 6: Zapis (10 testów)

| ID | Opis | Viewport |
|----|------|----------|
| SVC-U-080 | Po zapisie wywołuje callback onSaved | Desktop |
| SVC-U-081 | Po zapisie zamyka dialog (onClose) | Desktop |
| SVC-U-082 | Podczas zapisu przycisk pokazuje spinner | Desktop |
| SVC-U-083 | Podczas zapisu przyciski są disabled | Desktop |
| SVC-U-084 | Po sukcesie INSERT pokazuje toast "Usługa dodana" | Desktop |
| SVC-U-085 | Po sukcesie UPDATE pokazuje toast "Usługa zaktualizowana" | Desktop |
| SVC-U-086 | Po błędzie INSERT pokazuje toast error | Desktop |
| SVC-U-086b | Po błędzie UPDATE pokazuje toast error | Desktop |
| SVC-U-087 | Zapisuje service_type jako 'both' dla nowych usług | Desktop |
| SVC-U-088 | Zapisuje showSizePrices=true → price_from=null, S/M/L wypełnione | Desktop |

### Grupa 7: Zachowanie dialogu (4 testy)

| ID | Opis | Viewport |
|----|------|----------|
| SVC-U-090 | Kliknięcie tła nie zamyka dialogu (Desktop) | Desktop |
| SVC-U-091 | Kliknięcie "Anuluj" zamyka dialog | Desktop |
| SVC-U-092 | Kliknięcie X zamyka dialog | Desktop |
| SVC-U-093 | Mobile: Drawer obsługuje swipe down | Mobile |

### Grupa 8: Generowanie opisu AI (6 testów)

| ID | Opis | Viewport |
|----|------|----------|
| SVC-U-100 | Przycisk AI jest disabled gdy pole nazwy puste | Desktop |
| SVC-U-101 | Kliknięcie AI bez nazwy pokazuje toast error | Desktop |
| SVC-U-102 | Podczas generowania pokazuje spinner | Desktop |
| SVC-U-103 | Po sukcesie wstawia wygenerowany opis | Desktop |
| SVC-U-103b | API zwraca dane bez description → nic się nie dzieje | Desktop |
| SVC-U-104 | Po błędzie generowania pokazuje toast error | Desktop |

---

## Łączna liczba testów: 85 przypadków

---

## Struktura mocków

```typescript
// Istniejące usługi do walidacji unikalności
const mockExistingServices = [
  { id: 'existing-1', name: 'Mycie podstawowe', short_name: 'MYPOD' },
  { id: 'existing-2', name: 'Polerowanie', short_name: 'POL' },
  { id: 'existing-3', name: 'Woskowanie', short_name: null },
];

// Usługa do edycji (może mieć tą samą nazwę co existing-1)
const mockServiceToEdit = {
  id: 'existing-1',
  name: 'Mycie podstawowe',
  short_name: 'MYPOD',
  // ... reszta pól
};

// Mock categories i templates jak poprzednio
```

---

## Kluczowe asercje dla walidacji unikalności

```typescript
// SVC-U-019a - duplikat nazwy
await user.type(nameInput, 'Mycie podstawowe'); // już istnieje
await user.click(saveButton);
expect(screen.getByText(/Usługa o takiej nazwie już istnieje/i)).toBeInTheDocument();
expect(toast.error).toHaveBeenCalledWith(expect.stringMatching(/nazwa.*istnieje/i));

// SVC-U-019c - case-insensitive + trim
await user.type(nameInput, '  MYCIE PODSTAWOWE  ');
await user.click(saveButton);
expect(screen.getByText(/Usługa o takiej nazwie już istnieje/i)).toBeInTheDocument();

// SVC-U-019d - edycja własnej usługi (ta sama nazwa OK)
renderServiceFormDialog({ 
  service: mockServiceToEdit,
  existingServices: mockExistingServices 
});
// nazwa jest już "Mycie podstawowe" z mockServiceToEdit
await user.click(saveButton);
expect(screen.queryByText(/nazwa.*istnieje/i)).not.toBeInTheDocument();

// SVC-U-019e - duplikat skrótu
await user.type(nameInput, 'Nowa usługa');
await user.clear(shortNameInput);
await user.type(shortNameInput, 'POL'); // już istnieje
await user.click(saveButton);
expect(screen.getByText(/Usługa o takim skrócie już istnieje/i)).toBeInTheDocument();

// SVC-U-019g - oba puste skróty OK
await user.type(nameInput, 'Nowa usługa'); // unikalna
await user.clear(shortNameInput); // pusty, jak existing-3
await user.click(saveButton);
// Powinno przejść - puste skróty nie są sprawdzane
expect(mockOnSaved).toHaveBeenCalled();
```

---

## Sekcja techniczna

### Nowy stan dla błędu skrótu
```typescript
const [shortNameError, setShortNameError] = useState(false);
```

### Logika walidacji (kolejność)
1. Sprawdź czy nazwa pusta → `nameError`
2. Sprawdź czy nazwa zduplikowana → `nameError` + inny komunikat
3. Sprawdź czy skrót zduplikowany (jeśli niepusty) → `shortNameError`
4. Jeśli OK → wykonaj zapis

### Czyszczenie errorów
```typescript
// W onChange nazwy
if (nameError) setNameError(false);

// W onChange skrótu  
if (shortNameError) setShortNameError(false);
```

