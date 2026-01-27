import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { format } from 'date-fns';
import { pl } from 'date-fns/locale';
import { CalendarIcon, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { supabase } from '@/integrations/supabase/client';
import { normalizePhone } from '@/lib/phoneUtils';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

const SERVICE_TYPES = [
  { value: 'serwis', labelKey: 'serwis' },
  { value: 'kontrola', labelKey: 'kontrola' },
  { value: 'serwis_gwarancyjny', labelKey: 'serwis_gwarancyjny' },
  { value: 'odswiezenie', labelKey: 'odswiezenie' },
];

interface ReminderTemplate {
  id: string;
  name: string;
}

interface AddCustomerReminderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customerPhone: string;
  customerName: string;
  instanceId: string;
  onReminderAdded: () => void;
}

export function AddCustomerReminderDialog({
  open,
  onOpenChange,
  customerPhone,
  customerName,
  instanceId,
  onReminderAdded,
}: AddCustomerReminderDialogProps) {
  const { t } = useTranslation();
  const [saving, setSaving] = useState(false);
  const [vehiclePlate, setVehiclePlate] = useState('');
  const [serviceType, setServiceType] = useState('serwis');
  const [scheduledDate, setScheduledDate] = useState<Date | undefined>(undefined);
  const [reminderTemplateId, setReminderTemplateId] = useState<string>('');
  const [templates, setTemplates] = useState<ReminderTemplate[]>([]);
  const [loadingTemplates, setLoadingTemplates] = useState(false);

  useEffect(() => {
    if (open && instanceId) {
      loadTemplates();
    }
  }, [open, instanceId]);

  const loadTemplates = async () => {
    setLoadingTemplates(true);
    try {
      const { data, error } = await supabase
        .from('reminder_templates')
        .select('id, name')
        .eq('instance_id', instanceId)
        .order('name');
      
      if (error) throw error;
      setTemplates(data || []);
      
      // Auto-select first template if available
      if (data && data.length > 0 && !reminderTemplateId) {
        setReminderTemplateId(data[0].id);
      }
    } catch (error) {
      console.error('Error loading templates:', error);
    } finally {
      setLoadingTemplates(false);
    }
  };

  const resetForm = () => {
    setVehiclePlate('');
    setServiceType('serwis');
    setScheduledDate(undefined);
    setReminderTemplateId('');
  };

  const handleClose = () => {
    resetForm();
    onOpenChange(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!vehiclePlate.trim()) {
      toast.error(t('customers.vehiclePlateRequired'));
      return;
    }

    if (!scheduledDate) {
      toast.error(t('customers.scheduledDateRequired'));
      return;
    }

    if (!reminderTemplateId) {
      toast.error(t('customers.templateRequired'));
      return;
    }

    setSaving(true);

    try {
      const { error } = await supabase
        .from('customer_reminders')
        .insert({
          instance_id: instanceId,
          reminder_template_id: reminderTemplateId,
          customer_name: customerName,
          customer_phone: normalizePhone(customerPhone),
          vehicle_plate: vehiclePlate.trim().toUpperCase(),
          service_type: serviceType,
          scheduled_date: format(scheduledDate, 'yyyy-MM-dd'),
          months_after: 0, // Custom date, not calculated from months
          status: 'scheduled',
        });

      if (error) throw error;
      
      toast.success(t('customers.reminderAdded'));
      handleClose();
      onReminderAdded();
    } catch (error) {
      console.error('Error adding reminder:', error);
      toast.error(t('customers.addReminderError'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t('customers.addReminder')}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-4">
          {/* Reminder Template */}
          <div className="space-y-2">
            <Label>{t('customers.reminderTemplate')} *</Label>
            <Select 
              value={reminderTemplateId} 
              onValueChange={setReminderTemplateId}
              disabled={loadingTemplates}
            >
              <SelectTrigger>
                <SelectValue placeholder={t('customers.selectTemplate')} />
              </SelectTrigger>
              <SelectContent>
                {templates.map(template => (
                  <SelectItem key={template.id} value={template.id}>
                    {template.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {templates.length === 0 && !loadingTemplates && (
              <p className="text-xs text-muted-foreground">{t('customers.noTemplatesAvailable')}</p>
            )}
          </div>

          {/* Vehicle Plate */}
          <div className="space-y-2">
            <Label htmlFor="vehiclePlate">{t('customers.vehiclePlate')} *</Label>
            <Input
              id="vehiclePlate"
              value={vehiclePlate}
              onChange={(e) => setVehiclePlate(e.target.value.toUpperCase())}
              placeholder="WA12345"
              required
            />
          </div>

          {/* Service Type */}
          <div className="space-y-2">
            <Label>{t('reminderTemplates.serviceType')} *</Label>
            <Select value={serviceType} onValueChange={setServiceType}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SERVICE_TYPES.map(type => (
                  <SelectItem key={type.value} value={type.value}>
                    {t(`offers.serviceTypes.${type.labelKey}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Scheduled Date */}
          <div className="space-y-2">
            <Label>{t('customers.reminderDate')} *</Label>
            <p className="text-xs text-muted-foreground">{t('customers.reminderTimeInfo')}</p>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !scheduledDate && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {scheduledDate ? (
                    format(scheduledDate, 'd MMMM yyyy', { locale: pl })
                  ) : (
                    t('common.selectDate')
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0 bg-white" align="start">
                <Calendar
                  mode="single"
                  selected={scheduledDate}
                  onSelect={setScheduledDate}
                  disabled={(date) => date < new Date()}
                  initialFocus
                  locale={pl}
                />
              </PopoverContent>
            </Popover>
          </div>

          <DialogFooter className="pt-4">
            <Button type="button" variant="outline" onClick={handleClose}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" disabled={saving || templates.length === 0}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t('common.add')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
