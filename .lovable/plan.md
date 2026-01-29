

# Plan: Aktualizacja legendy kalendarza

## Podsumowanie
Legenda pod kalendarzem wymaga aktualizacji aby odzwierciedlić nowe kolory statusów:
1. **Prośba o zmianę** (`change_requested`) → zmiana z pomarańczowego na **jasny czerwony**
2. **W trakcie** (`in_progress`) → **nowa pozycja** z kolorem **pomarańczowym**

## Obecny stan legendy

| Status | Kolor | Etykieta |
|--------|-------|----------|
| Do potwierdzenia | amber | Do potwierdzenia |
| Prośba o zmianę | orange ❌ | Prośba o zmianę |
| Potwierdzony | green | Potwierdzony |
| Gotowy do wydania | sky | Gotowy do wydania |
| Wydany | slate | Wydany |

## Docelowy stan legendy

| Status | Kolor | Etykieta |
|--------|-------|----------|
| Do potwierdzenia | amber | Do potwierdzenia |
| Prośba o zmianę | **red** ✓ | Prośba o zmianę |
| W trakcie | **orange** ✓ | W trakcie |
| Potwierdzony | green | Potwierdzony |
| Gotowy do wydania | sky | Gotowy do wydania |
| Wydany | slate | Wydany |

---

## Zmiany w kodzie

**Plik:** `src/components/admin/AdminCalendar.tsx` (linie 2254-2275)

```tsx
{/* Color Legend */}
<div className="flex flex-wrap items-center justify-center gap-3 pt-4 pb-2 border-t border-border/50 mt-4">
  <div className="flex items-center gap-1.5">
    <div className="w-3 h-3 rounded bg-amber-400/80 border border-amber-500/70" />
    <span className="text-xs text-muted-foreground">Do potwierdzenia</span>
  </div>
  <div className="flex items-center gap-1.5">
    <div className="w-3 h-3 rounded bg-red-300/80 border border-red-400/70" />
    <span className="text-xs text-muted-foreground">Prośba o zmianę</span>
  </div>
  <div className="flex items-center gap-1.5">
    <div className="w-3 h-3 rounded bg-orange-400/80 border border-orange-500/70" />
    <span className="text-xs text-muted-foreground">W trakcie</span>
  </div>
  <div className="flex items-center gap-1.5">
    <div className="w-3 h-3 rounded bg-green-400/80 border border-green-500/70" />
    <span className="text-xs text-muted-foreground">Potwierdzony</span>
  </div>
  <div className="flex items-center gap-1.5">
    <div className="w-3 h-3 rounded bg-sky-300/80 border border-sky-400/70" />
    <span className="text-xs text-muted-foreground">Gotowy do wydania</span>
  </div>
  <div className="flex items-center gap-1.5">
    <div className="w-3 h-3 rounded bg-slate-400/80 border border-slate-500/70" />
    <span className="text-xs text-muted-foreground">Wydany</span>
  </div>
</div>
```

---

## Pliki do edycji

| Plik | Zmiana |
|------|--------|
| `src/components/admin/AdminCalendar.tsx` | Aktualizacja kolorów legendy + dodanie pozycji "W trakcie" |

