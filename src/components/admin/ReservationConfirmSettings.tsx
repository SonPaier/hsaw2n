import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Bell, Loader2 } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface ReservationConfirmSettingsProps {
  instanceId: string | null;
}

export const ReservationConfirmSettings = ({ instanceId }: ReservationConfirmSettingsProps) => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [autoConfirm, setAutoConfirm] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const fetchSettings = async () => {
      if (!instanceId) return;
      setLoading(true);
      
      const { data } = await supabase
        .from('instances')
        .select('auto_confirm_reservations')
        .eq('id', instanceId)
        .single();
      
      if (data) {
        setAutoConfirm(data.auto_confirm_reservations !== false);
      }
      setLoading(false);
    };

    fetchSettings();
  }, [instanceId]);

  const handleToggleAutoConfirm = async (checked: boolean) => {
    if (!instanceId) return;
    
    setSaving(true);
    setAutoConfirm(checked);

    const { error } = await supabase
      .from('instances')
      .update({ auto_confirm_reservations: checked })
      .eq('id', instanceId);

    if (error) {
      toast.error('Błąd podczas zapisywania ustawień');
      setAutoConfirm(!checked);
    } else {
      toast.success(checked ? 'Auto-potwierdzanie włączone' : 'Auto-potwierdzanie wyłączone');
    }
    
    setSaving(false);
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground">
        <Loader2 className="w-4 h-4 animate-spin" />
        Ładowanie...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Reservation Settings */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Bell className="w-5 h-5 text-primary" />
          <h3 className="font-semibold">Potwierdzanie rezerwacji</h3>
        </div>
        
        <div className="flex items-center justify-between p-4 rounded-lg border border-border bg-muted/30">
          <div className="space-y-1">
            <Label htmlFor="auto-confirm" className="font-medium">
              Automatyczne potwierdzanie
            </Label>
            <p className="text-sm text-muted-foreground">
              {autoConfirm 
                ? 'Rezerwacje klientów są automatycznie potwierdzane'
                : 'Każda rezerwacja wymaga ręcznego potwierdzenia'}
            </p>
          </div>
          <Switch
            id="auto-confirm"
            checked={autoConfirm}
            onCheckedChange={handleToggleAutoConfirm}
            disabled={saving}
          />
        </div>
      </div>
    </div>
  );
};