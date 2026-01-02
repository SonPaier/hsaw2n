import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Loader2, Save, MessageSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { SmsUsageCard } from './SmsUsageCard';

interface SmsMessageSettingsProps {
  instanceId: string | null;
  instanceName?: string;
}

type SmsMessageType = 'verification_code' | 'reservation_confirmed' | 'reminder_1day' | 'reminder_1hour' | 'vehicle_ready';

interface MessageSetting {
  type: SmsMessageType;
  enabled: boolean;
}

const SMS_MESSAGE_TYPES: SmsMessageType[] = [
  'verification_code',
  'reservation_confirmed', 
  'reminder_1day',
  'reminder_1hour',
  'vehicle_ready'
];

const SmsMessageSettings = ({ instanceId, instanceName }: SmsMessageSettingsProps) => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<MessageSetting[]>([]);
  const [currentInstanceName, setCurrentInstanceName] = useState(instanceName || '');

  useEffect(() => {
    if (instanceId) {
      fetchSettings();
      if (!instanceName) {
        fetchInstanceName();
      }
    }
  }, [instanceId, instanceName]);

  const fetchInstanceName = async () => {
    if (!instanceId) return;
    
    const { data } = await supabase
      .from('instances')
      .select('name')
      .eq('id', instanceId)
      .single();
    
    if (data) {
      setCurrentInstanceName(data.name);
    }
  };

  const fetchSettings = async () => {
    if (!instanceId) return;
    
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('sms_message_settings')
        .select('message_type, enabled')
        .eq('instance_id', instanceId);

      if (error) throw error;

      // Create settings with defaults for missing types
      const existingSettings = new Map(data?.map(s => [s.message_type, s.enabled]) || []);
      
      const allSettings: MessageSetting[] = SMS_MESSAGE_TYPES.map(type => ({
        type,
        enabled: existingSettings.has(type) ? existingSettings.get(type)! : true
      }));

      setSettings(allSettings);
    } catch (error) {
      console.error('Error fetching SMS settings:', error);
      // Set defaults
      setSettings(SMS_MESSAGE_TYPES.map(type => ({ type, enabled: true })));
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = (type: SmsMessageType, enabled: boolean) => {
    setSettings(prev => 
      prev.map(s => s.type === type ? { ...s, enabled } : s)
    );
  };

  const handleSave = async () => {
    if (!instanceId) return;

    setSaving(true);
    try {
      // Upsert all settings
      for (const setting of settings) {
        const { error } = await supabase
          .from('sms_message_settings')
          .upsert({
            instance_id: instanceId,
            message_type: setting.type,
            enabled: setting.enabled
          }, {
            onConflict: 'instance_id,message_type'
          });

        if (error) throw error;
      }

      toast.success(t('settings.saved'));
    } catch (error) {
      console.error('Error saving SMS settings:', error);
      toast.error(t('settings.saveError'));
    } finally {
      setSaving(false);
    }
  };

  const getMessageTypeLabel = (type: SmsMessageType): string => {
    return t(`sms.messageTypes.${type}.label`);
  };

  const getMessageTypeDescription = (type: SmsMessageType): string => {
    return t(`sms.messageTypes.${type}.description`);
  };

  const getExampleMessage = (type: SmsMessageType): string => {
    const template = t(`sms.messageTypes.${type}.exampleTemplate`);
    return template.replace('{{instanceName}}', currentInstanceName || 'Nazwa myjni');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* SMS Usage */}
      {instanceId && <SmsUsageCard instanceId={instanceId} />}

      {/* Message Type Settings */}
      <div className="space-y-4">
        <div>
          <h3 className="text-lg font-medium">{t('sms.messageSettings')}</h3>
          <p className="text-sm text-muted-foreground">{t('sms.messageSettingsDescription')}</p>
        </div>

        {settings.map((setting) => (
          <Card key={setting.type} className="bg-white">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <CardTitle className="text-base font-medium">
                    {getMessageTypeLabel(setting.type)}
                  </CardTitle>
                  <CardDescription>
                    {getMessageTypeDescription(setting.type)}
                  </CardDescription>
                </div>
                <Switch
                  checked={setting.enabled}
                  onCheckedChange={(checked) => handleToggle(setting.type, checked)}
                />
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="bg-slate-100 rounded-lg p-3 border border-slate-200">
                <div className="flex items-start gap-2">
                  <MessageSquare className="w-4 h-4 mt-0.5 text-slate-500 shrink-0" />
                  <div className="space-y-1">
                    <Label className="text-xs text-slate-500 font-medium">
                      {t('sms.exampleMessage')}
                    </Label>
                    <p className="text-sm text-slate-900 font-mono whitespace-pre-wrap">
                      {getExampleMessage(setting.type)}
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Save Button */}
      <Button onClick={handleSave} disabled={saving} className="w-full">
        {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
        {t('common.save')}
      </Button>
    </div>
  );
};

export default SmsMessageSettings;