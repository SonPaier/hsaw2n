

## Tryb "Rysik" + nowe nazewnictwo plikow

### Nazewnictwo plikow

Format:

```
protokol-szkoda-{YYYYMMDD-HHmmss}.jpg
```

Przyklady:
- `protokol-szkoda-20260221-143052.jpg`
- `protokol-szkoda-20260221-143055.jpg`

Zmiana w 3 miejscach: `ProtocolPhotosUploader.tsx`, `DamagePointDrawer.tsx`, nowy `PhotoAnnotationDialog.tsx`.

---

### Tryb "Rysik"

**UX Flow:**

```text
[Klikam zdjecie] -> [Podglad pelnoekranowy]
                         |
                    [Przycisk "Rysik" (ikona olowka)]
                         |
                    [Tryb rysowania - toolbar widoczny]
                         |
              +------------ Toolbar u gory -------------+
              | [Czerwony] [Zolty] [Niebieski] | [Cofnij] [Ponow] [Wyczysc] | [X]
              +-----------------------------------------+
                         |
              [Rysujesz palcem/mysza po zdjeciu]
                         |
              [Przycisk "Zapisz" na dole -- widoczny tylko gdy sa stroki]
                         |
              [Nowy JPEG -> stary usuniety ze storage]
              [URL w photo_urls[] zastapiony nowym]
```

**Widocznosc przyciskow:**

- Toolbar (kolory, Cofnij, Ponow, Wyczysc) -- widoczny tylko gdy rysik jest wlaczony
- Przycisk "Zapisz" -- widoczny tylko gdy rysik wlaczony ORAZ jest co najmniej 1 stroke
- Cofnij -- aktywny gdy `strokes.length > 0`
- Ponow -- aktywny gdy `redoStack.length > 0`
- Wyczysc -- aktywny gdy `strokes.length > 0`

**Kolory -- jeden kolor dla calego rysunku:**

Zmiana koloru zmienia kolor **wszystkich** narysowanych kresek naraz. Implementacja: historia strokow przechowuje tylko sciezki (punkty), bez koloru. Przy renderowaniu wszystkie stroki rysowane sa aktualnie wybranym kolorem.

- Czerwony (`#FF0000`) -- domyslny
- Zolty (`#FFD600`)
- Niebieski (`#0066FF`)
- Grubosc: 4px

**Undo / Redo / Clear:**

- **Cofnij (Undo):** przenosi ostatni stroke ze `strokes[]` na `redoStack[]`
- **Ponow (Redo):** przenosi ostatni element z `redoStack[]` z powrotem na `strokes[]`
- **Wyczysc (Clear):** czysci `strokes[]` i `redoStack[]` -- czysta kartka
- Nowy stroke czysci `redoStack[]` (jak w kazdym edytorze)
- Max 20 krokow wstecz

**Zapis:** JPEG 0.85 quality, max 1200px. Nowy plik zastepuje stary (stary usuwany ze storage).

---

### Szczegoly techniczne

**Stan komponentu PhotoAnnotationDialog:**

```typescript
type Stroke = { points: { x: number; y: number }[] };

const [strokes, setStrokes] = useState<Stroke[]>([]);
const [redoStack, setRedoStack] = useState<Stroke[]>([]);
const [activeColor, setActiveColor] = useState('#FF0000');
const [isDrawingMode, setIsDrawingMode] = useState(false);

const hasStrokes = strokes.length > 0;
const canUndo = strokes.length > 0;
const canRedo = redoStack.length > 0;
```

Kazdy `pointerup` dodaje nowy Stroke i czysci `redoStack`. Renderowanie: iteracja po `strokes[]` -- kazdy rysowany kolorem `activeColor`. Zmiana koloru = przerysowanie calego canvasa.

**Nowy plik:**
- `src/components/protocols/PhotoAnnotationDialog.tsx`

**Pliki do zmiany:**

1. **`PhotoFullscreenDialog.tsx`** -- nowy prop `onAnnotate?: (newUrl: string) => void`, przycisk "Rysik" (toggle wlacz/wylacz tryb rysowania)
2. **`DamagePointDrawer.tsx`** -- nazewnictwo `protokol-szkoda-{timestamp}.jpg`, callback `onAnnotate` do zastapienia URL w `photoUrls[]`
3. **`ProtocolPhotosUploader.tsx`** -- nazewnictwo `protokol-szkoda-{timestamp}.jpg`
4. **`CreateProtocolForm.tsx`** -- przekazanie `onAnnotate` do `PhotoFullscreenDialog` dla zdjec pod diagramem

