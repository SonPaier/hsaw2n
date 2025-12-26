import { useState, useRef } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { format, addDays, startOfWeek, isSameDay, isToday, isBefore, startOfDay } from 'date-fns';
import { pl } from 'date-fns/locale';

interface DatePickerProps {
  selectedDate: Date | null;
  onSelectDate: (date: Date) => void;
}

const DatePicker = ({ selectedDate, onSelectDate }: DatePickerProps) => {
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date(), { weekStartsOn: 1 }));
  const touchStartX = useRef<number | null>(null);
  const touchEndX = useRef<number | null>(null);

  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  const goToPreviousWeek = () => {
    const newStart = addDays(weekStart, -7);
    if (!isBefore(newStart, startOfDay(new Date()))) {
      setWeekStart(newStart);
    }
  };

  const goToNextWeek = () => {
    setWeekStart(addDays(weekStart, 7));
  };

  const canGoPrevious = !isBefore(addDays(weekStart, -7), startOfWeek(new Date(), { weekStartsOn: 1 }));

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    touchEndX.current = e.touches[0].clientX;
  };

  const handleTouchEnd = () => {
    if (touchStartX.current === null || touchEndX.current === null) return;
    
    const diff = touchStartX.current - touchEndX.current;
    const minSwipeDistance = 50;

    if (Math.abs(diff) > minSwipeDistance) {
      if (diff > 0) {
        // Swiped left - go to next week
        goToNextWeek();
      } else {
        // Swiped right - go to previous week
        if (canGoPrevious) {
          goToPreviousWeek();
        }
      }
    }

    touchStartX.current = null;
    touchEndX.current = null;
  };

  return (
    <div 
      className="space-y-4"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Week Navigation */}
      <div className="flex items-center justify-between">
        <Button
          variant="ghost"
          onClick={goToPreviousWeek}
          disabled={!canGoPrevious}
          className="shrink-0 h-12 w-12 sm:h-10 sm:w-10"
        >
          <ChevronLeft className="w-6 h-6 sm:w-5 sm:h-5" />
        </Button>
        <span className="text-sm font-medium text-muted-foreground">
          {format(weekStart, 'LLLL yyyy', { locale: pl })}
        </span>
        <Button
          variant="ghost"
          onClick={goToNextWeek}
          className="shrink-0 h-12 w-12 sm:h-10 sm:w-10"
        >
          <ChevronRight className="w-6 h-6 sm:w-5 sm:h-5" />
        </Button>
      </div>

      {/* Days Grid */}
      <div className="grid grid-cols-7 gap-2">
        {days.map((day) => {
          const isPast = isBefore(day, startOfDay(new Date()));
          const isSelected = selectedDate && isSameDay(day, selectedDate);
          const isTodayDate = isToday(day);

          return (
            <button
              key={day.toISOString()}
              onClick={() => !isPast && onSelectDate(day)}
              disabled={isPast}
              className={cn(
                "flex flex-col items-center py-3 px-1 rounded-xl transition-all duration-300",
                isPast && "opacity-40 cursor-not-allowed",
                isSelected
                  ? "bg-primary text-primary-foreground shadow-lg shadow-primary/30"
                  : isTodayDate
                    ? "bg-secondary border-2 border-primary/50"
                    : "bg-card/50 hover:bg-secondary border border-border/50"
              )}
            >
              <span className="text-[10px] uppercase font-medium opacity-70">
                {format(day, 'EEEEEE', { locale: pl })}
              </span>
              <span className="text-lg font-bold mt-1">
                {format(day, 'd')}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default DatePicker;
