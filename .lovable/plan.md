
# Plan: Widget Data Integration & Paint Pills UI Enhancement

## Overview
This plan addresses three requirements:
1. **UI Enhancement**: Make paint pills larger (2x), gray background with white font
2. **Widget Extras Preselection**: Auto-select customer-chosen extras from `widget_selected_extras` in Step 3
3. **Duration-Based Preselection**: Auto-preselect products matching customer's duration selection from `widget_duration_selections`

---

## Part 1: Paint Pills UI Enhancement

### Current State
In `SummaryStepV2.tsx` (lines 804-816), paint pills use:
- `px-2 py-0.5` (small padding)
- `bg-muted` (light background)
- `text-xs` (small text)
- Dark text on light background

### Changes
Update the pills styling in the "Pojazd" section:

```tsx
// Before (lines 805-816):
<div className="flex flex-wrap gap-2 mt-1">
  <span className="px-2 py-0.5 bg-muted rounded-full text-xs font-medium">
    {offer.vehicleData.paintColor}
  </span>
  <span className="px-2 py-0.5 bg-muted rounded-full text-xs font-medium">
    {paintTypeLabel}
  </span>
</div>

// After:
<div className="flex flex-wrap gap-2 mt-1">
  <span className="px-4 py-1 bg-slate-600 text-white rounded-full text-sm font-medium">
    {offer.vehicleData.paintColor}
  </span>
  <span className="px-4 py-1 bg-slate-600 text-white rounded-full text-sm font-medium">
    {paintTypeLabel}
  </span>
</div>
```

Changes:
- `px-2 py-0.5` → `px-4 py-1` (2x larger padding)
- `bg-muted` → `bg-slate-600` (gray background)
- Add `text-white` (white font)
- `text-xs` → `text-sm` (larger text)

---

## Part 2: Widget Extras Preselection

### Data Flow
1. Customer selects extras on widget → saved to `offers.widget_selected_extras` (uuid[])
2. When loading offer in Step 3 → read these IDs and auto-add to "Dodatki wybrane przez klienta"

### Changes to useOffer.ts

Add `widgetSelectedExtras` and `widgetDurationSelections` to OfferState interface:

```typescript
export interface OfferState {
  // ... existing fields
  widgetSelectedExtras?: string[];          // uuid[] from widget
  widgetDurationSelections?: Record<string, number | null>; // templateId → months
}
```

In `loadOffer` function (around line 955), after loading vehicleData, add:

```typescript
// Load widget selections for offer hydration in Step 3
const widgetSelectedExtras = (offerData as any).widget_selected_extras || [];
const widgetDurationSelections = (offerData as any).widget_duration_selections || {};
```

Include these in the setOffer call (around line 1035):

```typescript
setOffer({
  // ... existing fields
  widgetSelectedExtras,
  widgetDurationSelections,
});
```

### Changes to SummaryStepV2.tsx

In the extras scope initialization logic (around lines 366-373), after checking for persisted offers:

```typescript
// For NEW offers from widget: auto-add widget-selected extras
if (!isPersistedOffer && scope.is_extras_scope && offer.widgetSelectedExtras?.length) {
  // Find matching products from availableProducts
  const widgetExtrasProducts = scopeProducts.filter(
    p => offer.widgetSelectedExtras?.includes(p.product_id) && p.product
  );
  
  // Add as preselected (not just suggested)
  const widgetPreselected = widgetExtrasProducts.map(p => toSelectedProduct(p, true));
  selectedProducts = [...selectedProducts, ...widgetPreselected];
}
```

This ensures that extras chosen by the customer on the widget appear automatically in the "Dodatki wybrane przez klienta" section.

---

## Part 3: Duration-Based Product Preselection

### Concept
When customer selects "4 lata" (48 months) for a template, we need to:
1. Read `widget_duration_selections[templateId] = 48`
2. Find products in that template with `metadata.trwalosc_produktu_w_mesiacach === 48`
3. Auto-preselect those products

### Changes to SummaryStepV2.tsx

#### 1. Fetch product metadata with durability info

Update the products query (around line 197-203) to include metadata:

```typescript
const { data: allProductsData } = await supabase
  .from('unified_services')
  .select('id, name, short_name, default_price, price_from, price_small, price_medium, price_large, category_id, service_type, visibility, metadata')
  // ... rest of query
```

#### 2. Extend ScopeProduct interface to include durability

```typescript
interface ScopeProduct {
  id: string;
  product_id: string;
  variant_name: string | null;
  is_default: boolean;
  product: ProductPricing | null;
  durabilityMonths?: number | null; // NEW: from metadata.trwalosc_produktu_w_mesiacach
}
```

#### 3. Map durability when building scopeProducts

When building scopeProducts (lines 236-254 and 256-277), include durability:

```typescript
// For extras scope:
scopeProducts = filteredProductsData.map(product => ({
  // ... existing fields
  durabilityMonths: (product as any).metadata?.trwalosc_produktu_w_mesiacach || null
}));

// For regular scopes - need to join with full product data
// When fetching offer_scope_products, also need to get metadata
```

#### 4. Auto-preselect products matching duration

In the initialization logic for non-extras scopes (around line 366):

```typescript
// For NEW offers from widget with duration selection: auto-preselect matching products
if (!isPersistedOffer && !scope.is_extras_scope) {
  const selectedDuration = offer.widgetDurationSelections?.[scope.id];
  
  if (selectedDuration !== undefined && selectedDuration !== null) {
    // Filter products matching the selected duration
    const durationMatchingProducts = scopeProducts.filter(
      p => p.durabilityMonths === selectedDuration && p.product
    );
    
    if (durationMatchingProducts.length > 0) {
      // Replace default selection with duration-matched product(s)
      selectedProducts = durationMatchingProducts.map(p => toSelectedProduct(p, true));
    }
  }
}
```

---

## Files to Modify

| File | Changes |
|------|---------|
| `src/hooks/useOffer.ts` | Add `widgetSelectedExtras` and `widgetDurationSelections` to OfferState; load from DB in `loadOffer` |
| `src/components/offers/SummaryStepV2.tsx` | 1) Paint pills styling 2x larger with gray bg + white text; 2) Fetch product metadata; 3) Auto-preselect widget extras; 4) Auto-preselect products matching duration selection |

---

## Technical Details

### Database Query Updates

Update the `offer_scope_products` query to include product metadata:

```typescript
const { data: scopeProductsData } = await supabase
  .from('offer_scope_products')
  .select(`
    id, scope_id, product_id, variant_name, is_default, sort_order,
    product:unified_services!product_id(
      id, name, short_name, default_price, price_from, 
      price_small, price_medium, price_large, category_id, metadata
    )
  `)
  // ...
```

### Interface Updates

```typescript
// Extended ProductPricing to include metadata
interface ProductPricing {
  id: string;
  name: string;
  short_name: string | null;
  default_price: number | null;
  price_from: number | null;
  price_small: number | null;
  price_medium: number | null;
  price_large: number | null;
  category: string | null;
  metadata?: { trwalosc_produktu_w_mesiacach?: number } | null;
}
```

---

## Testing Checklist

- [ ] Create offer from widget with extras selected → extras auto-appear in Step 3
- [ ] Create offer from widget with 48-month duration for Powłoka ceramiczna → SYNCRO 48 auto-selected
- [ ] Paint pills in Pojazd section are larger (2x padding), gray background, white text
- [ ] Existing offers still load correctly (no regression)
- [ ] Manual product selection still works after auto-preselection
