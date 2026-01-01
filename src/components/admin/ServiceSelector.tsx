import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/integrations/supabase/client';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Service {
  id: string;
  name: string;
  shortcut?: string | null;
  duration_minutes?: number | null;
  is_popular?: boolean | null;
}

interface ServiceSelectorProps {
  instanceId: string;
  selectedServiceIds: string[];
  onServicesChange: (serviceIds: string[]) => void;
}

const ServiceSelector = ({ instanceId, selectedServiceIds, onServicesChange }: ServiceSelectorProps) => {
  const { t } = useTranslation();
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchValue, setSearchValue] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  useEffect(() => {
    const fetchServices = async () => {
      setLoading(true);
      const { data } = await supabase
        .from('services')
        .select('id, name, shortcut, duration_minutes, is_popular')
        .eq('instance_id', instanceId)
        .eq('active', true)
        .order('sort_order');
      
      if (data) {
        setServices(data);
      }
      setLoading(false);
    };

    if (instanceId) {
      fetchServices();
    }
  }, [instanceId]);

  const toggleService = (serviceId: string) => {
    if (selectedServiceIds.includes(serviceId)) {
      onServicesChange(selectedServiceIds.filter(id => id !== serviceId));
    } else {
      onServicesChange([...selectedServiceIds, serviceId]);
    }
  };

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const matchingService = filteredServices[0];
      if (matchingService) {
        toggleService(matchingService.id);
        setSearchValue('');
        setIsDropdownOpen(false);
      }
    } else if (e.key === 'Escape') {
      setIsDropdownOpen(false);
      setSearchValue('');
    }
  };

  const handleSearchChange = (value: string) => {
    setSearchValue(value);
    setIsDropdownOpen(value.length > 0);
  };

  // Filter services based on search
  const filteredServices = searchValue
    ? services.filter(s => 
        s.shortcut?.toLowerCase().includes(searchValue.toLowerCase()) ||
        s.name.toLowerCase().includes(searchValue.toLowerCase())
      )
    : services;

  // Get popular services for quick selection
  const popularServices = services.filter(s => s.is_popular);

  if (loading) {
    return (
      <div className="space-y-2">
        <Label>{t('reservations.services')}</Label>
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span className="text-sm">{t('serviceSelector.loadingServices')}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <Label>{t('reservations.services')}</Label>

      {/* Search input with dropdown */}
      <div className="relative">
        <Input
          placeholder={t('serviceSelector.searchPlaceholder')}
          value={searchValue}
          onChange={(e) => handleSearchChange(e.target.value)}
          onKeyDown={handleSearchKeyDown}
          onFocus={() => searchValue && setIsDropdownOpen(true)}
          onBlur={() => setTimeout(() => setIsDropdownOpen(false), 150)}
          className="h-9"
        />
        
        {/* Dropdown list */}
        {isDropdownOpen && filteredServices.length > 0 && (
          <div className="absolute z-50 w-full mt-1 bg-popover border border-border rounded-md shadow-lg max-h-[200px] overflow-y-auto">
            <div className="grid grid-cols-2 gap-1 p-2">
              {filteredServices.map(service => (
                <label
                  key={service.id}
                  className="flex items-center gap-2 cursor-pointer p-2 rounded-md hover:bg-accent transition-colors"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    toggleService(service.id);
                  }}
                >
                  <Checkbox
                    checked={selectedServiceIds.includes(service.id)}
                    onCheckedChange={() => toggleService(service.id)}
                  />
                  <span className="text-sm">
                    {service.shortcut && (
                      <span className="text-primary font-semibold">[{service.shortcut}]</span>
                    )}
                    {service.shortcut ? ` - ${service.name}` : service.name}
                  </span>
                </label>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Selected/Popular services - clickable chips */}
      <div className="flex flex-wrap gap-2">
        {(popularServices.length > 0 ? popularServices : services.slice(0, 4)).map(service => {
          const isSelected = selectedServiceIds.includes(service.id);
          return (
            <button
              key={service.id}
              type="button"
              onClick={() => toggleService(service.id)}
              className={cn(
                "px-3 py-2 rounded-md text-sm font-medium transition-colors min-h-[44px]",
                isSelected
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-accent"
              )}
            >
              {service.shortcut || service.name}
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default ServiceSelector;
