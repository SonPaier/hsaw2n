

## Usunięcie banera "Ta oferta wygasła" z widoku publicznego

### Co robimy
Usuwamy baner z czerwonym komunikatem "Ta oferta wygasła" wyświetlany na publicznej stronie oferty (`/offers/:token`), gdy data ważności minęła.

### Zmiana
Plik: `src/components/offers/PublicOfferCustomerView.tsx`, linie 685-693

Usunięcie bloku:
```tsx
{mode === 'public' && isExpired && (
  <Card className="border-destructive bg-destructive/10">
    <CardContent className="py-4 flex items-center gap-3">
      <Clock className="w-5 h-5 text-destructive" />
      <p className="text-destructive font-medium">{t('publicOffer.offerExpired')}</p>
    </CardContent>
  </Card>
)}
```

Zmienna `isExpired` zostaje — jest używana w logice `canRespond` (linia 510), która blokuje interakcje po wygaśnięciu. Usuwamy tylko wizualny baner.

