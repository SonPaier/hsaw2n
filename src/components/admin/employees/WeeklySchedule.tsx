import { useState, useMemo, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ChevronLeft, ChevronRight, Palmtree, Trash2 } from 'lucide-react';
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, eachDayOfInterval, addWeeks, subWeeks, isSameDay, getDay } from 'date-fns';
import { pl } from 'date-fns/locale';
import { useTimeEntries, useTimeEntriesForDateRange, useCreateTimeEntry, useUpdateTimeEntry, TimeEntry } from '@/hooks/useTimeEntries';
import { useEmployeeDaysOff, useCreateEmployeeDayOff, useDeleteEmployeeDayOff } from '@/hooks/useEmployeeDaysOff';
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
  const [isSaving, setIsSaving] = useState(false);

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
  const deleteDayOff = useDeleteEmployeeDayOff(instanceId);

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

  // Check if a date is a day off and return the day off record
  const getDayOffRecord = (dateStr: string) => {
    return daysOff.find(d => dateStr >= d.date_from && dateStr <= d.date_to);
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

  // Auto-save when dropdown values change
  const handleHoursChange = async (value: string) => {
    if (!editingCell) return;
    const newHours = value;
    setEditingCell({ ...editingCell, hours: newHours });
    
    // Auto-save
    await saveEntry(newHours, editingCell.minutes);
  };

  const handleMinutesChange = async (value: string) => {
    if (!editingCell) return;
    const newMinutes = value;
    setEditingCell({ ...editingCell, minutes: newMinutes });
    
    // Auto-save
    await saveEntry(editingCell.hours, newMinutes);
  };

  const saveEntry = async (hoursStr: string, minutesStr: string) => {
    if (!editingCell || isSaving) return;
    
    const hours = parseInt(hoursStr) || 0;
    const minutes = parseInt(minutesStr) || 0;
    const totalMinutes = hours * 60 + minutes;
    
    const existing = minutesByDate.get(editingCell.date);
    
    setIsSaving(true);
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
    } catch (error) {
      console.error('Save error:', error);
      toast.error('Błąd podczas zapisywania');
    } finally {
      setIsSaving(false);
    }
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

  const handleRemoveDayOff = async () => {
    if (!editingCell) return;
    
    const dayOffRecord = getDayOffRecord(editingCell.date);
    if (!dayOffRecord) return;
    
    try {
      await deleteDayOff.mutateAsync(dayOffRecord.id);
      toast.success('Usunięto wolne');
    } catch (error) {
      console.error('Remove day off error:', error);
      toast.error('Błąd podczas usuwania');
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

  // Check if editing cell is a day off
  const editingCellIsDayOff = editingCell ? !!getDayOffRecord(editingCell.date) : false;

  // Generate options for hours (0-24) and minutes (0-59 in 5-minute increments)
  const hourOptions = Array.from({ length: 25 }, (_, i) => i);
  const minuteOptions = Array.from({ length: 12 }, (_, i) => i * 5);

  return (
    <div className="w-full space-y-2">
      {/* Week navigation */}
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="icon" onClick={handlePrevWeek}>
          <ChevronLeft className="w-4 h-4" />
        </Button>
        <span className="font-semibold text-lg">
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
          const isOff = !!getDayOffRecord(dateStr);
          
          return (
            <div key={dateStr} className="flex flex-col">
              {/* Day header - white background */}
              <div className={`text-center text-xs py-1 rounded-t ${
                isToday ? 'bg-primary text-primary-foreground' : 
                isWeekend ? 'bg-muted/50 text-muted-foreground' : 'bg-white dark:bg-card'
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
        <div className="border rounded-lg p-4 bg-card space-y-3">
          {/* Day header - bigger */}
          <div className="text-lg font-semibold text-center capitalize">{editingDayLabel}</div>
          
          {/* Time selection with dropdowns */}
          <div className="flex items-center justify-center gap-2">
            <Select value={editingCell.hours} onValueChange={handleHoursChange}>
              <SelectTrigger className="h-14 w-24 text-center text-xl font-medium">
                <SelectValue placeholder="0" />
              </SelectTrigger>
              <SelectContent>
                {hourOptions.map(h => (
                  <SelectItem key={h} value={h.toString()}>{h}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <span className="text-2xl font-bold">:</span>
            <Select value={editingCell.minutes} onValueChange={handleMinutesChange}>
              <SelectTrigger className="h-14 w-24 text-center text-xl font-medium">
                <SelectValue placeholder="0" />
              </SelectTrigger>
              <SelectContent>
                {minuteOptions.map(m => (
                  <SelectItem key={m} value={m.toString()}>{m}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            {/* Wolne/Usuń Wolne button - closer to time selection */}
            {editingCellIsDayOff ? (
              <Button 
                onClick={handleRemoveDayOff} 
                size="sm" 
                variant="outline" 
                className="h-14 bg-red-50 border-red-200 text-red-700 hover:bg-red-100 ml-2"
              >
                <Trash2 className="w-4 h-4 mr-1" />
                Usuń Wolne
              </Button>
            ) : (
              <Button 
                onClick={handleMarkDayOff} 
                size="sm" 
                variant="outline" 
                className="h-14 bg-orange-50 border-orange-200 text-orange-700 hover:bg-orange-100 ml-2"
              >
                <Palmtree className="w-4 h-4 mr-1" />
                Wolne
              </Button>
            )}
          </div>
          
          {/* Time slots for the selected day - bigger and without parentheses */}
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
              <div className="text-center text-xl font-semibold text-foreground">
                {dayEntries.map((entry, idx) => (
                  <span key={entry.id}>
                    {idx > 0 && ', '}
                    {formatTimeFromISO(entry.start_time)}-{formatTimeFromISO(entry.end_time)}
                  </span>
                ))}
              </div>
            );
          })()}
        </div>
      )}

      {/* Week and month summary - right aligned with bold black labels */}
      <div className="space-y-1.5 pt-2 border-t">
        <div className="flex justify-between items-center">
          <span className="text-sm font-bold text-foreground">Suma tygodnia:</span>
          <span className="font-bold">{formatMinutes(weekTotal)}</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-sm font-bold text-foreground">Suma miesiąca ({monthName}):</span>
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
