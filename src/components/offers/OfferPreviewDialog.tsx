import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { X, Loader2, ChevronLeft, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import { OfferState, OfferOption } from '@/hooks/useOffer';
import { OfferPreviewContent } from './OfferPreviewContent';

interface OfferPreviewDialogProps {
  open: boolean;
  onClose: () => void;
  onSendAndClose: () => Promise<void>;
  offer: OfferState;
  instanceId: string;
  calculateTotalNet: () => number;
  calculateTotalGross: () => number;
}

interface Instance {
  name: string;
  logo_url?: string;
  phone?: string;
  email?: string;
  address?: string;
  website?: string;
  social_facebook?: string;
  social_instagram?: string;
  offer_branding_enabled?: boolean;
  offer_bg_color?: string;
  offer_header_bg_color?: string;
  offer_header_text_color?: string;
  offer_section_bg_color?: string;
  offer_section_text_color?: string;
  offer_primary_color?: string;
  offer_scope_header_text_color?: string;
}

export const OfferPreviewDialog = ({
  open,
  onClose,
  onSendAndClose,
  offer,
  instanceId,
  calculateTotalNet,
  calculateTotalGross,
}: OfferPreviewDialogProps) => {
  const { t } = useTranslation();
  const [instance, setInstance] = useState<Instance | null>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (open) {
      const fetchInstance = async () => {
        setLoading(true);
        const { data } = await supabase
          .from('instances')
          .select(`
            name,
            logo_url,
            phone,
            email,
            address,
            website,
            social_facebook,
            social_instagram,
            offer_branding_enabled,
            offer_bg_color,
            offer_header_bg_color,
            offer_header_text_color,
            offer_section_bg_color,
            offer_section_text_color,
            offer_primary_color,
            offer_scope_header_text_color
          `)
          .eq('id', instanceId)
          .single();

        if (data) {
          setInstance(data);
        }
        setLoading(false);
      };
      fetchInstance();
    }
  }, [open, instanceId]);

  const handleSend = async () => {
    setSending(true);
    try {
      await onSendAndClose();
    } finally {
      setSending(false);
    }
  };

  // Map OfferState to preview format
  const mappedOffer = {
    id: offer.id || '',
    offer_number: 'PODGLĄD',
    instance_id: instanceId,
    customer_data: {
      name: offer.customerData.name,
      email: offer.customerData.email,
      phone: offer.customerData.phone,
      company: offer.customerData.company,
      nip: offer.customerData.nip,
      address: offer.customerData.companyAddress,
    },
    vehicle_data: {
      brandModel: offer.vehicleData.brandModel,
      plate: offer.vehicleData.plate,
    },
    status: offer.status,
    total_net: calculateTotalNet(),
    total_gross: calculateTotalGross(),
    vat_rate: offer.vatRate,
    notes: offer.notes,
    payment_terms: offer.paymentTerms,
    valid_until: offer.validUntil,
    hide_unit_prices: offer.hideUnitPrices,
    created_at: new Date().toISOString(),
    offer_options: offer.options.map((opt: OfferOption) => ({
      id: opt.id,
      name: opt.name,
      description: opt.description,
      is_selected: opt.isSelected,
      subtotal_net: opt.items.reduce((sum, item) => {
        const itemTotal = item.quantity * item.unitPrice * (1 - item.discountPercent / 100);
        return sum + (item.isOptional ? 0 : itemTotal);
      }, 0),
      sort_order: opt.sortOrder,
      scope_id: opt.scopeId,
      is_upsell: opt.isUpsell,
      scope: null,
      offer_option_items: opt.items.map(item => ({
        id: item.id,
        custom_name: item.customName || '',
        custom_description: item.customDescription,
        quantity: item.quantity,
        unit_price: item.unitPrice,
        unit: item.unit,
        discount_percent: item.discountPercent,
        is_optional: item.isOptional,
        products_library: null,
      })),
    })),
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent 
        className="w-[90vw] h-[90vh] max-w-none p-0 overflow-hidden flex flex-col"
        onPointerDownOutside={(e) => e.preventDefault()}
      >
        {/* Header */}
        <DialogHeader className="px-4 py-3 border-b flex-shrink-0 flex flex-row items-center justify-between">
          <DialogTitle className="text-lg font-semibold">
            {t('offers.previewTitle')}
          </DialogTitle>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="h-8 w-8"
          >
            <X className="h-4 w-4" />
          </Button>
        </DialogHeader>

        {/* Content */}
        <ScrollArea className="flex-1">
          {loading ? (
            <div className="flex items-center justify-center h-full min-h-[400px]">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : instance ? (
            <OfferPreviewContent 
              offer={mappedOffer} 
              instance={instance} 
              previewMode={true}
            />
          ) : (
            <div className="flex items-center justify-center h-full min-h-[400px]">
              <p className="text-muted-foreground">{t('common.error')}</p>
            </div>
          )}
        </ScrollArea>

        {/* Footer */}
        <div className="px-4 py-3 border-t flex-shrink-0 flex items-center justify-between bg-background">
          <Button
            variant="outline"
            onClick={onClose}
            className="gap-2"
          >
            <ChevronLeft className="w-4 h-4" />
            {t('offers.backToEdit')}
          </Button>
          <Button
            onClick={handleSend}
            disabled={sending}
            className="gap-2"
          >
            {sending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
            {t('offers.sendOffer')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
