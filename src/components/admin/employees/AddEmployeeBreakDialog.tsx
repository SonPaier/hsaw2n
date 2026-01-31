import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useCreateEmployeeBreak } from '@/hooks/useEmployeeBreaks';
import { Employee } from '@/hooks/useEmployees';
import { toast } from 'sonner';
import { Loader2, CalendarIcon } from 'lucide-react';
import { format } from 'date-fns';
import { pl } from 'date-fns/locale';
import { cn } from '@/lib/utils';

interface AddEmployeeBreakDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  instanceId: string | null;
  employees: Employee[];
}

const AddEmployeeBreakDialog = ({
  open,
  onOpenChange,
  instanceId,
  employees,
}: AddEmployeeBreakDialogProps) => {
  const [employeeId, setEmployeeId] = useState('');
  const [date, setDate] = useState<Date | undefined>(new Date());
  const [startTime, setStartTime] = useState('12:00');
  const [endTime, setEndTime] = useState('12:30');

  const createBreak = useCreateEmployeeBreak(instanceId);
  const isSubmitting = createBreak.isPending;

  useEffect(() => {
    if (open) {
      setEmployeeId(employees[0]?.id || '');
      setDate(new Date());
      setStartTime('12:00');
      setEndTime('12:30');
    }
  }, [employees, open]);

  const handleSubmit = async () => {
    if (!employeeId) {
      toast.error('Wybierz pracownika');
      return;
    }
    if (!date) {
      toast.error('Wybierz datę');
      return;
    }
    if (startTime >= endTime) {
      toast.error('Godzina końca musi być późniejsza niż godzina początku');
      return;
    }

    try {
      await createBreak.mutateAsync({
        employee_id: employeeId,
        break_date: format(date, 'yyyy-MM-dd'),
        start_time: startTime,
        end_time: endTime,
      });
      toast.success('Przerwa została dodana');
      onOpenChange(false);
    } catch (error) {
      toast.error('Wystąpił błąd');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Dodaj przerwę</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Employee select */}
          <div className="space-y-2">
            <Label>Pracownik *</Label>
            <Select value={employeeId} onValueChange={setEmployeeId}>
              <SelectTrigger>
                <SelectValue placeholder="Wybierz pracownika" />
              </SelectTrigger>
              <SelectContent>
                {employees.map(emp => (
                  <SelectItem key={emp.id} value={emp.id}>{emp.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Date picker */}
          <div className="space-y-2">
            <Label>Data *</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    'w-full justify-start text-left font-normal',
                    !date && 'text-muted-foreground'
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {date ? format(date, 'd MMMM yyyy', { locale: pl }) : 'Wybierz datę'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar
                  mode="single"
                  selected={date}
                  onSelect={setDate}
                  locale={pl}
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* Time inputs */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="startTime">Od *</Label>
              <Input
                id="startTime"
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="endTime">Do *</Label>
              <Input
                id="endTime"
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
              />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Anuluj
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Dodaj
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default AddEmployeeBreakDialog;
