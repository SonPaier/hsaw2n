

# Plan: Rozszerzenie protokołu o zdjęcia i ukrywanie diagramu

## Podsumowanie zmian

### 1. Dwa typy zdjęć
- **Zdjęcia protokołu** (ogólne) - niezwiązane z konkretną usterką, widoczne pod licznikiem
- **Zdjęcia usterek** (per szkoda) - powiązane z punktami uszkodzeń na diagramie

### 2. Ukrycie diagramu i typu nadwozia
- Domyślnie przy tworzeniu nowego protokołu sekcja diagramu i typ nadwozia są ukryte
- Pojawiają się dopiero po kliknięciu "Dodaj usterki"

### 3. Nowy układ formularza
Pod "Stan licznika":
1. **Przycisk "Dodaj zdjęcia"** - rozwija sekcję zdjęć protokołu
2. **Galeria zdjęć protokołu** - siatka 4 kolumny (1/4 szerokości każde)
3. **Przycisk "Dodaj usterki"** - rozwija sekcję diagramu
4. **Diagram z nagłówkiem** "Zaznacz ewentualne usterki na diagramie pojazdu"
5. **Galeria zdjęć usterek** - pod diagramem, siatka 4 kolumny

### 4. Automatyczne usuwanie niezapisanych usterek
- Przy zapisie protokołu, punkty z flagą `isNew: true` są automatycznie usuwane ze stanu
- Tylko usterki potwierdzone w drawer'ze trafiają do bazy

### 5. Widok publiczny
- Sekcja diagramu jest rozwinięta tylko jeśli istnieją jakiekolwiek usterki
- Pod diagramem wyświetlane są zdjęcia powiązane z usterkami

---

## Szczegóły techniczne

### Baza danych

Nowa kolumna w tabeli `vehicle_protocols`:
```sql
ALTER TABLE vehicle_protocols
ADD COLUMN photo_urls TEXT[] DEFAULT '{}';
```

### Komponenty do utworzenia/modyfikacji

#### 1. Nowy komponent: `ProtocolPhotosUploader.tsx`
Odpowiada za:
- Przycisk "Zrób zdjęcie lub wybierz z galerii"
- Wyświetlanie siatki zdjęć (grid 4 kolumny)
- Usuwanie zdjęć (przycisk X)
- Kompresję i upload do storage `protocol-photos`

#### 2. Modyfikacja: `CreateProtocolForm.tsx`

**Nowe stany:**
- `protocolPhotoUrls: string[]` - zdjęcia protokołu
- `showPhotosSection: boolean` - czy sekcja zdjęć jest rozwinięta
- `showDamageSection: boolean` - czy sekcja diagramu jest rozwinięta

**Zmiany w układzie:**
```text
[Stan licznika]
     ↓
[Przycisk: Dodaj zdjęcia]
     ↓ (po kliknięciu)
[Sekcja zdjęć protokołu - galeria 4 kolumny]
     ↓
[Przycisk: Dodaj usterki]
     ↓ (po kliknięciu)
[Typ nadwozia - Select]
[Nagłówek: "Zaznacz ewentualne usterki na diagramie pojazdu"]
[VehicleDiagram]
[Galeria zdjęć usterek - 4 kolumny]
     ↓
[Uwagi]
```

**Logika usuwania niezapisanych usterek:**
```typescript
// W handleSave, przed zapisem:
const savedPoints = damagePoints.filter(p => !p.isNew);
```

**Payload rozszerzony o:**
```typescript
photo_urls: protocolPhotoUrls,
```

#### 3. Modyfikacja: `PublicProtocolCustomerView.tsx`

**Zmiany:**
- Sekcja diagramu widoczna tylko gdy `damagePoints.length > 0`
- Pod diagramem galeria zdjęć zebranych ze wszystkich usterek
- Galeria zdjęć protokołu wyświetlana osobno (jeśli istnieją)

### Styl galerii zdjęć

```css
/* Grid 4 kolumny */
.photo-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 0.5rem;
}

/* Każde zdjęcie kwadratowe z object-cover */
.photo-item {
  aspect-ratio: 1;
  object-fit: cover;
  border-radius: 0.5rem;
}
```

### Przepływ UX

1. **Tworzenie protokołu:**
   - Diagram i typ nadwozia ukryte
   - Użytkownik klika "Dodaj zdjęcia" → pojawia się uploader
   - Użytkownik klika "Dodaj usterki" → pojawia się typ nadwozia + diagram
   - Kliknięcie na diagram dodaje punkt (isNew: true)
   - Kliknięcie na punkt otwiera drawer
   - Zapisanie w drawer usuwa flagę isNew
   - Zapisanie protokołu: punkty z isNew są ignorowane

2. **Edycja protokołu:**
   - Jeśli są zdjęcia protokołu → sekcja rozwinięta
   - Jeśli są usterki → sekcja diagramu rozwinięta
   - Typ nadwozia zawsze widoczny w edycji jeśli są usterki

3. **Widok publiczny:**
   - Zdjęcia protokołu wyświetlane jako galeria
   - Diagram widoczny tylko gdy są usterki
   - Pod diagramem zdjęcia ze wszystkich usterek

### Pliki do modyfikacji

| Plik | Zmiany |
|------|--------|
| `CreateProtocolForm.tsx` | Nowy układ, stany, logika sekcji |
| `PublicProtocolCustomerView.tsx` | Galerie zdjęć, warunkowy diagram |
| `types.ts` | Nowa kolumna `photo_urls` (auto-generowane po migracji) |
| Migracja SQL | Dodanie kolumny `photo_urls` |

### Nowy komponent

| Plik | Opis |
|------|------|
| `ProtocolPhotosUploader.tsx` | Komponent uploadu i galerii zdjęć |

