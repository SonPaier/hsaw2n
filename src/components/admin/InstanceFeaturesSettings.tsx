import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Building2, ClipboardCheck, FileText, Link2, TrendingUp } from 'lucide-react';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface InstanceFeature {
  feature_key: string;
  enabled: boolean;
  parameters: Record<string, unknown> | null;
}

interface InstanceFeaturesSettingsProps {
  instanceId: string;
}

interface FeatureDefinition {
  key: string;
  name: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  isPaid: boolean;
  hasParameters?: boolean;
  parameterLabel?: string;
  parameterDescription?: string;
  parameterPlaceholder?: string;
}

const AVAILABLE_FEATURES: FeatureDefinition[] = [
  {
    key: 'offers',
    name: 'Moduł Oferty',
    description: 'Generator ofert z PDF i wysyłką do klienta',
    icon: FileText,
    isPaid: true,
  },
  {
    key: 'upsell',
    name: 'Sugestie upsell',
    description: 'Sugeruje usługi pasujące do wolnych slotów przy rezerwacji klienta',
    icon: TrendingUp,
    isPaid: false,
  },
  {
    key: 'sms_edit_link',
    name: 'Link do edycji w SMS',
    description: 'Dodaje frazę "Zmień lub anuluj: [link]" do wiadomości SMS',
    icon: Link2,
    isPaid: false,
    hasParameters: true,
    parameterLabel: 'Numery telefonów (opcjonalne)',
    parameterDescription: 'Wpisz numery telefonów (po przecinku), które otrzymają link. Puste = wszyscy.',
    parameterPlaceholder: '+48501234567, +48600111222',
  },
  {
    key: 'hall_view',
    name: 'Widok Hali',
    description: 'Uproszczony widok kalendarza dla pracowników hali z konfigurowalnymi stanowiskami',
    icon: Building2,
    isPaid: false,
  },
  {
    key: 'vehicle_reception_protocol',
    name: 'Protokół przyjęcia pojazdu',
    description: 'Formularz do dokumentowania stanu pojazdu przy przyjęciu z zaznaczaniem uszkodzeń na diagramie',
    icon: ClipboardCheck,
    isPaid: true,
  },
];

export const InstanceFeaturesSettings = ({ instanceId }: InstanceFeaturesSettingsProps) => {
  const [features, setFeatures] = useState<InstanceFeature[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [parameterInputs, setParameterInputs] = useState<Record<string, string>>({});

  useEffect(() => {
    fetchFeatures();
  }, [instanceId]);

  const fetchFeatures = async () => {
    try {
      const { data, error } = await supabase
        .from('instance_features')
        .select('feature_key, enabled, parameters')
        .eq('instance_id', instanceId);
      
      if (error) throw error;
      
      const mappedFeatures: InstanceFeature[] = (data || []).map(f => ({
        feature_key: f.feature_key,
        enabled: f.enabled,
        parameters: f.parameters as Record<string, unknown> | null,
      }));
      
      setFeatures(mappedFeatures);
      
      // Initialize parameter inputs from existing data
      const inputs: Record<string, string> = {};
      for (const f of mappedFeatures) {
        if (f.parameters && typeof f.parameters === 'object' && 'phones' in f.parameters) {
          inputs[f.feature_key] = (f.parameters.phones as string[]).join(', ');
        }
      }
      setParameterInputs(inputs);
    } catch (error) {
      console.error('Error fetching features:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleFeature = async (featureKey: string, currentEnabled: boolean) => {
    setSaving(featureKey);
    try {
      const currentFeature = features.find(f => f.feature_key === featureKey);
      const { error } = await supabase
        .from('instance_features')
        .upsert({
          instance_id: instanceId,
          feature_key: featureKey,
          enabled: !currentEnabled,
          parameters: currentFeature?.parameters || null,
        } as any, {
          onConflict: 'instance_id,feature_key',
        });
      
      if (error) throw error;

      setFeatures(prev => {
        const existing = prev.find(f => f.feature_key === featureKey);
        if (existing) {
          return prev.map(f => 
            f.feature_key === featureKey ? { ...f, enabled: !currentEnabled } : f
          );
        }
        return [...prev, { feature_key: featureKey, enabled: !currentEnabled, parameters: null }];
      });

      toast.success(`Funkcja ${!currentEnabled ? 'włączona' : 'wyłączona'}`);
    } catch (error) {
      console.error('Error toggling feature:', error);
      toast.error('Błąd podczas zmiany ustawienia');
    } finally {
      setSaving(null);
    }
  };

  const saveParameters = async (featureKey: string) => {
    setSaving(featureKey);
    try {
      const inputValue = parameterInputs[featureKey] || '';
      const phones = inputValue
        .split(',')
        .map(p => p.trim())
        .filter(p => p.length > 0);
      
      const parameters = phones.length > 0 ? { phones } : null;
      
      const currentFeature = features.find(f => f.feature_key === featureKey);
      const { error } = await supabase
        .from('instance_features')
        .upsert({
          instance_id: instanceId,
          feature_key: featureKey,
          enabled: currentFeature?.enabled ?? false,
          parameters,
        } as any, {
          onConflict: 'instance_id,feature_key',
        });
      
      if (error) throw error;

      setFeatures(prev => {
        const existing = prev.find(f => f.feature_key === featureKey);
        if (existing) {
          return prev.map(f => 
            f.feature_key === featureKey ? { ...f, parameters } : f
          );
        }
        return [...prev, { feature_key: featureKey, enabled: false, parameters }];
      });

      toast.success('Parametry zapisane');
    } catch (error) {
      console.error('Error saving parameters:', error);
      toast.error('Błąd podczas zapisu parametrów');
    } finally {
      setSaving(null);
    }
  };

  const isFeatureEnabled = (featureKey: string) => {
    return features.find(f => f.feature_key === featureKey)?.enabled ?? false;
  };

  const getFeatureParameters = (featureKey: string) => {
    return features.find(f => f.feature_key === featureKey)?.parameters || null;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-4">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Funkcje dodatkowe</CardTitle>
        <CardDescription>
          Zarządzaj funkcjami dla tej instancji
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {AVAILABLE_FEATURES.map((feature) => {
          const Icon = feature.icon;
          const isEnabled = isFeatureEnabled(feature.key);
          const isSaving = saving === feature.key;

          return (
            <div 
              key={feature.key}
              className="p-4 border rounded-lg space-y-3"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Icon className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <Label className="font-medium">{feature.name}</Label>
                      {feature.isPaid && (
                        <Badge variant="secondary" className="text-xs">Płatne</Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">{feature.description}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {isSaving && <Loader2 className="w-4 h-4 animate-spin" />}
                  <Switch
                    checked={isEnabled}
                    onCheckedChange={() => toggleFeature(feature.key, isEnabled)}
                    disabled={isSaving}
                  />
                </div>
              </div>
              
              {feature.hasParameters && isEnabled && (
                <div className="ml-14 space-y-2">
                  <div className="flex items-center gap-2">
                    <Input
                      value={parameterInputs[feature.key] || ''}
                      onChange={(e) => setParameterInputs(prev => ({
                        ...prev,
                        [feature.key]: e.target.value
                      }))}
                      placeholder={feature.parameterPlaceholder}
                      className="flex-1"
                      onBlur={() => saveParameters(feature.key)}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {feature.parameterDescription}
                  </p>
                </div>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
};
