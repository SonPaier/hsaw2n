import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { pl } from 'date-fns/locale';

interface Station {
  id: string;
  name: string;
  type: string;
}

interface AddBreakDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  instanceId: string;
  stations: Station[];
  initialData: {
    stationId: string;
    date: string;
    time: string;
  };
  onBreakAdded: () => void;
}

// Generate time options from 08:00 to 18:00
const generateTimeOptions = () => {
  const options: string[] = [];
  for (let hour = 8; hour <= 18; hour++) {
    for (let minute = 0; minute < 60; minute += 15) {
      if (hour === 18 && minute > 0) break;
      options.push(
        `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`
      );
    }
  }
  return options;
};

const TIME_OPTIONS = generateTimeOptions();

const AddBreakDialog = ({
  open,
  onOpenChange,
  instanceId,
  stations,
  initialData,
  onBreakAdded,
}: AddBreakDialogProps) => {
  const [startTime, setStartTime] = useState(initialData.time || '08:00');
  const [endTime, setEndTime] = useState('09:00');
  const [note, setNote] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!initialData.stationId || !startTime || !endTime) {
      toast.error('Wypełnij wszystkie pola');
      return;
    }

    if (startTime >= endTime) {
      toast.error('Godzina końca musi być późniejsza niż godzina początku');
      return;
    }

    setIsSubmitting(true);

    try {
      const { error } = await supabase.from('breaks').insert({
        instance_id: instanceId,
        station_id: initialData.stationId,
        break_date: initialData.date,
        start_time: startTime,
        end_time: endTime,
        note: note.trim() || null,
      });

      if (error) {
        console.error('Error adding break:', error);
        toast.error('Błąd podczas dodawania przerwy');
        return;
      }

      toast.success('Przerwa została dodana');
      onBreakAdded();
      onOpenChange(false);
      
      // Reset form
      setNote('');
    } catch (error) {
      console.error('Error:', error);
      toast.error('Wystąpił błąd');
    } finally {
      setIsSubmitting(false);
    }
  };

  const selectedStation = stations.find(s => s.id === initialData.stationId);
  const formattedDate = initialData.date 
    ? format(new Date(initialData.date), 'EEEE, d MMMM yyyy', { locale: pl })
    : '';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle>Dodaj przerwę</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Date and station display */}
          <div className="text-sm text-center pb-2 border-b border-border">
            <div className="text-muted-foreground">{formattedDate}</div>
            {selectedStation && (
              <div className="font-medium mt-1">{selectedStation.name}</div>
            )}
          </div>

          {/* Time range */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Od</Label>
              <Select value={startTime} onValueChange={setStartTime}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TIME_OPTIONS.map((time) => (
                    <SelectItem key={time} value={time}>
                      {time}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Do</Label>
              <Select value={endTime} onValueChange={setEndTime}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TIME_OPTIONS.map((time) => (
                    <SelectItem key={time} value={time}>
                      {time}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Note */}
          <div className="space-y-2">
            <Label>Notatka (opcjonalnie)</Label>
            <Textarea
              placeholder="Np. Przerwa na obiad, wizyta serwisowa..."
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Anuluj
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting ? 'Dodawanie...' : 'Dodaj przerwę'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default AddBreakDialog;
