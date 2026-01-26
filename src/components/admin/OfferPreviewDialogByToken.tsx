import { useState, useEffect } from 'react';
import { X, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import { PublicOfferCustomerView, PublicOfferData } from '@/components/offers/PublicOfferCustomerView';

interface OfferPreviewDialogByTokenProps {
  open: boolean;
  onClose: () => void;
  token: string;
}

interface TrustTile {
  icon: string;
  title: string;
  description: string;
}

export function OfferPreviewDialogByToken({
  open,
  onClose,
  token,
}: OfferPreviewDialogByTokenProps) {
  const [loading, setLoading] = useState(true);
  const [offerData, setOfferData] = useState<PublicOfferData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open && token) {
      fetchOfferData();
    }
  }, [open, token]);

  const fetchOfferData = async () => {
    setLoading(true);
    setError(null);
    
    try {
      // Fetch offer by public token with instance data
      const { data: offer, error: offerError } = await supabase
        .from('offers')
        .select(`
          *,
          offer_options (
            *,
            offer_option_items (*)
          ),
          offer_text_blocks (*),
          instances (*)
        `)
        .eq('public_token', token)
        .single();

      if (offerError || !offer) {
        setError('Nie znaleziono oferty');
        return;
      }

      // Fetch product descriptions if has_unified_services
      let enrichedOptions = offer.offer_options || [];
      if (offer.has_unified_services && enrichedOptions.length > 0) {
        const productIds = enrichedOptions
          .flatMap((opt) => 
            opt.offer_option_items?.map((item) => item.product_id).filter(Boolean) || []
          );
        
        if (productIds.length > 0) {
          const { data: products } = await supabase
            .from('unified_services')
            .select('id, description')
            .in('id', productIds as string[]);
          
          const descMap = (products || []).reduce((acc: Record<string, string>, p) => {
            if (p.description) acc[p.id] = p.description;
            return acc;
          }, {} as Record<string, string>);

          enrichedOptions = enrichedOptions.map((opt) => ({
            ...opt,
            offer_option_items: opt.offer_option_items?.map((item) => ({
              ...item,
              unified_services: item.product_id && descMap[item.product_id] 
                ? { description: descMap[item.product_id] } 
                : undefined,
            })),
          }));
        }
      }

      // Transform instances data to match expected format
      const instanceData = offer.instances;
      const transformedInstance = instanceData ? {
        ...instanceData,
        offer_trust_tiles: instanceData.offer_trust_tiles as unknown as TrustTile[] | undefined,
      } : undefined;

      setOfferData({
        ...offer,
        offer_options: enrichedOptions,
        instances: transformedInstance,
      } as unknown as PublicOfferData);
    } catch (err) {
      console.error('Error fetching offer:', err);
      setError('Błąd podczas ładowania oferty');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="max-w-4xl h-[90vh] p-0 overflow-hidden">
        <div className="absolute right-4 top-4 z-50">
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="h-10 w-10 rounded-full bg-white/80 hover:bg-white shadow-md"
          >
            <X className="h-5 w-5" />
          </Button>
        </div>
        
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          </div>
        ) : error ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-muted-foreground">{error}</p>
          </div>
        ) : offerData ? (
          <ScrollArea className="h-full">
            <div className="p-0">
              <PublicOfferCustomerView
                offer={offerData}
                mode="overlayPreview"
                isAdmin={true}
                onClose={onClose}
              />
            </div>
          </ScrollArea>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
