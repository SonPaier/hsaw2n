import { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { format, parseISO } from 'date-fns';
import { pl } from 'date-fns/locale';
import { Pencil, Trash2, X, Plus } from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

import { useEmployees } from '@/hooks/useEmployees';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { EmployeeSelectionDrawer } from '@/components/admin/EmployeeSelectionDrawer';
import type { Training } from './AddTrainingDrawer';

interface TrainingDetailsDrawerProps {
  open: boolean;
  onClose: () => void;
  training: Training | null;
  instanceId: string;
  onEdit: (training: Training) => void;
  onDeleted: () => void;
  readOnly?: boolean;
}

export function TrainingDetailsDrawer({
  open,
  onClose,
  training,
  instanceId,
  onEdit,
  onDeleted,
  readOnly = false,
}: TrainingDetailsDrawerProps) {
  const { t } = useTranslation();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [togglingStatus, setTogglingStatus] = useState(false);
  const [employeeDrawerOpen, setEmployeeDrawerOpen] = useState(false);
  const [editingNotes, setEditingNotes] = useState(false);
  const [localDescription, setLocalDescription] = useState('');
  const [savingNotes, setSavingNotes] = useState(false);
  const notesRef = useRef<HTMLTextAreaElement>(null);
  const { data: employees = [] } = useEmployees(instanceId);

  useEffect(() => {
    if (training) {
      setLocalDescription(training.description || '');
      setEditingNotes(false);
    }
  }, [training]);

  useEffect(() => {
    if (editingNotes && notesRef.current) {
      notesRef.current.focus();
    }
  }, [editingNotes]);

  if (!training) return null;

  const isSoldOut = training.status === 'sold_out';
  const isMultiDay = training.end_date && training.end_date !== training.start_date;

  const handleToggleStatus = async () => {
    setTogglingStatus(true);
    try {
      const newStatus = isSoldOut ? 'open' : 'sold_out';
      const { error } = await supabase
        .from('trainings')
        .update({ status: newStatus } as any)
        .eq('id', training.id);
      if (error) throw error;
      toast.success(newStatus === 'sold_out' ? t('trainings.statusSoldOut') : t('trainings.statusOpen'));
    } catch (err) {
      console.error('Error toggling status:', err);
      toast.error('Błąd zmiany statusu');
    } finally {
      setTogglingStatus(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      const { error } = await supabase
        .from('trainings')
        .delete()
        .eq('id', training.id);
      if (error) throw error;
      toast.success(t('trainings.trainingDeleted'));
      onDeleted();
      onClose();
    } catch (err) {
      console.error('Error deleting training:', err);
      toast.error('Błąd usuwania szkolenia');
    } finally {
      setDeleting(false);
      setDeleteDialogOpen(false);
    }
  };

  const handleSaveNotes = async () => {
    if (localDescription === (training.description || '')) {
      setEditingNotes(false);
      return;
    }
    setSavingNotes(true);
    try {
      const { error } = await supabase
        .from('trainings')
        .update({ description: localDescription || null } as any)
        .eq('id', training.id);
      if (error) throw error;
      toast.success('Notatki zapisane');
    } catch (err) {
      console.error('Error saving notes:', err);
      toast.error('Błąd zapisu notatek');
    } finally {
      setSavingNotes(false);
      setEditingNotes(false);
    }
  };

  const handleEmployeeSelect = async (employeeIds: string[]) => {
    try {
      const { error } = await supabase
        .from('trainings')
        .update({ assigned_employee_ids: employeeIds } as any)
        .eq('id', training.id);
      if (error) throw error;
      toast.success('Pracownicy zaktualizowani');
    } catch (err) {
      console.error('Error updating employees:', err);
      toast.error('Błąd aktualizacji pracowników');
    }
  };

  const formatDate = (dateStr: string) => {
    try {
      return format(parseISO(dateStr), 'EEEE, d MMM yyyy', { locale: pl });
    } catch {
      return dateStr;
    }
  };

  const formatTime = (timeStr: string) => timeStr?.substring(0, 5) || '';

  return (
    <>
      <Sheet open={open} onOpenChange={(isOpen) => !isOpen && onClose()} modal={false}>
        <SheetContent
          side="right"
          className="w-full sm:max-w-[27rem] flex flex-col h-full p-0 gap-0 shadow-[-8px_0_30px_-12px_rgba(0,0,0,0.15)] bg-white dark:bg-card"
          hideOverlay
          hideCloseButton
          onInteractOutside={(e) => e.preventDefault()}
          onEscapeKeyDown={(e) => e.preventDefault()}
        >
          <SheetHeader className="px-6 pt-6 pb-4 border-b shrink-0 bg-white dark:bg-card">
            <div className="flex items-center justify-between">
              <SheetTitle className="text-foreground">
                {training.title}
              </SheetTitle>
              <button
                type="button"
                onClick={onClose}
                className="p-2 rounded-full hover:bg-muted transition-colors shrink-0"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </SheetHeader>

          <div className="flex-1 overflow-y-auto px-6 py-4 bg-white dark:bg-card">
            <div className="space-y-4">
              {/* Status */}
              <div>
                <div className="text-xs text-muted-foreground">{t('trainings.status')}</div>
                <div className="flex items-center justify-between mt-1">
                  <Badge
                    variant="secondary"
                    className={isSoldOut
                      ? 'bg-fuchsia-600 text-white hover:bg-fuchsia-700'
                      : 'bg-pink-200 text-pink-900 hover:bg-pink-300'
                    }
                  >
                    {isSoldOut ? 'Zamknięte' : 'Otwarte'}
                  </Badge>
                  {!readOnly && (
                    <Switch
                      checked={isSoldOut}
                      onCheckedChange={handleToggleStatus}
                      disabled={togglingStatus}
                    />
                  )}
                </div>
              </div>

              {/* Dates */}
              <div>
                <div className="text-xs text-muted-foreground">{t('trainings.dates')}</div>
                <div className="font-medium text-foreground">
                  {formatDate(training.start_date)}
                  {isMultiDay && ` — ${formatDate(training.end_date!)}`}
                </div>
              </div>

              {/* Time */}
              <div>
                <div className="text-xs text-muted-foreground">{t('common.time')}</div>
                <div className="font-medium text-foreground">
                  {formatTime(training.start_time)} - {formatTime(training.end_time)}
                </div>
              </div>

              {/* Station */}
              {training.station && (
                <div>
                  <div className="text-xs text-muted-foreground">Stanowisko</div>
                  <div className="font-medium text-foreground">{training.station.name}</div>
                </div>
              )}

              {/* Employees */}
              <div>
                <div className="text-xs text-muted-foreground mb-1">Przypisani pracownicy</div>
                <div className="flex flex-wrap gap-2 items-center">
                  {training.assigned_employee_ids?.length > 0 && training.assigned_employee_ids.map(empId => {
                    const emp = employees.find(e => e.id === empId);
                    const name = emp?.name || 'Usunięty';
                    return (
                      <span
                        key={empId}
                        className="inline-flex items-center gap-1.5 px-3 py-1 bg-primary text-primary-foreground rounded-full text-sm font-medium leading-none"
                      >
                        {name}
                      </span>
                    );
                  })}
                  {!readOnly && (
                    <button
                      type="button"
                      className="inline-flex items-center gap-1.5 px-3 py-1 bg-primary text-primary-foreground rounded-full text-sm font-medium leading-none hover:bg-primary/90 transition-colors"
                      onClick={() => setEmployeeDrawerOpen(true)}
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Dodaj
                    </button>
                  )}
                </div>
              </div>

              {/* Internal Notes */}
              <div>
                <div className="text-xs text-muted-foreground mb-1">Notatki wewnętrzne</div>
                {editingNotes ? (
                  <Textarea
                    ref={notesRef}
                    value={localDescription}
                    onChange={(e) => setLocalDescription(e.target.value)}
                    onBlur={() => setTimeout(handleSaveNotes, 100)}
                    rows={3}
                    disabled={savingNotes}
                    className="text-sm bg-white dark:bg-card border-foreground/60"
                  />
                ) : (
                  <p
                    className={`text-sm cursor-pointer hover:bg-muted/50 rounded px-1 py-0.5 -mx-1 ${
                      !localDescription ? 'text-muted-foreground italic' : 'whitespace-pre-wrap text-foreground'
                    }`}
                    onClick={() => !readOnly && setEditingNotes(true)}
                  >
                    {localDescription || 'Brak notatek wewnętrznych'}
                  </p>
                )}
              </div>

              {/* Photos */}
              {training.photo_urls && training.photo_urls.length > 0 && (
                <>
                  <Separator />
                  <div className="space-y-2">
                    <div className="text-xs text-muted-foreground">{t('trainings.photos')}</div>
                    <div className="grid grid-cols-3 gap-2">
                      {training.photo_urls.map((url, i) => (
                        <img
                          key={i}
                          src={url}
                          alt={`Photo ${i + 1}`}
                          className="w-full h-20 object-cover rounded-md"
                        />
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>

          {!readOnly && (
            <SheetFooter className="px-6 py-4 border-t shrink-0 bg-white dark:bg-card">
              <div className="flex gap-2 w-full">
                <Button
                  variant="outline"
                  className="flex-1 bg-white dark:bg-card"
                  onClick={() => {
                    onEdit(training);
                    onClose();
                  }}
                >
                  <Pencil className="w-4 h-4 mr-2" />
                  {t('trainings.editTraining')}
                </Button>
                <Button
                  variant="destructive"
                  size="icon"
                  onClick={() => setDeleteDialogOpen(true)}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </SheetFooter>
          )}
        </SheetContent>
      </Sheet>

      <ConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title={t('trainings.deleteTraining')}
        description={t('trainings.deleteConfirm')}
        onConfirm={handleDelete}
        loading={deleting}
        variant="destructive"
      />

      <EmployeeSelectionDrawer
        open={employeeDrawerOpen}
        onOpenChange={setEmployeeDrawerOpen}
        instanceId={instanceId}
        selectedEmployeeIds={training.assigned_employee_ids || []}
        onSelect={handleEmployeeSelect}
      />
    </>
  );
}
