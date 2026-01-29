

# Plan: Nowy komponent HallReservationCard z listą usług

## Podsumowanie
Stworzenie nowego komponentu `HallReservationCard` dla widoku hali z dużymi przyciskami akcji. Usługi będą wyświetlane jako pionowa lista (bold), nie chipy.

## Zaktualizowane rozmiary fontów

| Element | Rozmiar | Styl |
|---------|---------|------|
| Czas + data | 28px | italic, szary |
| Klient (z telefonem) | 20px | bold |
| Model auta | 38px | bold |
| Usługi (lista) | 24px | bold, pionowo |
| Notatka deadline | 20px | żółte tło, czerwony tekst |
| START/STOP/WYDAJ | 24px | bold |
| Wyślij SMS | 20px | semibold |

---

## Struktura wizualna karty

```text
┌─────────────────────────────────────────────────────────────┐
│                                               [X]           │
│                                                             │
│   09:00 - 17:00 · 24 sty - 3 lut 2026        (28px, gray)  │
│                                                             │
│   Rafał Kamiński (693 178 704)               (20px, bold)  │
│                                                             │
│   Audi A6                                    (38px, bold)  │
│                                                             │
│   Mycie podstawowe                           (24px, bold)  │
│   Pranie tapicerki                           (24px, bold)  │
│   Korekta lakieru                            (24px, bold)  │
│   Powłoka ceramiczna                         (24px, bold)  │
│                                                             │
│   ⚠️ Notatka z admin_notes                   (20px, żółte) │
│                                                             │
│   ┌──────────────────────────────────────────────────────┐ │
│   │                       START                          │ │
│   └──────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

---

## Faza 1: Nowy komponent HallReservationCard

**Plik:** `src/components/admin/halls/HallReservationCard.tsx`

### Props interface

```typescript
interface HallReservationCardProps {
  reservation: {
    id: string;
    customer_name: string;
    customer_phone: string;
    vehicle_plate: string;
    reservation_date: string;
    end_date?: string | null;
    start_time: string;
    end_time: string;
    status: string;
    services_data?: Array<{ name: string }>;
    admin_notes?: string | null;
    instance_id: string;
  };
  open: boolean;
  onClose: () => void;
  onStartWork: (id: string) => Promise<void>;
  onEndWork: (id: string) => Promise<void>;
  onRelease: (id: string) => Promise<void>;
  onSendPickupSms: (id: string) => Promise<void>;
}
```

### Stylowanie usług (lista pionowa)

```tsx
{/* Lista usług - pionowo, bold */}
<div className="space-y-1">
  {services_data?.map((service, idx) => (
    <div key={idx} className="text-2xl font-bold">
      {service.name}
    </div>
  ))}
</div>
```

### Flow przycisków

| Status | Przycisk(i) | Kolor |
|--------|-------------|-------|
| pending/confirmed | START | zielony `bg-green-500` |
| in_progress | STOP | czerwony `bg-red-500` |
| completed | SMS + WYDAJ | fioletowy + niebieski |
| released | zamknij kartę | - |

### Pozostałe style

- **Overlay:** `fixed inset-0 bg-black/50 z-50`
- **Karta:** `max-w-4xl w-[70%] min-w-[500px] bg-white rounded-xl shadow-2xl p-8`
- **Przycisk X:** `absolute top-4 right-4`
- **Czas/data:** `text-[28px] italic text-gray-500`
- **Klient:** `text-xl font-bold`
- **Auto:** `text-[38px] font-bold`
- **Notatka:** `text-xl bg-yellow-100 text-red-600 rounded-lg p-4`

---

## Faza 2: Modyfikacja HallView.tsx

### Zmiany

1. Import nowego `HallReservationCard`
2. Pobranie `unified_services` do mapowania nazw usług
3. Dodanie funkcji `handleSendPickupSms` (wywołanie edge function `send-sms-message`)
4. Zamiana `ReservationDetailsDrawer` na `HallReservationCard`

---

## Faza 3: Tłumaczenia

**Plik:** `src/i18n/locales/pl.json`

```json
{
  "hallCard": {
    "start": "START",
    "stop": "STOP",
    "release": "WYDAJ",
    "sendPickupSms": "Wyślij SMS: auto do odbioru"
  }
}
```

---

## Podsumowanie zmian

| Plik | Typ | Opis |
|------|-----|------|
| `src/components/admin/halls/HallReservationCard.tsx` | Nowy | Karta rezerwacji z listą usług i dużymi przyciskami |
| `src/pages/HallView.tsx` | Modyfikacja | Import karty, mapowanie services, SMS handler |
| `src/i18n/locales/pl.json` | Modyfikacja | Tłumaczenia dla przycisków |

