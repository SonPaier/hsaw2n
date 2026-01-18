import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { format } from 'date-fns';
import { pl } from 'date-fns/locale';
import { CalendarIcon, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
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
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

const SERVICE_TYPES = [
  { value: 'serwis', labelKey: 'serwis' },
  { value: 'kontrola', labelKey: 'kontrola' },
  { value: 'serwis_gwarancyjny', labelKey: 'serwis_gwarancyjny' },
  { value: 'odswiezenie', labelKey: 'odswiezenie' },
];

const DEFAULT_SMS_TEMPLATE = '{short_name}: Przypominamy o {service_type} dla {vehicle_info}. {paid_info}. Zadzwon: {reservation_phone}';

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
  const [serviceName, setServiceName] = useState('');
  const [serviceType, setServiceType] = useState('serwis');
  const [scheduledDate, setScheduledDate] = useState<Date | undefined>(undefined);
  const [isPaid, setIsPaid] = useState(false);

  const resetForm = () => {
    setServiceName('');
    setServiceType('serwis');
    setScheduledDate(undefined);
    setIsPaid(false);
  };

  const handleClose = () => {
    resetForm();
    onOpenChange(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!serviceName.trim()) {
      toast.error(t('customers.serviceNameRequired'));
      return;
    }

    if (!scheduledDate) {
      toast.error(t('customers.scheduledDateRequired'));
      return;
    }

    setSaving(true);

    try {
      const { error } = await supabase
        .from('offer_reminders')
        .insert({
          instance_id: instanceId,
          offer_id: null, // Custom reminder - not linked to offer
          customer_name: customerName,
          customer_phone: customerPhone,
          service_name: serviceName.trim(),
          service_type: serviceType,
          scheduled_date: format(scheduledDate, 'yyyy-MM-dd'),
          months_after: 0, // Custom date, not calculated from months
          is_paid: isPaid,
          sms_template: DEFAULT_SMS_TEMPLATE,
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
          {/* Service Name */}
          <div className="space-y-2">
            <Label htmlFor="serviceName">{t('customers.reminderServiceName')} *</Label>
            <Input
              id="serviceName"
              value={serviceName}
              onChange={(e) => setServiceName(e.target.value)}
              placeholder={t('customers.reminderServiceNamePlaceholder')}
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

          {/* Is Paid */}
          <div className="flex items-center justify-between">
            <Label htmlFor="isPaid">{t('customers.reminderIsPaid')}</Label>
            <div className="flex items-center gap-2">
              <Switch
                id="isPaid"
                checked={isPaid}
                onCheckedChange={setIsPaid}
              />
              <span className="text-sm text-muted-foreground">
                {isPaid ? t('offers.paid') : t('offers.free')}
              </span>
            </div>
          </div>

          <DialogFooter className="pt-4">
            <Button type="button" variant="outline" onClick={handleClose}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t('common.add')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
