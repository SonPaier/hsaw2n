import { useState, useEffect, useCallback } from 'react';
import { Search, User, Phone, Car, Clock, Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface Station {
  id: string;
  name: string;
  type: string;
}

interface Service {
  id: string;
  name: string;
  duration_minutes: number | null;
  price_from: number | null;
  station_type: string | null;
}

interface Customer {
  id: string;
  phone: string;
  name: string;
  email: string | null;
}

interface AddReservationDialogProps {
  open: boolean;
  onClose: () => void;
  stationId: string | null;
  date: string;
  time: string;
  stations: Station[];
  instanceId: string;
  onSuccess: () => void;
}

const AddReservationDialog = ({
  open,
  onClose,
  stationId,
  date,
  time,
  stations,
  instanceId,
  onSuccess,
}: AddReservationDialogProps) => {
  const [loading, setLoading] = useState(false);
  const [searchingCustomer, setSearchingCustomer] = useState(false);
  const [services, setServices] = useState<Service[]>([]);
  const [foundCustomers, setFoundCustomers] = useState<Customer[]>([]);
  
  // Form state
  const [phone, setPhone] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [vehiclePlate, setVehiclePlate] = useState('');
  const [selectedService, setSelectedService] = useState<string>('');
  const [selectedStation, setSelectedStation] = useState<string>(stationId || '');
  const [startTime, setStartTime] = useState(time);
  const [endTime, setEndTime] = useState('');
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);

  // Fetch services on mount
  useEffect(() => {
    const fetchServices = async () => {
      const { data, error } = await supabase
        .from('services')
        .select('id, name, duration_minutes, price_from, station_type')
        .eq('instance_id', instanceId)
        .eq('active', true)
        .order('sort_order');
      
      if (!error && data) {
        setServices(data);
      }
    };
    
    if (open && instanceId) {
      fetchServices();
    }
  }, [open, instanceId]);

  // Reset form when dialog opens
  useEffect(() => {
    if (open) {
      setPhone('');
      setCustomerName('');
      setVehiclePlate('');
      setSelectedService('');
      setSelectedStation(stationId || '');
      setStartTime(time);
      setEndTime('');
      setFoundCustomers([]);
      setSelectedCustomerId(null);
    }
  }, [open, stationId, time]);

  // Calculate end time based on service duration
  useEffect(() => {
    if (selectedService && startTime) {
      const service = services.find(s => s.id === selectedService);
      if (service?.duration_minutes) {
        const [hours, minutes] = startTime.split(':').map(Number);
        const totalMinutes = hours * 60 + minutes + service.duration_minutes;
        const endHours = Math.floor(totalMinutes / 60);
        const endMins = totalMinutes % 60;
        setEndTime(`${endHours.toString().padStart(2, '0')}:${endMins.toString().padStart(2, '0')}`);
      }
    }
  }, [selectedService, startTime, services]);

  // Search customer by phone
  const searchCustomer = useCallback(async (phoneNumber: string) => {
    if (phoneNumber.length < 3) {
      setFoundCustomers([]);
      return;
    }
    
    setSearchingCustomer(true);
    try {
      const { data, error } = await supabase
        .from('customers')
        .select('id, phone, name, email')
        .eq('instance_id', instanceId)
        .ilike('phone', `%${phoneNumber}%`)
        .limit(5);
      
      if (!error && data) {
        setFoundCustomers(data);
      }
    } finally {
      setSearchingCustomer(false);
    }
  }, [instanceId]);

  // Debounced phone search
  useEffect(() => {
    const timer = setTimeout(() => {
      searchCustomer(phone);
    }, 300);
    return () => clearTimeout(timer);
  }, [phone, searchCustomer]);

  const selectCustomer = (customer: Customer) => {
    setPhone(customer.phone);
    setCustomerName(customer.name);
    setSelectedCustomerId(customer.id);
    setFoundCustomers([]);
  };

  const generateConfirmationCode = () => {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
  };

  const handleSubmit = async () => {
    if (!phone || !customerName || !vehiclePlate || !selectedService || !selectedStation || !startTime || !endTime) {
      toast.error('Wypełnij wszystkie wymagane pola');
      return;
    }

    setLoading(true);
    try {
      // First, check if customer exists or create new one
      let customerId = selectedCustomerId;
      
      if (!customerId) {
        // Check if customer with this phone exists
        const { data: existingCustomer } = await supabase
          .from('customers')
          .select('id')
          .eq('instance_id', instanceId)
          .eq('phone', phone)
          .maybeSingle();
        
        if (existingCustomer) {
          customerId = existingCustomer.id;
        } else {
          // Create new customer
          const { data: newCustomer, error: customerError } = await supabase
            .from('customers')
            .insert({
              instance_id: instanceId,
              phone,
              name: customerName,
            })
            .select('id')
            .single();
          
          if (customerError) throw customerError;
          customerId = newCustomer.id;
          toast.success('Dodano nowego klienta do bazy');
        }
      }

      // Create reservation
      const { error: reservationError } = await supabase
        .from('reservations')
        .insert({
          instance_id: instanceId,
          station_id: selectedStation,
          service_id: selectedService,
          reservation_date: date,
          start_time: startTime,
          end_time: endTime,
          customer_name: customerName,
          customer_phone: phone,
          vehicle_plate: vehiclePlate.toUpperCase(),
          confirmation_code: generateConfirmationCode(),
          status: 'confirmed',
        });

      if (reservationError) throw reservationError;

      toast.success('Rezerwacja została dodana');
      onSuccess();
      onClose();
    } catch (error) {
      console.error('Error creating reservation:', error);
      toast.error('Błąd podczas tworzenia rezerwacji');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-primary" />
            Nowa rezerwacja
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Date and Time Info */}
          <div className="flex gap-4 p-3 bg-muted/50 rounded-lg text-sm">
            <div>
              <span className="text-muted-foreground">Data:</span>{' '}
              <span className="font-medium">{date}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Godzina:</span>{' '}
              <span className="font-medium">{time}</span>
            </div>
          </div>

          {/* Phone search */}
          <div className="space-y-2">
            <Label htmlFor="phone" className="flex items-center gap-2">
              <Phone className="w-4 h-4" />
              Numer telefonu *
            </Label>
            <div className="relative">
              <Input
                id="phone"
                value={phone}
                onChange={(e) => {
                  setPhone(e.target.value);
                  setSelectedCustomerId(null);
                }}
                placeholder="+48 123 456 789"
                className="pr-10"
              />
              {searchingCustomer && (
                <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-muted-foreground" />
              )}
            </div>
            
            {/* Customer suggestions */}
            {foundCustomers.length > 0 && (
              <div className="border border-border rounded-lg overflow-hidden bg-card">
                {foundCustomers.map((customer) => (
                  <button
                    key={customer.id}
                    type="button"
                    className="w-full p-3 text-left hover:bg-muted/50 transition-colors flex items-center gap-3 border-b border-border last:border-0"
                    onClick={() => selectCustomer(customer)}
                  >
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                      <User className="w-4 h-4 text-primary" />
                    </div>
                    <div>
                      <div className="font-medium text-sm">{customer.name}</div>
                      <div className="text-xs text-muted-foreground">{customer.phone}</div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Customer Name */}
          <div className="space-y-2">
            <Label htmlFor="name" className="flex items-center gap-2">
              <User className="w-4 h-4" />
              Imię i nazwisko / Alias *
            </Label>
            <Input
              id="name"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              placeholder="Jan Kowalski"
            />
          </div>

          {/* Vehicle Plate */}
          <div className="space-y-2">
            <Label htmlFor="plate" className="flex items-center gap-2">
              <Car className="w-4 h-4" />
              Numer rejestracyjny *
            </Label>
            <Input
              id="plate"
              value={vehiclePlate}
              onChange={(e) => setVehiclePlate(e.target.value.toUpperCase())}
              placeholder="GD 12345"
              className="uppercase"
            />
          </div>

          {/* Service */}
          <div className="space-y-2">
            <Label>Usługa *</Label>
            <Select value={selectedService} onValueChange={setSelectedService}>
              <SelectTrigger>
                <SelectValue placeholder="Wybierz usługę" />
              </SelectTrigger>
              <SelectContent>
                {services.map((service) => (
                  <SelectItem key={service.id} value={service.id}>
                    <div className="flex items-center justify-between gap-4 w-full">
                      <span>{service.name}</span>
                      <span className="text-xs text-muted-foreground">
                        {service.duration_minutes}min
                        {service.price_from && ` • od ${service.price_from} zł`}
                      </span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Station */}
          <div className="space-y-2">
            <Label>Stanowisko *</Label>
            <Select value={selectedStation} onValueChange={setSelectedStation}>
              <SelectTrigger>
                <SelectValue placeholder="Wybierz stanowisko" />
              </SelectTrigger>
              <SelectContent>
                {stations.map((station) => (
                  <SelectItem key={station.id} value={station.id}>
                    {station.name}
                    <span className="text-xs text-muted-foreground ml-2">({station.type})</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Time Range */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="startTime">Godzina rozpoczęcia *</Label>
              <Input
                id="startTime"
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="endTime">Godzina zakończenia *</Label>
              <Input
                id="endTime"
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
              />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={loading}>
            Anuluj
          </Button>
          <Button onClick={handleSubmit} disabled={loading}>
            {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Dodaj rezerwację
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default AddReservationDialog;
