import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { pl } from 'date-fns/locale';
import { CalendarIcon, Phone, User, Car } from 'lucide-react';
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

interface AddYardVehicleDialogProps {
  open: boolean;
  onClose: () => void;
  instanceId: string;
  onSuccess: () => void;
}

export function AddYardVehicleDialog({ open, onClose, instanceId, onSuccess }: AddYardVehicleDialogProps) {
  const [loading, setLoading] = useState(false);
  const [services, setServices] = useState<Service[]>([]);
  
  // Form state
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [vehiclePlate, setVehiclePlate] = useState('');
  const [carSize, setCarSize] = useState<CarSize | ''>('');
  const [selectedServices, setSelectedServices] = useState<string[]>([]);
  const [arrivalDate, setArrivalDate] = useState<Date>(new Date());
  const [deadlineTime, setDeadlineTime] = useState('');
  const [notes, setNotes] = useState('');

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

  // Reset form on open
  useEffect(() => {
    if (open) {
      setCustomerName('');
      setCustomerPhone('');
      setVehiclePlate('');
      setCarSize('');
      setSelectedServices([]);
      setArrivalDate(new Date());
      setDeadlineTime('');
      setNotes('');
    }
  }, [open]);

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
      const { error } = await supabase
        .from('yard_vehicles')
        .insert({
          instance_id: instanceId,
          customer_name: customerName.trim(),
          customer_phone: customerPhone.trim(),
          vehicle_plate: vehiclePlate.trim(),
          car_size: carSize || null,
          service_ids: selectedServices,
          arrival_date: format(arrivalDate, 'yyyy-MM-dd'),
          deadline_time: deadlineTime || null,
          notes: notes.trim() || null,
          status: 'waiting'
        });

      if (error) throw error;

      toast.success('Pojazd dodany na plac');
      onSuccess();
      onClose();
    } catch (error) {
      console.error('Error adding yard vehicle:', error);
      toast.error('Błąd podczas dodawania pojazdu');
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
          <DialogTitle>Dodaj pojazd na plac</DialogTitle>
          <DialogDescription>Wprowadź dane pojazdu oczekującego na usługę</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Customer Name */}
          <div className="space-y-2">
            <Label htmlFor="customerName" className="flex items-center gap-2">
              <User className="w-4 h-4" />
              Imię i nazwisko *
            </Label>
            <Input
              id="customerName"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              placeholder="Jan Kowalski"
            />
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

          {/* Vehicle */}
          <div className="space-y-2">
            <Label htmlFor="vehicle" className="flex items-center gap-2">
              <Car className="w-4 h-4" />
              Pojazd *
            </Label>
            <Input
              id="vehicle"
              value={vehiclePlate}
              onChange={(e) => setVehiclePlate(e.target.value)}
              placeholder="BMW X5 / WA12345"
            />
          </div>

          {/* Car Size */}
          <div className="space-y-2">
            <Label>Rozmiar auta</Label>
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

          {/* Deadline Time */}
          <div className="space-y-2">
            <Label>Do kiedy skończyć (opcjonalne)</Label>
            <Select value={deadlineTime} onValueChange={setDeadlineTime}>
              <SelectTrigger>
                <SelectValue placeholder="Wybierz godzinę" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">Brak</SelectItem>
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
            {loading ? 'Dodawanie...' : 'Dodaj na plac'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
