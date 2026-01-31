import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ChevronLeft, ChevronRight, Check, X, Palmtree } from 'lucide-react';
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, eachDayOfInterval, addWeeks, subWeeks, isSameDay, getDay } from 'date-fns';
import { pl } from 'date-fns/locale';
import { useTimeEntries, useTimeEntriesForDateRange, useCreateTimeEntry, useUpdateTimeEntry, TimeEntry } from '@/hooks/useTimeEntries';
import { useEmployeeDaysOff, useCreateEmployeeDayOff } from '@/hooks/useEmployeeDaysOff';
import { useWorkingHours } from '@/hooks/useWorkingHours';
import { Employee } from '@/hooks/useEmployees';
import { toast } from 'sonner';

// Weekday index to working_hours key map (0=Sunday, 1=Monday, etc)
const WEEKDAY_TO_KEY: Record<number, string> = {
  0: 'sunday',
  1: 'monday',
  2: 'tuesday',
  3: 'wednesday',
  4: 'thursday',
  5: 'friday',
  6: 'saturday',
};

interface WeeklyScheduleProps {
  employee: Employee;
  instanceId: string;
}

interface EditingCell {
  date: string;
  hours: string;
  minutes: string;
}

const WeeklySchedule = ({ employee, instanceId }: WeeklyScheduleProps) => {
  const [currentWeekStart, setCurrentWeekStart] = useState(() => 
    startOfWeek(new Date(), { weekStartsOn: 1 })
  );
  const [editingCell, setEditingCell] = useState<EditingCell | null>(null);

  const weekEnd = endOfWeek(currentWeekStart, { weekStartsOn: 1 });
  const weekDays = eachDayOfInterval({ start: currentWeekStart, end: weekEnd });

  const dateFrom = format(currentWeekStart, 'yyyy-MM-dd');
  const dateTo = format(weekEnd, 'yyyy-MM-dd');

  // Monthly data for the calendar month of the current week
  const monthStartDate = startOfMonth(currentWeekStart);
  const monthEndDate = endOfMonth(currentWeekStart);
  const monthFrom = format(monthStartDate, 'yyyy-MM-dd');
  const monthTo = format(monthEndDate, 'yyyy-MM-dd');

  const { data: timeEntries = [] } = useTimeEntries(instanceId, employee.id, dateFrom, dateTo);
  const { data: monthTimeEntries = [] } = useTimeEntriesForDateRange(instanceId, monthFrom, monthTo);
  const { data: daysOff = [] } = useEmployeeDaysOff(instanceId, employee.id);
  const { data: workingHours } = useWorkingHours(instanceId);
  const createTimeEntry = useCreateTimeEntry(instanceId);
  const updateTimeEntry = useUpdateTimeEntry(instanceId);
  const createDayOff = useCreateEmployeeDayOff(instanceId);

  // Helper to get opening time for a given date
  const getOpeningTime = (dateStr: string): Date | null => {
    if (!workingHours) return null;
    const date = new Date(dateStr);
    const dayOfWeek = getDay(date);
    const dayKey = WEEKDAY_TO_KEY[dayOfWeek];
    const dayHours = workingHours[dayKey];
    if (!dayHours || !dayHours.open) return null;
    
    const [hours, minutes] = dayHours.open.split(':').map(Number);
    const openingDate = new Date(dateStr);
    openingDate.setHours(hours, minutes, 0, 0);
    return openingDate;
  };

  // Calculate pre-opening minutes for entries
  const calculatePreOpeningMinutes = (entries: TimeEntry[], dateStr: string): number => {
    const openingTime = getOpeningTime(dateStr);
    if (!openingTime) return 0;
    
    let preOpeningMinutes = 0;
    entries.forEach(entry => {
      if (!entry.start_time) return;
      const startTime = new Date(entry.start_time);
      if (startTime < openingTime) {
        const endTime = entry.end_time ? new Date(entry.end_time) : new Date();
        const effectiveEnd = endTime < openingTime ? endTime : openingTime;
        const diffMs = effectiveEnd.getTime() - startTime.getTime();
        preOpeningMinutes += Math.max(0, Math.floor(diffMs / 60000));
      }
    });
    return preOpeningMinutes;
  };

  // Check if a date is a day off
  const isDayOff = (dateStr: string) => {
    return daysOff.some(d => dateStr >= d.date_from && dateStr <= d.date_to);
  };

  // Group entries by date and sum minutes
  const minutesByDate = useMemo(() => {
    const map = new Map<string, { totalMinutes: number; entries: TimeEntry[] }>();
    
    timeEntries.forEach(entry => {
      const existing = map.get(entry.entry_date) || { totalMinutes: 0, entries: [] };
      existing.totalMinutes += entry.total_minutes || 0;
      existing.entries.push(entry);
      map.set(entry.entry_date, existing);
    });
    
    return map;
  }, [timeEntries]);

  const handlePrevWeek = () => setCurrentWeekStart(prev => subWeeks(prev, 1));
  const handleNextWeek = () => setCurrentWeekStart(prev => addWeeks(prev, 1));

  const handleCellClick = (date: Date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    const existing = minutesByDate.get(dateStr);
    const totalMinutes = existing?.totalMinutes || 0;
    
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    
    setEditingCell({
      date: dateStr,
      hours: hours.toString(),
      minutes: minutes.toString(),
    });
  };

  const handleSaveEdit = async () => {
    if (!editingCell) return;
    
    const hours = parseInt(editingCell.hours) || 0;
    const minutes = parseInt(editingCell.minutes) || 0;
    const totalMinutes = hours * 60 + minutes;
    
    const existing = minutesByDate.get(editingCell.date);
    
    try {
      if (existing && existing.entries.length > 0) {
        // Update first entry with new total
        const firstEntry = existing.entries[0];
        
        // Calculate start and end time for the entry based on total minutes
        const startTime = new Date(`${editingCell.date}T08:00:00`);
        const endTime = new Date(startTime.getTime() + totalMinutes * 60000);
        
        await updateTimeEntry.mutateAsync({
          id: firstEntry.id,
          start_time: startTime.toISOString(),
          end_time: endTime.toISOString(),
        });
      } else if (totalMinutes > 0) {
        // Create new entry
        const startTime = new Date(`${editingCell.date}T08:00:00`);
        const endTime = new Date(startTime.getTime() + totalMinutes * 60000);
        
        await createTimeEntry.mutateAsync({
          employee_id: employee.id,
          entry_date: editingCell.date,
          start_time: startTime.toISOString(),
          end_time: endTime.toISOString(),
          entry_type: 'manual',
        });
      }
      
      toast.success('Zapisano');
      setEditingCell(null);
    } catch (error) {
      console.error('Save error:', error);
      toast.error('Błąd podczas zapisywania');
    }
  };

  const handleCancelEdit = () => {
    setEditingCell(null);
  };

  const handleMarkDayOff = async () => {
    if (!editingCell) return;
    
    try {
      await createDayOff.mutateAsync({
        employee_id: employee.id,
        date_from: editingCell.date,
        date_to: editingCell.date,
        day_off_type: 'vacation',
      });
      toast.success('Zapisano jako wolne');
      setEditingCell(null);
    } catch (error) {
      console.error('Day off error:', error);
      toast.error('Błąd podczas zapisywania');
    }
  };

  // Calculate week total
  const weekTotal = useMemo(() => {
    let total = 0;
    minutesByDate.forEach(({ totalMinutes }) => {
      total += totalMinutes;
    });
    return total;
  }, [minutesByDate]);

  // Filter monthly entries to this employee and sum
  const monthTotal = useMemo(() => {
    return monthTimeEntries
      .filter(e => e.employee_id === employee.id)
      .reduce((sum, e) => sum + (e.total_minutes || 0), 0);
  }, [monthTimeEntries, employee.id]);

  // Calculate monthly pre-opening time
  const monthPreOpeningMinutes = useMemo(() => {
    const employeeEntries = monthTimeEntries.filter(e => e.employee_id === employee.id);
    // Group entries by date
    const entriesByDate = new Map<string, TimeEntry[]>();
    employeeEntries.forEach(entry => {
      const existing = entriesByDate.get(entry.entry_date) || [];
      existing.push(entry);
      entriesByDate.set(entry.entry_date, existing);
    });
    
    let totalPreOpening = 0;
    entriesByDate.forEach((entries, dateStr) => {
      totalPreOpening += calculatePreOpeningMinutes(entries, dateStr);
    });
    return totalPreOpening;
  }, [monthTimeEntries, employee.id, workingHours]);

  // Real time = Total - pre-opening
  const monthRealMinutes = Math.max(0, monthTotal - monthPreOpeningMinutes);

  const formatMinutes = (mins: number) => {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    if (h === 0) return `${m} min`;
    if (m === 0) return `${h} h`;
    return `${h} h ${m} min`;
  };

  // Find which day is being edited to show its label in the editor panel
  const editingDayLabel = editingCell
    ? format(new Date(editingCell.date), 'EEEE, d MMM', { locale: pl })
    : '';
  
  // Month name for display
  const monthName = format(monthStartDate, 'LLLL', { locale: pl });

  return (
    <div className="w-full space-y-2">
      {/* Week navigation */}
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="icon" onClick={handlePrevWeek}>
          <ChevronLeft className="w-4 h-4" />
        </Button>
        <span className="font-medium text-sm">
          {format(currentWeekStart, 'd MMM', { locale: pl })} - {format(weekEnd, 'd MMM yyyy', { locale: pl })}
        </span>
        <Button variant="ghost" size="icon" onClick={handleNextWeek}>
          <ChevronRight className="w-4 h-4" />
        </Button>
      </div>

      {/* Week grid - days only, no inline editing */}
      <div className="grid grid-cols-7 gap-1">
        {weekDays.map((day) => {
          const dateStr = format(day, 'yyyy-MM-dd');
          const isSelected = editingCell?.date === dateStr;
          const dayData = minutesByDate.get(dateStr);
          const totalMinutes = dayData?.totalMinutes || 0;
          const isToday = isSameDay(day, new Date());
          const isWeekend = day.getDay() === 0 || day.getDay() === 6;
          const isOff = isDayOff(dateStr);
          
          return (
            <div key={dateStr} className="flex flex-col">
              {/* Day header */}
              <div className={`text-center text-xs py-1 rounded-t ${
                isToday ? 'bg-primary text-primary-foreground' : 
                isWeekend ? 'bg-muted/50 text-muted-foreground' : 'bg-muted'
              }`}>
                <div className="font-medium">{format(day, 'EEE', { locale: pl })}</div>
                <div>{format(day, 'd')}</div>
              </div>
              
              {/* Time cell - click to select for editing */}
              <button
                onClick={() => handleCellClick(day)}
                className={`border rounded-b p-1 text-center min-h-[40px] flex items-center justify-center transition-colors ${
                  isSelected
                    ? 'ring-2 ring-primary border-primary bg-primary/10'
                    : isOff
                      ? 'bg-orange-50 dark:bg-orange-950 border-orange-200 dark:border-orange-800'
                      : totalMinutes > 0 
                        ? 'bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800 hover:bg-green-100 dark:hover:bg-green-900' 
                        : 'bg-background hover:bg-muted/50'
                }`}
              >
                <span className={`text-sm font-medium ${
                  isOff 
                    ? 'text-orange-600 dark:text-orange-400' 
                    : totalMinutes > 0 
                      ? 'text-green-700 dark:text-green-300' 
                      : 'text-muted-foreground'
                }`}>
                  {isOff ? 'Wolne' : totalMinutes > 0 ? formatMinutes(totalMinutes) : '-'}
                </span>
              </button>
            </div>
          );
        })}
      </div>

      {/* Editor panel - appears below the week grid when a day is selected */}
      {editingCell && (
        <div className="border rounded-lg p-3 bg-card space-y-2">
          <div className="text-sm font-medium text-center capitalize">{editingDayLabel}</div>
          <div className="flex items-center justify-center gap-2">
            <Input
              type="number"
              min="0"
              max="24"
              value={editingCell.hours}
              onChange={(e) => setEditingCell({ ...editingCell, hours: e.target.value })}
              className="h-12 w-20 text-center text-lg"
              placeholder="h"
              autoFocus
            />
            <span className="text-xl font-bold">:</span>
            <Input
              type="number"
              min="0"
              max="59"
              value={editingCell.minutes}
              onChange={(e) => setEditingCell({ ...editingCell, minutes: e.target.value })}
              className="h-12 w-20 text-center text-lg"
              placeholder="m"
            />
          </div>
          
          {/* Time slots for the selected day */}
          {(() => {
            const dayData = minutesByDate.get(editingCell.date);
            const dayEntries = dayData?.entries || [];
            if (dayEntries.length === 0) return null;
            
            const formatTimeFromISO = (isoString: string | null) => {
              if (!isoString) return '';
              try {
                return format(new Date(isoString), 'HH:mm');
              } catch {
                return '';
              }
            };
            
            return (
              <div className="text-center text-lg font-medium text-muted-foreground">
                ({dayEntries.map((entry, idx) => (
                  <span key={entry.id}>
                    {idx > 0 && ', '}
                    {formatTimeFromISO(entry.start_time)}-{formatTimeFromISO(entry.end_time)}
                  </span>
                ))})
              </div>
            );
          })()}
          
          {/* Action buttons - Anuluj left, Zapisz right */}
          <div className="flex gap-2 justify-between">
            <Button onClick={handleCancelEdit} size="sm" variant="outline" className="px-6">
              <X className="w-4 h-4 mr-1" />
              Anuluj
            </Button>
            <Button onClick={handleSaveEdit} size="sm" className="px-6">
              <Check className="w-4 h-4 mr-1" />
              Zapisz
            </Button>
          </div>
          {/* Wolne button centered below */}
          <div className="flex justify-center">
            <Button onClick={handleMarkDayOff} size="sm" variant="outline" className="bg-orange-50 border-orange-200 text-orange-700 hover:bg-orange-100">
              <Palmtree className="w-4 h-4 mr-1" />
              Wolne
            </Button>
          </div>
        </div>
      )}

      {/* Week summary */}
      <div className="space-y-1.5 pt-2 border-t">
        <div className="flex justify-between items-center">
          <span className="text-sm text-muted-foreground">Suma tygodnia:</span>
          <span className="font-bold">{formatMinutes(weekTotal)}</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-sm text-muted-foreground">Suma miesiąca ({monthName}):</span>
          <span className="font-bold">{formatMinutes(monthTotal)}</span>
        </div>
        {monthPreOpeningMinutes > 0 && (
          <>
            <div className="flex justify-between items-center text-xs">
              <span className="text-muted-foreground">W tym przed otwarciem:</span>
              <span className="text-muted-foreground">{formatMinutes(monthPreOpeningMinutes)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Czas realny:</span>
              <span className="font-bold">{formatMinutes(monthRealMinutes)}</span>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default WeeklySchedule;
