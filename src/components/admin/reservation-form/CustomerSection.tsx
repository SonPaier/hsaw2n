import { useTranslation } from 'react-i18next';
import { Loader2, AlertTriangle } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { PhoneMaskedInput } from '@/components/ui/phone-masked-input';
import ClientSearchAutocomplete from '@/components/ui/client-search-autocomplete';
import { supabase } from '@/integrations/supabase/client';
import { formatPhoneDisplay } from '@/lib/phoneUtils';
import { CustomerVehicle, CarSize } from './types';
import { RefObject } from 'react';

interface CustomerSectionProps {
  instanceId: string;
  customerName: string;
  onCustomerNameChange: (name: string) => void;
  phone: string;
  onPhoneChange: (phone: string) => void;
  phoneError?: string;
  searchingCustomer: boolean;
  foundVehicles: CustomerVehicle[];
  showPhoneDropdown: boolean;
  onSelectVehicle: (vehicle: CustomerVehicle) => void;
  onCustomerSelect: (customer: { id: string; name: string; phone: string; has_no_show?: boolean }) => void;
  onClearCustomer: () => void;
  suppressAutoSearch?: boolean;
  phoneInputRef: RefObject<HTMLDivElement>;
  setCarModel: (model: string) => void;
  setCarSize: (size: CarSize) => void;
  noShowWarning?: { customerName: string; date: string; serviceName: string } | null;
}

export const CustomerSection = ({
  instanceId,
  customerName,
  onCustomerNameChange,
  phone,
  onPhoneChange,
  phoneError,
  searchingCustomer,
  foundVehicles,
  showPhoneDropdown,
  onSelectVehicle,
  onCustomerSelect,
  onClearCustomer,
  suppressAutoSearch,
  phoneInputRef,
  setCarModel,
  setCarSize,
  noShowWarning,
}: CustomerSectionProps) => {
  const { t } = useTranslation();

  // Normalize phone: remove spaces and country code (+48, 0048, 48 at start)
  const normalizePhone = (phoneValue: string): string => {
    let normalized = phoneValue.replace(/\s+/g, '').replace(/[()-]/g, '');
    normalized = normalized.replace(/^\+48/, '').replace(/^0048/, '').replace(/^48(?=\d{9}$)/, '');
    return normalized;
  };

  const handleCustomerSelect = async (customer: { id: string; name: string; phone: string; has_no_show?: boolean }) => {
    onCustomerSelect(customer);

    // Fetch customer's most recent vehicle
    let vehicleData = null;

    // Try by customer_id
    const { data: byCustomerId } = await supabase
      .from('customer_vehicles')
      .select('model, car_size')
      .eq('instance_id', instanceId)
      .eq('customer_id', customer.id)
      .order('last_used_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (byCustomerId) {
      vehicleData = byCustomerId;
    } else {
      // Fallback: try by phone number
      const normalizedPhone = normalizePhone(customer.phone);
      const { data: byPhone } = await supabase
        .from('customer_vehicles')
        .select('model, car_size')
        .eq('instance_id', instanceId)
        .or(`phone.ilike.%${normalizedPhone}%`)
        .order('last_used_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (byPhone) {
        vehicleData = byPhone;
      }
    }

    if (vehicleData) {
      setCarModel(vehicleData.model);
      if (vehicleData.car_size === 'S') setCarSize('small');
      else if (vehicleData.car_size === 'L') setCarSize('large');
      else setCarSize('medium');
    }
  };

  return (
    <>
      {/* Customer Name */}
      <div className="space-y-2">
        <Label htmlFor="name">
          {t('addReservation.customerNameAlias')}{' '}
          <span className="text-muted-foreground text-xs">({t('common.optional')})</span>
        </Label>
        <ClientSearchAutocomplete
          instanceId={instanceId}
          value={customerName}
          onChange={(val) => {
            onCustomerNameChange(val);
            onClearCustomer();
          }}
          onSelect={handleCustomerSelect}
          onClear={onClearCustomer}
          suppressAutoSearch={suppressAutoSearch}
        />
      </div>

      {/* Phone */}
      <div className="space-y-2" ref={phoneInputRef}>
        <div className="flex items-center gap-2">
          <Label>
            {t('addReservation.customerPhone')} <span className="text-destructive">*</span>
          </Label>
          {searchingCustomer && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />}
        </div>
        <PhoneMaskedInput
          value={phone}
          onChange={onPhoneChange}
          className={phoneError ? 'border-destructive' : ''}
          data-testid="phone-input"
        />
        {phoneError && <p className="text-sm text-destructive">{phoneError}</p>}

        {/* No-show warning banner */}
        {noShowWarning && (
          <div className="flex items-start gap-2 bg-red-50 border border-red-200 text-red-700 rounded-lg p-3">
            <AlertTriangle className="w-5 h-5 mt-0.5 flex-shrink-0" />
            <span className="text-sm">
              Klient <strong>{noShowWarning.customerName}</strong> był nieobecny na wizycie {noShowWarning.date}, usługa: {noShowWarning.serviceName}
            </span>
          </div>
        )}

        {/* Phone search results dropdown */}
        {showPhoneDropdown && foundVehicles.length > 0 && (
          <div className="absolute z-50 w-[calc(100%-3rem)] mt-1 bg-background border border-border rounded-lg shadow-lg max-h-48 overflow-y-auto">
            {foundVehicles.map((vehicle) => (
              <button
                key={vehicle.id}
                type="button"
                className="w-full p-3 text-left hover:bg-muted/30 transition-colors flex flex-col border-b border-border last:border-0"
                onClick={() => onSelectVehicle(vehicle)}
              >
                <div className="font-medium text-base">
                  {vehicle.customer_name || formatPhoneDisplay(vehicle.phone)}
                </div>
                <div className="text-sm">
                  <span className="text-primary">{formatPhoneDisplay(vehicle.phone)}</span>
                  {vehicle.model && <span className="text-muted-foreground"> • {vehicle.model}</span>}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </>
  );
};

export default CustomerSection;
