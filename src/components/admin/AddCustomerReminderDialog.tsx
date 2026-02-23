import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { format, addMonths } from 'date-fns';
import { pl } from 'date-fns/locale';
import { CalendarIcon, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
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


interface ReminderTemplateItem {
  months: number;
  is_paid: boolean;
  service_type: string;
}

interface ReminderTemplate {
  id: string;
  name: string;
  items: ReminderTemplateItem[] | null;
}

interface CustomerVehicle {
  id: string;
  model: string;
  plate: string | null;
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
  const [selectedVehicleId, setSelectedVehicleId] = useState<string | null>(null);
  
  const [serviceDate, setServiceDate] = useState<Date | undefined>(undefined);
  const [reminderTemplateId, setReminderTemplateId] = useState<string>('');
  const [templates, setTemplates] = useState<ReminderTemplate[]>([]);
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [customerVehicles, setCustomerVehicles] = useState<CustomerVehicle[]>([]);
  const [loadingVehicles, setLoadingVehicles] = useState(false);

  useEffect(() => {
    if (open && instanceId) {
      loadTemplates();
      loadCustomerVehicles();
    }
  }, [open, instanceId, customerPhone]);

  const loadTemplates = async () => {
    setLoadingTemplates(true);
    try {
      const { data, error } = await supabase
        .from('reminder_templates')
        .select('id, name, items')
        .eq('instance_id', instanceId)
        .order('name');
      
      if (error) throw error;
      
      // Cast items from Json to proper type
      const typedTemplates: ReminderTemplate[] = (data || []).map(t => ({
        id: t.id,
        name: t.name,
        items: (t.items as unknown) as ReminderTemplateItem[] | null,
      }));
      
      setTemplates(typedTemplates);
      
      // Auto-select first template if available
      if (typedTemplates.length > 0 && !reminderTemplateId) {
        setReminderTemplateId(typedTemplates[0].id);
      }
    } catch (error) {
      console.error('Error loading templates:', error);
    } finally {
      setLoadingTemplates(false);
    }
  };

  const loadCustomerVehicles = async () => {
    setLoadingVehicles(true);
    try {
      const normalizedPhone = normalizePhone(customerPhone);
      const strippedPhone = normalizedPhone.replace(/^\+/, '');
      const { data, error } = await supabase
        .from('customer_vehicles')
        .select('id, model, plate')
        .eq('instance_id', instanceId)
        .or(`phone.eq.${normalizedPhone},phone.eq.${strippedPhone}`)
        .order('last_used_at', { ascending: false });
      
      if (error) throw error;
      setCustomerVehicles(data || []);
      
      // Auto-select first vehicle if available
      if (data && data.length > 0) {
        setSelectedVehicleId(data[0].id);
      }
    } catch (error) {
      console.error('Error loading customer vehicles:', error);
    } finally {
      setLoadingVehicles(false);
    }
  };

  const resetForm = () => {
    setSelectedVehicleId(null);
    setServiceDate(undefined);
    setReminderTemplateId('');
  };

  const handleClose = () => {
    resetForm();
    onOpenChange(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const selectedVehicle = customerVehicles.find(v => v.id === selectedVehicleId);
    if (!selectedVehicle) {
      toast.error(t('customers.vehicleRequired'));
      return;
    }

    if (!serviceDate) {
      toast.error(t('customers.serviceDateRequired'));
      return;
    }

    if (!reminderTemplateId) {
      toast.error(t('customers.templateRequired'));
      return;
    }

    const selectedTemplate = templates.find(t => t.id === reminderTemplateId);
    if (!selectedTemplate || !selectedTemplate.items || selectedTemplate.items.length === 0) {
      toast.error(t('customers.templateHasNoItems'));
      return;
    }

    setSaving(true);

    try {
      // Create a reminder for each item in the template
      const remindersToInsert = selectedTemplate.items.map(item => {
        const scheduledDate = addMonths(serviceDate, item.months);
        return {
          instance_id: instanceId,
          reminder_template_id: reminderTemplateId,
          customer_name: customerName,
          customer_phone: normalizePhone(customerPhone),
          vehicle_plate: selectedVehicle.plate || selectedVehicle.model,
          service_type: item.service_type,
          scheduled_date: format(scheduledDate, 'yyyy-MM-dd'),
          months_after: item.months,
          status: 'scheduled',
        };
      });

      const { error } = await supabase
        .from('customer_reminders')
        .insert(remindersToInsert);

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

  const selectedVehicle = customerVehicles.find(v => v.id === selectedVehicleId);

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
              <SelectTrigger className="bg-white">
                <SelectValue placeholder={t('customers.selectTemplate')} />
              </SelectTrigger>
              <SelectContent className="bg-white">
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

          {/* Vehicle Selection */}
          <div className="space-y-2">
            <Label>{t('customers.vehicle')} *</Label>
            {loadingVehicles ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                {t('common.loading')}
              </div>
            ) : customerVehicles.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {customerVehicles.map((vehicle) => (
                  <button
                    key={vehicle.id}
                    type="button"
                    onClick={() => setSelectedVehicleId(vehicle.id)}
                    className={cn(
                      'px-3 py-1.5 text-sm rounded-full transition-colors font-medium',
                      selectedVehicleId === vehicle.id
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-white hover:bg-muted/50 text-foreground border border-border'
                    )}
                  >
                    {vehicle.plate ? `${vehicle.model} (${vehicle.plate})` : vehicle.model}
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">{t('customers.noVehiclesFound')}</p>
            )}
          </div>


          {/* Service Date - base date for reminder calculation */}
          <div className="space-y-2">
            <Label>{t('customers.serviceDate')} *</Label>
            <p className="text-xs text-muted-foreground">{t('customers.serviceDateInfo')}</p>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal bg-white",
                    !serviceDate && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {serviceDate ? (
                    format(serviceDate, 'd MMMM yyyy', { locale: pl })
                  ) : (
                    t('common.selectDate')
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0 bg-white" align="start">
                <Calendar
                  mode="single"
                  selected={serviceDate}
                  onSelect={setServiceDate}
                  initialFocus
                  locale={pl}
                  className="pointer-events-auto"
                />
              </PopoverContent>
            </Popover>
          </div>

          <DialogFooter className="pt-4">
            <Button type="button" variant="outline" onClick={handleClose}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" disabled={saving || templates.length === 0 || customerVehicles.length === 0}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t('common.add')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}