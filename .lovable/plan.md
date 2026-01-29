

# Plan: Powiększenie fontów i wymuszenie usług na widoku hali

## Podsumowanie
1. **Powiększenie fontów o 50%** na kartach rezerwacji w kalendarzu gdy włączony jest `hallMode`
2. **Usługi (pills) zawsze widoczne** niezależnie od ustawień `visible_fields.services` w konfiguracji hali

---

## Aktualne rozmiary fontów w hallMode

| Element | Aktualny rozmiar | Nowy rozmiar (+50%) |
|---------|-----------------|---------------------|
| Czas (godziny) | `text-[12px] md:text-[15px]` | `text-[18px] md:text-[22px]` |
| Pojazd/Klient | `text-xs md:text-sm` (12px/14px) | `text-lg md:text-xl` (18px/20px) |
| Usługi (pills) | `text-[9px] md:text-[10px]` | `text-sm md:text-[15px]` |

---

## Zmiany w kodzie

**Plik:** `src/components/admin/AdminCalendar.tsx`

### 1. Czas (linia 1593-1598)

```tsx
// BYŁO:
{hallMode ? <div className="text-[12px] md:text-[15px] font-bold truncate pb-0.5 flex items-center gap-1">

// BĘDZIE:
{hallMode ? <div className="text-[18px] md:text-[22px] font-bold truncate pb-0.5 flex items-center gap-1">
```

### 2. Pojazd i klient (linia 1614-1625)

```tsx
// BYŁO:
<div className="flex items-center gap-1 text-xs md:text-sm min-w-0">
  <span className="font-semibold truncate max-w-[50%]">
    {reservation.vehicle_plate}
  </span>

// BĘDZIE:
<div className="flex items-center gap-1.5 text-lg md:text-xl min-w-0">
  <span className="font-bold truncate max-w-[50%]">
    {reservation.vehicle_plate}
  </span>
```

### 3. Usługi (pills) - powiększenie i wymuszenie widoczności

Usługi muszą być widoczne w hallMode **zawsze**, niezależnie od konfiguracji hali. Dodajemy specjalny blok dla hallMode:

```tsx
// Linia 1636-1645 - dodanie warunku dla hallMode z większymi fontami
{hallMode ? (
  // Hall mode: services always visible with larger fonts
  reservation.services_data && reservation.services_data.length > 0 ? (
    <div className="flex flex-wrap gap-1 mt-1">
      {reservation.services_data.map((svc, idx) => (
        <span key={idx} className="inline-block px-1.5 py-0.5 text-sm md:text-[15px] font-medium bg-slate-700/90 text-white rounded leading-tight">
          {svc.shortcut || svc.name}
        </span>
      ))}
    </div>
  ) : reservation.service && (
    <div className="flex flex-wrap gap-1 mt-1">
      <span className="inline-block px-1.5 py-0.5 text-sm md:text-[15px] font-medium bg-slate-700/90 text-white rounded leading-tight">
        {reservation.service.shortcut || reservation.service.name}
      </span>
    </div>
  )
) : (
  // Standard admin mode (unchanged)
  reservation.services_data && reservation.services_data.length > 0 ? ...
)}
```

---

## Wizualne porównanie

```text
PRZED (hallMode):
┌──────────────────────────────┐
│ 10:00 - 11:30                │  ← 12px/15px
│ WPI 12345  Jan Kowalski      │  ← 12px/14px  
│ [Mycie podstawowe]           │  ← 9px/10px
└──────────────────────────────┘

PO (hallMode + 50% większe):
┌──────────────────────────────┐
│ 10:00 - 11:30                │  ← 18px/22px
│ WPI 12345  Jan Kowalski      │  ← 18px/20px  
│ [Mycie podstawowe]           │  ← 14px/15px
└──────────────────────────────┘
```

---

## Pliki do modyfikacji

| Plik | Zmiana |
|------|--------|
| `src/components/admin/AdminCalendar.tsx` | Powiększenie fontów w hallMode + wymuszenie widoczności usług |

---

## Uwagi

- Zmiany dotyczą **tylko** trybu `hallMode` - standardowy widok admina pozostaje bez zmian
- Usługi są teraz wyświetlane **zawsze** w hallMode, niezależnie od ustawienia `visible_fields.services`
- Zwiększono też `gap` i `padding` dla lepszej czytelności na większych ekranach kiosku

