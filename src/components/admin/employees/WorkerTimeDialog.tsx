import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { useTimeEntries, useCreateTimeEntry, useUpdateTimeEntry } from '@/hooks/useTimeEntries';
import { useEmployeeBreaks, useCreateEmployeeBreak, useUpdateEmployeeBreak } from '@/hooks/useEmployeeBreaks';
import { Employee } from '@/hooks/useEmployees';
import { toast } from 'sonner';
import { Play, Square, Coffee, Loader2, Calendar } from 'lucide-react';
import { format } from 'date-fns';
import WeeklySchedule from './WeeklySchedule';

interface WorkerTimeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employee: Employee;
  instanceId: string;
}

const WorkerTimeDialog = ({
  open,
  onOpenChange,
  employee,
  instanceId,
}: WorkerTimeDialogProps) => {
  const today = format(new Date(), 'yyyy-MM-dd');
  const [showSchedule, setShowSchedule] = useState(false);
  
  const { data: timeEntries = [], refetch: refetchTimeEntries } = useTimeEntries(instanceId, undefined, today, today);
  const { data: breaks = [], refetch: refetchBreaks } = useEmployeeBreaks(instanceId, employee.id, today, today);
  
  const createTimeEntry = useCreateTimeEntry(instanceId);
  const updateTimeEntry = useUpdateTimeEntry(instanceId);
  const createBreak = useCreateEmployeeBreak(instanceId);
  const updateBreak = useUpdateEmployeeBreak(instanceId);
  
  // Find active entry for this employee (no end_time)
  const activeEntry = timeEntries.find(
    (e) => e.employee_id === employee.id && !e.end_time
  );
  
  // Find active break (start_time = end_time means it's ongoing)
  const todayBreaks = breaks.filter((b) => b.break_date === today);
  const activeBreak = todayBreaks.find((b) => b.start_time === b.end_time);
  
  const isWorking = !!activeEntry;
  const isOnBreak = !!activeBreak;
  
  const [isLoading, setIsLoading] = useState(false);

  const handleStart = async () => {
    setIsLoading(true);
    try {
      const now = new Date();
      await createTimeEntry.mutateAsync({
        employee_id: employee.id,
        entry_date: today,
        start_time: now.toISOString(),
        entry_type: 'manual',
      });
      toast.success(`${employee.name} rozpoczął pracę`);
      refetchTimeEntries();
    } catch (error) {
      console.error('Start error:', error);
      toast.error('Błąd podczas rozpoczynania pracy');
    } finally {
      setIsLoading(false);
    }
  };

  const handleStop = async () => {
    if (!activeEntry) return;
    
    setIsLoading(true);
    try {
      const now = new Date();
      await updateTimeEntry.mutateAsync({
        id: activeEntry.id,
        end_time: now.toISOString(),
      });
      toast.success(`${employee.name} zakończył pracę`);
      // Refetch both time entries and schedule data
      refetchTimeEntries();
    } catch (error) {
      console.error('Stop error:', error);
      toast.error('Błąd podczas kończenia pracy');
    } finally {
      setIsLoading(false);
    }
  };

  const handleBreakStart = async () => {
    setIsLoading(true);
    try {
      const now = new Date().toISOString();
      await createBreak.mutateAsync({
        employee_id: employee.id,
        break_date: today,
        start_time: now,
        end_time: now, // Same as start = ongoing
      });
      toast.success('Przerwa rozpoczęta');
      refetchBreaks();
    } catch (error) {
      console.error('Break start error:', error);
      toast.error('Błąd podczas rozpoczynania przerwy');
    } finally {
      setIsLoading(false);
    }
  };

  const handleBreakEnd = async () => {
    if (!activeBreak) return;
    
    setIsLoading(true);
    try {
      const now = new Date().toISOString();
      await updateBreak.mutateAsync({
        id: activeBreak.id,
        end_time: now,
      });
      toast.success('Przerwa zakończona');
      refetchBreaks();
    } catch (error) {
      console.error('Break end error:', error);
      toast.error('Błąd podczas kończenia przerwy');
    } finally {
      setIsLoading(false);
    }
  };

  // Calculate total time worked today
  const calculateTotalMinutes = () => {
    const employeeEntries = timeEntries.filter((e) => e.employee_id === employee.id);
    let total = 0;
    
    employeeEntries.forEach((entry) => {
      if (entry.total_minutes) {
        total += entry.total_minutes;
      }
    });
    
    return total;
  };

  const formatDuration = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h ${mins}m`;
  };

  const totalMinutes = calculateTotalMinutes();

  // Format time from ISO string for display
  const formatTimeFromISO = (isoString: string | null) => {
    if (!isoString) return '';
    try {
      return format(new Date(isoString), 'HH:mm');
    } catch {
      return isoString.slice(0, 5);
    }
  };

  // Get work start time for display
  const workStartTime = activeEntry?.start_time ? formatTimeFromISO(activeEntry.start_time) : null;
  
  // Get active break start time
  const breakStartTime = activeBreak?.start_time ? formatTimeFromISO(activeBreak.start_time) : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={showSchedule ? "sm:max-w-2xl" : "sm:max-w-sm"}>
        <DialogHeader>
          <DialogTitle className="sr-only">Czas pracy</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col items-center py-4 gap-4">
          <Avatar className="h-24 w-24">
            <AvatarImage src={employee.photo_url || undefined} alt={employee.name} />
            <AvatarFallback className="bg-primary/10 text-primary text-2xl">
              {employee.name.slice(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          
          <h2 className="text-xl font-semibold">{employee.name}</h2>
          
          {totalMinutes > 0 && (
            <p className="text-sm text-muted-foreground">
              Dzisiaj: {formatDuration(totalMinutes)}
            </p>
          )}

          <Separator className="my-2" />

          {/* Status indicator */}
          <div className="flex flex-col items-center gap-1 text-sm">
            <div className="flex items-center gap-2">
              <span
                className={`w-3 h-3 rounded-full ${
                  isWorking ? 'bg-green-500' : 'bg-muted'
                }`}
              />
              {isWorking && workStartTime && (
                <span className="text-green-700 dark:text-green-400 font-medium">
                  W pracy od {workStartTime}
                </span>
              )}
            </div>
            
            {/* Active break indicator */}
            {isOnBreak && breakStartTime && (
              <div className="text-amber-600 dark:text-amber-400 text-xs">
                Przerwa od {breakStartTime}...
              </div>
            )}
          </div>

          {/* Action buttons */}
          <div className="flex flex-col gap-3 w-full">
            <div className="flex gap-3">
              {!isWorking ? (
                <Button
                  onClick={handleStart}
                  disabled={isLoading}
                  className="flex-1 h-14 text-lg"
                  size="lg"
                >
                  {isLoading ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <>
                      <Play className="w-5 h-5 mr-2" />
                      Start
                    </>
                  )}
                </Button>
              ) : (
                <>
                  <Button
                    onClick={handleStop}
                    disabled={isLoading}
                    variant="destructive"
                    className="flex-1 h-14 text-lg"
                    size="lg"
                  >
                    {isLoading ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <>
                        <Square className="w-5 h-5 mr-2" />
                        Stop
                      </>
                    )}
                  </Button>
                  
                  {isOnBreak ? (
                    <Button
                      onClick={handleBreakEnd}
                      disabled={isLoading}
                      variant="outline"
                      className="h-14 bg-white dark:bg-card"
                      size="lg"
                    >
                      <Coffee className="w-5 h-5 text-amber-600" />
                    </Button>
                  ) : (
                    <Button
                      onClick={handleBreakStart}
                      disabled={isLoading}
                      variant="outline"
                      className="h-14 bg-white dark:bg-card"
                      size="lg"
                    >
                      <Coffee className="w-5 h-5" />
                    </Button>
                  )}
                </>
              )}
            </div>

            {/* View schedule button */}
            <Button
              variant="outline"
              onClick={() => setShowSchedule(!showSchedule)}
              className="w-full bg-white dark:bg-card"
            >
              <Calendar className="w-4 h-4 mr-2" />
              {showSchedule ? 'Ukryj grafik' : 'Zobacz pełny grafik'}
            </Button>
          </div>

          {/* Weekly schedule */}
          {showSchedule && (
            <div className="w-full mt-4">
              <WeeklySchedule employee={employee} instanceId={instanceId} />
            </div>
          )}

          {/* Today's completed breaks list */}
          {todayBreaks.filter(b => b.start_time !== b.end_time).length > 0 && !showSchedule && (
            <div className="w-full mt-2">
              <p className="text-xs text-muted-foreground mb-1">Przerwy dzisiaj:</p>
              <div className="text-xs space-y-1">
                {todayBreaks.filter(b => b.start_time !== b.end_time).map((b) => (
                  <div key={b.id} className="flex justify-between">
                    <span>
                      {formatTimeFromISO(b.start_time)} - {formatTimeFromISO(b.end_time)}
                    </span>
                    {b.duration_minutes && <span>{b.duration_minutes} min</span>}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default WorkerTimeDialog;
