
# Plan: Widget Lead Form Bugfixes and Duration Selection Feature

## Overview
This plan addresses multiple bugs in the widget-to-offer flow and adds a new duration-based package selection feature for coating products.

---

## Part 1: Bug Fixes

### 1.1 Paint Finish Not Loading in Offer Editor

**Root Cause:** The `loadOffer` function in `useOffer.ts` (lines 948-954) only reads `vehicleData` from the `vehicle_data` JSONB column. However, `submit-lead` saves `paint_color` and `paint_finish` to their own separate columns on the `offers` table, not inside `vehicle_data`.

**Fix:**
- Modify `useOffer.ts` `loadOffer` function to merge the separate `paint_color` and `paint_finish` columns into `vehicleData`:

```typescript
// After line 954 in loadOffer:
const vehicleData: VehicleData = {
  brandModel: ...,
  plate: ...,
  paintColor: vehicleDataRaw.paintColor || offerData.paint_color || '',
  paintType: vehicleDataRaw.paintType || offerData.paint_finish || '',
};
```

---

### 1.2 Customer-Selected Extras Not Appearing in Step 3

**Root Cause:** When `submit-lead` is called with `extra_service_ids`, it only creates `offer_options` for templates but ignores the extras array completely. The extras selected by the customer are not saved anywhere.

**Fix - submit-lead Edge Function:**
1. After creating template options, also create items for the Extras scope
2. Save the `extra_service_ids` to a new field in `offers` table OR directly insert into the extras option as items
3. Mark these items as preselected in `selected_state.selectedOptionalItems`

**Implementation:**
```typescript
// In submit-lead/index.ts:
// 1. Find or create the Extras scope option
// 2. Insert offer_option_items for each extra_service_id
// 3. Build selected_state with selectedOptionalItems mapping
```

**Database Change:**
- Add `widget_selected_extras` (uuid[]) column to `offers` table to persist widget selections for later hydration

---

### 1.3 Paint Color/Type Displayed Twice

**Root Cause:** In `SummaryStepV2.tsx`, paint information is rendered in both the "Klient" section (lines 776-783) and the "Pojazd" section (lines 811-816).

**Fix:**
1. Remove paint display from "Klient" section (delete lines 776-783)
2. Update "Pojazd" section to display paint as styled pills:

```tsx
// In Pojazd section:
{(offer.vehicleData.paintColor || offer.vehicleData.paintType) && (
  <div className="flex flex-wrap gap-2 mt-1">
    {offer.vehicleData.paintColor && (
      <span className="px-2 py-0.5 bg-muted rounded-full text-xs font-medium">
        {offer.vehicleData.paintColor}
      </span>
    )}
    {offer.vehicleData.paintType && (
      <span className="px-2 py-0.5 bg-muted rounded-full text-xs font-medium">
        {offer.vehicleData.paintType === 'gloss' ? 'Połysk' : 'Mat'}
      </span>
    )}
  </div>
)}
```

---

## Part 2: Duration-Based Package Selection (New Feature)

### 2.1 Concept
Templates like "Powłoka ceramiczna" have multiple services with different durabilities (12, 24, 36, 48, 60 months). In the widget, customers should see radio buttons to select their preferred package duration:
- "1 rok" (12 months)
- "2 lata" (24 months)  
- "3 lata" (36 months)
- "4 lata" (48 months)
- "5 lat" (60 months)
- "Nie wiem, proszę o propozycję" (null)

### 2.2 Data Model Changes

**offer_scopes table:**
- Add `available_durations` (integer[]) - auto-computed from assigned services' metadata

**offers table:**
- Add `widget_duration_selections` (jsonb) - maps template_id to selected duration in months
  - Example: `{"af7e2d07-...": 36, "2be777fe-...": null}`

### 2.3 Backend Changes

**get-embed-config Edge Function:**
1. For each template, query its products to find unique durability values
2. Return `available_durations` array with the template data:
```json
{
  "templates": [
    {
      "id": "...",
      "name": "Powłoka ceramiczna",
      "available_durations": [12, 24, 36, 48, 60]
    }
  ]
}
```

**submit-lead Edge Function:**
1. Accept new `duration_selections` field in offer_details
2. Save to `offers.widget_duration_selections`
3. This data will be used in Step 3 to pre-filter products

### 2.4 Widget UI Changes (EmbedLeadForm.tsx)

1. For each template with `available_durations.length > 0`:
   - Display radio group under the template checkbox
   - Options: duration values mapped to Polish labels + "Nie wiem" option
   
2. Duration label mapping:
```typescript
const formatDuration = (months: number): string => {
  const years = months / 12;
  if (years === 1) return '1 rok';
  if (years < 5) return `${years} lata`;
  return `${years} lat`;
};
```

3. Update FormData type:
```typescript
interface FormData {
  // ... existing fields
  durationSelections: Record<string, number | null>; // template_id -> months
}
```

### 2.5 Step 3 Integration (Future)

When loading an offer from widget:
1. Read `widget_duration_selections` from offer
2. For templates with duration selection, filter available products to match the selected durability
3. Auto-preselect the matching products

---

## Technical Implementation Summary

### Files to Modify:

| File | Changes |
|------|---------|
| `src/hooks/useOffer.ts` | Load `paint_color`, `paint_finish` from separate columns |
| `src/components/offers/SummaryStepV2.tsx` | Remove paint from Klient section, add pills styling in Pojazd |
| `supabase/functions/submit-lead/index.ts` | Save extras as option items, save duration selections |
| `supabase/functions/get-embed-config/index.ts` | Return available_durations per template |
| `src/pages/EmbedLeadForm.tsx` | Add duration radio groups for applicable templates |
| `src/components/offers/settings/EmbedLeadFormPreview.tsx` | Add duration radios to preview |

### Database Migration:

```sql
-- Add columns for widget data persistence
ALTER TABLE offers ADD COLUMN IF NOT EXISTS widget_selected_extras uuid[];
ALTER TABLE offers ADD COLUMN IF NOT EXISTS widget_duration_selections jsonb;

-- Add available_durations to offer_scopes (computed, for caching)
ALTER TABLE offer_scopes ADD COLUMN IF NOT EXISTS available_durations integer[];
```

---

## Implementation Order

1. **Bug fixes first** (immediate impact):
   - 1.1 Paint finish loading
   - 1.3 Remove duplicate paint display
   
2. **Extras persistence** (core functionality):
   - 1.2 Database migration + submit-lead + Step 3 hydration
   
3. **Duration feature** (new feature):
   - 2.2-2.5 Full implementation

---

## Testing Checklist

- [ ] Create offer from widget with "Mat" selected → verify radio shows Mat in offer editor
- [ ] Create offer from widget with extras selected → verify extras appear in Step 3 "Dodatki wybrane przez klienta"
- [ ] View Step 3 summary → paint info only in Pojazd section as pills
- [ ] Widget shows duration radios for ceramic coating template
- [ ] Duration selection persists and is readable when editing offer
