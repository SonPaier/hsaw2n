
# Plan: Naprawa normalizacji numerów telefonów - utrata cyfry "0"

## Znaleziony bug

Regex usuwający "trunk zero" jest zbyt zachłanny:

```javascript
// Błędny regex (frontend linia 40, backend linia 45):
cleaned.replace(/^\+(\d{2,3})0/, '+$1')
```

### Przykład błędu

| Krok | Wartość | Opis |
|------|---------|------|
| Input | `0048504504504` | Użytkownik wpisuje numer |
| Po `00 → +` | `+48504504504` | Zamiana prefiksu ✓ |
| Regex `(\d{2,3})` | `485` | Zachłanne dopasowanie 3 cyfr zamiast 2! |
| Regex `0` | `0` | Dopasowuje pierwszą cyfrę z "04504504" |
| Wynik | `+4854504504` | Utracono "0" ❌ |

## Przyczyna

Regex `(\d{2,3})` dopasowuje zachłannie maksymalną liczbę cyfr (3), przez co "zjada" pierwszą cyfrę numeru lokalnego.

## Rozwiązanie

Ograniczyć trunk-zero removal tylko do **znanych krajów z trunk-zero** (Niemcy, Austria, Szwajcaria, Włochy) i używać precyzyjnego dopasowania:

```javascript
// Poprawny regex - tylko dla znanych krajów z trunk-zero:
cleaned.replace(/^\+(?:49|43|41|39)0/, match => match.slice(0, -1))
// lub lepiej:
cleaned.replace(/^\+(49|43|41|39)0(\d)/, '+$1$2')
```

Polskie numery (`+48`) **NIE** używają trunk-zero, więc nie powinny być w ogóle przetwarzane przez ten regex.

## Pliki do modyfikacji

### 1. `src/lib/phoneUtils.ts` (frontend)

**Linia 40 - zmiana:**
```typescript
// PRZED (błędne):
cleaned = cleaned.replace(/^\+(\d{2,3})0/, '+$1');

// PO (poprawne):
// Trunk zero removal TYLKO dla krajów które go używają: DE, AT, CH, IT
cleaned = cleaned.replace(/^\+(49|43|41|39)0(\d)/, '+$1$2');
```

### 2. `supabase/functions/_shared/phoneUtils.ts` (backend)

**Linia 45 - zmiana:**
```typescript
// PRZED (błędne):
cleaned = cleaned.replace(/^(\+\d{1,3})0(\d)/, "$1$2");

// PO (poprawne):
// Trunk zero removal TYLKO dla krajów które go używają: DE, AT, CH, IT
cleaned = cleaned.replace(/^\+(49|43|41|39)0(\d)/, "+$1$2");
```

### 3. `src/lib/phoneUtils.test.ts` (nowe testy)

Dodanie testów dla scenariusza `0048504504504`:

```typescript
it('PU-U-033: handles 0048 prefix with number starting with 5', () => {
  expect(normalizePhone('0048504504504')).toBe('+48504504504');
});

it('PU-U-034: handles 0048 prefix with number starting with 0 (edge case)', () => {
  // Numer zaczynający się od 0 po prefiksie 48 - nie istnieje w PL
  expect(normalizePhone('0048012345678')).toBe('+48012345678');
});
```

## Sekcja techniczna

### Dlaczego regex był błędny

| Regex | Problem |
|-------|---------|
| `(\d{2,3})` | Zachłannie dopasowuje 2 LUB 3 cyfry |
| `+48504...` | Dopasowuje `485` (3 cyfry) zamiast `48` (2 cyfry) |
| Następne `0` | Dopasowuje `0` z `04504...` |
| Wynik | `+485` + `4504504` = `+4854504504` |

### Które kraje używają trunk-zero

| Kraj | Kod | Trunk zero? |
|------|-----|-------------|
| Niemcy | +49 | TAK (np. +49 0 171...) |
| Austria | +43 | TAK |
| Szwajcaria | +41 | TAK |
| Włochy | +39 | TAK |
| Polska | +48 | NIE |
| Ukraina | +380 | NIE |
| Czechy | +420 | NIE |

### Naprawa danych w bazie

Po wdrożeniu poprawki, istniejący rekord wymaga ręcznej korekty:

```sql
UPDATE reservations 
SET customer_phone = '+48504504504' 
WHERE confirmation_code = '7757872';
```
