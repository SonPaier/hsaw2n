import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Loader2, Save, MessageSquare, Clock, History } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { SmsUsageCard } from './SmsUsageCard';

interface SmsLogEntry {
  phone: string;
  message: string;
  created_at: string;
  message_type: string;
  status: string;
}

interface SmsMessageSettingsProps {
  instanceId: string | null;
  instanceName?: string;
}

type SmsMessageType = 'verification_code' | 'reservation_confirmed' | 'reservation_pending' | 'reservation_confirmed_by_admin' | 'reservation_edited' | 'reminder_1day' | 'reminder_1hour' | 'vehicle_ready';

interface MessageSetting {
  type: SmsMessageType;
  enabled: boolean;
  sendAtTime?: string | null; // For reminder_1day - time like "19:00"
}

const SMS_MESSAGE_TYPES: SmsMessageType[] = [
  'verification_code',
  'reservation_confirmed',
  'reservation_pending',
  'reservation_confirmed_by_admin',
  'reservation_edited',
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
  const [currentReservationPhone, setCurrentReservationPhone] = useState('');
  const [showHistory, setShowHistory] = useState(false);
  const [smsLogs, setSmsLogs] = useState<SmsLogEntry[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);

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
      .select('name, short_name, phone, reservation_phone')
      .eq('id', instanceId)
      .single();
    
    if (data) {
      // Prefer short_name for SMS examples
      setCurrentInstanceName(data.short_name || data.name);
      // Prefer reservation_phone for SMS examples
      setCurrentReservationPhone(data.reservation_phone || data.phone || '');
    }
  };

  const fetchSettings = async () => {
    if (!instanceId) return;
    
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('sms_message_settings')
        .select('message_type, enabled, send_at_time')
        .eq('instance_id', instanceId);

      if (error) throw error;

      // Create settings with defaults for missing types
      const existingSettings = new Map(
        data?.map(s => [s.message_type, { enabled: s.enabled, sendAtTime: s.send_at_time }]) || []
      );
      
      const allSettings: MessageSetting[] = SMS_MESSAGE_TYPES.map(type => ({
        type,
        enabled: existingSettings.has(type) ? existingSettings.get(type)!.enabled : true,
        sendAtTime: existingSettings.has(type) ? existingSettings.get(type)!.sendAtTime : (type === 'reminder_1day' ? '19:00' : null)
      }));

      setSettings(allSettings);
    } catch (error) {
      console.error('Error fetching SMS settings:', error);
      // Set defaults
      setSettings(SMS_MESSAGE_TYPES.map(type => ({ 
        type, 
        enabled: true,
        sendAtTime: type === 'reminder_1day' ? '19:00' : null
      })));
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = (type: SmsMessageType, enabled: boolean) => {
    setSettings(prev => 
      prev.map(s => s.type === type ? { ...s, enabled } : s)
    );
  };

  const handleTimeChange = (type: SmsMessageType, time: string) => {
    setSettings(prev => 
      prev.map(s => s.type === type ? { ...s, sendAtTime: time } : s)
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
            enabled: setting.enabled,
            send_at_time: setting.sendAtTime || null
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

  const fetchSmsLogs = async () => {
    if (!instanceId) return;
    
    setLoadingLogs(true);
    try {
      const { data, error } = await supabase
        .from('sms_logs')
        .select('phone, message, created_at, message_type, status')
        .eq('instance_id', instanceId)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      setSmsLogs(data || []);
    } catch (error) {
      console.error('Error fetching SMS logs:', error);
      toast.error('Błąd pobierania historii SMS');
    } finally {
      setLoadingLogs(false);
    }
  };

  const handleShowHistory = () => {
    if (!showHistory) {
      fetchSmsLogs();
    }
    setShowHistory(!showHistory);
  };

  const getMessageTypeLabel = (type: SmsMessageType): string => {
    return t(`sms.messageTypes.${type}.label`);
  };

  const getMessageTypeDescription = (type: SmsMessageType): string => {
    return t(`sms.messageTypes.${type}.description`);
  };

  const getExampleMessage = (type: SmsMessageType): string => {
    const template = t(`sms.messageTypes.${type}.exampleTemplate`);
    // Remove spaces from phone number for SMS
    const phoneWithoutSpaces = (currentReservationPhone || '+48123456789').replace(/\s/g, '');
    return template
      .replace('{{instanceName}}', currentInstanceName || 'Nazwa myjni')
      .replace('{{reservationPhone}}', phoneWithoutSpaces);
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

      {/* SMS History Button */}
      <Button 
        variant="outline" 
        onClick={handleShowHistory}
        className="w-full"
      >
        {loadingLogs ? (
          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
        ) : (
          <History className="w-4 h-4 mr-2" />
        )}
        {showHistory ? 'Ukryj historię' : 'Zobacz historię'}
      </Button>

      {/* SMS History Log */}
      {showHistory && (
        <Card className="bg-slate-50">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Historia SMS (ostatnie 50)</CardTitle>
          </CardHeader>
          <CardContent>
            {smsLogs.length === 0 ? (
              <p className="text-sm text-muted-foreground">Brak wiadomości SMS</p>
            ) : (
              <pre className="text-xs bg-slate-900 text-slate-100 p-4 rounded-lg overflow-auto max-h-96">
{JSON.stringify(smsLogs.map(log => ({
  phone: log.phone,
  date: new Date(log.created_at).toLocaleString('pl-PL'),
  type: log.message_type,
  status: log.status,
  message: log.message
})), null, 2)}
              </pre>
            )}
          </CardContent>
        </Card>
      )}
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
            <CardContent className="pt-0 space-y-3">
              {/* Time picker for 1-day reminder */}
              {setting.type === 'reminder_1day' && setting.enabled && (
                <div className="flex items-center gap-3 p-3 bg-blue-50 rounded-lg border border-blue-200">
                  <Clock className="w-4 h-4 text-blue-600 shrink-0" />
                  <div className="flex-1">
                    <Label className="text-sm font-medium text-blue-900">
                      {t('sms.sendAtTime')}
                    </Label>
                    <p className="text-xs text-blue-700 mt-0.5">
                      {t('sms.sendAtTimeDescription')}
                    </p>
                  </div>
                  <Input
                    type="time"
                    value={setting.sendAtTime || '19:00'}
                    onChange={(e) => handleTimeChange(setting.type, e.target.value)}
                    className="w-24 bg-white"
                  />
                </div>
              )}
              
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