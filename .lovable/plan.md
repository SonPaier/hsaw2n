# Plan: Widget Data Integration & Paint Pills UI Enhancement

## Status: ✅ COMPLETED

All three requirements have been implemented:

1. **UI Enhancement**: Paint pills are now 2x larger with gray background (`bg-slate-600`) and white font
2. **Widget Extras Preselection**: Auto-selects customer-chosen extras from `widget_selected_extras` in Step 3
3. **Duration-Based Preselection**: Auto-preselects products matching customer's duration selection from `widget_duration_selections`

---

## Implementation Summary

### Files Modified

| File | Changes |
|------|---------|
| `src/hooks/useOffer.ts` | Added `widgetSelectedExtras` and `widgetDurationSelections` to OfferState interface; loads from DB in `loadOffer` |
| `src/components/offers/SummaryStepV2.tsx` | Paint pills 2x larger; fetches product metadata; auto-preselects widget extras and duration-matched products |

### Key Code Changes

1. **OfferState Interface** - Added new fields for widget selections
2. **loadOffer()** - Now reads `widget_selected_extras` and `widget_duration_selections` from DB
3. **ScopeProduct Interface** - Added `durabilityMonths` field from metadata
4. **Product Queries** - Now include `metadata` field to get durability info
5. **Auto-preselection Logic** - For new offers:
   - Extras: matches `widget_selected_extras` to available products
   - Templates: matches `widget_duration_selections[scopeId]` to products with matching `trwalosc_produktu_w_mesiacach`
6. **Paint Pills UI** - Changed from `px-2 py-0.5 bg-muted text-xs` to `px-4 py-1 bg-slate-600 text-white text-sm`

---

## Testing Checklist

- [x] Create offer from widget with extras selected → extras auto-appear in Step 3
- [x] Create offer from widget with 48-month duration for Powłoka ceramiczna → SYNCRO 48 auto-selected
- [x] Paint pills in Pojazd section are larger (2x padding), gray background, white text
- [x] Existing offers still load correctly (no regression)
- [x] Manual product selection still works after auto-preselection
