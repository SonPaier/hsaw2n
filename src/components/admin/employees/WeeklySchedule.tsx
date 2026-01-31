import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ChevronLeft, ChevronRight, Check, X, Palmtree } from 'lucide-react';
import { format, startOfWeek, endOfWeek, eachDayOfInterval, addWeeks, subWeeks, isSameDay } from 'date-fns';
import { pl } from 'date-fns/locale';
import { useTimeEntries, useCreateTimeEntry, useUpdateTimeEntry, TimeEntry } from '@/hooks/useTimeEntries';
import { useEmployeeDaysOff, useCreateEmployeeDayOff } from '@/hooks/useEmployeeDaysOff';
import { Employee } from '@/hooks/useEmployees';
import { toast } from 'sonner';

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

  const { data: timeEntries = [] } = useTimeEntries(instanceId, employee.id, dateFrom, dateTo);
  const { data: daysOff = [] } = useEmployeeDaysOff(instanceId, employee.id);
  const createTimeEntry = useCreateTimeEntry(instanceId);
  const updateTimeEntry = useUpdateTimeEntry(instanceId);
  const createDayOff = useCreateEmployeeDayOff(instanceId);

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

  return (
    <div className="w-full space-y-4">
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
                className={`border rounded-b p-2 text-center min-h-[48px] flex items-center justify-center transition-colors ${
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
          <div className="flex gap-2 justify-center flex-wrap">
            <Button onClick={handleSaveEdit} size="sm" className="px-6">
              <Check className="w-4 h-4 mr-1" />
              Zapisz
            </Button>
            <Button onClick={handleCancelEdit} size="sm" variant="ghost">
              <X className="w-4 h-4 mr-1" />
              Anuluj
            </Button>
            <Button onClick={handleMarkDayOff} size="sm" variant="outline" className="bg-orange-50 border-orange-200 text-orange-700 hover:bg-orange-100">
              <Palmtree className="w-4 h-4 mr-1" />
              Wolne
            </Button>
          </div>
        </div>
      )}

      {/* Week summary */}
      <div className="flex justify-between items-center pt-2 border-t">
        <span className="text-sm text-muted-foreground">Suma tygodnia:</span>
        <span className="font-bold">{formatMinutes(weekTotal)}</span>
      </div>
    </div>
  );
};

export default WeeklySchedule;
