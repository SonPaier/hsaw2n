
# Plan: Rozwijana lista przypomnień SMS w karcie klienta

## Cel
Dodać pod każdą kartą przypomnienia (w `CustomerRemindersTab.tsx`) rozwijalną sekcję "Zobacz pełną listę przypomnień SMS", która wyświetli szczegóły zaplanowanych wiadomości z możliwością usuwania pojedynczych pozycji.

---

## Zmiany w UI

### 1. Struktura karty przypomnienia (rozszerzona)
Każda karta będzie miała dodatkową rozwijalną sekcję:

```text
┌─────────────────────────────────────────────────────────────┐
│ PPF Folia                                                 🗑 │
│ 📅 27 lutego 2026 (1 mies.)                                  │
│ [🚗 Porsche Panamera] [Kontrola] [Zaplanowane]              │
│                                                             │
│ ▼ Zobacz pełną listę przypomnień SMS                       │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ 📱 SMS zaplanowany: 27.02.2026 o 14:00              🗑  │ │
│ │    Status: Zaplanowane                                 │ │
│ └─────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

### 2. Collapsible z labelem
- Trigger: tekst "Zobacz pełną listę przypomnień SMS" + ikona chevron
- Stan: domyślnie zwinięte
- Po rozwinięciu: lista pojedynczych SMS-ów z datą wysyłki (godzina 14:00)

### 3. Elementy listy SMS
Dla każdego przypomnienia pokażemy:
- Data wysyłki: `DD.MM.YYYY o 14:00` (hardcoded godzina zgodnie z logiką edge function)
- Status: badge (Zaplanowane/Wysłane/Anulowane/Błąd)
- Przycisk usuwania (ikona kosza)

---

## Szczegóły techniczne

### Plik: `src/components/admin/CustomerRemindersTab.tsx`

**Importy do dodania:**
```typescript
import { ChevronDown, ChevronUp, MessageSquare } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
```

**Stan do dodania:**
```typescript
const [expandedCards, setExpandedCards] = useState<Record<string, boolean>>({});
```

**Logika toggle:**
```typescript
const toggleCardExpansion = (reminderId: string) => {
  setExpandedCards(prev => ({
    ...prev,
    [reminderId]: !prev[reminderId]
  }));
};
```

**Rozwinięcie karty (wewnątrz pętli `reminders.map`):**
```tsx
<Collapsible 
  open={expandedCards[reminder.id]} 
  onOpenChange={() => toggleCardExpansion(reminder.id)}
>
  <CollapsibleTrigger className="flex items-center gap-2 text-sm text-primary hover:underline mt-3 w-full">
    {expandedCards[reminder.id] ? (
      <ChevronUp className="w-4 h-4" />
    ) : (
      <ChevronDown className="w-4 h-4" />
    )}
    <MessageSquare className="w-4 h-4" />
    <span>Zobacz pełną listę przypomnień SMS</span>
  </CollapsibleTrigger>
  
  <CollapsibleContent className="mt-3 space-y-2">
    <div className="flex items-center justify-between p-2 bg-gray-50 rounded border text-sm">
      <div>
        <div className="flex items-center gap-2">
          <MessageSquare className="w-3.5 h-3.5 text-muted-foreground" />
          <span>SMS zaplanowany: {format(new Date(reminder.scheduled_date), 'dd.MM.yyyy', { locale: pl })} o 14:00</span>
        </div>
        <Badge ...>{status}</Badge>
      </div>
      <Button variant="ghost" size="icon" onClick={() => setDeleteReminderDialog(reminder.id)}>
        <Trash2 className="w-4 h-4" />
      </Button>
    </div>
  </CollapsibleContent>
</Collapsible>
```

### Plik: `src/i18n/locales/pl.json`

Dodać klucze tłumaczeń:
```json
{
  "customers": {
    "viewRemindersList": "Zobacz pełną listę przypomnień SMS",
    "smsScheduledAt": "SMS zaplanowany: {{date}} o 14:00"
  }
}
```

---

## Podsumowanie zmian

| Plik | Zmiana |
|------|--------|
| `src/components/admin/CustomerRemindersTab.tsx` | Dodanie Collapsible z listą SMS-ów, stan `expandedCards`, importy |
| `src/i18n/locales/pl.json` | Nowe klucze tłumaczeń |

---

## Uwagi
- Godzina 14:00 jest hardcoded zgodnie z logiką w edge function `send-offer-reminders`
- Usuwanie pojedynczego SMS-a korzysta z istniejącej logiki `handleDeleteReminder`
- Każda karta ma niezależny stan rozwinięcia
