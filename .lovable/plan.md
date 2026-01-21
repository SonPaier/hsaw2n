
# Plan: Walidacja formularza z komunikatami błędów i scrollem

## Cel
Zmienić zachowanie przycisku "Dalej" w pierwszym kroku kreatora ofert:
- Przycisk zawsze aktywny (bez `disabled`)
- Na klik walidacja wszystkich wymaganych pól
- Wyświetlenie błędów pod polami z gwiazdką
- Automatyczny scroll do pierwszego pola z błędem

## Wymagane pola w kroku 1
Na podstawie kodu `CustomerDataStep.tsx` i walidacji w `OfferGenerator.tsx`:
- Imię i nazwisko (`customerData.name`) - oznaczone gwiazdką
- Email (`customerData.email`) - oznaczone gwiazdką
- Marka i model (`vehicleData.brandModel`) - oznaczone gwiazdką

---

## Zmiany techniczne

### 1. CustomerDataStep.tsx - dodanie obsługi błędów walidacji

Rozszerzenie interfejsu propsów:
```typescript
interface CustomerDataStepProps {
  customerData: CustomerData;
  vehicleData: VehicleData;
  onCustomerChange: (data: Partial<CustomerData>) => void;
  onVehicleChange: (data: Partial<VehicleData>) => void;
  validationErrors?: {
    name?: string;
    email?: string;
    brandModel?: string;
  };
}
```

Dodanie refów do pól do obsługi scrollowania:
```typescript
const nameInputRef = useRef<HTMLInputElement>(null);
const emailInputRef = useRef<HTMLInputElement>(null);
const brandModelRef = useRef<HTMLDivElement>(null);
```

Wyświetlanie błędów pod polami:
- Pole "Imię i nazwisko": czerwona ramka + tekst błędu "Imię i nazwisko jest wymagane"
- Pole "Email": czerwona ramka + tekst błędu "Email jest wymagany"
- Pole "Marka i model": czerwona ramka + tekst błędu "Marka i model jest wymagany"

### 2. OfferGenerator.tsx - logika walidacji i scrollowania

Dodanie stanu błędów walidacji:
```typescript
const [validationErrors, setValidationErrors] = useState<{
  name?: string;
  email?: string;
  brandModel?: string;
}>({});
```

Dodanie refa do komponentu CustomerDataStep:
```typescript
const customerStepRef = useRef<CustomerDataStepHandle>(null);
```

Zmiana funkcji `handleNext`:
```typescript
const handleNext = () => {
  if (currentStep === 1) {
    const errors: typeof validationErrors = {};
    
    if (!offer.customerData.name?.trim()) {
      errors.name = 'Imię i nazwisko jest wymagane';
    }
    if (!offer.customerData.email?.trim()) {
      errors.email = 'Email jest wymagany';
    }
    if (!offer.vehicleData.brandModel?.trim()) {
      errors.brandModel = 'Marka i model jest wymagany';
    }
    
    if (Object.keys(errors).length > 0) {
      setValidationErrors(errors);
      // Scroll do pierwszego pola z błędem
      customerStepRef.current?.scrollToFirstError(errors);
      return;
    }
    
    setValidationErrors({});
  }
  
  // Kontynuacja do następnego kroku
  setCurrentStep(prev => prev + 1);
  saveOffer(true).catch(console.error);
};
```

Usunięcie `disabled={!canProceed}` z przycisku "Dalej" na kroku 1:
```tsx
<Button
  onClick={handleNext}
  // disabled tylko na kroku 2 (wybór szablonów)
  disabled={currentStep === 2 && !canProceed}
  className="gap-2 h-12 w-12 sm:w-auto sm:px-4"
>
```

### 3. CustomerDataStep.tsx - implementacja scrollToFirstError

Dodanie `forwardRef` i `useImperativeHandle`:
```typescript
export interface CustomerDataStepHandle {
  scrollToFirstError: (errors: { name?: string; email?: string; brandModel?: string }) => void;
}

export const CustomerDataStep = forwardRef<CustomerDataStepHandle, CustomerDataStepProps>(
  ({ customerData, vehicleData, onCustomerChange, onVehicleChange, validationErrors }, ref) => {
    const nameInputRef = useRef<HTMLInputElement>(null);
    const emailInputRef = useRef<HTMLInputElement>(null);
    const brandModelRef = useRef<HTMLDivElement>(null);
    
    useImperativeHandle(ref, () => ({
      scrollToFirstError: (errors) => {
        if (errors.name && nameInputRef.current) {
          nameInputRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
          nameInputRef.current.focus();
        } else if (errors.email && emailInputRef.current) {
          emailInputRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
          emailInputRef.current.focus();
        } else if (errors.brandModel && brandModelRef.current) {
          brandModelRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }
    }));
    
    // ...rest of component
  }
);
```

### 4. Czyszczenie błędów przy edycji pola

W `OfferGenerator.tsx` - przekazanie funkcji czyszczącej błędy:
```typescript
const handleCustomerChange = (data: Partial<CustomerData>) => {
  updateCustomerData(data);
  // Czyść błąd dla zmienionego pola
  if (data.name !== undefined && validationErrors.name) {
    setValidationErrors(prev => ({ ...prev, name: undefined }));
  }
  if (data.email !== undefined && validationErrors.email) {
    setValidationErrors(prev => ({ ...prev, email: undefined }));
  }
};

const handleVehicleChange = (data: Partial<VehicleData>) => {
  updateVehicleData(data);
  if (data.brandModel !== undefined && validationErrors.brandModel) {
    setValidationErrors(prev => ({ ...prev, brandModel: undefined }));
  }
};
```

---

## Pliki do zmodyfikowania

| Plik | Zmiany |
|------|--------|
| `src/components/offers/CustomerDataStep.tsx` | Dodanie propsów `validationErrors`, refów do inputów, wyświetlanie błędów, `forwardRef` + `useImperativeHandle` |
| `src/components/offers/OfferGenerator.tsx` | Stan `validationErrors`, logika walidacji w `handleNext`, usunięcie `disabled` z przycisku, przekazanie propsów do CustomerDataStep |

---

## UX Flow

1. Użytkownik wchodzi na krok 1 (puste pola)
2. Klika "Dalej"
3. System waliduje pola oznaczone gwiazdką
4. Pod pustymi polami pojawiają się czerwone komunikaty
5. Strona automatycznie scrolluje do pierwszego pola z błędem
6. Użytkownik wypełnia pole
7. Błąd znika natychmiast po wpisaniu tekstu
8. Po wypełnieniu wszystkich wymaganych pól klik "Dalej" przechodzi do kroku 2
