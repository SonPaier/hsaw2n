import { useState, useEffect, useMemo } from 'react';
import { Sparkles, Clock, Plus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface Service {
  id: string;
  name: string;
  description: string | null;
  duration_minutes: number | null;
  price_from: number | null;
  price_small: number | null;
  price_medium: number | null;
  price_large: number | null;
  requires_size: boolean | null;
  station_type: string | null;
}

interface AvailabilityBlock {
  block_date: string;
  start_time: string;
  end_time: string;
  station_id: string;
}

interface Station {
  id: string;
  name: string;
  type: string;
}

interface UpsellSuggestionProps {
  selectedService: Service;
  selectedTime: string;
  selectedDate: Date;
  selectedStationId: string;
  services: Service[];
  stations: Station[];
  availabilityBlocks: AvailabilityBlock[];
  carSize: 'small' | 'medium' | 'large';
  onAddService: (serviceId: string) => void;
  selectedAddons: string[];
}

const UPSELL_SLOT_SIZE = 15; // Grid is 15-minute intervals

export default function UpsellSuggestion({
  selectedService,
  selectedTime,
  selectedDate,
  selectedStationId,
  services,
  stations,
  availabilityBlocks,
  carSize,
  onAddService,
  selectedAddons,
}: UpsellSuggestionProps) {
  const [dismissed, setDismissed] = useState(false);

  // Reset dismissed state when time changes
  useEffect(() => {
    setDismissed(false);
  }, [selectedTime, selectedDate]);

  // Calculate available gap after the selected service ends
  const upsellSuggestion = useMemo(() => {
    if (!selectedService || !selectedTime || !selectedDate || !selectedStationId) {
      return null;
    }

    const serviceDuration = selectedService.duration_minutes || 60;
    const [startHours, startMins] = selectedTime.split(':').map(Number);
    const serviceStartMinutes = startHours * 60 + startMins;
    const serviceEndMinutes = serviceStartMinutes + serviceDuration;

    // Format date for comparison
    const dateStr = selectedDate.toISOString().split('T')[0];

    // Find next block on this station after our service ends
    const stationBlocks = availabilityBlocks
      .filter(b => b.station_id === selectedStationId && b.block_date === dateStr)
      .map(b => {
        const [h, m] = b.start_time.split(':').map(Number);
        return { start: h * 60 + m, block: b };
      })
      .filter(b => b.start > serviceEndMinutes)
      .sort((a, b) => a.start - b.start);

    if (stationBlocks.length === 0) {
      return null; // No next reservation, no urgency for upsell
    }

    const nextBlockStart = stationBlocks[0].start;
    const gapMinutes = nextBlockStart - serviceEndMinutes;

    // Only suggest if gap is exactly 15 minutes (one grid slot)
    if (gapMinutes !== UPSELL_SLOT_SIZE) {
      return null;
    }

    // Find services that fit exactly in the 15-minute slot
    const shortServices = services.filter(s => {
      if (s.id === selectedService.id) return false;
      if (selectedAddons.includes(s.id)) return false;
      const duration = s.duration_minutes || 60;
      return duration <= UPSELL_SLOT_SIZE;
    });

    if (shortServices.length === 0) {
      return null;
    }

    // Return the best fitting service (longest that fits)
    const bestService = shortServices.reduce((best, current) => {
      const currentDuration = current.duration_minutes || 0;
      const bestDuration = best?.duration_minutes || 0;
      return currentDuration > bestDuration ? current : best;
    }, shortServices[0]);

    return {
      service: bestService,
      gapMinutes,
      extraMinutes: bestService.duration_minutes || 15,
    };
  }, [selectedService, selectedTime, selectedDate, selectedStationId, services, availabilityBlocks, selectedAddons]);

  // Get price for service based on car size
  const getServicePrice = (service: Service): number => {
    if (service.requires_size) {
      if (carSize === 'small') return service.price_small || service.price_from || 0;
      if (carSize === 'large') return service.price_large || service.price_from || 0;
      return service.price_medium || service.price_from || 0;
    }
    return service.price_from || 0;
  };

  if (!upsellSuggestion || dismissed) {
    return null;
  }

  const { service, extraMinutes } = upsellSuggestion;
  const price = getServicePrice(service);

  return (
    <div className="relative glass-card p-4 mb-4 border-primary/30 bg-primary/5 animate-fade-in">
      <button
        onClick={() => setDismissed(true)}
        className="absolute top-2 right-2 p-1 text-muted-foreground hover:text-foreground transition-colors"
        aria-label="Zamknij"
      >
        <X className="w-4 h-4" />
      </button>

      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
          <Sparkles className="w-5 h-5 text-primary" />
        </div>
        
        <div className="flex-1 min-w-0">
          <h4 className="font-semibold text-sm mb-1">
            A co powiesz o dodatkowych {extraMinutes} minutach?
          </h4>
          <p className="text-xs text-muted-foreground mb-3">
            Masz jeszcze chwilę przed kolejną rezerwacją. Co powiesz na <span className="font-medium text-foreground">{service.name}</span>?
          </p>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Clock className="w-3.5 h-3.5" />
              <span>{extraMinutes} min</span>
              <span>•</span>
              <span className="font-medium text-primary">{price} zł</span>
            </div>

            <Button
              size="sm"
              onClick={() => {
                onAddService(service.id);
                setDismissed(true);
              }}
              className="h-8 text-xs gap-1"
            >
              <Plus className="w-3.5 h-3.5" />
              Dodaj
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
