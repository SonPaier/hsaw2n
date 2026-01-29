
# Plan: Protokół i zdjęcia z rezerwacji

## Podsumowanie

Implementacja dwóch funkcjonalności:
1. **Dodawanie protokołu z rezerwacji** - przycisk "Dodaj protokół" nawiguje do formularza z auto-wypełnionymi danymi klienta
2. **Dodawanie zdjęć do rezerwacji** - limit 8 zdjęć, kompresja jak w protokołach, widoczne tylko dla admina

Dodatkowo: zamiana pojedynczej ikony historii na rozwijane menu (3 kropki) z opcjami.

---

## Część 1: Zmiany w bazie danych

### 1.1 Nowa kolumna `photo_urls` w tabeli `reservations`

```sql
ALTER TABLE reservations ADD COLUMN photo_urls text[] DEFAULT NULL;
```

### 1.2 Nowa kolumna `reservation_id` w tabeli `vehicle_protocols`

```sql
ALTER TABLE vehicle_protocols ADD COLUMN reservation_id uuid REFERENCES reservations(id);
```

### 1.3 Nowy bucket storage `reservation-photos`

```sql
INSERT INTO storage.buckets (id, name, public) 
VALUES ('reservation-photos', 'reservation-photos', true);

-- RLS policies
CREATE POLICY "Authenticated users can upload reservation photos"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'reservation-photos');

CREATE POLICY "Public read access for reservation photos"
ON storage.objects FOR SELECT
USING (bucket_id = 'reservation-photos');

CREATE POLICY "Authenticated users can delete reservation photos"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'reservation-photos');
```

---

## Część 2: Zmiany UI w ReservationDetailsDrawer

### 2.1 Nowy układ przycisków - zamiana ikony historii na menu 3 kropki

**PRZED:**
```text
┌────────────────────────────────────┐
│ [🕐] [      Edytuj      ]          │
└────────────────────────────────────┘
```

**PO:**
```text
┌────────────────────────────────────┐
│ [      Edytuj      ] [⋮]           │
└────────────────────────────────────┘
```

Menu rozwijane (DropdownMenu) zawiera:
- 📷 Dodaj zdjęcia
- 📄 Dodaj protokół *(tylko dla confirmed/in_progress)*
- 🕐 Zobacz historię
- ───────────────
- 🗑️ Usuń *(czerwony tekst)*

### 2.2 Sekcja "Zobacz zdjęcia" w drawerze

Jeśli `reservation.photo_urls?.length > 0`:
- Rozwijana sekcja (Collapsible) z etykietą "Zobacz zdjęcia (X)"
- Siatka 4 kolumny z miniaturami
- Kliknięcie otwiera PhotoFullscreenDialog (reużycie z protokołów)
- Możliwość usunięcia zdjęcia (ikona X)

### 2.3 Dialog dodawania zdjęć (`ReservationPhotosDialog`)

Nowy komponent z:
- Limit 8 zdjęć per rezerwacja
- Kompresja obrazów (1200px, 80% jakości) - reużycie `compressImage` z ProtocolPhotosUploader
- Upload do bucketu `reservation-photos`
- Aktualizacja `reservations.photo_urls`

---

## Część 3: Nawigacja do protokołu z rezerwacji

### 3.1 Logika pobierania danych

Gdy użytkownik klika "Dodaj protokół":

1. **Z rezerwacji dostępne**:
   - `customer_name`
   - `customer_phone`
   - `vehicle_plate`
   - `id` (reservation_id)

2. **Szukamy email w kolejności**:
   a) Tabela `customers` - po `phone` i `instance_id` → pole `email`
   b) Tabela `offers` - po `customer_data->phone` i `instance_id` → `customer_data->email`
   c) Jeśli brak - email pozostaje pusty (do uzupełnienia w formularzu)

3. **Nawigacja z query params**:
   ```
   /protocols/new?
     reservationId=xxx&
     customerName=...&
     customerPhone=...&
     vehiclePlate=...&
     email=...
   ```

### 3.2 Modyfikacja CreateProtocolForm

- Odczyt `searchParams` przy inicjalizacji
- Auto-wypełnienie pól: `customerName`, `phone`, `vehicleModel` (z vehicle_plate), `customerEmail`
- Dodanie nowego pola `reservationId` w state
- Zapisanie `reservation_id` w protokole przy tworzeniu/aktualizacji

---

## Część 4: Zmiany w HallReservationCard

### 4.1 Przyciski protokołu i zdjęć

Dla statusu `confirmed` lub `in_progress` wyświetlamy dodatkowe przyciski:

```text
┌────────────────────────────────────────────┐
│ [📄 Protokół] [📷 Zdjęcia]                 │
│                                            │
│ [         START / STOP          ]          │
└────────────────────────────────────────────┘
```

Dodatkowe propsy dla komponentu:
- `onAddProtocol?: (reservation) => void`
- `onAddPhotos?: (reservation) => void`

---

## Część 5: Nowe komponenty

| Plik | Opis |
|------|------|
| `src/components/admin/ReservationPhotosDialog.tsx` | Dialog do dodawania zdjęć z kompresją i uploadem |
| `src/components/admin/ReservationPhotosSection.tsx` | Sekcja rozwijana z galerią miniatur i fullscreen |

---

## Część 6: Pliki do modyfikacji

| Plik | Zmiana |
|------|--------|
| `src/components/admin/ReservationDetailsDrawer.tsx` | Menu 3 kropki, sekcja zdjęć, nawigacja do protokołu |
| `src/components/admin/halls/HallReservationCard.tsx` | Przyciski protokołu i zdjęć |
| `src/components/protocols/CreateProtocolForm.tsx` | Odczyt URL params, auto-wypełnienie, zapis reservation_id |
| `src/pages/HallView.tsx` | Handler nawigacji do protokołu, dialog zdjęć |

---

## Część 7: Przepływ danych

```text
Rezerwacja (confirmed/in_progress)
        │
        ├── "Dodaj protokół"
        │       │
        │       ▼
        │   Szukaj email: customers → offers → puste
        │       │
        │       ▼
        │   navigate(/protocols/new?reservationId=...&customerName=...&...)
        │       │
        │       ▼
        │   CreateProtocolForm (auto-filled z URL params)
        │       │
        │       ▼
        │   Zapis protokołu z reservation_id
        │
        └── "Dodaj zdjęcia"
                │
                ▼
            ReservationPhotosDialog
                │
                ▼
            Upload → compressImage → storage bucket
                │
                ▼
            UPDATE reservations SET photo_urls = [...]
```

---

## Część 8: Szczegóły techniczne

### 8.1 Nowe importy w ReservationDetailsDrawer

```tsx
import { MoreVertical, Camera, FileText, History, Trash2 } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { PhotoFullscreenDialog } from '@/components/protocols/PhotoFullscreenDialog';
import ReservationPhotosDialog from './ReservationPhotosDialog';
```

### 8.2 Logika wyszukiwania email dla protokołu

```tsx
const findCustomerEmail = async (phone: string, instanceId: string): Promise<string | null> => {
  // 1. Check customers table
  const { data: customer } = await supabase
    .from('customers')
    .select('email')
    .eq('instance_id', instanceId)
    .or(`phone.eq.${normalizePhone(phone)},phone.eq.+48${normalizePhone(phone)}`)
    .maybeSingle();
  
  if (customer?.email) return customer.email;
  
  // 2. Check offers table
  const { data: offers } = await supabase
    .from('offers')
    .select('customer_data')
    .eq('instance_id', instanceId)
    .not('customer_data', 'is', null)
    .limit(10);
  
  for (const offer of offers || []) {
    const customerData = offer.customer_data as any;
    if (normalizePhone(customerData?.phone) === normalizePhone(phone) && customerData?.email) {
      return customerData.email;
    }
  }
  
  return null;
};
```

### 8.3 Kompresja obrazów (reużycie)

Wyodrębniona funkcja `compressImage` z `ProtocolPhotosUploader.tsx` będzie użyta w nowym komponencie `ReservationPhotosDialog.tsx`.

---

## Wizualizacja menu

```text
┌─────────────────────────────┐
│ ⋮                           │
├─────────────────────────────┤
│ 📷 Dodaj zdjęcia            │
│ 📄 Dodaj protokół           │  ← tylko dla confirmed/in_progress
│ 🕐 Zobacz historię          │
│ ────────────────────────    │
│ 🗑️ Usuń                      │  ← czerwony tekst, z dialogiem potwierdzenia
└─────────────────────────────┘
```

---

## Uwagi

1. **Widoczność protokołu** - przycisk "Dodaj protokół" widoczny tylko dla `confirmed` i `in_progress`
2. **Limit zdjęć** - max 8 per rezerwacja (vs 20 w protokole)
3. **Widoczność zdjęć** - tylko w panelu admina, nie w widoku klienta `MojaRezerwacja`
4. **Fullscreen** - reużycie `PhotoFullscreenDialog` z modułu protokołów
5. **Email lookup** - kolejność: customers → offers → puste (użytkownik uzupełni w formularzu)
6. **reservation_id w protokole** - pozwala na powiązanie i późniejsze wyświetlenie protokołu z poziomu rezerwacji
