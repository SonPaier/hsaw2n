import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Loader2, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Service {
  id: string;
  name: string;
  shortcut?: string | null;
  duration_minutes?: number | null;
}

interface ServiceSelectorProps {
  instanceId: string;
  selectedServiceIds: string[];
  onServicesChange: (serviceIds: string[]) => void;
}

const ServiceSelector = ({ instanceId, selectedServiceIds, onServicesChange }: ServiceSelectorProps) => {
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchValue, setSearchValue] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  useEffect(() => {
    const fetchServices = async () => {
      setLoading(true);
      const { data } = await supabase
        .from('services')
        .select('id, name, shortcut, duration_minutes')
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

  if (loading) {
    return (
      <div className="space-y-2">
        <Label>Usługi</Label>
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span className="text-sm">Ładowanie usług...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <Label>Usługi</Label>
      
      {/* Quick service bubbles - first 2 services */}
      {services.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {services.slice(0, 2).map(service => {
            const isSelected = selectedServiceIds.includes(service.id);
            return (
              <button
                key={service.id}
                type="button"
                onClick={() => toggleService(service.id)}
                className={cn(
                  "inline-flex items-center gap-2 px-3 py-2 rounded-full text-sm font-medium transition-colors border min-h-[40px]",
                  isSelected
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-background text-foreground border-border hover:bg-accent hover:border-accent"
                )}
              >
                {isSelected && <Check className="w-3 h-3" />}
                {service.shortcut || service.name}
              </button>
            );
          })}
        </div>
      )}

      {/* Search input with dropdown */}
      <div className="relative">
        <Input
          placeholder="Szukaj usługi lub wpisz skrót (np. KPL, MZ)..."
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
                  <span className="text-sm truncate">
                    {service.shortcut && (
                      <span className="text-primary font-semibold mr-1">[{service.shortcut}]</span>
                    )}
                    {service.name}
                  </span>
                </label>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Selected services display */}
      {selectedServiceIds.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {services
            .filter(s => selectedServiceIds.includes(s.id))
            .map(s => (
              <span key={s.id} className="px-2 py-1 bg-primary text-primary-foreground rounded-md text-xs">
                {s.shortcut || s.name}
              </span>
            ))}
        </div>
      )}
    </div>
  );
};

export default ServiceSelector;
