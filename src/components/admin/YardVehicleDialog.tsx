import { useState, useEffect, useCallback } from 'react';
import { format } from 'date-fns';
import { pl } from 'date-fns/locale';
import { CalendarIcon, Phone, User, Car, Loader2, Sparkles, ChevronDown } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

type CarSize = 'small' | 'medium' | 'large';

interface Service {
  id: string;
  name: string;
  shortcut?: string;
}

interface Customer {
  id: string;
  phone: string;
  name: string;
}

interface CustomerVehicle {
  id: string;
  model: string;
  plate: string | null;
  usage_count: number;
}

interface YardVehicle {
  id: string;
  customer_name: string;
  customer_phone: string;
  vehicle_plate: string;
  car_size: CarSize | null;
  service_ids: string[];
  arrival_date: string;
  deadline_time: string | null;
  notes: string | null;
}

interface YardVehicleDialogProps {
  open: boolean;
  onClose: () => void;
  instanceId: string;
  onSuccess: () => void;
  editingVehicle?: YardVehicle | null; // If provided, we're editing
}

export function YardVehicleDialog({ open, onClose, instanceId, onSuccess, editingVehicle }: YardVehicleDialogProps) {
  const [loading, setLoading] = useState(false);
  const [services, setServices] = useState<Service[]>([]);
  
  // Customer search state
  const [searchingCustomer, setSearchingCustomer] = useState(false);
  const [foundCustomers, setFoundCustomers] = useState<Customer[]>([]);
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  
  // Vehicle suggestions
  const [customerVehicles, setCustomerVehicles] = useState<CustomerVehicle[]>([]);
  const [showVehicleDropdown, setShowVehicleDropdown] = useState(false);
  
  // AI car size suggestion
  const [suggestingSize, setSuggestingSize] = useState(false);
  
  // Form state
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [vehiclePlate, setVehiclePlate] = useState('');
  const [carSize, setCarSize] = useState<CarSize | ''>('');
  const [selectedServices, setSelectedServices] = useState<string[]>([]);
  const [arrivalDate, setArrivalDate] = useState<Date>(new Date());
  const [deadlineTime, setDeadlineTime] = useState('');
  const [notes, setNotes] = useState('');

  const isEditing = !!editingVehicle;

  // Fetch services
  useEffect(() => {
    const fetchServices = async () => {
      const { data } = await supabase
        .from('services')
        .select('id, name, shortcut')
        .eq('instance_id', instanceId)
        .eq('active', true)
        .order('sort_order');
      
      if (data) {
        setServices(data);
      }
    };

    if (open && instanceId) {
      fetchServices();
    }
  }, [open, instanceId]);

  // Reset or populate form on open
  useEffect(() => {
    if (open) {
      if (editingVehicle) {
        // Populate form with existing data
        setCustomerName(editingVehicle.customer_name);
        setCustomerPhone(editingVehicle.customer_phone);
        setVehiclePlate(editingVehicle.vehicle_plate);
        setCarSize(editingVehicle.car_size || '');
        setSelectedServices(editingVehicle.service_ids);
        setArrivalDate(new Date(editingVehicle.arrival_date));
        setDeadlineTime(editingVehicle.deadline_time || '');
        setNotes(editingVehicle.notes || '');
        setSelectedCustomerId(null);
        setFoundCustomers([]);
        setShowCustomerDropdown(false);
        setCustomerVehicles([]);
        setShowVehicleDropdown(false);
      } else {
        // Reset form for new entry
        setCustomerName('');
        setCustomerPhone('');
        setVehiclePlate('');
        setCarSize('');
        setSelectedServices([]);
        setArrivalDate(new Date());
        setDeadlineTime('');
        setNotes('');
        setSelectedCustomerId(null);
        setFoundCustomers([]);
        setShowCustomerDropdown(false);
        setCustomerVehicles([]);
        setShowVehicleDropdown(false);
      }
    }
  }, [open, editingVehicle]);

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
        .select('id, phone, name')
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

  // Fetch customer vehicles when customer is selected
  const fetchCustomerVehicles = useCallback(async (phone: string) => {
    const { data } = await supabase
      .from('customer_vehicles')
      .select('id, model, plate, usage_count')
      .eq('instance_id', instanceId)
      .eq('phone', phone)
      .order('usage_count', { ascending: false })
      .limit(5);
    
    if (data) {
      setCustomerVehicles(data);
    }
  }, [instanceId]);

  const selectCustomer = (customer: Customer) => {
    setCustomerName(customer.name);
    setCustomerPhone(customer.phone);
    setSelectedCustomerId(customer.id);
    setFoundCustomers([]);
    setShowCustomerDropdown(false);
    
    // Fetch vehicles for this customer
    fetchCustomerVehicles(customer.phone);
  };

  const selectVehicle = (vehicle: CustomerVehicle) => {
    setVehiclePlate(vehicle.plate ? `${vehicle.model} / ${vehicle.plate}` : vehicle.model);
    setShowVehicleDropdown(false);
    
    // Trigger AI car size suggestion
    suggestCarSize(vehicle.model);
  };

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

  // Debounced vehicle model change for AI suggestion
  useEffect(() => {
    if (!vehiclePlate || vehiclePlate.length < 3) return;
    
    const timer = setTimeout(() => {
      // Extract model from "Model / Plate" format
      const model = vehiclePlate.split('/')[0].trim();
      if (model.length >= 3) {
        suggestCarSize(model);
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [vehiclePlate, suggestCarSize]);

  const toggleService = (serviceId: string) => {
    setSelectedServices(prev => 
      prev.includes(serviceId)
        ? prev.filter(id => id !== serviceId)
        : [...prev, serviceId]
    );
  };

  const handleSubmit = async () => {
    if (!customerName.trim()) {
      toast.error('Podaj imię i nazwisko klienta');
      return;
    }
    if (!customerPhone.trim()) {
      toast.error('Podaj numer telefonu');
      return;
    }
    if (!vehiclePlate.trim()) {
      toast.error('Podaj model pojazdu');
      return;
    }
    if (selectedServices.length === 0) {
      toast.error('Wybierz przynajmniej jedną usługę');
      return;
    }

    setLoading(true);
    try {
      const vehicleData = {
        instance_id: instanceId,
        customer_name: customerName.trim(),
        customer_phone: customerPhone.trim(),
        vehicle_plate: vehiclePlate.trim(),
        car_size: carSize || null,
        service_ids: selectedServices,
        arrival_date: format(arrivalDate, 'yyyy-MM-dd'),
        deadline_time: deadlineTime || null,
        notes: notes.trim() || null,
      };

      if (isEditing && editingVehicle) {
        // Update existing
        const { error } = await supabase
          .from('yard_vehicles')
          .update(vehicleData)
          .eq('id', editingVehicle.id);

        if (error) throw error;
        toast.success('Pojazd zaktualizowany');
      } else {
        // Insert new
        const { error } = await supabase
          .from('yard_vehicles')
          .insert({
            ...vehicleData,
            status: 'waiting'
          });

        if (error) throw error;
        toast.success('Pojazd dodany na plac');
      }

      onSuccess();
      onClose();
    } catch (error) {
      console.error('Error saving yard vehicle:', error);
      toast.error(isEditing ? 'Błąd podczas aktualizacji pojazdu' : 'Błąd podczas dodawania pojazdu');
    } finally {
      setLoading(false);
    }
  };

  // Generate time options (every 15 min)
  const timeOptions = [];
  for (let h = 6; h <= 22; h++) {
    for (let m = 0; m < 60; m += 15) {
      const time = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
      timeOptions.push(time);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Edytuj pojazd' : 'Dodaj pojazd na plac'}</DialogTitle>
          <DialogDescription>
            {isEditing ? 'Zmień dane pojazdu oczekującego na usługę' : 'Wprowadź dane pojazdu oczekującego na usługę'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Customer Name with autocomplete */}
          <div className="space-y-2 relative">
            <Label htmlFor="customerName" className="flex items-center gap-2">
              <User className="w-4 h-4" />
              Imię i nazwisko *
              {searchingCustomer && <Loader2 className="w-3 h-3 animate-spin" />}
            </Label>
            <Input
              id="customerName"
              value={customerName}
              onChange={(e) => {
                setCustomerName(e.target.value);
                setSelectedCustomerId(null);
              }}
              placeholder="Jan Kowalski"
            />
            {/* Customer dropdown */}
            {showCustomerDropdown && foundCustomers.length > 0 && (
              <div className="absolute z-50 w-full mt-1 bg-popover border border-border rounded-md shadow-lg max-h-40 overflow-y-auto">
                {foundCustomers.map((customer) => (
                  <button
                    key={customer.id}
                    type="button"
                    onClick={() => selectCustomer(customer)}
                    className="w-full px-3 py-2 text-left hover:bg-muted text-sm flex justify-between items-center"
                  >
                    <span>{customer.name}</span>
                    <span className="text-muted-foreground text-xs">{customer.phone}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Phone */}
          <div className="space-y-2">
            <Label htmlFor="phone" className="flex items-center gap-2">
              <Phone className="w-4 h-4" />
              Telefon *
            </Label>
            <Input
              id="phone"
              type="tel"
              value={customerPhone}
              onChange={(e) => setCustomerPhone(e.target.value)}
              placeholder="+48 123 456 789"
            />
          </div>

          {/* Vehicle with suggestions */}
          <div className="space-y-2 relative">
            <Label htmlFor="vehicle" className="flex items-center gap-2">
              <Car className="w-4 h-4" />
              Pojazd *
              {suggestingSize && <Sparkles className="w-3 h-3 animate-pulse text-yellow-500" />}
            </Label>
            <div className="flex gap-2">
              <div className="flex-1 relative">
                <Input
                  id="vehicle"
                  value={vehiclePlate}
                  onChange={(e) => setVehiclePlate(e.target.value)}
                  placeholder="BMW X5 / WA12345"
                  onFocus={() => customerVehicles.length > 0 && setShowVehicleDropdown(true)}
                />
                {/* Vehicle dropdown */}
                {showVehicleDropdown && customerVehicles.length > 0 && (
                  <div className="absolute z-50 w-full mt-1 bg-popover border border-border rounded-md shadow-lg max-h-40 overflow-y-auto">
                    {customerVehicles.map((vehicle) => (
                      <button
                        key={vehicle.id}
                        type="button"
                        onClick={() => selectVehicle(vehicle)}
                        className="w-full px-3 py-2 text-left hover:bg-muted text-sm flex justify-between items-center"
                      >
                        <span>{vehicle.model}</span>
                        {vehicle.plate && (
                          <span className="text-muted-foreground text-xs">{vehicle.plate}</span>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {customerVehicles.length > 0 && (
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => setShowVehicleDropdown(!showVehicleDropdown)}
                >
                  <ChevronDown className="w-4 h-4" />
                </Button>
              )}
            </div>
          </div>

          {/* Car Size */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              Rozmiar auta
              {suggestingSize && <Loader2 className="w-3 h-3 animate-spin" />}
            </Label>
            <div className="flex gap-2">
              {(['small', 'medium', 'large'] as CarSize[]).map((size) => (
                <Button
                  key={size}
                  type="button"
                  variant={carSize === size ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setCarSize(carSize === size ? '' : size)}
                  className="flex-1"
                >
                  {size === 'small' ? 'Małe' : size === 'medium' ? 'Średnie' : 'Duże'}
                </Button>
              ))}
            </div>
          </div>

          {/* Services */}
          <div className="space-y-2">
            <Label>Usługi *</Label>
            <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto p-2 border rounded-md bg-muted/30">
              {services.map((service) => (
                <Button
                  key={service.id}
                  type="button"
                  variant={selectedServices.includes(service.id) ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => toggleService(service.id)}
                  className="text-xs"
                >
                  {service.shortcut || service.name}
                </Button>
              ))}
            </div>
          </div>

          {/* Arrival Date */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <CalendarIcon className="w-4 h-4" />
              Data przyjazdu *
            </Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !arrivalDate && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {arrivalDate ? format(arrivalDate, 'PPP', { locale: pl }) : 'Wybierz datę'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={arrivalDate}
                  onSelect={(date) => date && setArrivalDate(date)}
                  locale={pl}
                  className="pointer-events-auto"
                />
              </PopoverContent>
            </Popover>
          </div>

          <div className="space-y-2">
            <Label>Do kiedy skończyć (opcjonalne)</Label>
            <Select value={deadlineTime || "none"} onValueChange={(val) => setDeadlineTime(val === "none" ? "" : val)}>
              <SelectTrigger>
                <SelectValue placeholder="Wybierz godzinę" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Brak</SelectItem>
                {timeOptions.map((time) => (
                  <SelectItem key={time} value={time}>{time}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label>Notatki</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Dodatkowe informacje..."
              rows={2}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={loading}>
            Anuluj
          </Button>
          <Button onClick={handleSubmit} disabled={loading}>
            {loading ? 'Zapisywanie...' : (isEditing ? 'Zapisz zmiany' : 'Dodaj na plac')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
