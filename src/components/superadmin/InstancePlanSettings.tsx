import { useState, useEffect } from 'react';
import { Loader2, Minus, Plus, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Separator } from '@/components/ui/separator';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface SubscriptionPlan {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  base_price: number;
  price_per_station: number;
  sms_limit: number;
  included_features: string[];
  sort_order: number;
}

interface InstanceSubscription {
  id: string;
  plan_id: string;
  station_limit: number;
  monthly_price: number | null;
}

interface InstancePlanSettingsProps {
  instanceId: string;
  instanceName: string;
  onUpdate?: () => void;
}

const FEATURE_LABELS: Record<string, string> = {
  calendar: 'Główny kalendarz',
  online_booking: 'Rezerwacje online 24/7',
  sms_notifications: 'Powiadomienia SMS',
  customer_crm: 'Zarządzanie klientami',
  team_management: 'Zarządzanie zespołem',
  yard_vehicles: 'Obsługa aut z placu',
  employee_view: 'Widok dla pracowników',
  analytics: 'Analityka i raporty',
  offers: 'Moduł ofert',
  vehicle_reception_protocol: 'Protokół przyjęcia',
  followup: 'Wsparcie sprzedaży',
  reminders: 'Automatyczne przypomnienia',
};

export const InstancePlanSettings = ({ instanceId, instanceName, onUpdate }: InstancePlanSettingsProps) => {
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [subscription, setSubscription] = useState<InstanceSubscription | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  const [selectedPlanId, setSelectedPlanId] = useState<string>('');
  const [stationLimit, setStationLimit] = useState(1);

  useEffect(() => {
    fetchData();
  }, [instanceId]);

  const fetchData = async () => {
    try {
      // Fetch all active plans
      const { data: plansData, error: plansError } = await supabase
        .from('subscription_plans')
        .select('*')
        .eq('active', true)
        .order('sort_order');

      if (plansError) throw plansError;

      const mappedPlans: SubscriptionPlan[] = (plansData || []).map(p => ({
        ...p,
        included_features: Array.isArray(p.included_features) ? p.included_features as string[] : [],
      }));
      setPlans(mappedPlans);

      // Fetch current subscription
      const { data: subData, error: subError } = await supabase
        .from('instance_subscriptions')
        .select('*')
        .eq('instance_id', instanceId)
        .single();

      if (subError && subError.code !== 'PGRST116') {
        throw subError;
      }

      if (subData) {
        setSubscription(subData);
        setSelectedPlanId(subData.plan_id);
        setStationLimit(subData.station_limit);
      } else if (mappedPlans.length > 0) {
        // Default to first plan if no subscription exists
        setSelectedPlanId(mappedPlans[0].id);
        setStationLimit(1);
      }
    } catch (error) {
      console.error('Error fetching plan data:', error);
      toast.error('Błąd podczas ładowania danych planu');
    } finally {
      setLoading(false);
    }
  };

  const selectedPlan = plans.find(p => p.id === selectedPlanId);
  
  const calculateMonthlyPrice = () => {
    if (!selectedPlan) return 0;
    const extraStations = Math.max(0, stationLimit - 1);
    return selectedPlan.base_price + (extraStations * selectedPlan.price_per_station);
  };

  const handleSave = async () => {
    if (!selectedPlanId) {
      toast.error('Wybierz plan');
      return;
    }

    setSaving(true);
    try {
      const monthlyPrice = calculateMonthlyPrice();

      if (subscription) {
        // Update existing subscription
        const { error } = await supabase
          .from('instance_subscriptions')
          .update({
            plan_id: selectedPlanId,
            station_limit: stationLimit,
            monthly_price: monthlyPrice,
            updated_at: new Date().toISOString(),
          })
          .eq('id', subscription.id);

        if (error) throw error;
      } else {
        // Create new subscription
        const { error } = await supabase
          .from('instance_subscriptions')
          .insert({
            instance_id: instanceId,
            plan_id: selectedPlanId,
            station_limit: stationLimit,
            monthly_price: monthlyPrice,
          });

        if (error) throw error;
      }

      toast.success('Plan zapisany');
      onUpdate?.();
      fetchData();
    } catch (error) {
      console.error('Error saving subscription:', error);
      toast.error('Błąd podczas zapisywania planu');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Plan Selection */}
      <div className="space-y-3">
        <Label className="text-base font-medium">Wybierz plan</Label>
        <RadioGroup value={selectedPlanId} onValueChange={setSelectedPlanId}>
          <div className="grid gap-3">
            {plans.map((plan) => (
              <div
                key={plan.id}
                className={cn(
                  "relative flex items-start gap-4 p-4 border rounded-lg cursor-pointer transition-colors",
                  selectedPlanId === plan.id 
                    ? "border-primary bg-primary/5" 
                    : "border-border hover:border-primary/50"
                )}
                onClick={() => setSelectedPlanId(plan.id)}
              >
                <RadioGroupItem value={plan.id} id={plan.id} className="mt-1" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <Label htmlFor={plan.id} className="text-base font-semibold cursor-pointer">
                      {plan.name}
                    </Label>
                    <span className="text-lg font-bold text-primary">
                      {plan.base_price} zł
                      <span className="text-sm font-normal text-muted-foreground">/mies.</span>
                    </span>
                  </div>
                  {plan.description && (
                    <p className="text-sm text-muted-foreground mt-1">{plan.description}</p>
                  )}
                  <div className="flex flex-wrap gap-2 mt-3">
                    {plan.included_features.slice(0, 6).map((feature) => (
                      <span key={feature} className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                        <Check className="w-3 h-3 text-success" />
                        {FEATURE_LABELS[feature] || feature}
                      </span>
                    ))}
                    {plan.included_features.length > 6 && (
                      <span className="text-xs text-muted-foreground">
                        +{plan.included_features.length - 6} więcej
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </RadioGroup>
      </div>

      {/* Station Limit */}
      <div className="space-y-3">
        <Label className="text-base font-medium">Limit stanowisk</Label>
        <div className="flex items-center gap-4">
          <Button
            variant="outline"
            size="icon"
            onClick={() => setStationLimit(prev => Math.max(1, prev - 1))}
            disabled={stationLimit <= 1}
          >
            <Minus className="w-4 h-4" />
          </Button>
          <span className="text-2xl font-bold w-12 text-center">{stationLimit}</span>
          <Button
            variant="outline"
            size="icon"
            onClick={() => setStationLimit(prev => prev + 1)}
          >
            <Plus className="w-4 h-4" />
          </Button>
        </div>
        <p className="text-sm text-muted-foreground">
          Admin instancji nie będzie mógł dodać więcej niż {stationLimit} stanowisk
        </p>
      </div>

      <Separator />

      {/* Price Summary */}
      {selectedPlan && (
        <div className="space-y-2 p-4 bg-muted/30 rounded-lg">
          <h4 className="font-medium">Podsumowanie</h4>
          <div className="space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Plan bazowy ({selectedPlan.name})</span>
              <span>{selectedPlan.base_price} zł</span>
            </div>
            {stationLimit > 1 && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">
                  Dodatkowe stanowiska ({stationLimit - 1} × {selectedPlan.price_per_station} zł)
                </span>
                <span>+ {(stationLimit - 1) * selectedPlan.price_per_station} zł</span>
              </div>
            )}
            <Separator className="my-2" />
            <div className="flex justify-between font-semibold text-base">
              <span>Razem miesięcznie</span>
              <span className="text-primary">{calculateMonthlyPrice()} zł netto</span>
            </div>
          </div>
        </div>
      )}

      {/* Save Button */}
      <Button 
        onClick={handleSave} 
        disabled={saving || !selectedPlanId}
        className="w-full"
      >
        {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
        Zapisz zmiany
      </Button>
    </div>
  );
};
