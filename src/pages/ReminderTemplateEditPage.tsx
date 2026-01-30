import { useState, useEffect } from 'react';
import { useNavigate, useParams, useSearchParams, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, Plus, Trash2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent } from '@/components/ui/tabs';
import { AdminTabsList, AdminTabsTrigger } from '@/components/admin/AdminTabsList';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { TemplateAssignedCustomers } from '@/components/admin/TemplateAssignedCustomers';
import type { Json } from '@/integrations/supabase/types';

interface ReminderItem {
  months: number;
  service_type: string;
}

interface ReminderTemplate {
  id: string;
  name: string;
  description: string | null;
  items: ReminderItem[];
  sms_template: string;
}

const SERVICE_TYPES = [
  { value: 'serwis', labelKey: 'serwis' },
  { value: 'kontrola', labelKey: 'kontrola' },
  { value: 'serwis_gwarancyjny', labelKey: 'serwis_gwarancyjny' },
  { value: 'odswiezenie_powloki', labelKey: 'odswiezenie_powloki' },
];

// TODO: Superadmin będzie mógł edytować szablony SMS w panelu superadmina
// Na razie hardcoded templates - admin widzi readonly
const SMS_TEMPLATES: Record<string, string> = {
  serwis: '{short_name}: Zapraszamy na serwis folii PPF pojazdu {vehicle_model}. Kontakt: {reservation_phone}',
  kontrola: '{short_name}: Zapraszamy na bezplatna kontrole folii PPF pojazdu {vehicle_model}. Kontakt: {reservation_phone}',
  serwis_gwarancyjny: '{short_name}: Zapraszamy na serwis gwarancyjny pojazdu {vehicle_model}. Kontakt: {reservation_phone}',
  odswiezenie_powloki: '{short_name}: Zapraszamy na odswiezenie powloki pojazdu {vehicle_model}. Kontakt: {reservation_phone}',
};

export default function ReminderTemplateEditPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const { shortId } = useParams<{ shortId: string }>();
  const [searchParams] = useSearchParams();
  const { user, roles, loading: authLoading } = useAuth();
  
  // Get instanceId directly from roles (already fetched by useAuth)
  const instanceId = roles.find(r => r.instance_id)?.instance_id || null;
  
  // Check if we came from ServiceFormDialog (to return and assign template)
  const returnToService = searchParams.get('returnToService');
  const serviceId = searchParams.get('serviceId');
  
  // In some routes we use explicit "/reminders/new" path. Treat it as shortId="new".
  const isNew = shortId === 'new' || location.pathname.endsWith('/reminders/new');
  
  // Detect if we're on admin path (for subdomain navigation)
  const isAdminPath = location.pathname.startsWith('/admin');
  const remindersBasePath = isAdminPath ? '/admin/reminders' : '/reminders';
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [templateId, setTemplateId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'template' | 'customers'>('template');
  
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [items, setItems] = useState<ReminderItem[]>([{ months: 12, service_type: 'serwis' }]);

  // For new templates, stop loading once auth is ready and we have instanceId
  useEffect(() => {
    if (!authLoading && isNew) {
      setLoading(false);
    }
  }, [authLoading, isNew]);

  useEffect(() => {
    if (!authLoading && !isNew && instanceId && shortId) {
      fetchTemplate();
    }
  }, [authLoading, isNew, instanceId, shortId]);

  const fetchTemplate = async () => {
    if (!instanceId || !shortId) return;
    
    setLoading(true);
    try {
      // Find template by short ID prefix - fetch all and filter client-side
      // because ilike doesn't work with UUID type directly
      const { data, error } = await supabase
        .from('reminder_templates')
        .select('*')
        .eq('instance_id', instanceId);

      if (error) throw error;
      
      // Find template where ID starts with shortId
      const template = data?.find(t => t.id.startsWith(shortId));
      
      if (template) {
        setTemplateId(template.id);
        setName(template.name);
        setDescription(template.description || '');
        // Safely parse items from JSONB
        const parsedItems = Array.isArray(template.items) 
          ? (template.items as unknown as ReminderItem[])
          : [];
        setItems(parsedItems.length > 0 ? parsedItems : [{ months: 12, service_type: 'serwis' }]);
      } else {
      toast.error(t('reminderTemplates.notFound'));
        navigate(remindersBasePath);
      }
    } catch (error) {
      console.error('Error fetching template:', error);
      toast.error(t('reminderTemplates.fetchError'));
      navigate(remindersBasePath);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!instanceId) return;
    
    if (!name.trim()) {
      toast.error(t('reminderTemplates.nameRequired'));
      return;
    }

    if (items.length === 0) {
      toast.error(t('reminderTemplates.itemsRequired'));
      return;
    }

    setSaving(true);
    try {
      // Use the first item's service_type for SMS template
      const smsTemplate = SMS_TEMPLATES[items[0]?.service_type] || SMS_TEMPLATES.serwis;
      
      // Convert items to Json compatible format
      const itemsJson = items as unknown as Json;
      
      let newTemplateId: string | null = null;
      
      if (isNew) {
        const { data, error } = await supabase
          .from('reminder_templates')
          .insert({
            instance_id: instanceId!,
            name: name.trim(),
            description: description.trim() || null,
            items: itemsJson,
            sms_template: smsTemplate,
          })
          .select('id')
          .single();

        if (error) throw error;
        newTemplateId = data?.id || null;
        toast.success(t('reminderTemplates.created'));
      } else if (templateId) {
        const { error } = await supabase
          .from('reminder_templates')
          .update({
            name: name.trim(),
            description: description.trim() || null,
            items: itemsJson,
            sms_template: smsTemplate,
          })
          .eq('id', templateId);

        if (error) throw error;
        newTemplateId = templateId;
        toast.success(t('reminderTemplates.updated'));
      }

      // If we came from ServiceFormDialog, return with the new template ID
      if (returnToService === 'true' && serviceId && newTemplateId) {
        // Navigate back with template ID in URL for assignment
        const pricingPath = isAdminPath ? '/admin/pricelist' : '/pricelist';
        navigate(`${pricingPath}?serviceId=${serviceId}&assignedReminderId=${newTemplateId}`);
      } else {
        navigate(remindersBasePath);
      }
    } catch (error) {
      console.error('Error saving template:', error);
      toast.error(t('reminderTemplates.saveError'));
    } finally {
      setSaving(false);
    }
  };

  const addItem = () => {
    setItems([...items, { months: 12, service_type: 'serwis' }]);
  };

  const removeItem = (index: number) => {
    if (items.length <= 1) return;
    setItems(items.filter((_, i) => i !== index));
  };

  const updateItem = (index: number, field: keyof ReminderItem, value: number | string) => {
    setItems(items.map((item, i) => 
      i === index ? { ...item, [field]: value } : item
    ));
  };

  // Get SMS template example based on first item's service type
  const getSmsExample = () => {
    const serviceType = items[0]?.service_type || 'serwis';
    const template = SMS_TEMPLATES[serviceType] || SMS_TEMPLATES.serwis;
    return template
      .replace('{short_name}', 'Armcar')
      .replace('{vehicle_model}', 'Porsche 911')
      .replace('{reservation_phone}', '123456789');
  };

  const handleBack = () => {
    if (returnToService === 'true') {
      // Go back to pricelist without creating template
      const pricingPath = isAdminPath ? '/admin/pricelist' : '/pricelist';
      navigate(pricingPath);
    } else {
      navigate(remindersBasePath);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background border-b">
        <div className="container max-w-2xl mx-auto px-4 py-4">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={handleBack}
              className="shrink-0"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <h1 className="text-xl font-semibold">
              {isNew ? t('reminders.addTemplate') : t('reminders.editTemplate')}
            </h1>
          </div>
        </div>
      </div>

      {/* Tabs - only for existing templates */}
      {!isNew && (
        <div className="container max-w-2xl mx-auto px-4 pt-4">
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'template' | 'customers')}>
            <AdminTabsList columns={2}>
              <AdminTabsTrigger value="template">
                {t('reminders.tabs.template')}
              </AdminTabsTrigger>
              <AdminTabsTrigger value="customers">
                {t('reminders.tabs.assignedCustomers')}
              </AdminTabsTrigger>
            </AdminTabsList>
          </Tabs>
        </div>
      )}

      {/* Tab Content */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'template' | 'customers')}>
        {/* Template Form Tab */}
        <TabsContent value="template" className="mt-0">
          <div className="container max-w-2xl mx-auto px-4 py-6 space-y-6">
            {/* Template Name */}
            <div className="space-y-2">
              <Label htmlFor="name">{t('reminderTemplates.name')} *</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t('reminderTemplates.namePlaceholder')}
              />
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label htmlFor="description">{t('reminderTemplates.description')}</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={t('reminderTemplates.descriptionPlaceholder')}
                rows={2}
              />
            </div>

            {/* Reminder Schedule */}
            <div className="space-y-3">
              <Label>{t('reminders.schedule')}</Label>
              
              {items.map((item, index) => (
                <div key={index} className="flex items-center gap-3 p-4 border rounded-lg bg-card">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-muted-foreground mb-2">
                      {t('reminders.reminderNumber')} #{index + 1} {t('reminders.reminderNumberSms')}
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
                      {/* Months input */}
                      <div className="flex items-center gap-2">
                        <Input
                          type="number"
                          min={1}
                          max={120}
                          value={item.months}
                          onChange={(e) => updateItem(index, 'months', parseInt(e.target.value) || 1)}
                          className="w-20"
                        />
                        <span className="text-sm text-muted-foreground">{t('reminders.monthsAfter')}</span>
                      </div>
                      
                      {/* Service type dropdown */}
                      <Select
                        value={item.service_type}
                        onValueChange={(value) => updateItem(index, 'service_type', value)}
                      >
                        <SelectTrigger className="w-[180px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {SERVICE_TYPES.map((type) => (
                            <SelectItem key={type.value} value={type.value}>
                              {t(`offers.serviceTypes.${type.labelKey}`)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  
                  {items.length > 1 && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => removeItem(index)}
                      className="shrink-0 text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ))}

              <Button
                variant="outline"
                onClick={addItem}
                className="w-full gap-2 bg-white"
              >
                <Plus className="h-4 w-4" />
                {items.length > 0 ? t('reminders.addAnotherReminder') : t('reminders.addReminder')}
              </Button>
            </div>

            {/* SMS Template Preview (readonly for admin) */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                {t('reminders.smsTemplate')}
              </Label>
              <div className="p-3 bg-card rounded-lg border">
                <p className="text-sm text-muted-foreground mb-1">{t('reminders.smsExample')}:</p>
                <p className="text-sm font-mono">{getSmsExample()}</p>
              </div>
              <p className="text-xs text-muted-foreground">
                {t('reminders.smsTemplateReadonly')}
              </p>
            </div>
          </div>
        </TabsContent>

        {/* Assigned Customers Tab */}
        <TabsContent value="customers" className="mt-0">
          <div className="container max-w-2xl mx-auto px-4 py-6">
            <TemplateAssignedCustomers
              templateId={templateId}
              instanceId={instanceId}
            />
          </div>
        </TabsContent>
      </Tabs>

      {/* Sticky Footer Buttons - only show in template tab */}
      {activeTab === 'template' && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t p-4 z-20">
          <div className="container max-w-2xl mx-auto flex gap-3">
            <Button
              variant="outline"
              onClick={handleBack}
              className="flex-1"
              disabled={saving}
            >
              {t('common.cancel')}
            </Button>
            <Button
              onClick={handleSave}
              className="flex-1"
              disabled={saving}
            >
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {t('common.save')}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
