

## Plan: 3 zmiany (hover klientow, przypomnienia PPF, usuwanie Widget)

### 1. Jasniejszy hover na kartach klientow + formatowanie telefonu

**CustomersList.tsx** i **CustomersView.tsx**:
- Zmiana klasy hover z `hover:bg-muted/50` na `hover:bg-accent/30` (jasniejszy, subtelniejszy efekt)
- Import `formatPhoneDisplay` z `@/lib/phoneUtils` i uzycie go do wyswietlania numeru telefonu zamiast surowego `customer.phone`
- Dotyczy obu plikow (CustomersList uzywa wlasnego renderowania, CustomersView ma swoj renderCustomerList)

### 2. Skopiowanie szablonow przypomnien PPF z ARMCAR do ULTRAFIT

Z ARMCAR istnieje szablon **"PPF Folia"** (id: `f6d18a1f`):
- Kontrola (bezplatna) po 1 miesiacu
- Serwis (platny) po 12 miesiacach
- SMS template: `{short_name}: Przypominamy o {service_type} dla {vehicle_info}. {paid_info}. Zadzwon: {reservation_phone}`

Tworzymy **2 szablony** w instancji ultrafit (`29f15eeb-5ada-446c-9351-0194dbc886fd`):

| Szablon | Elementy |
|---------|----------|
| **Serwis PPF** | Kontrola (bezplatna, 1 mies.) + Serwis (platny, 12 mies.) |
| **Przeglad PPF** | Kontrola (bezplatna, 1 mies.) |

Oba z tym samym szablonem SMS co w ARMCAR.

### 3. Usuniecie zakladki Widget z Ustawien

**SettingsView.tsx**:
- Usuniecie wpisu `{ key: 'widget', ... }` z tablicy `allTabs`
- Usuniecie `case 'widget'` z `renderTabContent()`
- Usuniecie importu `WidgetSettings`

---

### Szczegoly techniczne

**Pliki do edycji:**
- `src/components/admin/CustomersList.tsx` -- import formatPhoneDisplay, hover
- `src/components/admin/CustomersView.tsx` -- import formatPhoneDisplay, hover
- `src/components/admin/SettingsView.tsx` -- usun widget tab

**Operacje bazodanowe:**
- 2x INSERT do `reminder_templates` (instancja ultrafit)
