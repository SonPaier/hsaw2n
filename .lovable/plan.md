
# Plan: Naprawa wyświetlania ceny oferty i ustawiania approved_at

## Problem

1. **Brak kwoty na liście ofert** - oferty ze statusem `accepted` ale `approved_at = null` nie wyświetlają ceny
2. **Brak approved_at przy ręcznej zmianie statusu** - admin może zmienić status na "accepted" przez dropdown, ale funkcja `handleChangeStatus` nie ustawia `approved_at`

## Rozwiązanie

### 1. Naprawa warunku wyświetlania ceny

**Plik:** `src/components/admin/OffersView.tsx`

**Linia ~618 (mobile layout):**
```tsx
// Przed:
{offer.approved_at && (

// Po:
{(offer.approved_at || offer.status === 'accepted' || offer.status === 'completed') && (
```

**Linia ~671 (desktop layout):**
```tsx
// Przed:
{offer.approved_at ? formatPrice(offer.total_gross) : ...}

// Po:
{(offer.approved_at || offer.status === 'accepted' || offer.status === 'completed') ? formatPrice(offer.total_gross) : ...}
```

### 2. Ustawienie approved_at przy ręcznej zmianie statusu

**Plik:** `src/components/admin/OffersView.tsx`

**Linia ~312 (w handleChangeStatus):**
```tsx
// Przed:
const updateData: Record<string, unknown> = { status: newStatus };
if (newStatus === 'sent') updateData.sent_at = new Date().toISOString();

// Po:
const updateData: Record<string, unknown> = { status: newStatus };
if (newStatus === 'sent') updateData.sent_at = new Date().toISOString();
if (newStatus === 'accepted') updateData.approved_at = new Date().toISOString();
```

## Podsumowanie zmian

| Lokalizacja | Zmiana |
|-------------|--------|
| Linia 312 | Dodanie `approved_at` przy zmianie na `accepted` |
| Linia 618 | Warunek ceny mobile: `offer.approved_at \|\| offer.status === 'accepted' \|\| offer.status === 'completed'` |
| Linia 671 | Warunek ceny desktop: analogicznie |

## Efekt

- Wszystkie zaakceptowane oferty będą wyświetlać cenę (nawet archiwalne bez approved_at)
- Nowe ręczne zmiany statusu na "accepted" automatycznie ustawią approved_at
- Spójność danych między statusem a znacznikiem czasu
