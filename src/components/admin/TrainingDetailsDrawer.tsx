import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { format, parseISO } from 'date-fns';
import { pl } from 'date-fns/locale';
import { GraduationCap, Pencil, Trash2, MapPin, Clock, Calendar, Users, X } from 'lucide-react';
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
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

import { useEmployees } from '@/hooks/useEmployees';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
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
  const { data: employees = [] } = useEmployees(instanceId);

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
          className="w-full sm:max-w-[27rem] flex flex-col h-full p-0 gap-0 shadow-[-8px_0_30px_-12px_rgba(0,0,0,0.15)]"
          hideOverlay
          hideCloseButton
          onInteractOutside={(e) => e.preventDefault()}
          onEscapeKeyDown={(e) => e.preventDefault()}
        >
          <SheetHeader className="px-6 pt-6 pb-4 border-b shrink-0">
            <div className="flex items-center justify-between">
              <SheetTitle className="flex items-center gap-2">
                <GraduationCap className="w-5 h-5" />
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

          <div className="flex-1 overflow-y-auto px-6 py-4">
            <div className="space-y-4">
              {/* Status label - matching calendar card colors */}
              <div className="flex items-center gap-2 flex-wrap">
                <Badge
                  variant="secondary"
                  className={isSoldOut
                    ? 'bg-fuchsia-600 text-white hover:bg-fuchsia-700'
                    : 'bg-pink-200 text-pink-900 hover:bg-pink-300'
                  }
                >
                  {isSoldOut ? 'Zamknięte' : 'Otwarte'}
                </Badge>
              </div>

              {/* Status toggle */}
              {!readOnly && (
                <div className="flex items-center justify-between py-2">
                  <Label>{t('trainings.status')}</Label>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">
                      {isSoldOut ? t('trainings.statusSoldOut') : t('trainings.statusOpen')}
                    </span>
                    <Switch
                      checked={isSoldOut}
                      onCheckedChange={handleToggleStatus}
                      disabled={togglingStatus}
                    />
                  </div>
                </div>
              )}

              {/* Dates */}
              <div className="space-y-1">
                <Label className="flex items-center gap-2 text-muted-foreground">
                  <Calendar className="w-4 h-4" />
                  {t('trainings.dates')}
                </Label>
                <p className="text-sm font-medium">
                  {formatDate(training.start_date)}
                  {isMultiDay && ` — ${formatDate(training.end_date!)}`}
                </p>
              </div>

              {/* Times */}
              <div className="space-y-1">
                <Label className="flex items-center gap-2 text-muted-foreground">
                  <Clock className="w-4 h-4" />
                  {t('common.time')}
                </Label>
                <p className="text-sm font-medium">
                  {formatTime(training.start_time)} - {formatTime(training.end_time)}
                </p>
              </div>

              {/* Station */}
              {training.station && (
                <div className="space-y-1">
                  <Label className="flex items-center gap-2 text-muted-foreground">
                    <MapPin className="w-4 h-4" />
                    Stanowisko
                  </Label>
                  <p className="text-sm font-medium">{training.station.name}</p>
                </div>
              )}

              {/* Description */}
              {training.description && (
                <>
                  <Separator />
                  <div className="space-y-1">
                    <Label className="text-muted-foreground">{t('trainings.description')}</Label>
                    <p className="text-sm whitespace-pre-wrap">{training.description}</p>
                  </div>
                </>
              )}

              {/* Employees */}
              <div className="space-y-2">
                <Label className="flex items-center gap-2 text-muted-foreground">
                  <Users className="w-4 h-4" />
                  {t('trainings.employees')}
                </Label>
                {training.assigned_employee_ids?.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {training.assigned_employee_ids.map(empId => {
                      const emp = employees.find(e => e.id === empId);
                      const name = emp?.name || 'Usunięty';
                      return (
                        <span
                          key={empId}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-primary text-primary-foreground rounded-full text-sm font-medium"
                        >
                          {name}
                        </span>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">{t('trainings.noEmployees')}</p>
                )}
              </div>

              {/* Photos */}
              {training.photo_urls && training.photo_urls.length > 0 && (
                <>
                  <Separator />
                  <div className="space-y-2">
                    <Label className="text-muted-foreground">{t('trainings.photos')}</Label>
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
            <SheetFooter className="px-6 py-4 border-t shrink-0">
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
    </>
  );
}
