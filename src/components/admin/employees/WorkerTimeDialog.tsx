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
import { Employee } from '@/hooks/useEmployees';
import { toast } from 'sonner';
import { Play, Square, Loader2, Calendar } from 'lucide-react';
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
  
  const createTimeEntry = useCreateTimeEntry(instanceId);
  const updateTimeEntry = useUpdateTimeEntry(instanceId);
  
  // Find active entry for this employee (no end_time)
  const activeEntry = timeEntries.find(
    (e) => e.employee_id === employee.id && !e.end_time
  );
  
  const isWorking = !!activeEntry;
  
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

  // Get today's completed entries for this employee
  const todayEmployeeEntries = timeEntries
    .filter((e) => e.employee_id === employee.id && e.end_time)
    .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());

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
    if (hours === 0) return `${mins} min`;
    if (mins === 0) return `${hours} h`;
    return `${hours} h ${mins} min`;
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
            <div className="text-center">
              <p className="text-sm text-muted-foreground">
                Dzisiaj: {formatDuration(totalMinutes)}
              </p>
              {todayEmployeeEntries.length > 0 && (
                <p className="text-xs text-muted-foreground/70 mt-1">
                  ({todayEmployeeEntries.map((e, i) => (
                    <span key={e.id}>
                      {i > 0 && ', '}
                      {formatTimeFromISO(e.start_time)}-{formatTimeFromISO(e.end_time)}
                    </span>
                  ))})
                </p>
              )}
            </div>
          )}

          <Separator className="my-2" />

          {/* Status indicator */}
          <div className="flex items-center gap-2 text-sm">
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
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default WorkerTimeDialog;
