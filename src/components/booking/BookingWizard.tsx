import { useState, useMemo } from 'react';
import { Service, TimeSlot } from '@/types';
import { mockServices, generateTimeSlots, mockStations } from '@/data/mockData';
import ServiceCard from './ServiceCard';
import DatePicker from './DatePicker';
import TimeSlotPicker from './TimeSlotPicker';
import BookingForm from './BookingForm';
import { Button } from '@/components/ui/button';
import { format } from 'date-fns';
import { pl } from 'date-fns/locale';
import { Sparkles, CalendarDays, Clock, UserCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

type Step = 'service' | 'date' | 'time' | 'form';

const steps: { key: Step; label: string; icon: React.ReactNode }[] = [
  { key: 'service', label: 'Usługa', icon: <Sparkles className="w-4 h-4" /> },
  { key: 'date', label: 'Data', icon: <CalendarDays className="w-4 h-4" /> },
  { key: 'time', label: 'Godzina', icon: <Clock className="w-4 h-4" /> },
  { key: 'form', label: 'Dane', icon: <UserCircle className="w-4 h-4" /> },
];

const BookingWizard = () => {
  const [currentStep, setCurrentStep] = useState<Step>('service');
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<TimeSlot | null>(null);

  const currentStepIndex = steps.findIndex(s => s.key === currentStep);

  const timeSlots = useMemo(() => {
    if (!selectedDate || !selectedService) return [];
    
    const station = mockStations.find(s => s.type === selectedService.category) || mockStations[0];
    return generateTimeSlots(format(selectedDate, 'yyyy-MM-dd'), station.id);
  }, [selectedDate, selectedService]);

  const handleServiceSelect = (service: Service) => {
    setSelectedService(service);
  };

  const handleDateSelect = (date: Date) => {
    setSelectedDate(date);
    setSelectedSlot(null);
  };

  const handleSlotSelect = (slot: TimeSlot) => {
    setSelectedSlot(slot);
  };

  const handleNext = () => {
    if (currentStep === 'service' && selectedService) {
      setCurrentStep('date');
    } else if (currentStep === 'date' && selectedDate) {
      setCurrentStep('time');
    } else if (currentStep === 'time' && selectedSlot) {
      setCurrentStep('form');
    }
  };

  const handleBack = () => {
    if (currentStep === 'form') {
      setCurrentStep('time');
    } else if (currentStep === 'time') {
      setCurrentStep('date');
    } else if (currentStep === 'date') {
      setCurrentStep('service');
    }
  };

  const handleComplete = () => {
    setCurrentStep('service');
    setSelectedService(null);
    setSelectedDate(null);
    setSelectedSlot(null);
  };

  const canProceed = () => {
    switch (currentStep) {
      case 'service':
        return !!selectedService;
      case 'date':
        return !!selectedDate;
      case 'time':
        return !!selectedSlot;
      default:
        return false;
    }
  };

  const washServices = mockServices.filter(s => s.category === 'mycie');
  const foliaServices = mockServices.filter(s => s.category === 'folia');

  return (
    <div className="space-y-6">
      {/* Progress Steps */}
      {currentStep !== 'form' && (
        <div className="flex items-center justify-between gap-2">
          {steps.map((step, index) => (
            <div
              key={step.key}
              className={cn(
                "flex-1 flex items-center gap-2 py-2 px-3 rounded-lg transition-all",
                index === currentStepIndex
                  ? "bg-primary/10 text-primary"
                  : index < currentStepIndex
                    ? "text-primary/60"
                    : "text-muted-foreground/50"
              )}
            >
              <div className={cn(
                "w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0",
                index === currentStepIndex
                  ? "bg-primary text-primary-foreground"
                  : index < currentStepIndex
                    ? "bg-primary/30 text-primary"
                    : "bg-muted text-muted-foreground"
              )}>
                {index + 1}
              </div>
              <span className="text-sm font-medium hidden sm:block">{step.label}</span>
            </div>
          ))}
        </div>
      )}

      {/* Step Content */}
      <div className="min-h-[400px]">
        {currentStep === 'service' && (
          <div className="space-y-6 animate-slide-up">
            <div>
              <h2 className="text-xl font-bold text-foreground mb-1">Wybierz usługę</h2>
              <p className="text-sm text-muted-foreground">Co chciałbyś zarezerwować?</p>
            </div>

            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                Mycie
              </h3>
              <div className="space-y-3">
                {washServices.map((service) => (
                  <ServiceCard
                    key={service.id}
                    service={service}
                    selected={selectedService?.id === service.id}
                    onSelect={handleServiceSelect}
                  />
                ))}
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                Folia
              </h3>
              <div className="space-y-3">
                {foliaServices.map((service) => (
                  <ServiceCard
                    key={service.id}
                    service={service}
                    selected={selectedService?.id === service.id}
                    onSelect={handleServiceSelect}
                  />
                ))}
              </div>
            </div>
          </div>
        )}

        {currentStep === 'date' && (
          <div className="space-y-6 animate-slide-up">
            <div>
              <h2 className="text-xl font-bold text-foreground mb-1">Wybierz datę</h2>
              <p className="text-sm text-muted-foreground">
                {selectedService?.name} • {selectedService?.duration}min
              </p>
            </div>
            <DatePicker
              selectedDate={selectedDate}
              onSelectDate={handleDateSelect}
            />
          </div>
        )}

        {currentStep === 'time' && selectedDate && (
          <div className="space-y-6 animate-slide-up">
            <div>
              <h2 className="text-xl font-bold text-foreground mb-1">Wybierz godzinę</h2>
              <p className="text-sm text-muted-foreground">
                {format(selectedDate, 'd MMMM yyyy', { locale: pl })}
              </p>
            </div>
            <TimeSlotPicker
              slots={timeSlots}
              selectedSlot={selectedSlot}
              onSelectSlot={handleSlotSelect}
            />
          </div>
        )}

        {currentStep === 'form' && selectedService && selectedDate && selectedSlot && (
          <BookingForm
            service={selectedService}
            date={selectedDate}
            slot={selectedSlot}
            onBack={handleBack}
            onComplete={handleComplete}
          />
        )}
      </div>

      {/* Navigation */}
      {currentStep !== 'form' && (
        <div className="flex gap-3 pt-4 border-t border-border/50">
          {currentStep !== 'service' && (
            <Button variant="outline" onClick={handleBack} className="flex-1">
              Wstecz
            </Button>
          )}
          <Button
            variant="hero"
            onClick={handleNext}
            disabled={!canProceed()}
            className="flex-1"
          >
            Dalej
          </Button>
        </div>
      )}
    </div>
  );
};

export default BookingWizard;
