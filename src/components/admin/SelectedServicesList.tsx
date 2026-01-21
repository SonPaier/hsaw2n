import { useTranslation } from 'react-i18next';
import { Trash2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

type CarSize = 'small' | 'medium' | 'large';

interface ServiceWithCategory {
  id: string;
  name: string;
  shortcut?: string | null;
  duration_minutes: number | null;
  duration_small: number | null;
  duration_medium: number | null;
  duration_large: number | null;
  price_from: number | null;
  price_small: number | null;
  price_medium: number | null;
  price_large: number | null;
  category_id?: string | null;
  category_prices_are_net?: boolean;
}

export interface ServiceItem {
  service_id: string;
  custom_price: number | null;
}

interface SelectedServicesListProps {
  services: ServiceWithCategory[];
  selectedServiceIds: string[];
  serviceItems: ServiceItem[];
  carSize: CarSize;
  onRemoveService: (serviceId: string) => void;
  onPriceChange: (serviceId: string, price: number | null) => void;
  onAddMore: () => void;
}

// Round to nearest 5 PLN
const roundToNearest5 = (value: number): number => {
  return Math.round(value / 5) * 5;
};

// Convert net price to brutto (gross) and round
const netToBrutto = (netPrice: number): number => {
  const brutto = netPrice * 1.23;
  return roundToNearest5(brutto);
};

const SelectedServicesList = ({
  services,
  selectedServiceIds,
  serviceItems,
  carSize,
  onRemoveService,
  onPriceChange,
  onAddMore,
}: SelectedServicesListProps) => {
  const { t } = useTranslation();

  // Get base price for a service based on car size
  const getBasePrice = (service: ServiceWithCategory): number => {
    let price = 0;
    if (carSize === 'small' && service.price_small !== null) {
      price = service.price_small;
    } else if (carSize === 'medium' && service.price_medium !== null) {
      price = service.price_medium;
    } else if (carSize === 'large' && service.price_large !== null) {
      price = service.price_large;
    } else {
      price = service.price_from || 0;
    }
    
    // If category prices are net, convert to brutto
    if (service.category_prices_are_net) {
      price = netToBrutto(price);
    }
    
    return price;
  };

  // Get duration for a service based on car size
  const getDuration = (service: ServiceWithCategory): number => {
    if (carSize === 'small' && service.duration_small) return service.duration_small;
    if (carSize === 'medium' && service.duration_medium) return service.duration_medium;
    if (carSize === 'large' && service.duration_large) return service.duration_large;
    return service.duration_minutes || 60;
  };

  // Format duration
  const formatDuration = (minutes: number): string => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours > 0 && mins > 0) {
      return `${hours}h ${mins}min`;
    } else if (hours > 0) {
      return `${hours}h`;
    }
    return `${minutes}min`;
  };

  // Get displayed price (custom or calculated)
  const getDisplayedPrice = (serviceId: string, service: ServiceWithCategory): number => {
    const item = serviceItems.find(si => si.service_id === serviceId);
    if (item?.custom_price !== null && item?.custom_price !== undefined) {
      return item.custom_price;
    }
    return getBasePrice(service);
  };

  // Get selected services with details
  const selectedServices = selectedServiceIds
    .map(id => services.find(s => s.id === id))
    .filter((s): s is ServiceWithCategory => s !== undefined);

  // Calculate totals
  const totalDuration = selectedServices.reduce((total, service) => {
    return total + getDuration(service);
  }, 0);

  const totalPrice = selectedServices.reduce((total, service) => {
    return total + getDisplayedPrice(service.id, service);
  }, 0);

  if (selectedServices.length === 0) {
    return (
      <button
        type="button"
        onClick={onAddMore}
        className="w-full text-left text-muted-foreground hover:text-foreground transition-colors rounded-lg border-2 border-dashed border-muted-foreground/30 p-3"
      >
        {t('addReservation.addServices')}
      </button>
    );
  }

  return (
    <div className="space-y-2">
      {/* Service items list */}
      <div className="flex flex-col gap-1 rounded-lg overflow-hidden">
        {selectedServices.map((service) => {
          const displayedPrice = getDisplayedPrice(service.id, service);
          const hasCustomPrice = serviceItems.find(si => si.service_id === service.id)?.custom_price !== null;
          const duration = getDuration(service);

          return (
            <div key={service.id} className="bg-white rounded-lg border border-border">
              {/* Service row */}
              <div className="flex items-center gap-2 px-3 py-2.5">
                {/* Service name */}
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">
                    {service.shortcut && (
                      <span className="text-primary font-bold mr-1.5">{service.shortcut}</span>
                    )}
                    {service.name}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatDuration(duration)}
                    {service.category_prices_are_net && (
                      <span className="ml-1 text-primary">(netto→brutto)</span>
                    )}
                  </p>
                </div>

                {/* Price input - inline */}
                <div className="flex items-center gap-1">
                  <Input
                    type="number"
                    value={displayedPrice || ''}
                    onChange={(e) => {
                      const value = e.target.value ? parseFloat(e.target.value) : null;
                      onPriceChange(service.id, value);
                    }}
                    className={cn(
                      "w-20 h-8 text-right text-sm font-semibold bg-white",
                      hasCustomPrice && "bg-accent border-primary/30"
                    )}
                    min={0}
                    step={5}
                  />
                  <span className="text-sm text-muted-foreground">zł</span>
                </div>

                {/* Remove button - red trash */}
                <button
                  type="button"
                  onClick={() => onRemoveService(service.id)}
                  className="p-1.5 rounded-full hover:bg-destructive/10 text-destructive transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer with totals and add button */}
      <div className="flex items-center justify-between gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onAddMore}
          className="text-primary"
        >
          + {t('common.add')}
        </Button>

        <div className="text-right">
          <p className="text-sm text-muted-foreground">
            {t('addReservation.totalDuration')}: <span className="font-medium">{formatDuration(totalDuration)}</span>
          </p>
          <p className="text-lg font-bold">
            {totalPrice} zł
          </p>
        </div>
      </div>
    </div>
  );
};

export default SelectedServicesList;
