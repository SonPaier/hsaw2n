import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Phone, Calendar, MessageSquare, CheckCircle2, Clock, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { format, addMonths } from 'date-fns';
import { pl } from 'date-fns/locale';
import { TaskNotesDialog } from './TaskNotesDialog';

interface FollowUpTask {
  id: string;
  event_id: string;
  customer_name: string;
  customer_phone: string;
  due_date: string;
  status: string;
  notes: string | null;
  completed_at: string | null;
  title: string;
  followup_events: {
    followup_services: {
      name: string;
      default_interval_months: number;
    } | null;
  } | null;
}

interface FollowUpTasksProps {
  instanceId: string;
}

export function FollowUpTasks({ instanceId }: FollowUpTasksProps) {
  const [tasks, setTasks] = useState<FollowUpTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [completingTaskId, setCompletingTaskId] = useState<string | null>(null);
  const [selectedTask, setSelectedTask] = useState<FollowUpTask | null>(null);
  const [showNotesDialog, setShowNotesDialog] = useState(false);

  const fetchTasks = async () => {
    try {
      const { data, error } = await supabase
        .from('followup_tasks')
        .select(`
          *,
          followup_events (
            followup_services (
              name,
              default_interval_months
            )
          )
        `)
        .eq('instance_id', instanceId)
        .eq('status', 'pending')
        .order('due_date', { ascending: true });

      if (error) throw error;
      setTasks((data as unknown as FollowUpTask[]) || []);
    } catch (error) {
      console.error('Error fetching tasks:', error);
      toast.error('Błąd podczas pobierania zadań');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTasks();
  }, [instanceId]);

  const handleCompleteTask = async (task: FollowUpTask, notes?: string) => {
    setCompletingTaskId(task.id);
    try {
      // Mark task as completed
      const { error: taskError } = await supabase
        .from('followup_tasks')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
          notes: notes || task.notes,
        })
        .eq('id', task.id);

      if (taskError) throw taskError;

      // Update event's next reminder date (shift by interval)
      if (task.followup_events?.followup_services) {
        const intervalMonths = task.followup_events.followup_services.default_interval_months;
        const nextDate = addMonths(new Date(), intervalMonths);
        
        const { error: eventError } = await supabase
          .from('followup_events')
          .update({
            next_reminder_date: format(nextDate, 'yyyy-MM-dd'),
          })
          .eq('id', task.event_id);

        if (eventError) throw eventError;
      }

      toast.success('Zadanie zostało ukończone');
      fetchTasks();
    } catch (error) {
      console.error('Error completing task:', error);
      toast.error('Błąd podczas ukończania zadania');
    } finally {
      setCompletingTaskId(null);
    }
  };

  const handleCall = (phone: string) => {
    window.location.href = `tel:${phone}`;
  };

  const openNotesDialog = (task: FollowUpTask) => {
    setSelectedTask(task);
    setShowNotesDialog(true);
  };

  const getDaysOverdue = (date: string) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dueDate = new Date(date);
    dueDate.setHours(0, 0, 0, 0);
    const diffTime = today.getTime() - dueDate.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (tasks.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          <CheckCircle2 className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>Brak zadań do wykonania</p>
          <p className="text-sm">Zadania pojawią się automatycznie w dniu przypomnienia</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">Zadania do wykonania ({tasks.length})</h2>

      <div className="space-y-2">
        {tasks.map((task) => {
          const daysOverdue = getDaysOverdue(task.due_date);
          const isOverdue = daysOverdue > 0;
          const isToday = daysOverdue === 0;
          
          return (
            <Card key={task.id} className={isOverdue ? 'border-destructive' : ''}>
              <CardContent className="p-4">
                <div className="flex items-start gap-4">
                  <Checkbox
                    checked={false}
                    disabled={completingTaskId === task.id}
                    onCheckedChange={() => openNotesDialog(task)}
                    className="mt-1"
                  />
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium">{task.customer_name}</span>
                      {task.followup_events?.followup_services && (
                        <span className="text-xs px-2 py-0.5 rounded bg-primary/10 text-primary">
                          {task.followup_events.followup_services.name}
                        </span>
                      )}
                    </div>
                    
                    <div className="flex items-center gap-4 text-sm text-muted-foreground mt-1">
                      <div className="flex items-center gap-1">
                        <Phone className="h-3 w-3" />
                        <span>{task.customer_phone}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        <span className={isOverdue ? 'text-destructive' : isToday ? 'text-orange-500' : ''}>
                          {format(new Date(task.due_date), 'd MMM yyyy', { locale: pl })}
                          {isOverdue && ` (${daysOverdue} dni temu)`}
                          {isToday && ' (dziś)'}
                        </span>
                      </div>
                    </div>

                    {task.notes && (
                      <p className="text-sm text-muted-foreground mt-1 truncate">
                        <MessageSquare className="h-3 w-3 inline mr-1" />
                        {task.notes}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleCall(task.customer_phone)}
                    >
                      <Phone className="h-4 w-4" />
                    </Button>
                    
                    {completingTaskId === task.id && (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <TaskNotesDialog
        open={showNotesDialog}
        onOpenChange={setShowNotesDialog}
        task={selectedTask}
        onComplete={(notes) => {
          if (selectedTask) {
            handleCompleteTask(selectedTask, notes);
            setShowNotesDialog(false);
            setSelectedTask(null);
          }
        }}
      />
    </div>
  );
}
