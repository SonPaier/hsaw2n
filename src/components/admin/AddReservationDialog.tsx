import { useState, useEffect, useCallback } from 'react';
import { User, Phone, Car, Clock, Loader2, Sparkles } from 'lucide-react';
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

type CarSize = 'small' | 'medium' | 'large';

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
  stationId: string;
  date: string;
  time: string;
  instanceId: string;
  onSuccess: () => void;
}

const CAR_SIZE_LABELS: Record<CarSize, string> = {
  small: 'Mały (np. Fiat 500, VW Polo)',
  medium: 'Średni (np. VW Golf, BMW 3)',
  large: 'Duży (np. BMW X5, Audi Q7)',
};

const AddReservationDialog = ({
  open,
  onClose,
  stationId,
  date,
  time,
  instanceId,
  onSuccess,
}: AddReservationDialogProps) => {
  const [loading, setLoading] = useState(false);
  const [searchingCustomer, setSearchingCustomer] = useState(false);
  const [suggestingSize, setSuggestingSize] = useState(false);
  const [services, setServices] = useState<Service[]>([]);
  const [foundCustomers, setFoundCustomers] = useState<Customer[]>([]);
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
  
  // Form state
  const [customerName, setCustomerName] = useState('');
  const [phone, setPhone] = useState('');
  const [carModel, setCarModel] = useState('');
  const [carSize, setCarSize] = useState<CarSize | ''>('');
  const [selectedService, setSelectedService] = useState<string>('');
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
        // Set default service to first "mycie" service
        const defaultService = data.find(s => s.name.toLowerCase().includes('mycie'));
        if (defaultService) {
          setSelectedService(defaultService.id);
        }
      }
    };
    
    if (open && instanceId) {
      fetchServices();
    }
  }, [open, instanceId]);

  // Reset form when dialog opens
  useEffect(() => {
    if (open) {
      setCustomerName('');
      setPhone('');
      setCarModel('');
      setCarSize('');
      setSelectedService('');
      setStartTime(time);
      setEndTime('');
      setFoundCustomers([]);
      setSelectedCustomerId(null);
      setShowCustomerDropdown(false);
    }
  }, [open, time]);

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

  // AI suggestion for car size
  const suggestCarSize = useCallback(async (model: string) => {
    if (model.trim().length < 3) return;
    
    setSuggestingSize(true);
    try {
      const { data, error } = await supabase.functions.invoke('suggest-car-size', {
        body: { carModel: model }
      });
      
      if (!error && data?.size) {
        setCarSize(data.size);
      }
    } catch (err) {
      console.error('Error suggesting car size:', err);
    } finally {
      setSuggestingSize(false);
    }
  }, []);

  // Debounced car model change for AI suggestion
  useEffect(() => {
    if (!carModel || carModel.length < 3) return;
    
    const timer = setTimeout(() => {
      suggestCarSize(carModel);
    }, 500);
    return () => clearTimeout(timer);
  }, [carModel, suggestCarSize]);

  // Search customer by name
  const searchCustomer = useCallback(async (searchName: string) => {
    if (searchName.length < 2) {
      setFoundCustomers([]);
      setShowCustomerDropdown(false);
      return;
    }
    
    setSearchingCustomer(true);
    try {
      const { data, error } = await supabase
        .from('customers')
        .select('id, phone, name, email')
        .eq('instance_id', instanceId)
        .ilike('name', `%${searchName}%`)
        .limit(5);
      
      if (!error && data) {
        setFoundCustomers(data);
        setShowCustomerDropdown(data.length > 0);
      }
    } finally {
      setSearchingCustomer(false);
    }
  }, [instanceId]);

  // Debounced name search
  useEffect(() => {
    if (selectedCustomerId) return; // Don't search if customer already selected
    
    const timer = setTimeout(() => {
      searchCustomer(customerName);
    }, 300);
    return () => clearTimeout(timer);
  }, [customerName, searchCustomer, selectedCustomerId]);

  const selectCustomer = (customer: Customer) => {
    setCustomerName(customer.name);
    setPhone(customer.phone);
    setSelectedCustomerId(customer.id);
    setFoundCustomers([]);
    setShowCustomerDropdown(false);
  };

  const generateConfirmationCode = () => {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
  };

  const handleSubmit = async () => {
    // Only stationId is required (from context), rest is optional
    if (!stationId) {
      toast.error('Brak stanowiska');
      return;
    }

    // Calculate end time if not set but service is selected
    let finalEndTime = endTime;
    if (!finalEndTime && selectedService && startTime) {
      const service = services.find(s => s.id === selectedService);
      if (service?.duration_minutes) {
        const [hours, minutes] = startTime.split(':').map(Number);
        const totalMinutes = hours * 60 + minutes + service.duration_minutes;
        const endHours = Math.floor(totalMinutes / 60);
        const endMins = totalMinutes % 60;
        finalEndTime = `${endHours.toString().padStart(2, '0')}:${endMins.toString().padStart(2, '0')}`;
      }
    }
    
    // Default end time if still not set (1 hour from start)
    if (!finalEndTime && startTime) {
      const [hours, minutes] = startTime.split(':').map(Number);
      const totalMinutes = hours * 60 + minutes + 60;
      const endHours = Math.floor(totalMinutes / 60);
      const endMins = totalMinutes % 60;
      finalEndTime = `${endHours.toString().padStart(2, '0')}:${endMins.toString().padStart(2, '0')}`;
    }

    setLoading(true);
    try {
      // Create customer if name provided and not already selected
      let customerId = selectedCustomerId;
      
      if (customerName && !customerId) {
        // Check if customer with this phone exists (if phone provided)
        if (phone) {
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
        } else {
          // Create customer without phone
          const { data: newCustomer, error: customerError } = await supabase
            .from('customers')
            .insert({
              instance_id: instanceId,
              phone: '', // Empty phone
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
      const reservationData: any = {
        instance_id: instanceId,
        station_id: stationId,
        reservation_date: date,
        start_time: startTime,
        end_time: finalEndTime,
        customer_name: customerName || 'Bez nazwy',
        customer_phone: phone || '',
        vehicle_plate: carModel || '', // Using vehicle_plate field for car model temporarily
        car_size: carSize || null,
        confirmation_code: generateConfirmationCode(),
        status: 'confirmed',
      };

      if (selectedService) {
        reservationData.service_id = selectedService;
      }

      const { error: reservationError } = await supabase
        .from('reservations')
        .insert(reservationData);

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

          {/* Customer Name / Alias - Autocomplete */}
          <div className="space-y-2">
            <Label htmlFor="name" className="flex items-center gap-2">
              <User className="w-4 h-4" />
              Imię i nazwisko / Alias
            </Label>
            <div className="relative">
              <Input
                id="name"
                value={customerName}
                onChange={(e) => {
                  setCustomerName(e.target.value);
                  setSelectedCustomerId(null);
                }}
                placeholder="Jan Kowalski"
                className="pr-10"
                autoComplete="off"
              />
              {searchingCustomer && (
                <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-muted-foreground" />
              )}
            </div>
            
            {/* Customer suggestions dropdown */}
            {showCustomerDropdown && foundCustomers.length > 0 && (
              <div className="border border-border rounded-lg overflow-hidden bg-card shadow-lg z-50">
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
                      <div className="font-medium text-sm">
                        {customer.name} <span className="text-muted-foreground">[{customer.phone}]</span>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Phone */}
          <div className="space-y-2">
            <Label htmlFor="phone" className="flex items-center gap-2">
              <Phone className="w-4 h-4" />
              Numer telefonu
            </Label>
            <Input
              id="phone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="123 456 789"
            />
          </div>

          {/* Car Model */}
          <div className="space-y-2">
            <Label htmlFor="carModel" className="flex items-center gap-2">
              <Car className="w-4 h-4" />
              Model samochodu
            </Label>
            <div className="relative">
              <Input
                id="carModel"
                value={carModel}
                onChange={(e) => setCarModel(e.target.value)}
                placeholder="np. BMW X5, Audi A4"
                className="pr-10"
              />
              {suggestingSize && (
                <Sparkles className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-pulse text-primary" />
              )}
            </div>
          </div>

          {/* Car Size */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              Wielkość samochodu
              {suggestingSize && (
                <span className="text-xs text-muted-foreground">(AI sugeruje...)</span>
              )}
            </Label>
            <Select value={carSize} onValueChange={(v) => setCarSize(v as CarSize)}>
              <SelectTrigger>
                <SelectValue placeholder="Wybierz wielkość" />
              </SelectTrigger>
              <SelectContent className="bg-popover">
                <SelectItem value="small">{CAR_SIZE_LABELS.small}</SelectItem>
                <SelectItem value="medium">{CAR_SIZE_LABELS.medium}</SelectItem>
                <SelectItem value="large">{CAR_SIZE_LABELS.large}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Service */}
          <div className="space-y-2">
            <Label>Usługa</Label>
            <Select value={selectedService} onValueChange={setSelectedService}>
              <SelectTrigger>
                <SelectValue placeholder="Wybierz usługę" />
              </SelectTrigger>
              <SelectContent className="bg-popover">
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

          {/* Time Range */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="startTime">Godzina rozpoczęcia</Label>
              <Input
                id="startTime"
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="endTime">Godzina zakończenia</Label>
              <Input
                id="endTime"
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                placeholder="Automatycznie"
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
