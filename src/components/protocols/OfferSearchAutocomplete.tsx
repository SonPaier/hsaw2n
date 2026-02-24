import { useState, useEffect, useRef } from 'react';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { Search, FileText, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { normalizeSearchQuery } from '@/lib/textUtils';

interface OfferData {
  id: string;
  offer_number: string;
  customer_name: string;
  customer_phone: string;
  customer_email?: string;
  customer_nip?: string;
  vehicle_model?: string;
}

interface OfferSearchAutocompleteProps {
  instanceId: string;
  value: string;
  onChange: (value: string) => void;
  onOfferSelect: (offer: OfferData) => void;
  placeholder?: string;
  inputClassName?: string;
}

export const OfferSearchAutocomplete = ({
  instanceId,
  value,
  onChange,
  onOfferSelect,
  placeholder = 'Wyszukaj ofertę po numerze lub nazwisku...',
  inputClassName,
}: OfferSearchAutocompleteProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [offers, setOffers] = useState<OfferData[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    const searchOffers = async () => {
      if (!value || value.length < 2) {
        setOffers([]);
        return;
      }

      setIsLoading(true);
      try {
        // Normalize search value for space-agnostic matching
        const normalizedValue = normalizeSearchQuery(value);
        
        const { data, error } = await supabase
          .from('offers')
          .select('id, offer_number, customer_data, vehicle_data')
          .eq('instance_id', instanceId)
          .or(`offer_number.ilike.%${normalizedValue}%,customer_data->>name.ilike.%${value}%`)
          .order('created_at', { ascending: false })
          .limit(10);

        if (error) throw error;

        const mappedOffers: OfferData[] = (data || []).map((offer) => {
          const customerData = offer.customer_data as Record<string, unknown> || {};
          const vehicleData = offer.vehicle_data as Record<string, unknown> || {};
          return {
            id: offer.id,
            offer_number: offer.offer_number,
            customer_name: (customerData.name as string) || '',
            customer_phone: (customerData.phone as string) || '',
            customer_email: (customerData.email as string) || undefined,
            customer_nip: (customerData.nip as string) || undefined,
            vehicle_model: (vehicleData.brandModel as string) || (vehicleData.model as string) || undefined,
          };
        });

        setOffers(mappedOffers);
      } catch (error) {
        console.error('Error searching offers:', error);
      } finally {
        setIsLoading(false);
      }
    };

    const debounce = setTimeout(searchOffers, 300);
    return () => clearTimeout(debounce);
  }, [value, instanceId]);

  const handleSelect = (offer: OfferData) => {
    onOfferSelect(offer);
    onChange(offer.offer_number);
    setIsOpen(false);
  };

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          placeholder={placeholder}
          className={cn("pl-10", inputClassName)}
        />
        {isLoading && (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
        )}
      </div>

      {isOpen && offers.length > 0 && (
        <div className="absolute z-50 w-full mt-1 bg-white border rounded-lg shadow-lg max-h-64 overflow-auto">
          {offers.map((offer) => (
            <button
              key={offer.id}
              className={cn(
                "w-full px-4 py-3 text-left hover:bg-muted/50 transition-colors",
                "flex items-start gap-3 border-b last:border-b-0"
              )}
              onClick={() => handleSelect(offer)}
            >
              <FileText className="h-5 w-5 text-muted-foreground mt-0.5 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm">#{offer.offer_number}</span>
                  {offer.vehicle_model && (
                    <span className="text-xs text-muted-foreground truncate">
                      • {offer.vehicle_model}
                    </span>
                  )}
                </div>
                <p className="text-sm text-muted-foreground truncate">
                  {offer.customer_name}
                  {offer.customer_phone && ` • ${offer.customer_phone}`}
                </p>
              </div>
            </button>
          ))}
        </div>
      )}

      {isOpen && value.length >= 2 && offers.length === 0 && !isLoading && (
        <div className="absolute z-50 w-full mt-1 bg-white border rounded-lg shadow-lg p-4 text-center text-sm text-muted-foreground">
          Nie znaleziono ofert. Możesz wpisać numer ręcznie.
        </div>
      )}
    </div>
  );
};
