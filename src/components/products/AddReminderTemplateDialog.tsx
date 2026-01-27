import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
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
import { Plus, Trash2, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { ScrollArea } from '@/components/ui/scroll-area';

export interface ReminderTemplateItem {
  months: number;
  is_paid: boolean;
  service_type: string;
}

export interface ReminderTemplate {
  id: string;
  instance_id: string;
  name: string;
  description: string | null;
  sms_template: string;
  items: ReminderTemplateItem[];
  created_at: string;
  updated_at: string;
}

interface AddReminderTemplateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  instanceId: string;
  template?: ReminderTemplate | null;
  onSaved: () => void;
}

const SERVICE_TYPES = [
  { value: 'serwis', label: 'Serwis' },
  { value: 'kontrola', label: 'Kontrola' },
  { value: 'serwis_gwarancyjny', label: 'Serwis gwarancyjny' },
  { value: 'odswiezenie', label: 'Odświeżenie' },
];

const DEFAULT_SMS_TEMPLATE = '{short_name}: Przypominamy o {service_type} dla {vehicle_info}. {paid_info}. Zadzwon: {reservation_phone}';

export function AddReminderTemplateDialog({
  open,
  onOpenChange,
  instanceId,
  template,
  onSaved,
}: AddReminderTemplateDialogProps) {
  const { t } = useTranslation();
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [smsTemplate, setSmsTemplate] = useState(DEFAULT_SMS_TEMPLATE);
  const [items, setItems] = useState<ReminderTemplateItem[]>([]);

  const isEditMode = !!template;

  const resetForm = () => {
    setName('');
    setDescription('');
    setSmsTemplate(DEFAULT_SMS_TEMPLATE);
    setItems([]);
  };

  useEffect(() => {
    if (template && open) {
      setName(template.name || '');
      setDescription(template.description || '');
      setSmsTemplate(template.sms_template || DEFAULT_SMS_TEMPLATE);
      setItems(template.items || []);
    } else if (!template && open) {
      resetForm();
    }
  }, [template, open]);

  const handleClose = () => {
    if (!isEditMode) {
      resetForm();
    }
    onOpenChange(false);
  };

  const addItem = () => {
    setItems([...items, { months: 12, is_paid: true, service_type: 'serwis' }]);
  };

  const updateItem = (index: number, field: keyof ReminderTemplateItem, value: number | boolean | string) => {
    const updated = [...items];
    if (field === 'months') {
      updated[index] = { ...updated[index], months: value as number };
    } else if (field === 'is_paid') {
      updated[index] = { ...updated[index], is_paid: value as boolean };
    } else if (field === 'service_type') {
      updated[index] = { ...updated[index], service_type: value as string };
    }
    setItems(updated);
  };

  const removeItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!name.trim()) {
      toast.error(t('reminderTemplates.nameRequired'));
      return;
    }

    if (!smsTemplate.trim()) {
      toast.error(t('reminderTemplates.smsTemplateRequired'));
      return;
    }

    if (items.length === 0) {
      toast.error(t('reminderTemplates.noItems'));
      return;
    }

    setSaving(true);

    try {
      // Cast items to JSON-compatible format for Supabase
      const itemsJson = items.map(item => ({
        months: item.months,
        is_paid: item.is_paid,
        service_type: item.service_type,
      }));

      if (isEditMode && template) {
        const { error } = await supabase
          .from('reminder_templates')
          .update({
            name: name.trim(),
            description: description.trim() || null,
            sms_template: smsTemplate.trim(),
            items: itemsJson,
          })
          .eq('id', template.id);

        if (error) throw error;
        toast.success(t('reminderTemplates.updated'));
      } else {
        const { error } = await supabase
          .from('reminder_templates')
          .insert({
            instance_id: instanceId,
            name: name.trim(),
            description: description.trim() || null,
            sms_template: smsTemplate.trim(),
            items: itemsJson,
          });

        if (error) throw error;
        toast.success(t('reminderTemplates.created'));
      }

      handleClose();
      onSaved();
    } catch (error) {
      console.error('Error saving template:', error);
      toast.error(isEditMode ? t('reminderTemplates.updateError') : t('reminderTemplates.createError'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-xl max-h-[90vh] p-0">
        <DialogHeader className="p-6 pb-0">
          <DialogTitle>
            {isEditMode ? t('reminderTemplates.edit') : t('reminderTemplates.add')}
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="max-h-[calc(90vh-140px)]">
          <form onSubmit={handleSubmit} className="space-y-4 p-6 pt-4">
            {/* Name */}
            <div className="space-y-2">
              <Label htmlFor="name">{t('reminderTemplates.name')} *</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t('reminderTemplates.namePlaceholder')}
                required
              />
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label htmlFor="description">{t('reminderTemplates.description')}</Label>
              <Input
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={t('reminderTemplates.descriptionPlaceholder')}
              />
            </div>

            {/* SMS Template */}
            <div className="space-y-2">
              <Label htmlFor="smsTemplate">{t('reminderTemplates.smsTemplate')} *</Label>
              <Textarea
                id="smsTemplate"
                value={smsTemplate}
                onChange={(e) => setSmsTemplate(e.target.value)}
                rows={3}
                className="resize-none"
              />
              <p className="text-xs text-muted-foreground">
                {t('reminderTemplates.smsTemplateHelp')}
              </p>
            </div>

            {/* Reminder Items */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>{t('reminderTemplates.schedule')} *</Label>
                <Button type="button" variant="outline" size="sm" onClick={addItem} className="gap-1">
                  <Plus className="h-3 w-3" />
                  {t('reminderTemplates.addReminder')}
                </Button>
              </div>

              {items.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center border rounded-lg">
                  {t('reminderTemplates.noItemsYet')}
                </p>
              ) : (
                <div className="space-y-3">
                  {items.map((item, index) => (
                    <div key={index} className="p-3 border rounded-lg space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">
                          {t('reminderTemplates.reminder')} #{index + 1}
                        </span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => removeItem(index)}
                          className="h-7 w-7 text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        {/* Months */}
                        <div className="space-y-1">
                          <Label className="text-xs">{t('reminderTemplates.monthsAfter')}</Label>
                          <Input
                            type="number"
                            min="1"
                            max="120"
                            value={item.months}
                            onChange={(e) => updateItem(index, 'months', parseInt(e.target.value) || 1)}
                            className="h-9"
                          />
                        </div>

                        {/* Service Type */}
                        <div className="space-y-1">
                          <Label className="text-xs">{t('reminderTemplates.serviceType')}</Label>
                          <Select 
                            value={item.service_type} 
                            onValueChange={(v) => updateItem(index, 'service_type', v)}
                          >
                            <SelectTrigger className="h-9">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {SERVICE_TYPES.map(type => (
                                <SelectItem key={type.value} value={type.value}>
                                  {t(`reminderTemplates.serviceTypes.${type.value}`)}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        {/* Is Paid */}
                        <div className="space-y-1">
                          <Label className="text-xs">{t('reminderTemplates.isPaid')}</Label>
                          <div className="flex items-center h-9">
                            <Switch
                              checked={item.is_paid}
                              onCheckedChange={(checked) => updateItem(index, 'is_paid', checked)}
                            />
                            <span className="ml-2 text-sm text-muted-foreground">
                              {item.is_paid ? t('reminderTemplates.paid') : t('reminderTemplates.free')}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <DialogFooter className="pt-4">
              <Button type="button" variant="outline" onClick={handleClose}>
                {t('common.cancel')}
              </Button>
              <Button type="submit" disabled={saving}>
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {isEditMode ? t('common.save') : t('reminderTemplates.create')}
              </Button>
            </DialogFooter>
          </form>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
