import { useState, useEffect, DragEvent } from 'react';
import { format, isToday, isTomorrow, parseISO, isBefore, startOfDay } from 'date-fns';
import { pl } from 'date-fns/locale';
import { Phone, Clock, Trash2, Plus, Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import AddReservationDialogV2, { YardVehicle } from './AddReservationDialogV2';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

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
  hallMode?: boolean; // When true, only show vehicles from today or earlier
}

// Group vehicles by arrival date
const groupVehiclesByDate = (vehicles: YardVehicle[]) => {
  const groups: Record<string, YardVehicle[]> = {};
  
  vehicles.forEach(vehicle => {
    const date = vehicle.arrival_date;
    if (!groups[date]) {
      groups[date] = [];
    }
    groups[date].push(vehicle);
  });

  // Sort by date (earliest first)
  const sortedDates = Object.keys(groups).sort();
  
  return sortedDates.map(date => ({
    date,
    vehicles: groups[date],
  }));
};

const getDateLabel = (dateStr: string): string => {
  const date = parseISO(dateStr);
  if (isToday(date)) return 'Dzisiaj';
  if (isTomorrow(date)) return 'Jutro';
  return format(date, 'd MMMM', { locale: pl });
};

export function YardVehiclesList({ instanceId, onVehicleDragStart, hallMode = false }: YardVehiclesListProps) {
  const [vehicles, setVehicles] = useState<YardVehicle[]>([]);
  const [services, setServices] = useState<Record<string, Service>>({});
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingVehicle, setEditingVehicle] = useState<YardVehicle | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [vehicleToDelete, setVehicleToDelete] = useState<YardVehicle | null>(null);

  const fetchVehicles = async () => {
    const { data, error } = await supabase
      .from('yard_vehicles')
      .select('*')
      .eq('instance_id', instanceId)
      .eq('status', 'waiting')
      .order('arrival_date', { ascending: true })
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
      .from('unified_services')
      .select('id, name, shortcut')
      .eq('instance_id', instanceId)
      .eq('service_type', 'reservation')
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

  const handleDeleteClick = (vehicle: YardVehicle) => {
    setVehicleToDelete(vehicle);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!vehicleToDelete) return;
    
    const { error } = await supabase
      .from('yard_vehicles')
      .delete()
      .eq('id', vehicleToDelete.id);

    if (error) {
      console.error('Error deleting yard vehicle:', error);
    } else {
      fetchVehicles();
    }
    
    setDeleteDialogOpen(false);
    setVehicleToDelete(null);
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

  const getServicesData = (serviceIds: string[]) => {
    return serviceIds
      .map(id => services[id])
      .filter(Boolean);
  };

  const handleDragStart = (e: DragEvent<HTMLDivElement>, vehicle: YardVehicle) => {
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('application/yard-vehicle', JSON.stringify(vehicle));
    onVehicleDragStart?.(e, vehicle);
  };

  // Filter vehicles for hall mode (only today or earlier)
  const filteredVehicles = hallMode 
    ? vehicles.filter(v => {
        const arrivalDate = parseISO(v.arrival_date);
        const today = startOfDay(new Date());
        return isBefore(arrivalDate, today) || isToday(arrivalDate);
      })
    : vehicles;

  const groupedVehicles = groupVehiclesByDate(filteredVehicles);

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
      <div className="flex-1 overflow-auto p-2 space-y-4">
        {loading ? (
          <div className="text-center text-muted-foreground py-8">
            Ładowanie...
          </div>
        ) : filteredVehicles.length === 0 ? (
          <div className="text-center text-muted-foreground py-8">
            Brak pojazdów na placu
          </div>
        ) : (
          groupedVehicles.map((group) => (
            <div key={group.date} className="space-y-2">
              {/* Date header */}
              <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide px-1">
                {getDateLabel(group.date)}
              </div>
              
              {group.vehicles.map((vehicle) => (
                <div
                  key={vehicle.id}
                  draggable
                  onDragStart={(e) => handleDragStart(e, vehicle)}
                  className="bg-slate-100 rounded-lg p-3 space-y-2 border border-slate-200 cursor-grab active:cursor-grabbing hover:border-slate-300 hover:shadow-sm transition-all select-none"
                >
                  {/* Vehicle info */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-slate-900 truncate">
                        {vehicle.vehicle_plate}
                      </div>
                      <div className="text-sm text-slate-600 mt-0.5 truncate">
                        {vehicle.customer_name}
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
                        onClick={() => handleDeleteClick(vehicle)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>

                  {/* Services - styled like calendar reservation chips */}
                  {vehicle.service_ids.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {getServicesData(vehicle.service_ids).map((svc, idx) => (
                        <span key={idx} className="inline-block px-1.5 py-0.5 text-[9px] font-medium bg-slate-700/90 text-white rounded leading-none">
                          {svc.shortcut || svc.name}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Pickup date and Deadline */}
                  {(vehicle.pickup_date || vehicle.deadline_time) && (
                    <div className="flex items-center gap-3 text-xs text-slate-600">
                      {vehicle.pickup_date && (
                        <span>odbiór: {format(parseISO(vehicle.pickup_date), 'd MMM', { locale: pl })}</span>
                      )}
                      {vehicle.deadline_time && (
                        <span className="text-orange-600 flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          do {vehicle.deadline_time.slice(0, 5)}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ))
        )}
      </div>

      {/* Dialog for add/edit - using AddReservationDialogV2 with mode="yard" */}
      <AddReservationDialogV2
        open={dialogOpen}
        onClose={() => {
          setDialogOpen(false);
          setEditingVehicle(null);
        }}
        instanceId={instanceId}
        onSuccess={fetchVehicles}
        mode="yard"
        editingYardVehicle={editingVehicle}
      />

      {/* Delete confirmation dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Usuń pojazd z placu</AlertDialogTitle>
            <AlertDialogDescription>
              Czy na pewno chcesz usunąć pojazd {vehicleToDelete?.vehicle_plate} ({vehicleToDelete?.customer_name}) z placu?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Anuluj</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteConfirm} className="bg-red-600 hover:bg-red-700">
              Usuń
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// Re-export the YardVehicle type from AddReservationDialogV2 for backward compatibility
export type { YardVehicle } from './AddReservationDialogV2';
