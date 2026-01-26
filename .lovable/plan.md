

# Plan: Status połączenia telefonicznego w kafelku oferty

## Przegląd

Dodanie funkcjonalności śledzenia statusu follow-up (połączeń telefonicznych) do ofert. Na kafelku oferty pojawi się nowy komponent z ikoną telefonu i dropdown menu do ustawiania statusu.

## Zmiany w bazie danych

### Migracja SQL - dodanie kolumny `follow_up_phone_status`

Dodanie nowej kolumny do tabeli `offers` przechowującej status follow-up telefonicznego.

**Dopuszczalne wartości:**
- `NULL` - brak statusu (domyślny stan)
- `called_discussed` - "Dzwoniłem, omówione" (zielony)
- `call_later` - "Zadzwonić kiedy indziej" (żółty)
- `called_no_answer` - "Dzwoniłem, nieodebrane" (pomarańczowy)

---

## Zmiany w kodzie

### 1. Nowy komponent: `OfferFollowUpStatus.tsx`

Lokalizacja: `src/components/admin/OfferFollowUpStatus.tsx`

Komponent zawiera:
- Ikonę telefonu (Phone z lucide-react) - klikalna, otwiera dialer
- Dropdown z pill-shaped buttonem pokazującym aktualny status
- Menu z 3 opcjami statusu (każda w odpowiednim kolorze)

```text
+-------------------------------------------+
| 📞  [Ustaw status ▼]                     |
+-------------------------------------------+
      ↓ (po kliknięciu)
+-------------------------------------------+
| [Dzwoniłem, omówione]      (zielony)     |
| [Zadzwonić kiedy indziej]  (żółty)       |
| [Dzwoniłem, nieodebrane]   (pomarańczowy)|
+-------------------------------------------+
```

**Kolory statusów (zaktualizowane):**
- `called_discussed` → `bg-green-500 text-white hover:bg-green-600`
- `call_later` → `bg-yellow-400 text-gray-800 hover:bg-yellow-500` (żółty z ciemnym tekstem dla czytelności)
- `called_no_answer` → `bg-orange-500 text-white hover:bg-orange-600`
- `null` (brak) → `bg-gray-200 text-gray-600 hover:bg-gray-300`

---

### 2. Modyfikacja `OffersView.tsx`

**Zmiany:**

1. Rozszerzenie interfejsu `Offer` o pole `follow_up_phone_status`
2. Dodanie funkcji `handleFollowUpStatusChange` do aktualizacji statusu w bazie
3. Integracja komponentu `OfferFollowUpStatus` w layoutach desktop i mobile

---

## Wizualizacja na kafelku oferty

**Desktop:**
```text
┌─────────────────────────────────────────────────────────────┐
│ ARM/26/01/2026/16 📋  🟡 Obejrzana 11:46    │ 21 000 zł    │
│ Kamil • Tesla Model Y                        │ Utworzono:.. │
│ [PPF Full body MAT] [Dodatki]                │     ⋮        │
│                                              │              │
│ 📞  [Dzwoniłem, omówione ▼]  ← NOWY         │              │
└─────────────────────────────────────────────────────────────┘
```

**Mobile:**
```text
┌───────────────────────────────────┐
│ ARM/26/01/2026/16 📋              │
│ 🟡 Obejrzana 11:46, 17 sty        │
│ Kamil • Tesla Model Y             │
│ [PPF Full body MAT] [Dodatki]     │
│ ─────────────────────────────     │
│        17 073,17 zł + 23% VAT     │
│               21 000,00 zł        │
│                                   │
│ 📞  [Ustaw status ▼]  ← NOWY     │
└───────────────────────────────────┘
```

---

## Warunki wyświetlania

Komponent jest widoczny tylko gdy `offer.customer_data?.phone` istnieje.

---

## Pliki do modyfikacji/utworzenia

| Plik | Typ zmiany |
|------|------------|
| Migracja SQL | Nowa - dodanie kolumny `follow_up_phone_status` |
| `src/components/admin/OfferFollowUpStatus.tsx` | NOWY - komponent statusu |
| `src/components/admin/OffersView.tsx` | Modyfikacja - integracja komponentu |

