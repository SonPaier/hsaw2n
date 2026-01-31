
# Plan: Usunięcie artefaktów `=20` z maili potwierdzających

## Problem
`=20` to zakodowany znak spacji w standardzie Quoted-Printable (używanym w emailach). Pojawia się gdy:
- Linie HTML przekraczają 76 znaków
- W HTML są niepotrzebne białe znaki (wcięcia, puste linie)

## Rozwiązanie
Zmodyfikować szablon emaila w funkcji `submit-lead` aby:
1. Usunąć wszystkie zbędne wcięcia i białe znaki z template'u HTML
2. Zapisać HTML jako "minified" string bez niepotrzebnych spacji
3. Dynamiczne sekcje (extras, budget, notes) budować bez wcięć

## Zmiany techniczne

### Plik: `supabase/functions/submit-lead/index.ts`

**Zmiana 1**: Usunięcie wcięć z dynamicznych sekcji (linie 332-354)
- `extrasSection`, `budgetSection`, `notesSection` - usunąć wcięcia ze stringów
- Zamiast:
```typescript
extrasSection = `
      <div class="summary-label">Dodatki</div>
      <div class="summary-value">...</div>
    `;
```
- Na:
```typescript
extrasSection = `<div style="...">Dodatki</div><div style="...">...</div>`;
```

**Zmiana 2**: Usunięcie wcięć z sekcji portfolio (linie 360-368)
- Analogicznie jak wyżej

**Zmiana 3**: Kompaktowy główny template HTML (linie 375-413)
- Usunąć wszystkie niepotrzebne wcięcia i nowe linie
- Zostawić jednolinijkowy (minified) HTML
- Przenieść style inline (usunąć class="summary-label" itp., bo nie ma CSS)

## Efekt
Po wdrożeniu klient otrzyma czytelny email bez artefaktów `=20`.
