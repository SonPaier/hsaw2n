import { useTranslation } from 'react-i18next';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { CarSearchAutocomplete, CarSearchValue } from '@/components/ui/car-search-autocomplete';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { CarSize, CustomerVehicle } from './types';
import { RefObject } from 'react';

interface VehicleSectionProps {
  carModel: string;
  onCarModelChange: (value: CarSearchValue) => void;
  carSize: CarSize;
  onCarSizeChange: (size: CarSize) => void;
  carModelError?: string;
  customerVehicles: CustomerVehicle[];
  selectedVehicleId: string | null;
  onVehicleSelect: (vehicle: CustomerVehicle) => void;
  suppressAutoOpen?: boolean;
  carModelRef: RefObject<HTMLDivElement>;
}

export const VehicleSection = ({
  carModel,
  onCarModelChange,
  carSize,
  onCarSizeChange,
  carModelError,
  customerVehicles,
  selectedVehicleId,
  onVehicleSelect,
  suppressAutoOpen,
  carModelRef,
}: VehicleSectionProps) => {
  const { t } = useTranslation();

  return (
    <div className="space-y-2" ref={carModelRef}>
      <Label className="flex items-center gap-2">
        {t('reservations.carModel')} <span className="text-destructive">*</span>
      </Label>
      <div className="flex gap-2">
        <div className="relative flex-1">
          <CarSearchAutocomplete
            value={carModel}
            onChange={onCarModelChange}
            suppressAutoOpen={suppressAutoOpen}
            error={!!carModelError}
          />
        </div>

        <TooltipProvider>
          <div className="flex gap-1 shrink-0">
            {(['small', 'medium', 'large'] as CarSize[]).map((size) => (
              <Tooltip key={size}>
                <TooltipTrigger asChild>
                   <Button
                    type="button"
                    size="sm"
                    variant={carSize === size ? 'secondary' : 'outline'}
                    className="w-9 h-9 font-bold p-0 border-foreground/60"
                    onClick={() => onCarSizeChange(size)}
                  >
                    {size === 'small' ? 'S' : size === 'medium' ? 'M' : 'L'}
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">
                  <p>{t(`reservations.carSizes.${size}`)}</p>
                </TooltipContent>
              </Tooltip>
            ))}
          </div>
        </TooltipProvider>
      </div>
      {carModelError && <p className="text-sm text-destructive">{carModelError}</p>}

      {/* Customer vehicles pills */}
      {customerVehicles.length > 1 && (
        <div className="flex flex-wrap gap-2 mt-2">
          {customerVehicles.map((vehicle) => (
            <button
              key={vehicle.id}
              type="button"
              onClick={() => onVehicleSelect(vehicle)}
              className={cn(
                'px-3 py-1.5 text-sm rounded-full transition-colors font-medium',
                selectedVehicleId === vehicle.id
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-white hover:bg-muted/50 text-foreground border border-border'
              )}
            >
              {vehicle.model}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default VehicleSection;
