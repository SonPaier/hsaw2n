

## Poprawki: rysik (1 klik) + kafelki zdjec w DamagePointDrawer

### Problem 1: Rysik wymaga 2 klikniec

Przyczyna: W `PhotoFullscreenDialog.tsx` linia 30 ustawia `open={open && !annotationOpen}`. Gdy klikasz olowek, `annotationOpen` staje sie `true`, co zamyka dialog podgladu (`onOpenChange(false)`) i resetuje stan rodzica -- zdjecie "znika".

Rozwiazanie: Nie zamykac dialogu podgladu gdy otwieramy rysik. Zamiast tego uzywac osobnego stanu i nie wiazac `open` z `annotationOpen`.

```
// Zamiast:
open={open && !annotationOpen}

// Bedzie:
open={open}
// + ukrycie contentu podgladu gdy annotationOpen=true (display: none lub conditional render)
```

Plik: `src/components/protocols/PhotoFullscreenDialog.tsx`

### Problem 2: "Dodaj zdjecie" nie jest kafelkiem w DamagePointDrawer

Aktualnie `DamagePointDrawer.tsx` uzywa pelnej szerokosci buttona "Zrob zdjecie lub wybierz z galerii" + poziomego ScrollArea na zdjecia. Trzeba to zamienic na `grid-cols-4` z kafelkiem "Dodaj zdjecie" jako pierwszym elementem -- identycznie jak w `ProtocolPhotosUploader.tsx`.

Plik: `src/components/protocols/DamagePointDrawer.tsx`

Zmiany:
- Usunac label/button pelnej szerokosci i ScrollArea
- Dodac `grid grid-cols-4 gap-2` z kafelkiem "Dodaj zdjecie" (aspect-square, border-dashed, Camera icon + label) jako pierwszy element
- Zdjecia jako kolejne kafelki aspect-square z przyciskiem usuwania

### Podsumowanie zmian

| Plik | Zmiana |
|------|--------|
| `PhotoFullscreenDialog.tsx` | Nie zamykac podgladu gdy rysik otwarty |
| `DamagePointDrawer.tsx` | Grid 4 kolumny z kafelkiem "Dodaj zdjecie" |
