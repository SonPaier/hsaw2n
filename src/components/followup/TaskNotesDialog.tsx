import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { CheckCircle2 } from 'lucide-react';

interface Task {
  id: string;
  customer_name: string;
  customer_phone: string;
  notes: string | null;
}

interface TaskNotesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  task: Task | null;
  onComplete: (notes: string) => void;
}

export function TaskNotesDialog({
  open,
  onOpenChange,
  task,
  onComplete,
}: TaskNotesDialogProps) {
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (task) {
      setNotes(task.notes || '');
    }
  }, [task]);

  const handleComplete = () => {
    onComplete(notes);
    setNotes('');
  };

  if (!task) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-green-500" />
            Zakończ zadanie
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <p className="font-medium">{task.customer_name}</p>
            <p className="text-sm text-muted-foreground">{task.customer_phone}</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notatka (opcjonalnie)</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Zapisz efekt rozmowy, ustalenia..."
              rows={4}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Anuluj
          </Button>
          <Button onClick={handleComplete}>
            <CheckCircle2 className="h-4 w-4 mr-2" />
            Zakończ zadanie
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
