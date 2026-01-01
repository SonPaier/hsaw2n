import { useState, useEffect, DragEvent } from 'react';
import { format } from 'date-fns';
import { pl } from 'date-fns/locale';
import { Phone, Clock, Car, Trash2, Plus, GripVertical, Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { YardVehicleDialog } from './YardVehicleDialog';
import { cn } from '@/lib/utils';

interface YardVehicle {
  id: string;
  customer_name: string;
  customer_phone: string;
  vehicle_plate: string;
  car_size: 'small' | 'medium' | 'large' | null;
  service_ids: string[];
  arrival_date: string;
  deadline_time: string | null;
  notes: string | null;
  status: string;
  created_at: string;
}

// Helper to safely convert JSON array to string array
const toStringArray = (arr: unknown): string[] => {
  if (!Array.isArray(arr)) return [];
  return arr.filter((item): item is string => typeof item === 'string');
};

interface Service {
  id: string;
  name: string;
  shortcut?: string;
}

interface YardVehiclesListProps {
  instanceId: string;
  onVehicleDragStart?: (e: DragEvent<HTMLDivElement>, vehicle: YardVehicle) => void;
}

export function YardVehiclesList({ instanceId, onVehicleDragStart }: YardVehiclesListProps) {
  const [vehicles, setVehicles] = useState<YardVehicle[]>([]);
  const [services, setServices] = useState<Record<string, Service>>({});
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingVehicle, setEditingVehicle] = useState<YardVehicle | null>(null);

  const fetchVehicles = async () => {
    const { data, error } = await supabase
      .from('yard_vehicles')
      .select('*')
      .eq('instance_id', instanceId)
      .eq('status', 'waiting')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching yard vehicles:', error);
    } else {
      setVehicles((data || []).map(v => ({
        ...v,
        service_ids: toStringArray(v.service_ids)
      })));
    }
    setLoading(false);
  };

  const fetchServices = async () => {
    const { data } = await supabase
      .from('services')
      .select('id, name, shortcut')
      .eq('instance_id', instanceId)
      .eq('active', true);

    if (data) {
      const servicesMap: Record<string, Service> = {};
      data.forEach(s => {
        servicesMap[s.id] = s;
      });
      setServices(servicesMap);
    }
  };

  useEffect(() => {
    if (instanceId) {
      fetchVehicles();
      fetchServices();
    }
  }, [instanceId]);

  // Realtime subscription
  useEffect(() => {
    if (!instanceId) return;

    const channel = supabase
      .channel('yard_vehicles_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'yard_vehicles',
          filter: `instance_id=eq.${instanceId}`
        },
        () => {
          fetchVehicles();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [instanceId]);

  const handleDelete = async (id: string) => {
    const { error } = await supabase
      .from('yard_vehicles')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting yard vehicle:', error);
    } else {
      fetchVehicles();
    }
  };

  const handleCall = (phone: string) => {
    window.location.href = `tel:${phone}`;
  };

  const handleEdit = (vehicle: YardVehicle) => {
    setEditingVehicle(vehicle);
    setDialogOpen(true);
  };

  const handleAdd = () => {
    setEditingVehicle(null);
    setDialogOpen(true);
  };

  const getServiceNames = (serviceIds: string[]) => {
    return serviceIds
      .map(id => services[id]?.shortcut || services[id]?.name || '')
      .filter(Boolean)
      .join(', ');
  };

  const handleDragStart = (e: DragEvent<HTMLDivElement>, vehicle: YardVehicle) => {
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('application/yard-vehicle', JSON.stringify(vehicle));
    onVehicleDragStart?.(e, vehicle);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Add button */}
      <div className="p-4 border-b border-border">
        <Button 
          onClick={handleAdd} 
          className="w-full"
          size="sm"
        >
          <Plus className="w-4 h-4 mr-2" />
          Dodaj pojazd
        </Button>
      </div>

      {/* Vehicles list */}
      <div className="flex-1 overflow-auto p-2 space-y-2">
        {loading ? (
          <div className="text-center text-muted-foreground py-8">
            Ładowanie...
          </div>
        ) : vehicles.length === 0 ? (
          <div className="text-center text-muted-foreground py-8">
            Brak pojazdów na placu
          </div>
        ) : (
          vehicles.map((vehicle) => (
            <div
              key={vehicle.id}
              draggable
              onDragStart={(e) => handleDragStart(e, vehicle)}
              className="bg-slate-100 rounded-lg p-3 space-y-2 border border-slate-200 cursor-grab active:cursor-grabbing hover:border-slate-300 transition-colors"
            >
              {/* Drag handle + Vehicle info */}
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-start gap-2 flex-1 min-w-0">
                  <GripVertical className="w-4 h-4 text-slate-400 flex-shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 text-sm font-medium text-slate-900">
                      <Car className="w-4 h-4 text-slate-500 flex-shrink-0" />
                      <span className="truncate">{vehicle.vehicle_plate}</span>
                    </div>
                    <div className="text-sm text-slate-600 mt-1 truncate">
                      {vehicle.customer_name}
                    </div>
                  </div>
                </div>
                
                {/* Actions */}
                <div className="flex items-center gap-1 flex-shrink-0">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-slate-600 hover:text-slate-700 hover:bg-slate-200"
                    onClick={() => handleEdit(vehicle)}
                  >
                    <Pencil className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-green-600 hover:text-green-700 hover:bg-green-50"
                    onClick={() => handleCall(vehicle.customer_phone)}
                  >
                    <Phone className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-red-500 hover:text-red-600 hover:bg-red-50"
                    onClick={() => handleDelete(vehicle.id)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              {/* Services */}
              {vehicle.service_ids.length > 0 && (
                <div className="text-xs text-slate-500 truncate pl-6">
                  {getServiceNames(vehicle.service_ids)}
                </div>
              )}

              {/* Deadline */}
              {vehicle.deadline_time && (
                <div className="flex items-center gap-1 text-xs text-orange-600 pl-6">
                  <Clock className="w-3 h-3" />
                  <span>do {vehicle.deadline_time.slice(0, 5)}</span>
                </div>
              )}

              {/* Arrival date if not today */}
              {vehicle.arrival_date !== format(new Date(), 'yyyy-MM-dd') && (
                <div className="text-xs text-slate-400 pl-6">
                  Przyjazd: {format(new Date(vehicle.arrival_date), 'd MMM', { locale: pl })}
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Dialog for add/edit */}
      <YardVehicleDialog
        open={dialogOpen}
        onClose={() => {
          setDialogOpen(false);
          setEditingVehicle(null);
        }}
        instanceId={instanceId}
        onSuccess={fetchVehicles}
        editingVehicle={editingVehicle}
      />
    </div>
  );
}

// Export the YardVehicle type for use in other components
export type { YardVehicle };
