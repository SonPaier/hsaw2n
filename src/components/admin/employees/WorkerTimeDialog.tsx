import { useState, useRef } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useTimeEntries, useCreateTimeEntry, useUpdateTimeEntry, TimeEntry } from '@/hooks/useTimeEntries';
import { Employee, useUpdateEmployee } from '@/hooks/useEmployees';
import { useWorkersSettings } from '@/hooks/useWorkersSettings';
import { useIsMobile } from '@/hooks/use-mobile';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { compressImage } from '@/lib/imageUtils';
import { toast } from 'sonner';
import { Play, Square, Loader2, Calendar, Pencil, Camera } from 'lucide-react';
import { format } from 'date-fns';
import WeeklySchedule from './WeeklySchedule';

interface WorkerTimeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employee: Employee;
  instanceId: string;
  showEditButton?: boolean;
  onEditEmployee?: () => void;
}

const WorkerTimeDialog = ({
  open,
  onOpenChange,
  employee,
  instanceId,
  showEditButton = false,
  onEditEmployee,
}: WorkerTimeDialogProps) => {
  const today = format(new Date(), 'yyyy-MM-dd');
  const [showSchedule, setShowSchedule] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [currentPhotoUrl, setCurrentPhotoUrl] = useState<string | null>(employee.photo_url);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isMobile = useIsMobile();
  
  const { hasRole } = useAuth();
  const isHall = hasRole('hall');
  const isAdmin = hasRole('admin') || hasRole('super_admin');
  const canChangePhoto = isHall || isAdmin;
  
  const { data: workersSettings } = useWorkersSettings(instanceId);
  const startStopEnabled = workersSettings?.start_stop_enabled !== false; // default true
  
  const { data: timeEntries = [], refetch: refetchTimeEntries } = useTimeEntries(instanceId, undefined, today, today);
  
  const createTimeEntry = useCreateTimeEntry(instanceId);
  const updateTimeEntry = useUpdateTimeEntry(instanceId);
  const updateEmployee = useUpdateEmployee(instanceId);
  
  // Find active entry for this employee (no end_time)
  const activeEntry = timeEntries.find(
    (e: TimeEntry) => e.employee_id === employee.id && !e.end_time
  );
  
  // Optimistic state for immediate UI feedback
  const [optimisticWorking, setOptimisticWorking] = useState<boolean | null>(null);
  const isWorking = optimisticWorking !== null ? optimisticWorking : !!activeEntry;
  
  const [isLoading, setIsLoading] = useState(false);

  const handleAvatarClick = () => {
    if (canChangePhoto) {
      fileInputRef.current?.click();
    }
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !instanceId) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Dozwolone są tylko pliki graficzne');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error('Maksymalny rozmiar pliku to 10MB');
      return;
    }

    setIsUploading(true);
    try {
      // Compress and crop to square for avatar
      const compressedBlob = await compressImage(file, 400, 0.85, true);
      
      const fileName = `${instanceId}/${Date.now()}.jpg`;

      const { error: uploadError } = await supabase.storage
        .from('employee-photos')
        .upload(fileName, compressedBlob, { contentType: 'image/jpeg' });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('employee-photos')
        .getPublicUrl(fileName);

      // Update state immediately
      setCurrentPhotoUrl(publicUrl);

      // Save to database
      await updateEmployee.mutateAsync({
        id: employee.id,
        photo_url: publicUrl,
        name: employee.name,
      });
      
      toast.success('Zdjęcie zostało zapisane');
    } catch (error) {
      console.error('Upload error:', error);
      toast.error('Błąd podczas przesyłania zdjęcia');
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleStart = async () => {
    // Optimistic update - show "Stop" button immediately
    setOptimisticWorking(true);
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
      onOpenChange(false); // Close dialog after START
    } catch (error) {
      console.error('Start error:', error);
      toast.error('Błąd podczas rozpoczynania pracy');
      // Rollback optimistic update on error
      setOptimisticWorking(null);
    } finally {
      setIsLoading(false);
      // Reset optimistic state after data is refetched
      setTimeout(() => setOptimisticWorking(null), 500);
    }
  };

  const handleStop = async () => {
    if (!activeEntry) return;
    
    // Optimistic update - show "Start" button immediately
    setOptimisticWorking(false);
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
      // Rollback optimistic update on error
      setOptimisticWorking(null);
    } finally {
      setIsLoading(false);
      // Reset optimistic state after data is refetched
      setTimeout(() => setOptimisticWorking(null), 500);
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
      <DialogContent className={`${showSchedule || !startStopEnabled ? "sm:max-w-2xl" : "sm:max-w-sm"} ${isMobile ? "h-[100dvh] max-h-[100dvh] rounded-none" : "max-h-[90vh]"} overflow-hidden flex flex-col`}>
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="sr-only">Czas pracy</DialogTitle>
        </DialogHeader>

        <ScrollArea className="flex-1 -mx-6 px-6">
          <div className="flex flex-col items-center py-2 gap-2">
            {/* Clickable Avatar for photo change */}
            <div 
              className={`relative ${canChangePhoto ? 'cursor-pointer group' : ''}`}
              onClick={handleAvatarClick}
            >
              <Avatar className="h-20 w-20 ring-2 ring-transparent group-hover:ring-primary/50 transition-all">
                <AvatarImage src={currentPhotoUrl || undefined} alt={employee.name} />
                <AvatarFallback className="bg-primary/10 text-primary text-xl">
                  {employee.name.slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              {isUploading ? (
                <div className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-full">
                  <Loader2 className="w-6 h-6 animate-spin text-white" />
                </div>
              ) : canChangePhoto && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/30 rounded-full opacity-0 group-hover:opacity-100 transition-opacity">
                  <Camera className="w-6 h-6 text-white" />
                </div>
              )}
            </div>
            
            {/* Hidden file input */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={handlePhotoUpload}
              disabled={isUploading}
            />
            
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-semibold">{employee.name}</h2>
              {showEditButton && onEditEmployee && (
                <button
                  onClick={onEditEmployee}
                  className="p-1 rounded hover:bg-muted"
                >
                  <Pencil className="w-4 h-4 text-muted-foreground" />
                </button>
              )}
            </div>
            
            {totalMinutes > 0 && (
              <div className="text-center">
                <p className="text-xl font-medium text-muted-foreground">
                  Dzisiaj: {formatDuration(totalMinutes)}
                </p>
                {todayEmployeeEntries.length > 0 && (
                  <p className="text-2xl font-bold text-foreground mt-1">
                    {todayEmployeeEntries.map((e, i) => (
                      <span key={e.id}>
                        {i > 0 && ', '}
                        {formatTimeFromISO(e.start_time)}-{formatTimeFromISO(e.end_time)}
                      </span>
                    ))}
                  </p>
                )}
              </div>
            )}

            {/* Action buttons - only show when start/stop is enabled */}
            {startStopEnabled && (
              <div className="flex flex-col gap-2 w-full mt-2">
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

                {/* View schedule button - only when start/stop enabled */}
                <Button
                  variant="outline"
                  onClick={() => setShowSchedule(!showSchedule)}
                  className="w-full bg-white dark:bg-card"
                  size="sm"
                >
                  <Calendar className="w-4 h-4 mr-2" />
                  {showSchedule ? 'Ukryj grafik' : 'Zobacz grafik'}
                </Button>
              </div>
            )}

            {/* Weekly schedule - always visible when start/stop disabled, toggleable otherwise */}
            {(startStopEnabled ? showSchedule : true) && (
              <div className="w-full mt-2">
                <WeeklySchedule employee={employee} instanceId={instanceId} />
              </div>
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};

export default WorkerTimeDialog;
