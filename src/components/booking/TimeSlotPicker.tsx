import { TimeSlot } from '@/types';
import { cn } from '@/lib/utils';

interface TimeSlotPickerProps {
  slots: TimeSlot[];
  selectedSlot: TimeSlot | null;
  onSelectSlot: (slot: TimeSlot) => void;
}

const TimeSlotPicker = ({ slots, selectedSlot, onSelectSlot }: TimeSlotPickerProps) => {
  const morningSlots = slots.filter(s => {
    const hour = parseInt(s.time.split(':')[0]);
    return hour < 12;
  });
  
  const afternoonSlots = slots.filter(s => {
    const hour = parseInt(s.time.split(':')[0]);
    return hour >= 12;
  });

  const renderSlots = (timeSlots: TimeSlot[], label: string) => (
    <div className="space-y-3">
      <h4 className="text-sm font-medium text-muted-foreground">{label}</h4>
      <div className="grid grid-cols-4 sm:grid-cols-5 gap-2">
        {timeSlots.map((slot) => {
          const isSelected = selectedSlot?.id === slot.id;
          
          return (
            <button
              key={slot.id}
              onClick={() => slot.available && onSelectSlot(slot)}
              disabled={!slot.available}
              className={cn(
                "py-3 px-2 rounded-lg text-sm font-medium transition-all duration-300",
                !slot.available && "opacity-30 cursor-not-allowed bg-muted line-through",
                slot.available && !isSelected && "bg-card border border-border/50 hover:border-primary/50 hover:bg-primary/10",
                isSelected && "bg-primary text-primary-foreground shadow-lg shadow-primary/30"
              )}
            >
              {slot.time}
            </button>
          );
        })}
      </div>
    </div>
  );

  if (slots.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-muted-foreground">Brak dostępnych terminów w tym dniu.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {morningSlots.length > 0 && renderSlots(morningSlots, 'Rano')}
      {afternoonSlots.length > 0 && renderSlots(afternoonSlots, 'Po południu')}
    </div>
  );
};

export default TimeSlotPicker;
