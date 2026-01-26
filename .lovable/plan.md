

# Plan: Dialog zatwierdzenia oferty przez admina + edycja kwoty

## Cel
1. Gdy admin zmienia status oferty na "Zaakceptowana" → dialog z edycją kwoty netto/brutto
2. Dla już zaakceptowanych ofert (status `accepted` lub `completed`) → nowa opcja "Zmień kwotę" w dropdown
3. Po zapisie lista automatycznie się odświeża

---

## Zmiany w bazie danych

### Nowe kolumny w tabeli `offers`
```sql
ALTER TABLE offers ADD COLUMN admin_approved_net numeric;
ALTER TABLE offers ADD COLUMN admin_approved_gross numeric;
```

---

## Nowy komponent: `AdminOfferApprovalDialog.tsx`

**Lokalizacja:** `src/components/offers/AdminOfferApprovalDialog.tsx`

### Props
```typescript
interface AdminOfferApprovalDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  offer: {
    id: string;
    customer_data: { name?: string };
    total_net: number | null;
    total_gross: number | null;
    admin_approved_net: number | null;
    admin_approved_gross: number | null;
  };
  mode: 'approve' | 'edit';
  onConfirm: (netAmount: number, grossAmount: number) => Promise<void>;
}
```

### Wygląd dialogu
- **Nagłówek:** "Oferta zaakceptowana"
- **Opis:** "Oferta dla 'IMIĘ_KLIENTA' zaakceptowana na kwotę:"
- **Pola:**
  - Input "Kwota netto (zł)"
  - Input "Kwota brutto (zł)"
- **Przyciski:** "Anuluj" i "Zapisz"

### Logika przeliczania
- Edycja netto → brutto = netto × 1.23
- Edycja brutto → netto = brutto ÷ 1.23
- Zaokrąglanie do 2 miejsc po przecinku

### Inicjalne wartości (priorytet)
1. `admin_approved_net/gross` (jeśli admin już wcześniej ustawił)
2. `total_net/gross` (jeśli klient zatwierdził)
3. Puste (jeśli brak obu)

---

## Modyfikacja `OffersView.tsx`

### 1. Nowy stan dla dialogu
```typescript
const [approvalDialog, setApprovalDialog] = useState<{ 
  open: boolean; 
  offer: OfferWithOptions | null;
  mode: 'approve' | 'edit';
}>({ open: false, offer: null, mode: 'approve' });
```

### 2. Przechwycenie statusu "accepted" w dropdown
```typescript
if (status === 'accepted') {
  setApprovalDialog({ open: true, offer, mode: 'approve' });
} else {
  handleChangeStatus(offer.id, status);
}
```

### 3. Nowa opcja "Zmień kwotę" w dropdown
```typescript
{(offer.status === 'accepted' || offer.status === 'completed') && (
  <DropdownMenuItem onClick={() => setApprovalDialog({ open: true, offer, mode: 'edit' })}>
    <Receipt className="w-4 h-4 mr-2" />
    Zmień kwotę
  </DropdownMenuItem>
)}
```

### 4. Funkcja `handleApproveOffer`
```typescript
const handleApproveOffer = async (
  offerId: string, 
  netAmount: number, 
  grossAmount: number,
  changeStatus: boolean
) => {
  const updateData = {
    admin_approved_net: netAmount,
    admin_approved_gross: grossAmount,
    ...(changeStatus && {
      status: 'accepted',
      approved_at: new Date().toISOString(),
      approved_by: userId,
    }),
  };
  
  await supabase.from('offers').update(updateData).eq('id', offerId);
  await fetchOffers();  // ← odświeżenie listy
  toast.success(changeStatus ? t('offers.statusChanged') : 'Kwota została zmieniona');
};
```

### 5. Wyświetlanie kwoty na liście (priorytet admin → klient)
```typescript
{(offer.admin_approved_gross || offer.approved_at) && (
  <span className="font-semibold">
    {formatPrice(offer.admin_approved_gross ?? offer.total_gross)}
  </span>
)}
```

---

## Pliki do modyfikacji/utworzenia

| Plik | Operacja |
|------|----------|
| Migracja SQL | Dodanie `admin_approved_net`, `admin_approved_gross` |
| `src/components/offers/AdminOfferApprovalDialog.tsx` | **Nowy** |
| `src/components/admin/OffersView.tsx` | Modyfikacja |

---

## Szczegóły techniczne

- VAT stały = 23% (mnożnik 1.23)
- Inputy typu `number` z `step="0.01"`
- Walidacja: przynajmniej jedna kwota > 0
- Priorytet wyświetlania: `admin_approved_gross ?? total_gross`
- Opcja "Zmień kwotę" widoczna tylko dla `accepted` lub `completed`

