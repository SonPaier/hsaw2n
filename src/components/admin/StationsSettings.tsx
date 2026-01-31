import { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, Loader2, Save, Droplets } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

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

const StationsSettings = ({ instanceId }: StationsSettingsProps) => {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
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
      });
    } else {
      setEditingStation(null);
      setFormData({
        name: '',
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
        type: 'universal' as const,
        active: true,
        sort_order: editingStation?.sort_order ?? stations.length,
      };

      if (editingStation) {
        const { error } = await supabase
          .from('stations')
          .update({ name: formData.name.trim() })
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
      // Invalidate stations cache
      queryClient.invalidateQueries({ queryKey: ['stations', instanceId] });
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
      // Invalidate stations cache
      queryClient.invalidateQueries({ queryKey: ['stations', instanceId] });
    } catch (error) {
      console.error('Error deleting station:', error);
      toast.error(t('stationsSettings.deleteError'));
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
          {stations.map(station => (
            <div
              key={station.id}
              className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 p-3 sm:p-4 border border-border/50 rounded-lg"
            >
              <div className="flex items-start sm:items-center gap-3 sm:gap-4 flex-1 min-w-0">
                <div className="p-2 rounded-lg shrink-0 bg-primary/10">
                  <Droplets className="w-5 h-5 text-primary" />
                </div>
                <div className="min-w-0 flex-1">
                  <span className="font-medium text-sm sm:text-base">{station.name}</span>
                </div>
              </div>
              
              <div className="flex items-center gap-2 justify-end sm:justify-start pl-10 sm:pl-0 shrink-0">
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
          ))}
        </div>
      )}

      {/* Edit/Add Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingStation ? t('stationsSettings.editStation') : t('stationsSettings.addNewStation')}
            </DialogTitle>
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
