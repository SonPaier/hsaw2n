import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronLeft, Send, Loader2, X } from 'lucide-react';
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
import { PublicOfferCustomerView, PublicOfferData } from './PublicOfferCustomerView';

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
  offer_portfolio_url?: string;
  offer_google_reviews_url?: string;
  contact_person?: string;
  offer_bank_company_name?: string;
  offer_bank_account_number?: string;
  offer_bank_name?: string;
}

interface ScopeData {
  id: string;
  name: string;
  is_extras_scope: boolean;
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
  const [scopes, setScopes] = useState<Record<string, ScopeData>>({});
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (open) {
      const fetchData = async () => {
        setLoading(true);
        
        // Fetch instance data
        const { data: instanceData } = await supabase
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
            offer_scope_header_text_color,
            offer_portfolio_url,
            offer_google_reviews_url,
            contact_person,
            offer_bank_company_name,
            offer_bank_account_number,
            offer_bank_name
          `)
          .eq('id', instanceId)
          .single();

        if (instanceData) {
          setInstance(instanceData);
        }

        // Get unique scope IDs from offer options
        const scopeIds = [...new Set(offer.options.map(opt => opt.scopeId).filter(Boolean))] as string[];
        
        if (scopeIds.length > 0) {
          const { data: scopesData } = await supabase
            .from('offer_scopes')
            .select('id, name, is_extras_scope')
            .in('id', scopeIds);
          
          if (scopesData) {
            const scopeMap: Record<string, ScopeData> = {};
            scopesData.forEach(s => {
              scopeMap[s.id] = s;
            });
            setScopes(scopeMap);
          }
        }

        setLoading(false);
      };
      fetchData();
    }
  }, [open, instanceId, offer.options]);

  const handleSend = async () => {
    setSending(true);
    try {
      await onSendAndClose();
    } finally {
      setSending(false);
    }
  };

  // Map OfferState to PublicOfferData format
  const mappedOffer: PublicOfferData | null = instance ? {
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
    warranty: offer.warranty,
    service_info: offer.serviceInfo,
    valid_until: offer.validUntil,
    hide_unit_prices: offer.hideUnitPrices,
    created_at: new Date().toISOString(),
    approved_at: null,
    selected_state: null,
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
      scope: opt.scopeId && scopes[opt.scopeId] ? {
        id: scopes[opt.scopeId].id,
        name: scopes[opt.scopeId].name,
        is_extras_scope: scopes[opt.scopeId].is_extras_scope,
      } : null,
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
    instances: instance,
  } : null;

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
          ) : mappedOffer ? (
            <PublicOfferCustomerView
              offer={mappedOffer}
              mode="overlayPreview"
              embedded={true}
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
