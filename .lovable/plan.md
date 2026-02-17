
# Tracking historii ogladania ofert

## Co robimy
1. Tworzymy tabele `offer_views` w bazie danych do logowania kazdego otwarcia oferty (czas trwania, kiedy)
2. W `PublicOfferCustomerView` dodajemy tracking -- przy otwarciu oferty tworzymy wpis, przy wyjsciu aktualizujemy `duration_seconds`
3. Badge "Obejrzana 15:27, 6 lutego" dostaje ikonke oczka (Eye) i staje sie klikalny -- klikniecie otwiera dialog z historia ogladania
4. Dialog pokazuje liste wizyt: data/godzina, czas trwania (minuty i sekundy), oraz podsumowanie (ile razy, laczny czas)

## Jak to wyglada

Badge na liscie ofert:
- Ikonka oczka + tekst "Obejrzana 15:27, 6 lutego"
- Klikniecie otwiera dialog (nie otwiera oferty -- `e.stopPropagation()`)

Dialog historii ogladania:
- Tytul: "Historia ogladania"
- Lista wpisow: "6 lut, 15:27 -- 3 min 24 s"
- Na gorze podsumowanie: "Wyswietlenia: 4 | Laczny czas: 12 min 8 s"
- Stare oferty (sprzed wdrozenia) pokaza tylko "Obejrzana" z data z `viewed_at`, bez szczegolowych danych

## Szczegoly techniczne

### 1. Migracja bazy danych -- tabela `offer_views`
```sql
CREATE TABLE public.offer_views (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  offer_id uuid NOT NULL REFERENCES public.offers(id) ON DELETE CASCADE,
  instance_id uuid NOT NULL,
  started_at timestamptz NOT NULL DEFAULT now(),
  duration_seconds integer DEFAULT 0,
  is_admin_preview boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_offer_views_offer_id ON public.offer_views(offer_id);

ALTER TABLE public.offer_views ENABLE ROW LEVEL SECURITY;

-- Publiczny insert (klient otwiera oferte)
CREATE POLICY "Public can insert offer views"
  ON public.offer_views FOR INSERT
  WITH CHECK (true);

-- Publiczny update duration (klient zamyka oferte)
CREATE POLICY "Public can update own offer views"
  ON public.offer_views FOR UPDATE
  USING (true);

-- Admini moga czytac
CREATE POLICY "Admins can view offer views"
  ON public.offer_views FOR SELECT
  USING (
    has_role(auth.uid(), 'super_admin'::app_role)
    OR has_instance_role(auth.uid(), 'admin'::app_role, instance_id)
  );
```

### 2. Tracking w `PublicOfferCustomerView`
- Przy renderowaniu komponentu: `INSERT` do `offer_views` (z `offer_id`, `instance_id`, `is_admin_preview`)
- Zapamietanie `viewId` i `startTime`
- Na `visibilitychange` (hidden) i `beforeunload`: `UPDATE` z obliczonym `duration_seconds`
- Wykluczenie podgladu admina (`is_admin_preview = true`) -- bedzie zapisywane, ale w dialogu mozna filtrowac

### 3. Nowy komponent `OfferViewsDialog`
- Przyjmuje `offerId`, `viewedAt` (legacy), `open`, `onOpenChange`
- Pobiera dane z `offer_views` WHERE `offer_id` i `is_admin_preview = false`
- Wyswietla podsumowanie + liste wizyt posortowanych od najnowszej
- Jesli brak wpisow w `offer_views`, ale jest `viewed_at` -- pokazuje "Obejrzana" z data legacy

### 4. Zmiany w `OffersView.tsx`
- Badge "Obejrzana..." staje sie `<button>` z `onClick={e.stopPropagation(); openDialog()}`
- Dodanie ikonki `<Eye className="w-3 h-3" />` przed tekstem w badge
- Render `OfferViewsDialog` w drzewie komponentu
- Ten sam wzorzec na desktop (linia ~705) i mobile (linia ~768)

### 5. Tlumaczenia w `pl.json`
- Dodanie kluczy: `offers.viewHistory`, `offers.viewCount`, `offers.totalTime`, `offers.noViewData`
