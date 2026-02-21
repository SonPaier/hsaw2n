import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { generateTimeSlots, getWorkingHoursRange } from '@/lib/utils';
import { useTranslation } from 'react-i18next';
import { format } from 'date-fns';
import { pl } from 'date-fns/locale';
import { DateRange } from 'react-day-picker';
import { GraduationCap, Users, X } from 'lucide-react';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from '@/components/ui/sheet';
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
import { ReservationDateTimeSection } from './reservation-form/ReservationDateTimeSection';
import { EmployeeSelectionDrawer } from './EmployeeSelectionDrawer';
import { AssignedEmployeesChips } from './AssignedEmployeesChips';
import { useStations } from '@/hooks/useStations';
import { useWorkingHours } from '@/hooks/useWorkingHours';
import { useIsMobile } from '@/hooks/use-mobile';
import { useEmployees } from '@/hooks/useEmployees';
import type { ReservationType } from './reservation-form/types';

export interface TrainingTypeRecord {
  id: string;
  instance_id: string;
  name: string;
  duration_days: number;
  sort_order: number;
  active: boolean;
}

export interface Training {
  id: string;
  instance_id: string;
  training_type: string;
  training_type_id: string | null;
  title: string;
  description: string | null;
  start_date: string;
  end_date: string | null;
  start_time: string;
  end_time: string;
  station_id: string | null;
  status: string;
  assigned_employee_ids: string[];
  photo_urls: string[] | null;
  created_by: string | null;
  created_by_username: string | null;
  created_at: string;
  updated_at: string;
  station?: { name: string; type: string } | null;
  training_type_record?: TrainingTypeRecord | null;
}

interface AddTrainingDrawerProps {
  open: boolean;
  onClose: () => void;
  instanceId: string;
  onSuccess: () => void;
  editingTraining?: Training | null;
  currentUsername?: string | null;
  initialDate?: string;
  initialTime?: string;
  initialStationId?: string;
}

export function AddTrainingDrawer({
  open,
  onClose,
  instanceId,
  onSuccess,
  editingTraining,
  currentUsername,
  initialDate,
  initialTime,
  initialStationId,
}: AddTrainingDrawerProps) {
  const { t } = useTranslation();
  const isMobile = useIsMobile();
  const isEditMode = !!editingTraining;

  const { data: stations = [] } = useStations(instanceId);
  const { data: workingHoursData } = useWorkingHours(instanceId);
  const { data: employees = [] } = useEmployees(instanceId);

  const [trainingTypes, setTrainingTypes] = useState<TrainingTypeRecord[]>([]);
  const [selectedTypeId, setSelectedTypeId] = useState<string>('');
  const [status, setStatus] = useState<'open' | 'sold_out'>('open');
  const [description, setDescription] = useState('');
  const [reservationType, setReservationType] = useState<ReservationType>('multi');
  const [dateRange, setDateRange] = useState<DateRange | undefined>();
  const [dateRangeOpen, setDateRangeOpen] = useState(false);
  const [manualStartTime, setManualStartTime] = useState('');
  const [manualEndTime, setManualEndTime] = useState('');
  const [manualStationId, setManualStationId] = useState<string | null>(null);
  const [selectedEmployeeIds, setSelectedEmployeeIds] = useState<string[]>([]);
  const [employeeDrawerOpen, setEmployeeDrawerOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [userModifiedEndTime, setUserModifiedEndTime] = useState(false);

  const dateRangeRef = useRef<HTMLDivElement>(null!);
  const timeRef = useRef<HTMLDivElement>(null!);

  const workingHours = workingHoursData as Record<string, { open: string; close: string } | null> | null;

  // Fetch training types
  useEffect(() => {
    if (!instanceId) return;
    const fetch = async () => {
      const { data } = await supabase
        .from('training_types')
        .select('*')
        .eq('instance_id', instanceId)
        .eq('active', true)
        .order('sort_order') as any;
      if (data) setTrainingTypes(data);
    };
    fetch();
  }, [instanceId]);

  // Dynamic time range based on working hours (30 min step for trainings)
  const timeOptions = useMemo(() => {
    const { min, max } = getWorkingHoursRange(workingHours, dateRange?.from);
    return generateTimeSlots(min, max, 30);
  }, [workingHours, dateRange?.from]);

  const getSelectedType = () => trainingTypes.find(t => t.id === selectedTypeId);

  // Reset form when opening
  useEffect(() => {
    if (!open) return;

    if (editingTraining) {
      setSelectedTypeId(editingTraining.training_type_id || '');
      setDescription(editingTraining.description || '');
      setStatus(editingTraining.status === 'sold_out' ? 'sold_out' : 'open');
      const startDate = new Date(editingTraining.start_date + 'T00:00:00');
      const endDate = editingTraining.end_date
        ? new Date(editingTraining.end_date + 'T00:00:00')
        : startDate;
      setDateRange({ from: startDate, to: endDate });
      setReservationType(
        editingTraining.start_date === (editingTraining.end_date || editingTraining.start_date)
          ? 'single'
          : 'multi'
      );
      setManualStartTime(editingTraining.start_time.substring(0, 5));
      setManualEndTime(editingTraining.end_time.substring(0, 5));
      setManualStationId(editingTraining.station_id);
      setSelectedEmployeeIds(editingTraining.assigned_employee_ids || []);
    } else {
      setSelectedTypeId(trainingTypes[0]?.id || '');
      setDescription('');
      setReservationType('single');
      setSelectedEmployeeIds([]);
      setManualStationId(initialStationId || null);
      setStatus('open');

      if (initialDate) {
        const d = new Date(initialDate + 'T00:00:00');
        const firstType = trainingTypes[0];
        const days = firstType?.duration_days || 1;
        const endD = new Date(d);
        endD.setDate(endD.getDate() + Math.ceil(days) - 1);
        setDateRange({ from: d, to: endD });
        if (days > 1) setReservationType('multi');
      } else {
        setDateRange(undefined);
      }

      if (initialTime) {
        setManualStartTime(initialTime);
      } else if (workingHours) {
        const dayName = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][new Date().getDay()];
        const dayHours = workingHours[dayName];
        if (dayHours) {
          setManualStartTime(dayHours.open.substring(0, 5));
          setManualEndTime(dayHours.close.substring(0, 5));
        }
      }
    }
  }, [open, editingTraining, initialDate, initialTime, initialStationId, workingHours, trainingTypes]);

  // When training type changes, auto-set dates
  const handleTypeChange = (typeId: string) => {
    setSelectedTypeId(typeId);
    const type = trainingTypes.find(t => t.id === typeId);
    if (!type) return;

    const days = type.duration_days;
    if (days <= 1) {
      setReservationType('single');
      if (dateRange?.from) {
        setDateRange({ from: dateRange.from, to: dateRange.from });
      }
    } else {
      setReservationType('multi');
      if (dateRange?.from) {
        const endD = new Date(dateRange.from);
        endD.setDate(endD.getDate() + Math.ceil(days) - 1);
        setDateRange({ from: dateRange.from, to: endD });
      }
    }

    // Set working hours for the day
    if (workingHours && dateRange?.from) {
      const dayName = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][dateRange.from.getDay()];
      const dayHours = workingHours[dayName];
      if (dayHours) {
        setManualStartTime(dayHours.open.substring(0, 5));
        setManualEndTime(dayHours.close.substring(0, 5));
      }
    }
  };

  const handleSave = async () => {
    const selectedType = getSelectedType();
    const title = selectedType ? `Szkolenie ${selectedType.name}` : 'Szkolenie';
    
    if (!dateRange?.from || !manualStartTime || !manualEndTime) {
      toast.error('Uzupełnij wymagane pola');
      return;
    }

    setSaving(true);
    try {
      const startDate = format(dateRange.from, 'yyyy-MM-dd');
      const endDate = dateRange.to ? format(dateRange.to, 'yyyy-MM-dd') : startDate;

      const payload = {
        instance_id: instanceId,
        training_type: selectedType?.name || 'custom',
        training_type_id: selectedTypeId || null,
        title,
        description: description.trim() || null,
        start_date: startDate,
        end_date: endDate,
        start_time: manualStartTime,
        end_time: manualEndTime,
        station_id: manualStationId,
        assigned_employee_ids: selectedEmployeeIds,
        created_by_username: currentUsername || null,
        status,
      };

      if (isEditMode && editingTraining) {
        const { error } = await supabase
          .from('trainings')
          .update(payload as any)
          .eq('id', editingTraining.id);
        if (error) throw error;
        toast.success(t('trainings.trainingUpdated'));
      } else {
        const { error } = await supabase
          .from('trainings')
          .insert(payload as any);
        if (error) throw error;
        toast.success(t('trainings.trainingSaved'));
      }

      onSuccess();
      onClose();
    } catch (err) {
      console.error('Error saving training:', err);
      toast.error('Błąd zapisu szkolenia');
    } finally {
      setSaving(false);
    }
  };

  const markUserEditing = () => {};

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
                {isEditMode ? t('trainings.editTraining') : t('trainings.newTraining')}
              </SheetTitle>
              <button
                type="button"
                onClick={onClose}
                className="p-2 rounded-full hover:bg-muted transition-colors shrink-0"
              >
                <span className="sr-only">Close</span>
                <X className="w-5 h-5" />
              </button>
            </div>
          </SheetHeader>

          <div className="flex-1 overflow-y-auto px-6 py-4">
            <div className="space-y-4">
              {/* Training Type */}
              <div className="space-y-2">
                <Label>{t('trainings.type')}</Label>
                <Select value={selectedTypeId} onValueChange={handleTypeChange}>
                  <SelectTrigger className="bg-white dark:bg-card">
                    <SelectValue placeholder="Wybierz typ szkolenia" />
                  </SelectTrigger>
                  <SelectContent className="bg-white dark:bg-card z-50">
                    {trainingTypes.map((type) => (
                      <SelectItem key={type.id} value={type.id}>
                        {type.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Status: Open / Sold Out */}
              <div className="space-y-2">
                <Label>{t('trainings.status')}</Label>
                <RadioGroup
                  value={status}
                  onValueChange={(v) => setStatus(v as 'open' | 'sold_out')}
                  className="flex gap-4"
                >
                  <div className="flex items-center gap-2">
                    <RadioGroupItem value="open" id="status-open" />
                    <Label htmlFor="status-open" className="cursor-pointer font-normal">{t('trainings.statusOpen')}</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <RadioGroupItem value="sold_out" id="status-sold-out" />
                    <Label htmlFor="status-sold-out" className="cursor-pointer font-normal">{t('trainings.statusSoldOut')}</Label>
                  </div>
                </RadioGroup>
              </div>

              {/* Date & Time */}
              <ReservationDateTimeSection
                instanceId={instanceId}
                reservationType={reservationType}
                setReservationType={setReservationType}
                dateRange={dateRange}
                setDateRange={setDateRange}
                dateRangeOpen={dateRangeOpen}
                setDateRangeOpen={setDateRangeOpen}
                onClearDateRangeError={() => {}}
                manualStartTime={manualStartTime}
                setManualStartTime={setManualStartTime}
                manualEndTime={manualEndTime}
                setManualEndTime={setManualEndTime}
                setUserModifiedEndTime={setUserModifiedEndTime}
                manualStationId={manualStationId}
                setManualStationId={setManualStationId}
                stations={stations}
                startTimeOptions={timeOptions}
                endTimeOptions={timeOptions}
                offerNumber=""
                setOfferNumber={() => {}}
                customerName=""
                setCustomerName={() => {}}
                phone=""
                setPhone={() => {}}
                carModel=""
                setCarModel={() => {}}
                workingHours={workingHours}
                isMobile={isMobile}
                markUserEditing={markUserEditing}
                dateRangeRef={dateRangeRef}
                timeRef={timeRef}
                showStationSelector
              />

              {/* Internal Notes */}
              <div className="space-y-2">
                <Label>Notatki wewnętrzne</Label>
                <Textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                />
              </div>

              {/* Employees */}
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Users className="w-4 h-4" />
                  {t('trainings.employees')}
                </Label>
                <AssignedEmployeesChips
                  employeeIds={selectedEmployeeIds}
                  employees={employees}
                  onRemove={(id) => setSelectedEmployeeIds(prev => prev.filter(e => e !== id))}
                  onAdd={() => setEmployeeDrawerOpen(true)}
                />
              </div>
            </div>
          </div>

          <SheetFooter className="px-6 py-4 border-t shrink-0">
            <Button
              onClick={handleSave}
              disabled={saving || !dateRange?.from || !manualStartTime || !manualEndTime}
              className="w-full"
            >
              {saving ? '...' : isEditMode ? t('trainings.saveTraining') : t('trainings.addTraining')}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      <EmployeeSelectionDrawer
        open={employeeDrawerOpen}
        onOpenChange={setEmployeeDrawerOpen}
        instanceId={instanceId}
        selectedEmployeeIds={selectedEmployeeIds}
        onSelect={setSelectedEmployeeIds}
      />
    </>
  );
}
