

# Plan: Przycisk Fullscreen w nagłówku kalendarza

## Podsumowanie
Dodanie przycisku fullscreen (ikona `Maximize2`/`Minimize2`) obok przycisku "Protokół" w nagłówku kalendarza. Po kliknięciu uruchamia tryb pełnoekranowy przeglądarki (jak F11), ukrywając całe okno przeglądarki.

## Jak działa Fullscreen API

Browser Fullscreen API pozwala ukryć całkowicie ramkę przeglądarki (pasek adresu, zakładki, menu):

```typescript
// Wejście w fullscreen
document.documentElement.requestFullscreen();

// Wyjście z fullscreen
document.exitFullscreen();

// Sprawdzenie stanu
document.fullscreenElement !== null;
```

---

## Implementacja

### 1. Stan i logika fullscreen

W `AdminCalendar.tsx` dodamy:

```typescript
const [isFullscreen, setIsFullscreen] = useState(false);

// Nasłuchiwanie zmian stanu fullscreen (np. user naciśnie ESC)
useEffect(() => {
  const handleFullscreenChange = () => {
    setIsFullscreen(document.fullscreenElement !== null);
  };
  
  document.addEventListener('fullscreenchange', handleFullscreenChange);
  return () => {
    document.removeEventListener('fullscreenchange', handleFullscreenChange);
  };
}, []);

// Funkcja toggle
const toggleFullscreen = useCallback(async () => {
  if (!document.fullscreenElement) {
    await document.documentElement.requestFullscreen();
  } else {
    await document.exitFullscreen();
  }
}, []);
```

### 2. Przycisk w nagłówku

Dodanie przycisku obok "Protokół" (linia ~1235):

```tsx
{/* Fullscreen button - in hall mode */}
{hallMode && (
  <Button 
    variant="outline" 
    size="sm" 
    onClick={toggleFullscreen} 
    className="gap-1"
    title={isFullscreen ? t('calendar.exitFullscreen') : t('calendar.enterFullscreen')}
  >
    {isFullscreen ? (
      <Minimize2 className="w-4 h-4" />
    ) : (
      <Maximize2 className="w-4 h-4" />
    )}
  </Button>
)}
```

---

## Struktura nagłówka po zmianach

```text
[< poprzedni] [Dziś] [następny >]  |  [Dzień] [2-Dni]  |  [Plac] [Protokół] [⛶]
                                                                             ↑
                                                              przycisk fullscreen
```

---

## Tłumaczenia

**Plik:** `src/i18n/locales/pl.json`

```json
{
  "calendar": {
    "enterFullscreen": "Pełny ekran",
    "exitFullscreen": "Zamknij pełny ekran"
  }
}
```

---

## Pliki do zmodyfikowania

| Plik | Zmiana |
|------|--------|
| `src/components/admin/AdminCalendar.tsx` | State, useEffect, toggle function, przycisk z ikoną |
| `src/i18n/locales/pl.json` | Tłumaczenia dla tooltip |

---

## Uwagi techniczne

- Fullscreen API jest wspierany we wszystkich nowoczesnych przeglądarkach
- User może wyjść z fullscreen naciskając **ESC** - useEffect nasłuchuje `fullscreenchange` i aktualizuje ikonę
- Przycisk będzie widoczny tylko w `hallMode` (widok hali)
- Import ikon: `Maximize2`, `Minimize2` z `lucide-react`

