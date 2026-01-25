import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { useTranslation } from 'react-i18next';
import { Receipt } from 'lucide-react';

interface SelectedState {
  selectedVariants?: Record<string, string>;
  selectedUpsells?: Record<string, boolean>;
  selectedOptionalItems?: Record<string, boolean>;
  selectedScopeId?: string | null;
  selectedItemInOption?: Record<string, string>;
  totalNet?: number;
  totalGross?: number;
}

interface OfferOption {
  id: string;
  name?: string;
  scope_id?: string | null;
  is_upsell?: boolean;
  subtotal_net?: number;
  offer_option_items?: {
    id: string;
    custom_name?: string;
    unit_price?: number;
    quantity?: number;
    discount_percent?: number;
  }[];
}

interface Offer {
  id: string;
  offer_number: string;
  selected_state?: SelectedState | null;
  total_net: number;
  total_gross: number;
  vat_rate?: number;
  offer_options?: OfferOption[];
}

interface OfferSelectionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  offer: Offer;
}

export function OfferSelectionDialog({ open, onOpenChange, offer }: OfferSelectionDialogProps) {
  const { t } = useTranslation();
  const selectedState = offer.selected_state as SelectedState | null;
  
  if (!selectedState) {
    return null;
  }

  const formatPrice = (value: number) => {
    return new Intl.NumberFormat('pl-PL', {
      style: 'currency',
      currency: 'PLN',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  // Calculate item price after discount
  const calculateItemPrice = (item: { unit_price?: number; quantity?: number; discount_percent?: number }) => {
    const unitPrice = item.unit_price || 0;
    const quantity = item.quantity || 1;
    const discount = item.discount_percent || 0;
    return unitPrice * quantity * (1 - discount / 100);
  };

  // Parse selections from selected_state
  const selections: { name: string; price: number }[] = [];

  // 1. Get selected items from non-extras scopes using selectedItemInOption
  if (selectedState.selectedItemInOption && offer.offer_options) {
    Object.entries(selectedState.selectedItemInOption).forEach(([optionOrScopeId, itemId]) => {
      if (!itemId) return;
      
      // Find the item across all options (key might be option_id or scope_id)
      let foundItem: { custom_name?: string; unit_price?: number; quantity?: number; discount_percent?: number } | null = null;
      let foundOption: OfferOption | null = null;
      
      for (const option of offer.offer_options || []) {
        // Check if this option matches by id or scope_id
        if (option.id === optionOrScopeId || option.scope_id === optionOrScopeId) {
          const item = option.offer_option_items?.find(i => i.id === itemId);
          if (item) {
            foundItem = item;
            foundOption = option;
            break;
          }
        }
      }
      
      if (foundItem) {
        selections.push({
          name: foundItem.custom_name || foundOption?.name || 'Usługa',
          price: calculateItemPrice(foundItem)
        });
      }
    });
  }

  // Track which item IDs have been added to avoid duplicates
  const addedItemIds = new Set<string>();
  selections.forEach(s => {
    // Mark items added by selectedItemInOption
    Object.values(selectedState?.selectedItemInOption || {}).forEach(itemId => {
      if (itemId) addedItemIds.add(itemId);
    });
  });

  // 2. Get selected optional items (extras)
  if (selectedState.selectedOptionalItems && offer.offer_options) {
    offer.offer_options.forEach(option => {
      option.offer_option_items?.forEach(item => {
        if (selectedState.selectedOptionalItems?.[item.id] && !addedItemIds.has(item.id)) {
          addedItemIds.add(item.id);
          selections.push({
            name: item.custom_name || 'Dodatek',
            price: calculateItemPrice(item)
          });
        }
      });
    });
  }

  // Use the confirmed totals from the offer - these are what the customer agreed to
  const vatRate = offer.vat_rate ?? 23;
  const totalNet = offer.total_net;
  const totalGross = offer.total_gross;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Receipt className="w-5 h-5" />
            {t('offers.customerSelection', 'Wybór klienta')}
          </DialogTitle>
          <p className="text-sm text-muted-foreground">{offer.offer_number}</p>
        </DialogHeader>

        <div className="space-y-3 py-4">
          {selections.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              {t('offers.noSelections', 'Brak wybranych pozycji')}
            </p>
          ) : (
            <>
              {selections.map((item, idx) => (
                <div key={idx} className="flex justify-between items-start gap-4">
                  <span className="text-sm flex-1">{item.name}</span>
                  <span className="text-sm font-medium whitespace-nowrap">
                    {formatPrice(item.price)}
                  </span>
                </div>
              ))}
            </>
          )}
        </div>

        <Separator />

        <div className="space-y-2 py-2">
          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground">{t('offers.totalNet', 'Suma netto')}:</span>
            <span className="font-medium">{formatPrice(totalNet)}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground">{t('offers.totalGross', 'Suma brutto')} ({vatRate}% VAT):</span>
            <span className="font-bold text-lg">{formatPrice(totalGross)}</span>
          </div>
        </div>

        <div className="flex justify-end pt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('common.close', 'Zamknij')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
