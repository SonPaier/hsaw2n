import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Service, TimeSlot } from '@/types';
import { format } from 'date-fns';
import { pl } from 'date-fns/locale';
import { User, Phone, Car, ArrowLeft, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';

interface BookingFormProps {
  service: Service;
  date: Date;
  slot: TimeSlot;
  onBack: () => void;
  onComplete: () => void;
}

const BookingForm = ({ service, date, slot, onBack, onComplete }: BookingFormProps) => {
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    vehiclePlate: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [confirmationCode, setConfirmationCode] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name || !formData.phone || !formData.vehiclePlate) {
      toast.error('Wypełnij wszystkie pola');
      return;
    }

    setIsSubmitting(true);
    
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    // Generate 3-digit confirmation code
    const code = Math.floor(100 + Math.random() * 900).toString();
    setConfirmationCode(code);
    setShowConfirmation(true);
    setIsSubmitting(false);
    
    toast.success('Rezerwacja wysłana! Sprawdź SMS z kodem.');
  };

  if (showConfirmation) {
    return (
      <div className="text-center space-y-6 py-8 animate-slide-up">
        <div className="w-20 h-20 rounded-full bg-success/20 flex items-center justify-center mx-auto">
          <CheckCircle2 className="w-10 h-10 text-success" />
        </div>
        
        <div className="space-y-2">
          <h2 className="text-2xl font-bold text-foreground">Rezerwacja wysłana!</h2>
          <p className="text-muted-foreground">
            Wysłaliśmy SMS z kodem potwierdzenia na numer {formData.phone}
          </p>
        </div>

        <div className="glass-card p-6 max-w-sm mx-auto space-y-4">
          <div className="text-sm text-muted-foreground">Twój kod potwierdzenia:</div>
          <div className="text-4xl font-bold tracking-[0.5em] text-primary pl-2">
            {confirmationCode}
          </div>
        </div>

        <div className="glass-card p-4 max-w-sm mx-auto text-left space-y-3">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Usługa:</span>
            <span className="font-medium">{service.name}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Data:</span>
            <span className="font-medium">{format(date, 'd MMMM yyyy', { locale: pl })}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Godzina:</span>
            <span className="font-medium">{slot.time}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Cena:</span>
            <span className="font-bold text-primary">{service.price} zł</span>
          </div>
        </div>

        <Button variant="hero" size="lg" onClick={onComplete} className="mt-4">
          Zamknij
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-slide-up">
      {/* Back Button */}
      <Button variant="ghost" onClick={onBack} className="gap-2 -ml-2">
        <ArrowLeft className="w-4 h-4" />
        Wróć
      </Button>

      {/* Summary */}
      <div className="glass-card p-4 space-y-3">
        <h3 className="font-semibold text-foreground">Podsumowanie rezerwacji</h3>
        <div className="grid grid-cols-2 gap-2 text-sm">
          <span className="text-muted-foreground">Usługa:</span>
          <span className="font-medium text-right">{service.name}</span>
          <span className="text-muted-foreground">Data:</span>
          <span className="font-medium text-right">{format(date, 'd MMMM yyyy', { locale: pl })}</span>
          <span className="text-muted-foreground">Godzina:</span>
          <span className="font-medium text-right">{slot.time}</span>
          <span className="text-muted-foreground">Cena:</span>
          <span className="font-bold text-primary text-right">{service.price} zł</span>
        </div>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="space-y-2">
          <Label htmlFor="name" className="flex items-center gap-2">
            <User className="w-4 h-4 text-muted-foreground" />
            Imię i nazwisko
          </Label>
          <Input
            id="name"
            placeholder="Jan Kowalski"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            className="h-12"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="phone" className="flex items-center gap-2">
            <Phone className="w-4 h-4 text-muted-foreground" />
            Numer telefonu
          </Label>
          <Input
            id="phone"
            type="tel"
            placeholder="+48 123 456 789"
            value={formData.phone}
            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
            className="h-12"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="plate" className="flex items-center gap-2">
            <Car className="w-4 h-4 text-muted-foreground" />
            Numer rejestracyjny
          </Label>
          <Input
            id="plate"
            placeholder="GD 12345"
            value={formData.vehiclePlate}
            onChange={(e) => setFormData({ ...formData, vehiclePlate: e.target.value.toUpperCase() })}
            className="h-12 uppercase"
          />
        </div>

        <div className="pt-4">
          <Button 
            type="submit" 
            variant="hero" 
            size="xl" 
            className="w-full"
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Wysyłanie...' : `Zarezerwuj za ${service.price} zł`}
          </Button>
          <p className="text-xs text-muted-foreground text-center mt-3">
            Otrzymasz SMS z kodem potwierdzającym rezerwację
          </p>
        </div>
      </form>
    </div>
  );
};

export default BookingForm;
