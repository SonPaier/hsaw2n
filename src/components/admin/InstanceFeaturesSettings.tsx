import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { FileText, Loader2, Sparkles, TrendingUp } from 'lucide-react';
import { toast } from 'sonner';

interface InstanceFeature {
  feature_key: string;
  enabled: boolean;
}

interface InstanceFeaturesSettingsProps {
  instanceId: string;
}

const AVAILABLE_FEATURES = [
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
];

export const InstanceFeaturesSettings = ({ instanceId }: InstanceFeaturesSettingsProps) => {
  const [features, setFeatures] = useState<InstanceFeature[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);

  useEffect(() => {
    fetchFeatures();
  }, [instanceId]);

  const fetchFeatures = async () => {
    try {
      const { data, error } = await supabase
        .from('instance_features')
        .select('feature_key, enabled')
        .eq('instance_id', instanceId);
      
      if (error) throw error;
      setFeatures(data || []);
    } catch (error) {
      console.error('Error fetching features:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleFeature = async (featureKey: string, currentEnabled: boolean) => {
    setSaving(featureKey);
    try {
      const { error } = await supabase
        .from('instance_features')
        .upsert({
          instance_id: instanceId,
          feature_key: featureKey,
          enabled: !currentEnabled,
        }, {
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
        return [...prev, { feature_key: featureKey, enabled: !currentEnabled }];
      });

      toast.success(`Funkcja ${!currentEnabled ? 'włączona' : 'wyłączona'}`);
    } catch (error) {
      console.error('Error toggling feature:', error);
      toast.error('Błąd podczas zmiany ustawienia');
    } finally {
      setSaving(null);
    }
  };

  const isFeatureEnabled = (featureKey: string) => {
    return features.find(f => f.feature_key === featureKey)?.enabled ?? false;
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
          Zarządzaj płatnymi funkcjami dla tej instancji
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
              className="flex items-center justify-between p-4 border rounded-lg"
            >
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
          );
        })}
      </CardContent>
    </Card>
  );
};
