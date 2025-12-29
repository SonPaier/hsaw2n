import { TimeSlot } from '@/types';
import { cn } from '@/lib/utils';
import { useRef, useEffect } from 'react';

interface TimeSlotPickerProps {
  slots: TimeSlot[];
  selectedSlot: TimeSlot | null;
  onSelectSlot: (slot: TimeSlot) => void;
}

const TimeSlotPicker = ({ slots, selectedSlot, onSelectSlot }: TimeSlotPickerProps) => {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const selectedRef = useRef<HTMLButtonElement>(null);

  // Scroll to selected slot when it changes
  useEffect(() => {
    if (selectedRef.current && scrollContainerRef.current) {
      const container = scrollContainerRef.current;
      const selected = selectedRef.current;
      const containerRect = container.getBoundingClientRect();
      const selectedRect = selected.getBoundingClientRect();
      
      const scrollLeft = selected.offsetLeft - container.offsetWidth / 2 + selected.offsetWidth / 2;
      container.scrollTo({ left: scrollLeft, behavior: 'smooth' });
    }
  }, [selectedSlot]);

  const availableSlots = slots.filter(s => s.available);

  if (availableSlots.length === 0) {
    return (
      <div className="text-center py-6">
        <p className="text-muted-foreground text-base">Brak dostępnych terminów w tym dniu.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <h4 className="text-sm font-medium text-muted-foreground px-1">Dostępne godziny</h4>
      <div 
        ref={scrollContainerRef}
        className="flex gap-3 overflow-x-auto pb-2 -mx-4 px-4 scrollbar-hide"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        {availableSlots.map((slot) => {
          const isSelected = selectedSlot?.id === slot.id;
          
          return (
            <button
              key={slot.id}
              ref={isSelected ? selectedRef : null}
              onClick={() => onSelectSlot(slot)}
              className={cn(
                "flex-shrink-0 py-3 px-5 rounded-2xl text-base font-medium transition-all duration-200 min-w-[80px]",
                isSelected 
                  ? "bg-primary text-primary-foreground shadow-lg" 
                  : "bg-card border-2 border-border hover:border-primary/50"
              )}
            >
              {slot.time}
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default TimeSlotPicker;
