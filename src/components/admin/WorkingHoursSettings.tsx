import { useState, useEffect } from 'react';
import { Clock, Save, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';

interface WorkingHoursSettingsProps {
  instanceId: string | null;
  onSave?: () => void;
}

interface DayHours {
  open: string;
  close: string;
}

type WorkingHours = Record<string, DayHours | null>;

const DAYS = [
  { key: 'monday', labelKey: 'workingHours.monday' },
  { key: 'tuesday', labelKey: 'workingHours.tuesday' },
  { key: 'wednesday', labelKey: 'workingHours.wednesday' },
  { key: 'thursday', labelKey: 'workingHours.thursday' },
  { key: 'friday', labelKey: 'workingHours.friday' },
  { key: 'saturday', labelKey: 'workingHours.saturday' },
  { key: 'sunday', labelKey: 'workingHours.sunday' },
];

const DEFAULT_HOURS: WorkingHours = {
  monday: { open: '09:00', close: '19:00' },
  tuesday: { open: '09:00', close: '19:00' },
  wednesday: { open: '09:00', close: '19:00' },
  thursday: { open: '09:00', close: '19:00' },
  friday: { open: '09:00', close: '19:00' },
  saturday: { open: '09:00', close: '14:00' },
  sunday: null,
};

const WorkingHoursSettings = ({ instanceId, onSave }: WorkingHoursSettingsProps) => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [workingHours, setWorkingHours] = useState<WorkingHours>(DEFAULT_HOURS);

  useEffect(() => {
    const fetchWorkingHours = async () => {
      if (!instanceId) return;

      setLoading(true);
      const { data, error } = await supabase
        .from('instances')
        .select('working_hours')
        .eq('id', instanceId)
        .maybeSingle();

      if (data?.working_hours) {
        setWorkingHours(data.working_hours as unknown as WorkingHours);
      }
      setLoading(false);
    };

    fetchWorkingHours();
  }, [instanceId]);

  const handleDayToggle = (dayKey: string, enabled: boolean) => {
    setWorkingHours(prev => ({
      ...prev,
      [dayKey]: enabled ? { open: '09:00', close: '19:00' } : null,
    }));
  };

  const handleTimeChange = (dayKey: string, field: 'open' | 'close', value: string) => {
    setWorkingHours(prev => {
      const currentDay = prev[dayKey];
      if (!currentDay) return prev;
      return {
        ...prev,
        [dayKey]: { ...currentDay, [field]: value },
      };
    });
  };

  const handleSave = async () => {
    if (!instanceId) return;

    setSaving(true);
    try {
      console.log('[WorkingHoursSettings] Saving working hours via RPC:', workingHours);
      
      const { data, error } = await supabase.rpc('update_instance_working_hours', {
        _instance_id: instanceId,
        _working_hours: JSON.parse(JSON.stringify(workingHours))
      });

      console.log('[WorkingHoursSettings] RPC response:', { data, error });

      if (error) throw error;
      toast.success(t('workingHours.saved'));
      onSave?.();
    } catch (error) {
      console.error('Error saving working hours:', error);
      toast.error(t('workingHours.saveError'));
    } finally {
      setSaving(false);
    }
  };

  if (!instanceId) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        {t('workingHours.noInstance')}
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Clock className="w-5 h-5 text-primary" />
          <h3 className="text-lg font-semibold">{t('workingHours.title')}</h3>
        </div>
        <Button onClick={handleSave} disabled={saving} size="sm">
          {saving ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <Save className="w-4 h-4 mr-2" />
          )}
          {t('common.save')}
        </Button>
      </div>

      <div className="space-y-3">
        {DAYS.map(({ key, labelKey }) => {
          const dayHours = workingHours[key];
          const isOpen = dayHours !== null;

          return (
            <div
              key={key}
              className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 p-3 rounded-lg bg-muted/30 border border-border/50"
            >
              <div className="flex items-center justify-between sm:justify-start gap-3 sm:w-36">
                <div className="flex items-center gap-3">
                  <Switch
                    checked={isOpen}
                    onCheckedChange={(checked) => handleDayToggle(key, checked)}
                  />
                  <Label className="font-medium text-sm sm:text-base">{t(labelKey)}</Label>
                </div>
                {!isOpen && (
                  <span className="text-muted-foreground text-xs sm:hidden">{t('workingHours.closed')}</span>
                )}
              </div>

              {isOpen ? (
                <div className="flex items-center gap-2 flex-1 pl-10 sm:pl-0">
                  <Input
                    type="time"
                    value={dayHours?.open || '09:00'}
                    onChange={(e) => handleTimeChange(key, 'open', e.target.value)}
                    className="flex-1 sm:w-24 sm:flex-none text-sm"
                  />
                  <span className="text-muted-foreground">-</span>
                  <Input
                    type="time"
                    value={dayHours?.close || '19:00'}
                    onChange={(e) => handleTimeChange(key, 'close', e.target.value)}
                    className="flex-1 sm:w-24 sm:flex-none text-sm"
                  />
                </div>
              ) : (
                <span className="text-muted-foreground text-sm hidden sm:inline">{t('workingHours.closed')}</span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default WorkingHoursSettings;
