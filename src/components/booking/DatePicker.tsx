import { useState, useRef } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { 
  format, 
  addMonths, 
  subMonths,
  startOfMonth, 
  endOfMonth,
  startOfWeek,
  endOfWeek,
  addDays,
  isSameDay, 
  isToday, 
  isBefore, 
  startOfDay,
  isSameMonth 
} from 'date-fns';
import { pl } from 'date-fns/locale';

interface DatePickerProps {
  selectedDate: Date | null;
  onSelectDate: (date: Date) => void;
  daysWithAvailability?: Date[];
}

const DatePicker = ({ selectedDate, onSelectDate, daysWithAvailability = [] }: DatePickerProps) => {
  const [currentMonth, setCurrentMonth] = useState(() => startOfMonth(new Date()));
  const touchStartX = useRef<number | null>(null);
  const touchEndX = useRef<number | null>(null);

  const goToPreviousMonth = () => {
    const newMonth = subMonths(currentMonth, 1);
    if (!isBefore(endOfMonth(newMonth), startOfDay(new Date()))) {
      setCurrentMonth(newMonth);
    }
  };

  const goToNextMonth = () => {
    setCurrentMonth(addMonths(currentMonth, 1));
  };

  const canGoPrevious = !isBefore(endOfMonth(subMonths(currentMonth, 1)), startOfDay(new Date()));

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
        goToNextMonth();
      } else {
        if (canGoPrevious) {
          goToPreviousMonth();
        }
      }
    }

    touchStartX.current = null;
    touchEndX.current = null;
  };

  // Generate calendar days
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });

  const calendarDays: Date[] = [];
  let day = calendarStart;
  while (day <= calendarEnd) {
    calendarDays.push(day);
    day = addDays(day, 1);
  }

  const dayNames = ['PON', 'WT', 'ŚR', 'CZW', 'PT', 'SOB', 'NIEDZ'];

  const hasAvailability = (date: Date) => {
    return daysWithAvailability.some(d => isSameDay(d, date));
  };

  return (
    <div 
      className="space-y-4"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Month Navigation */}
      <div className="flex items-center justify-between px-2">
        <Button
          variant="ghost"
          size="icon"
          onClick={goToPreviousMonth}
          disabled={!canGoPrevious}
          className="shrink-0 h-10 w-10 text-muted-foreground"
        >
          <ChevronLeft className="w-5 h-5" />
        </Button>
        <span className="text-base font-semibold capitalize">
          {format(currentMonth, 'LLLL yyyy', { locale: pl })}
        </span>
        <Button
          variant="ghost"
          size="icon"
          onClick={goToNextMonth}
          className="shrink-0 h-10 w-10 text-muted-foreground"
        >
          <ChevronRight className="w-5 h-5" />
        </Button>
      </div>

      {/* Day Names Header */}
      <div className="grid grid-cols-7 gap-1">
        {dayNames.map((dayName) => (
          <div 
            key={dayName} 
            className="text-center text-xs font-medium text-muted-foreground py-2"
          >
            {dayName}
          </div>
        ))}
      </div>

      {/* Calendar Grid */}
      <div className="grid grid-cols-7 gap-1">
        {calendarDays.map((calDay) => {
          const isPast = isBefore(calDay, startOfDay(new Date()));
          const isSelected = selectedDate && isSameDay(calDay, selectedDate);
          const isTodayDate = isToday(calDay);
          const isCurrentMonth = isSameMonth(calDay, currentMonth);
          const hasSlots = hasAvailability(calDay);

          return (
            <button
              key={calDay.toISOString()}
              onClick={() => !isPast && isCurrentMonth && onSelectDate(calDay)}
              disabled={isPast || !isCurrentMonth}
              className={cn(
                "relative flex items-center justify-center h-11 w-full rounded-full text-sm font-medium transition-all duration-200",
                !isCurrentMonth && "text-muted-foreground/30",
                isPast && isCurrentMonth && "text-muted-foreground/50 cursor-not-allowed",
                !isPast && isCurrentMonth && !isSelected && "hover:bg-secondary",
                isTodayDate && !isSelected && "ring-2 ring-primary/30 ring-inset",
                isSelected && "bg-primary text-primary-foreground shadow-lg",
              )}
            >
              <span>{format(calDay, 'd')}</span>
              {/* Availability dot */}
              {hasSlots && !isPast && isCurrentMonth && !isSelected && (
                <span className="absolute bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-primary" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default DatePicker;
