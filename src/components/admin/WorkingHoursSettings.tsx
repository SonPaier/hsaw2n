import { useState, useEffect } from 'react';
import { Clock, Save, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface WorkingHoursSettingsProps {
  instanceId: string | null;
}

interface DayHours {
  open: string;
  close: string;
}

type WorkingHours = Record<string, DayHours | null>;

const DAYS = [
  { key: 'monday', label: 'Poniedziałek' },
  { key: 'tuesday', label: 'Wtorek' },
  { key: 'wednesday', label: 'Środa' },
  { key: 'thursday', label: 'Czwartek' },
  { key: 'friday', label: 'Piątek' },
  { key: 'saturday', label: 'Sobota' },
  { key: 'sunday', label: 'Niedziela' },
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

const WorkingHoursSettings = ({ instanceId }: WorkingHoursSettingsProps) => {
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
      toast.success('Godziny pracy zostały zapisane');
    } catch (error) {
      console.error('Error saving working hours:', error);
      toast.error('Błąd podczas zapisywania godzin pracy');
    } finally {
      setSaving(false);
    }
  };

  if (!instanceId) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        Brak przypisanej instancji
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
          <h3 className="text-lg font-semibold">Godziny pracy</h3>
        </div>
        <Button onClick={handleSave} disabled={saving} size="sm">
          {saving ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <Save className="w-4 h-4 mr-2" />
          )}
          Zapisz
        </Button>
      </div>

      <div className="space-y-3">
        {DAYS.map(({ key, label }) => {
          const dayHours = workingHours[key];
          const isOpen = dayHours !== null;

          return (
            <div
              key={key}
              className="flex items-center gap-4 p-3 rounded-lg bg-muted/30 border border-border/50"
            >
              <div className="flex items-center gap-3 w-36">
                <Switch
                  checked={isOpen}
                  onCheckedChange={(checked) => handleDayToggle(key, checked)}
                />
                <Label className="font-medium">{label}</Label>
              </div>

              {isOpen ? (
                <div className="flex items-center gap-2 flex-1">
                  <Input
                    type="time"
                    value={dayHours?.open || '09:00'}
                    onChange={(e) => handleTimeChange(key, 'open', e.target.value)}
                    className="w-28"
                  />
                  <span className="text-muted-foreground">-</span>
                  <Input
                    type="time"
                    value={dayHours?.close || '19:00'}
                    onChange={(e) => handleTimeChange(key, 'close', e.target.value)}
                    className="w-28"
                  />
                </div>
              ) : (
                <span className="text-muted-foreground text-sm">Zamknięte</span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default WorkingHoursSettings;
