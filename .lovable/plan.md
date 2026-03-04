## Mobile calendar scroll fix — DONE

### Problem
Kalendarz na mobile "pływał" — nagłówki stacji skakały, oś czasu nie trzymała pozycji, scroll wracał do pozycji.

### Przyczyna
1. Dwa zagnieżdżone kontenery scrolla (content-wrapper + gridScrollRef)
2. Nagłówki stacji i grid to oddzielne `overflow-x-auto` kontenery synchronizowane przez JS (`onScroll` + `scrollLeft =`) — momentum scroll na iOS powodował opóźnienia
3. Touch axis-locking (`handleScrollTouchMove`) manipulował `overflow` w trakcie gestów

### Rozwiązanie
1. **Na mobile**: nagłówki stacji przeniesione WEWNĄTRZ `gridScrollRef` jako `sticky top-0` — native CSS sticky, zero JS sync
2. **Na desktop**: zachowane dotychczasowe zachowanie (dwa kontenery + JS sync)
3. Usunięte touch handlers z gridScrollRef na mobile (niepotrzebne przy jednym kontenerze)
4. Wyekstrahowano `renderDayStationHeaders()` — współdzielony render nagłówków między mobile i desktop

### Pliki zmienione
- `src/components/admin/AdminCalendar.tsx`
