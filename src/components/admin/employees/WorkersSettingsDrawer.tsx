import { useState, useEffect } from 'react';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { useWorkersSettings, useUpdateWorkersSettings } from '@/hooks/useWorkersSettings';
import { X, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface WorkersSettingsDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  instanceId: string | null;
}

const WorkersSettingsDrawer = ({
  open,
  onOpenChange,
  instanceId,
}: WorkersSettingsDrawerProps) => {
  const { data: settings, isLoading } = useWorkersSettings(instanceId);
  const updateSettings = useUpdateWorkersSettings(instanceId);

  const [startStopEnabled, setStartStopEnabled] = useState(true);
  const [overtimeEnabled, setOvertimeEnabled] = useState(false);
  const [standardHours, setStandardHours] = useState('8');
  const [reportFrequency, setReportFrequency] = useState<'monthly' | 'weekly'>('monthly');
  const [timeCalculationMode, setTimeCalculationMode] = useState<'start_to_stop' | 'opening_to_stop'>('start_to_stop');

  // Sync form state with fetched settings
  useEffect(() => {
    if (settings) {
      setStartStopEnabled(settings.start_stop_enabled ?? true);
      setOvertimeEnabled(settings.overtime_enabled ?? false);
      setStandardHours(settings.standard_hours_per_day?.toString() ?? '8');
      setReportFrequency(settings.report_frequency ?? 'monthly');
      setTimeCalculationMode(settings.time_calculation_mode ?? 'start_to_stop');
    }
  }, [settings]);

  const handleClose = () => {
    onOpenChange(false);
  };

  const handleSave = async () => {
    try {
      await updateSettings.mutateAsync({
        start_stop_enabled: startStopEnabled,
        overtime_enabled: overtimeEnabled,
        standard_hours_per_day: parseInt(standardHours) || 8,
        report_frequency: reportFrequency,
        time_calculation_mode: timeCalculationMode,
      });
      toast.success('Ustawienia zostały zapisane');
      handleClose();
    } catch (error) {
      console.error('Save error:', error);
      toast.error('Błąd podczas zapisywania ustawień');
    }
  };

  const saving = updateSettings.isPending;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-md p-0 flex flex-col" hideCloseButton>
        {/* Sticky header */}
        <div className="sticky top-0 z-10 bg-background border-b p-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Ustawienia czasu pracy</h2>
            <button 
              onClick={handleClose}
              className="p-2 rounded-full hover:bg-muted"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <>
              {/* Switch: Start/Stop */}
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <Label htmlFor="start-stop">Włączona rejestracja Start/Stop</Label>
                  <Switch 
                    id="start-stop"
                    checked={startStopEnabled} 
                    onCheckedChange={setStartStopEnabled} 
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  Pracownicy mogą samodzielnie rejestrować czas pracy
                </p>
              </div>

              {/* Time calculation mode - only when Start/Stop enabled */}
              {startStopEnabled && (
                <div className="space-y-3">
                  <Label>Jak liczyć czas?</Label>
                  <RadioGroup 
                    value={timeCalculationMode} 
                    onValueChange={(v) => setTimeCalculationMode(v as 'start_to_stop' | 'opening_to_stop')}
                  >
                    <div className="space-y-0.5">
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="start_to_stop" id="start-to-stop" />
                        <Label htmlFor="start-to-stop" className="font-normal cursor-pointer">
                          Od kliknięcia start do stop
                        </Label>
                      </div>
                      <p className="text-xs text-muted-foreground ml-6">
                        Liczy pełny czas od naciśnięcia przycisku
                      </p>
                    </div>
                    <div className="space-y-0.5">
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="opening_to_stop" id="opening-to-stop" />
                        <Label htmlFor="opening-to-stop" className="font-normal cursor-pointer">
                          Od otwarcia myjni do stop
                        </Label>
                      </div>
                      <p className="text-xs text-muted-foreground ml-6">
                        Ignoruje czas przed otwarciem salonu
                      </p>
                    </div>
                  </RadioGroup>
                </div>
              )}

              {/* Switch: Nadgodziny */}
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <Label htmlFor="overtime">Naliczanie nadgodzin</Label>
                  <Switch 
                    id="overtime"
                    checked={overtimeEnabled} 
                    onCheckedChange={setOvertimeEnabled} 
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  Automatycznie oznacza godziny ponad normę
                </p>
              </div>

              {/* Number: Norma dzienna - TYLKO gdy nadgodziny włączone */}
              {overtimeEnabled && (
                <div className="space-y-2">
                  <Label htmlFor="standard-hours">Norma dzienna (godziny)</Label>
                  <Input 
                    id="standard-hours"
                    type="number" 
                    min="1" 
                    max="24" 
                    value={standardHours} 
                    onChange={(e) => setStandardHours(e.target.value)}
                    className="w-24"
                  />
                </div>
              )}

              {/* RadioGroup: Okres rozliczeniowy */}
              <div className="space-y-3">
                <Label>Okres rozliczeniowy</Label>
                <RadioGroup 
                  value={reportFrequency} 
                  onValueChange={(v) => setReportFrequency(v as 'monthly' | 'weekly')}
                >
                  <div className="space-y-0.5">
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="monthly" id="monthly" />
                      <Label htmlFor="monthly" className="font-normal cursor-pointer">
                        Miesięcznie
                      </Label>
                    </div>
                    <p className="text-xs text-muted-foreground ml-6">
                      Podsumowanie raz w miesiącu
                    </p>
                  </div>
                  <div className="space-y-0.5">
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="weekly" id="weekly" />
                      <Label htmlFor="weekly" className="font-normal cursor-pointer">
                        Tygodniowo
                      </Label>
                    </div>
                    <p className="text-xs text-muted-foreground ml-6">
                      Podsumowanie co tydzień
                    </p>
                  </div>
                </RadioGroup>
              </div>
            </>
          )}
        </div>

        {/* Sticky white footer */}
        <div className="sticky bottom-0 bg-background border-t p-4 flex gap-3">
          <Button variant="outline" onClick={handleClose} className="flex-1 bg-white">
            Anuluj
          </Button>
          <Button onClick={handleSave} disabled={saving || isLoading} className="flex-1">
            {saving && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
            Zapisz
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default WorkersSettingsDrawer;
