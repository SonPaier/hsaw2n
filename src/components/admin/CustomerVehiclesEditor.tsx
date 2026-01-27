import { useState } from 'react';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { CarSearchAutocomplete, CarSearchValue } from '@/components/ui/car-search-autocomplete';
import { useTranslation } from 'react-i18next';

export interface VehicleChip {
  id?: string;
  model: string;
  carSize: 'S' | 'M' | 'L';
  isNew?: boolean;
}

interface CustomerVehiclesEditorProps {
  vehicles: VehicleChip[];
  onChange: (vehicles: VehicleChip[]) => void;
  disabled?: boolean;
}

export const CustomerVehiclesEditor = ({
  vehicles,
  onChange,
  disabled = false,
}: CustomerVehiclesEditorProps) => {
  const { t } = useTranslation();
  const [vehicleSearchValue, setVehicleSearchValue] = useState('');
  const [pendingVehicle, setPendingVehicle] = useState<CarSearchValue>(null);

  const handleSearchChange = (val: CarSearchValue) => {
    setPendingVehicle(val);
    setVehicleSearchValue(val?.label || '');
  };

  const handleAddVehicle = () => {
    if (!pendingVehicle) return;

    const newVehicle: VehicleChip = {
      model: pendingVehicle.label,
      carSize: 'size' in pendingVehicle ? pendingVehicle.size : 'M',
      isNew: true,
    };

    // Check duplicates
    if (!vehicles.some((v) => v.model === newVehicle.model)) {
      onChange([...vehicles, newVehicle]);
    }

    // Reset input
    setVehicleSearchValue('');
    setPendingVehicle(null);
  };

  const handleRemoveVehicle = (index: number) => {
    onChange(vehicles.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-3">
      <label className="text-sm font-medium">{t('customers.vehicles')}</label>

      {/* Search + Add button row */}
      <div className="flex gap-2">
        <div className="flex-1">
          <CarSearchAutocomplete
            value={vehicleSearchValue}
            onChange={handleSearchChange}
            disabled={disabled}
            suppressAutoOpen={false}
          />
        </div>
        <Button
          type="button"
          variant="outline"
          onClick={handleAddVehicle}
          disabled={disabled || !pendingVehicle}
        >
          {t('common.add')}
        </Button>
      </div>

      {/* Vehicle chips */}
      {vehicles.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {vehicles.map((vehicle, index) => (
            <div
              key={vehicle.id || `new-${index}`}
              className="flex items-center gap-1 px-3 py-1.5 bg-background border border-border rounded-full text-sm font-medium"
            >
              <span>{vehicle.model}</span>
              {!disabled && (
                <button
                  type="button"
                  onClick={() => handleRemoveVehicle(index)}
                  className="p-0.5 hover:bg-muted rounded-full transition-colors"
                >
                  <X className="w-3.5 h-3.5 text-muted-foreground" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default CustomerVehiclesEditor;
