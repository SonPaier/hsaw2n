import { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, Loader2, Save, Droplets, Shield } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface Station {
  id: string;
  name: string;
  type: 'washing' | 'ppf' | 'detailing' | 'universal';
  active: boolean | null;
  sort_order: number | null;
}

interface StationsSettingsProps {
  instanceId: string | null;
}

interface SubscriptionData {
  station_limit: number;
  subscription_plans: {
    name: string;
  } | null;
}

const useStationTypeConfig = () => {
  const { t } = useTranslation();
  
  return {
    washing: {
      label: t('stationsSettings.typeWashing'),
      icon: Droplets,
      description: t('stationsSettings.typeWashingDesc'),
      color: 'text-blue-500',
      bgColor: 'bg-blue-500/10',
    },
    ppf: {
      label: t('stationsSettings.typePpf'),
      icon: Shield,
      description: t('stationsSettings.typePpfDesc'),
      color: 'text-orange-500',
      bgColor: 'bg-orange-500/10',
    },
    detailing: {
      label: t('stationsSettings.typeDetailing'),
      icon: Droplets,
      description: t('stationsSettings.typeDetailingDesc'),
      color: 'text-purple-500',
      bgColor: 'bg-purple-500/10',
    },
    universal: {
      label: t('stationsSettings.typeUniversal'),
      icon: Droplets,
      description: t('stationsSettings.typeUniversalDesc'),
      color: 'text-green-500',
      bgColor: 'bg-green-500/10',
    },
  };
};

const StationsSettings = ({ instanceId }: StationsSettingsProps) => {
  const { t } = useTranslation();
  const STATION_TYPE_CONFIG = useStationTypeConfig();
  const [stations, setStations] = useState<Station[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingStation, setEditingStation] = useState<Station | null>(null);
  
  // Subscription limit state
  const [maxStations, setMaxStations] = useState<number>(2);
  const [currentPlanName, setCurrentPlanName] = useState<string>('');
  
  const [formData, setFormData] = useState({
    name: '',
    type: 'washing' as Station['type'],
    active: true,
  });

  const fetchStations = async () => {
    if (!instanceId) return;
    
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('stations')
        .select('*')
        .eq('instance_id', instanceId)
        .order('sort_order');
      
      if (error) throw error;
      setStations(data || []);
    } catch (error) {
      console.error('Error fetching stations:', error);
      toast.error(t('stationsSettings.fetchError'));
    } finally {
      setLoading(false);
    }
  };

  const fetchSubscription = async () => {
    if (!instanceId) return;
    
    try {
      const { data, error } = await supabase
        .from('instance_subscriptions')
        .select('station_limit, subscription_plans(name)')
        .eq('instance_id', instanceId)
        .single();
      
      if (error && error.code !== 'PGRST116') throw error;
      
      if (data) {
        const subData = data as unknown as SubscriptionData;
        setMaxStations(subData.station_limit);
        setCurrentPlanName(subData.subscription_plans?.name || '');
      }
    } catch (error) {
      console.error('Error fetching subscription:', error);
    }
  };

  useEffect(() => {
    fetchStations();
    fetchSubscription();
  }, [instanceId]);

  const openEditDialog = (station?: Station) => {
    if (station) {
      setEditingStation(station);
      setFormData({
        name: station.name,
        type: station.type,
        active: station.active ?? true,
      });
    } else {
      setEditingStation(null);
      setFormData({
        name: '',
        type: 'washing',
        active: true,
      });
    }
    setEditDialogOpen(true);
  };

  const handleSave = async () => {
    if (!instanceId) return;
    if (!formData.name.trim()) {
      toast.error(t('stationsSettings.stationNameRequired'));
      return;
    }

    setSaving(true);
    try {
      const stationData = {
        instance_id: instanceId,
        name: formData.name.trim(),
        type: formData.type,
        active: formData.active,
        sort_order: editingStation?.sort_order ?? stations.length,
      };

      if (editingStation) {
        const { error } = await supabase
          .from('stations')
          .update(stationData)
          .eq('id', editingStation.id);
        
        if (error) throw error;
        toast.success(t('stationsSettings.stationUpdated'));
      } else {
        const { error } = await supabase
          .from('stations')
          .insert(stationData);
        
        if (error) throw error;
        toast.success(t('stationsSettings.stationAdded'));
      }

      setEditDialogOpen(false);
      fetchStations();
    } catch (error: any) {
      console.error('Error saving station:', error);
      // Handle station limit error from trigger
      if (error.message?.includes('Limit stanowisk')) {
        toast.error('Osiągnięto limit stanowisk dla Twojego planu');
      } else {
        toast.error(t('stationsSettings.saveError'));
      }
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (stationId: string) => {
    if (!confirm(t('stationsSettings.deleteConfirm'))) return;

    try {
      const { error } = await supabase
        .from('stations')
        .delete()
        .eq('id', stationId);
      
      if (error) throw error;
      toast.success(t('stationsSettings.stationDeleted'));
      fetchStations();
    } catch (error) {
      console.error('Error deleting station:', error);
      toast.error(t('stationsSettings.deleteError'));
    }
  };

  const toggleStationActive = async (station: Station) => {
    try {
      const { error } = await supabase
        .from('stations')
        .update({ active: !station.active })
        .eq('id', station.id);
      
      if (error) throw error;
      fetchStations();
    } catch (error) {
      console.error('Error toggling station:', error);
      toast.error(t('stationsSettings.toggleError'));
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const isAtLimit = stations.length >= maxStations;

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <h3 className="text-lg font-semibold">{t('stationsSettings.title')}</h3>
          <p className="text-sm text-muted-foreground">
            Twój plan {currentPlanName && `(${currentPlanName})`} obejmuje maksymalnie {maxStations} stanowisk
          </p>
        </div>
        <Button 
          onClick={() => openEditDialog()} 
          size="sm" 
          className="gap-2 w-full sm:w-auto"
          disabled={isAtLimit}
          title={isAtLimit ? 'Osiągnięto limit stanowisk' : undefined}
        >
          <Plus className="w-4 h-4" />
          {t('stationsSettings.addStation')}
        </Button>
      </div>

      {stations.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          <p>{t('stationsSettings.noStations')}</p>
        </div>
      ) : (
        <div className="grid gap-3">
          {stations.map(station => {
            const config = STATION_TYPE_CONFIG[station.type];
            const Icon = config.icon;
            
            return (
              <div
                key={station.id}
                className={cn(
                  "flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 p-3 sm:p-4 border border-border/50 rounded-lg",
                  !station.active && "opacity-50"
                )}
              >
                <div className="flex items-start sm:items-center gap-3 sm:gap-4 flex-1 min-w-0">
                  <div className={cn("p-2 rounded-lg shrink-0", config.bgColor)}>
                    <Icon className={cn("w-5 h-5", config.color)} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm sm:text-base">{station.name}</span>
                      {!station.active && (
                        <span className="text-xs bg-muted px-2 py-0.5 rounded">{t('stationsSettings.inactive')}</span>
                      )}
                    </div>
                    <div className="text-xs sm:text-sm text-muted-foreground line-clamp-2 sm:line-clamp-1">
                      {config.label} • {config.description}
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center gap-2 justify-end sm:justify-start pl-10 sm:pl-0 shrink-0">
                  <Switch
                    checked={station.active ?? true}
                    onCheckedChange={() => toggleStationActive(station)}
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 sm:h-10 sm:w-10"
                    onClick={() => openEditDialog(station)}
                  >
                    <Edit2 className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 sm:h-10 sm:w-10 text-destructive"
                    onClick={() => handleDelete(station.id)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Edit/Add Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingStation ? t('stationsSettings.editStation') : t('stationsSettings.addNewStation')}
            </DialogTitle>
            <DialogDescription>
              {t('stationsSettings.stationDescription')}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>{t('stationsSettings.stationName')} *</Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                placeholder={t('stationsSettings.stationNamePlaceholder')}
              />
            </div>

            <div className="space-y-2">
              <Label>{t('stationsSettings.stationType')}</Label>
              <Select
                value={formData.type}
                onValueChange={(v) => setFormData(prev => ({ ...prev, type: v as Station['type'] }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-popover">
                  <SelectItem value="washing">
                    <div className="flex items-center gap-2">
                      <Droplets className="w-4 h-4 text-blue-500" />
                      <span>{t('stationsSettings.typeWashing')}</span>
                      <span className="text-xs text-muted-foreground ml-2">
                        ({t('stationsSettings.typeWashingDesc')})
                      </span>
                    </div>
                  </SelectItem>
                  <SelectItem value="ppf">
                    <div className="flex items-center gap-2">
                      <Shield className="w-4 h-4 text-orange-500" />
                      <span>{t('stationsSettings.typePpf')}</span>
                      <span className="text-xs text-muted-foreground ml-2">
                        ({t('stationsSettings.typePpfDesc')})
                      </span>
                    </div>
                  </SelectItem>
                  <SelectItem value="detailing">
                    <div className="flex items-center gap-2">
                      <Droplets className="w-4 h-4 text-purple-500" />
                      <span>{t('stationsSettings.typeDetailing')}</span>
                      <span className="text-xs text-muted-foreground ml-2">
                        ({t('stationsSettings.typeDetailingDesc')})
                      </span>
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center justify-between">
              <Label>{t('stationsSettings.stationActive')}</Label>
              <Switch
                checked={formData.active}
                onCheckedChange={(v) => setFormData(prev => ({ ...prev, active: v }))}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button onClick={handleSave} disabled={saving} className="gap-2">
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              <Save className="w-4 h-4" />
              {t('common.save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default StationsSettings;
