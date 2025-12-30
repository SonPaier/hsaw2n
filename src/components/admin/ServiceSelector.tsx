import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Loader2 } from 'lucide-react';

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
      <div className="grid grid-cols-2 gap-2 max-h-[200px] overflow-y-auto p-2 bg-muted/30 rounded-md border border-border/50">
        {services.map(service => (
          <label
            key={service.id}
            className="flex items-center gap-2 cursor-pointer p-2 rounded-md hover:bg-muted/50 transition-colors"
          >
            <Checkbox
              checked={selectedServiceIds.includes(service.id)}
              onCheckedChange={() => toggleService(service.id)}
            />
            <span className="text-sm truncate">
              {service.shortcut || service.name}
            </span>
          </label>
        ))}
      </div>
      {selectedServiceIds.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {services
            .filter(s => selectedServiceIds.includes(s.id))
            .map(s => (
              <span key={s.id} className="px-2 py-1 bg-primary text-primary-foreground rounded-md text-xs">
                {s.name}
              </span>
            ))}
        </div>
      )}
    </div>
  );
};

export default ServiceSelector;
