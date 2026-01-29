

# Plan: Poprawka nawigacji w sidebarze dla roli hall

## Problem
W sidebarze dla roli `hall`:
1. Kliknięcie logo kieruje do `setCurrentView('halls')` = lista hal (HallsListView)
2. Przycisk "Halls" kieruje do `setCurrentView('halls')` = lista hal (HallsListView)

**Oczekiwane zachowanie**: Rola `hall` (kiosk/tablet) powinna być zawsze kierowana do widoku kalendarza hali (`HallView`), nie do listy zarządczej.

---

## Rozwiązanie

### Zmiany w `src/pages/AdminDashboard.tsx`

#### 1. Nawigacja z logo (linia ~2250)

```text
Przed:
onClick={() => setCurrentView(userRole === 'hall' ? 'halls' : 'calendar')}

Po:
onClick={() => {
  if (userRole === 'hall') {
    // Przekieruj do kalendarza hali
    navigate(adminBasePath ? '/admin/halls/1' : '/halls/1');
  } else {
    setCurrentView('calendar');
  }
}}
```

#### 2. Przycisk "Halls" w uproszczonym menu (linia ~2276)

```text
Przed:
<Button ... onClick={() => { setSidebarOpen(false); setTimeout(() => setCurrentView('halls'), 50); }} ...>

Po:
<Button ... onClick={() => { 
  setSidebarOpen(false); 
  setTimeout(() => navigate(adminBasePath ? '/admin/halls/1' : '/halls/1'), 50); 
}} ...>
```

---

## Diagram przepływu po zmianach

```text
Rola 'hall' w sidebarze:
        │
        ├── Klik logo ──► navigate('/halls/1') ──► HallView (kalendarz)
        │
        └── Klik "Halls" ──► navigate('/halls/1') ──► HallView (kalendarz)


Rola 'admin'/'employee' w sidebarze:
        │
        ├── Klik logo ──► setCurrentView('calendar') ──► AdminCalendar
        │
        └── Klik "Halls" ──► setCurrentView('halls') ──► HallsListView (lista zarządcza)
```

---

## Szczegóły techniczne

### Pliki do zmiany
| Plik | Zmiana |
|------|--------|
| `src/pages/AdminDashboard.tsx` | Linie ~2250 i ~2276: użycie `navigate()` zamiast `setCurrentView()` dla roli `hall` |

### Zależności
- `navigate` jest już importowane z `react-router-dom` (linia 16)
- `adminBasePath` jest już zdefiniowany (linia 152) - określa czy używamy `/admin/...` czy `/...`
- `userRole` jest już dostępny w stanie komponentu (linia 256)

---

## Weryfikacja po zmianach

1. **Zalogować się jako użytkownik z rolą `hall`**
2. **Kliknąć logo** → URL: `/halls/1`, widok: kalendarz hali (HallView)
3. **Kliknąć przycisk "Halls" w sidebarze** → URL: `/halls/1`, widok: kalendarz hali
4. **Zalogować się jako admin** → logo i "Halls" działają jak poprzednio (lista zarządcza)

