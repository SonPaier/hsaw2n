
# Plan: Inline data obejrzenia oferty

## Cel
Zamiana tooltipa z datą obejrzenia na tekst inline w badge, z relatywnym formatowaniem daty (dziś, wczoraj, pełna data).

## Zmiany

### 1. Dodanie funkcji formatującej datę (`src/lib/textUtils.ts`)

Nowa funkcja `formatViewedDate` zwracająca:
- `"HH:mm, dziś"` - dla dzisiejszej daty
- `"HH:mm, wczoraj"` - dla wczorajszej daty  
- `"HH:mm, d MMMM"` - dla starszych dat (np. "13:52, 26 stycznia")

```typescript
export const formatViewedDate = (dateString: string): string => {
  const date = new Date(dateString);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  
  const time = format(date, 'HH:mm', { locale: pl });
  
  if (date >= today) {
    return `${time}, dziś`;
  } else if (date >= yesterday) {
    return `${time}, wczoraj`;
  } else {
    return `${time}, ${format(date, 'd MMMM', { locale: pl })}`;
  }
};
```

### 2. Modyfikacja `OffersView.tsx`

**Linie 566-578 (desktop)** - usunięcie TooltipProvider/Tooltip, zastąpienie prostym Badge:
```tsx
{offer.status === 'viewed' && offer.viewed_at ? (
  <Badge className={cn('text-xs', statusColors[offer.status])}>
    Obejrzana {formatViewedDate(offer.viewed_at)}
  </Badge>
) : (
  // ... pozostały kod dla innych statusów
)}
```

**Linie 628-640 (mobile)** - analogiczna zmiana.

## Pliki do modyfikacji
1. `src/lib/textUtils.ts` - dodanie `formatViewedDate`
2. `src/components/admin/OffersView.tsx` - usunięcie tooltipów, inline data w 2 miejscach

## Przykładowe wyniki
- Oferta obejrzana dziś o 13:52 → `Obejrzana 13:52, dziś`
- Oferta obejrzana wczoraj o 10:30 → `Obejrzana 10:30, wczoraj`
- Oferta obejrzana 26 stycznia o 14:15 → `Obejrzana 14:15, 26 stycznia`
