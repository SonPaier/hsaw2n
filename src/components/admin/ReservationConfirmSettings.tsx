import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Bell, Loader2, Clock, Smartphone, Check, Users } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { usePushSubscription } from '@/hooks/usePushSubscription';
import { useInstanceSettings, useUpdateInstanceSettings } from '@/hooks/useInstanceSettings';

interface ReservationConfirmSettingsProps {
  instanceId: string | null;
}

export const ReservationConfirmSettings = ({ instanceId }: ReservationConfirmSettingsProps) => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [autoConfirm, setAutoConfirm] = useState(true);
  const [customerEditCutoffHours, setCustomerEditCutoffHours] = useState(1);
  const [saving, setSaving] = useState(false);

  // Employee assignment settings
  const { data: instanceSettings, isLoading: isSettingsLoading } = useInstanceSettings(instanceId);
  const { updateSetting } = useUpdateInstanceSettings(instanceId);
  const [savingEmployeeSettings, setSavingEmployeeSettings] = useState(false);

  // Push notification subscription
  const {
    isSubscribed,
    isLoading: isPushLoading,
    subscribe,
    checkSubscription,
    isSupported: isPushSupported
  } = usePushSubscription(instanceId);

  useEffect(() => {
    const fetchSettings = async () => {
      if (!instanceId) return;
      setLoading(true);

      const { data } = await supabase.
      from('instances').
      select('auto_confirm_reservations, customer_edit_cutoff_hours').
      eq('id', instanceId).
      single();

      if (data) {
        setAutoConfirm(data.auto_confirm_reservations !== false);
        setCustomerEditCutoffHours(data.customer_edit_cutoff_hours ?? 1);
      }
      setLoading(false);
    };

    fetchSettings();
    checkSubscription();
  }, [instanceId, checkSubscription]);

  const handleToggleEmployeeSetting = async (key: 'assign_employees_to_stations' | 'assign_employees_to_reservations', checked: boolean) => {
    setSavingEmployeeSettings(true);
    try {
      await updateSetting(key, checked);
      toast.success('Ustawienia zapisane');
    } catch (error) {
      toast.error('Błąd podczas zapisywania ustawień');
    } finally {
      setSavingEmployeeSettings(false);
    }
  };

  const handleToggleAutoConfirm = async (checked: boolean) => {
    if (!instanceId) return;

    setSaving(true);
    setAutoConfirm(checked);

    const { error } = await supabase.
    from('instances').
    update({ auto_confirm_reservations: checked }).
    eq('id', instanceId);

    if (error) {
      toast.error('Błąd podczas zapisywania ustawień');
      setAutoConfirm(!checked);
    } else {
      toast.success(checked ? 'Auto-potwierdzanie włączone' : 'Auto-potwierdzanie wyłączone');
    }

    setSaving(false);
  };

  const handleCutoffHoursChange = async (value: number) => {
    if (!instanceId) return;

    setSaving(true);
    setCustomerEditCutoffHours(value);

    const { error } = await supabase.
    from('instances').
    update({ customer_edit_cutoff_hours: value }).
    eq('id', instanceId);

    if (error) {
      toast.error('Błąd podczas zapisywania ustawień');
    } else {
      toast.success('Ustawienia zapisane');
    }

    setSaving(false);
  };

  const handleEnablePush = async () => {
    const result = await subscribe();
    if (result.success) {
      toast.success(t('pushNotifications.enabled'));
    } else if (result.error) {
      toast.error(result.error);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground">
        <Loader2 className="w-4 h-4 animate-spin" />
        Ładowanie...
      </div>);

  }

  return (
    <div className="space-y-6 pb-24 md:pb-0">
      {/* Reservation Confirmation Settings - moved up */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Bell className="w-5 h-5 text-primary" />
          <h3 className="font-semibold">Potwierdzanie rezerwacji</h3>
        </div>
        
        <div className="p-4 rounded-lg border-border space-y-3 bg-white border-0">
          <div className="space-y-1">
            <Label htmlFor="auto-confirm" className="font-medium">
              Automatyczne potwierdzanie
            </Label>
            <p className="text-sm text-muted-foreground">
              {autoConfirm ?
              'Rezerwacje klientów są automatycznie potwierdzane' :
              'Przy wyłączonym automatycznym potwierdzaniu, każda rezerwacja wymaga ręcznego potwierdzenia'}
            </p>
          </div>
          <Switch
            id="auto-confirm"
            checked={autoConfirm}
            onCheckedChange={handleToggleAutoConfirm}
            disabled={saving} />

        </div>
      </div>

      {/* Customer Edit Cutoff Settings */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Clock className="w-5 h-5 text-primary" />
          <h3 className="font-semibold">Edycja przez klienta</h3>
        </div>
        
        <div className="p-4 rounded-lg border-border bg-white border-0">
          <div className="space-y-3">
            <Label htmlFor="cutoff-hours" className="font-medium">
              Limit edycji rezerwacji
            </Label>
            <p className="text-sm text-muted-foreground">
              Klient może zmienić lub anulować rezerwację do X godzin przed wizytą
            </p>
            <div className="flex items-center gap-3">
              <Input
                id="cutoff-hours"
                type="number"
                min={0}
                max={48}
                value={customerEditCutoffHours}
                onChange={(e) => handleCutoffHoursChange(parseInt(e.target.value) || 0)}
                className="w-20"
                disabled={saving} />

              <span className="text-sm text-muted-foreground">godzin przed wizytą</span>
            </div>
          </div>
        </div>
      </div>

      {/* Employee Assignment Settings */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Users className="w-5 h-5 text-primary" />
          <h3 className="font-semibold">Przypisywanie pracowników</h3>
        </div>
        
        <div className="p-4 rounded-lg border-border space-y-4 bg-white border-0">
          <div className="flex items-center justify-between gap-4">
            <div className="space-y-1">
              <Label htmlFor="assign-stations" className="font-medium">
                Przypisanie do stanowisk
              </Label>
              <p className="text-sm text-muted-foreground">
                Pozwala przypisać pracowników do konkretnych stanowisk
              </p>
            </div>
            <Switch
              id="assign-stations"
              checked={instanceSettings?.assign_employees_to_stations ?? false}
              onCheckedChange={(checked) => handleToggleEmployeeSetting('assign_employees_to_stations', checked)}
              disabled={savingEmployeeSettings || isSettingsLoading} />

          </div>
          
          <div className="flex items-center justify-between gap-4">
            <div className="space-y-1">
              <Label htmlFor="assign-reservations" className="font-medium">
                Przypisanie do rezerwacji
              </Label>
              <p className="text-sm text-muted-foreground">
                Pozwala przypisać pracowników wykonujących usługę do rezerwacji
              </p>
            </div>
            <Switch
              id="assign-reservations"
              checked={instanceSettings?.assign_employees_to_reservations ?? false}
              onCheckedChange={(checked) => handleToggleEmployeeSetting('assign_employees_to_reservations', checked)}
              disabled={savingEmployeeSettings || isSettingsLoading} />

          </div>
        </div>
      </div>

      {/* Push Notifications Section - moved to bottom */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Smartphone className="w-5 h-5 text-primary" />
          <h3 className="font-semibold">Powiadomienia push</h3>
        </div>
        
        {!isPushSupported ?
        <div className="p-4 rounded-lg border border-border bg-muted/30 space-y-2">
            <p className="text-sm text-muted-foreground font-medium">
              Powiadomienia push nie są wspierane
            </p>
            <div className="text-sm text-muted-foreground space-y-1">
              <p><strong>iPhone:</strong> Otwórz w Safari → Dodaj do ekranu głównego → Otwórz zainstalowaną aplikację</p>
              <p><strong>Android:</strong> Chrome/Edge → Zainstaluj aplikację</p>
            </div>
            <p className="text-xs text-muted-foreground/60 mt-2">
              Chrome na iOS nie wspiera push (ograniczenie Apple)
            </p>
          </div> :

        <div className="p-4 rounded-lg border-border space-y-3 bg-white border-0">
            <div className="space-y-1">
              <Label className="font-medium">
                Powiadomienia na tym urządzeniu
              </Label>
              <p className="text-sm text-muted-foreground">
                {isSubscribed ?
              'Otrzymasz powiadomienia o nowych rezerwacjach' :
              'Włącz, aby otrzymywać powiadomienia o nowych rezerwacjach'}
              </p>
            </div>
            {isSubscribed ?
          <div className="flex items-center gap-2 text-emerald-600">
                <Check className="w-5 h-5" />
                <span className="text-sm font-medium">{t('pushNotifications.enabled')}</span>
              </div> :

          <Button
            onClick={handleEnablePush}
            disabled={isPushLoading}
            size="sm">

                {isPushLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                {t('pushNotifications.enable')}
              </Button>
          }
          </div>
        }
      </div>
    </div>);

};