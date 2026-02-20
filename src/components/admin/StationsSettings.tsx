import { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, Loader2, Save, Droplets, Check, X, GripVertical } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors, DragEndEvent } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, useSortable, arrayMove } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
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
import { cn } from '@/lib/utils';
import { useInstanceSettings } from '@/hooks/useInstanceSettings';
import { useStationEmployees, useUpdateStationEmployees } from '@/hooks/useStationEmployees';
import { useEmployees } from '@/hooks/useEmployees';
import { AssignedEmployeesChips } from './AssignedEmployeesChips';
import { EmployeeSelectionDrawer } from './EmployeeSelectionDrawer';

interface Station {
  id: string;
  name: string;
  type: 'washing' | 'ppf' | 'detailing' | 'universal';
  active: boolean | null;
  sort_order: number | null;
  color?: string | null;
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

function SortableStationItem({ station, onEdit, onDelete }: { station: Station; onEdit: () => void; onDelete: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: station.id });
  const style = { transform: CSS.Transform.toString(transform), transition };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 p-3 sm:p-4 border border-border/50 rounded-lg bg-white dark:bg-card",
        isDragging && "opacity-50 shadow-lg"
      )}
    >
      <div className="flex items-start sm:items-center gap-3 sm:gap-4 flex-1 min-w-0">
        <button type="button" className="cursor-grab active:cursor-grabbing touch-none p-1 text-muted-foreground hover:text-foreground" {...attributes} {...listeners}>
          <GripVertical className="w-5 h-5" />
        </button>
        <div className={cn("p-2 rounded-lg shrink-0", !station.color && "bg-primary/10")} style={station.color ? { backgroundColor: station.color } : undefined}>
          <Droplets className={cn("w-5 h-5", !station.color && "text-primary")} style={station.color ? { color: '#475569' } : undefined} />
        </div>
        <div className="min-w-0 flex-1">
          <span className="font-medium text-sm sm:text-base">{station.name}</span>
        </div>
      </div>

      <div className="flex items-center gap-2 justify-end sm:justify-start pl-10 sm:pl-0 shrink-0">
        <Button variant="ghost" size="icon" className="h-8 w-8 sm:h-10 sm:w-10" onClick={onEdit}>
          <Edit2 className="w-4 h-4" />
        </Button>
        <Button variant="ghost" size="icon" className="h-8 w-8 sm:h-10 sm:w-10 text-destructive" onClick={onDelete}>
          <Trash2 className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}

const StationsSettings = ({ instanceId }: StationsSettingsProps) => {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));
  const [stations, setStations] = useState<Station[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingStation, setEditingStation] = useState<Station | null>(null);
  const [employeeDrawerOpen, setEmployeeDrawerOpen] = useState(false);
  
  // Employee assignment settings and data
  const { data: instanceSettings } = useInstanceSettings(instanceId);
  const { data: stationEmployeesMap } = useStationEmployees(instanceId);
  const { mutateAsync: updateStationEmployees } = useUpdateStationEmployees(instanceId);
  const { data: employees = [] } = useEmployees(instanceId);
  const [selectedEmployeeIds, setSelectedEmployeeIds] = useState<string[]>([]);
  
  // Subscription limit state
  const [maxStations, setMaxStations] = useState<number>(2);
  const [currentPlanName, setCurrentPlanName] = useState<string>('');
  
  const STATION_COLORS = [
    '#E2EFFF', '#E5D5F1', '#FEE0D6', '#FEF1D6',
    '#D8EBE4', '#F5E6D0', '#E8E8E8', '#FDDEDE',
  ];

  const [formData, setFormData] = useState({
    name: '',
    color: null as string | null,
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
        color: station.color || null,
      });
      // Load existing employee assignments for this station
      const existingEmployees = stationEmployeesMap?.get(station.id) || [];
      setSelectedEmployeeIds(existingEmployees);
    } else {
      setEditingStation(null);
      setFormData({
        name: '',
        color: null,
      });
      setSelectedEmployeeIds([]);
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
        color: formData.color,
      };

      if (editingStation) {
        const { error } = await supabase
          .from('stations')
          .update({ name: formData.name.trim(), color: formData.color })
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
      
      // Save employee assignments if editing and feature is enabled
      if (editingStation && instanceSettings?.assign_employees_to_stations) {
        await updateStationEmployees({
          stationId: editingStation.id,
          employeeIds: selectedEmployeeIds,
        });
      }
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

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = stations.findIndex(s => s.id === active.id);
    const newIndex = stations.findIndex(s => s.id === over.id);
    const reordered = arrayMove(stations, oldIndex, newIndex);
    setStations(reordered);

    // Persist new sort_order
    try {
      const updates = reordered.map((s, i) =>
        supabase.from('stations').update({ sort_order: i }).eq('id', s.id)
      );
      await Promise.all(updates);
      queryClient.invalidateQueries({ queryKey: ['stations', instanceId] });
    } catch (error) {
      console.error('Error reordering stations:', error);
      toast.error('Błąd zmiany kolejności');
      fetchStations();
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
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={stations.map(s => s.id)} strategy={verticalListSortingStrategy}>
            <div className="grid gap-3">
              {stations.map(station => (
                <SortableStationItem
                  key={station.id}
                  station={station}
                  onEdit={() => openEditDialog(station)}
                  onDelete={() => handleDelete(station.id)}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
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
            {/* Color picker */}
            <div className="space-y-2">
              <Label>Kolor stanowiska</Label>
              <div className="flex flex-wrap gap-2 items-center">
                {/* No color option */}
                <button
                  type="button"
                  onClick={() => setFormData(prev => ({ ...prev, color: null }))}
                  className={cn(
                    "w-8 h-8 rounded-md border-2 flex items-center justify-center transition-all",
                    formData.color === null ? "border-foreground ring-2 ring-foreground/20" : "border-border hover:border-foreground/50"
                  )}
                  title="Brak koloru"
                >
                  {formData.color === null ? <X className="w-3.5 h-3.5 text-muted-foreground" /> : <X className="w-3 h-3 text-muted-foreground/40" />}
                </button>
                {STATION_COLORS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setFormData(prev => ({ ...prev, color }))}
                    className={cn(
                      "w-8 h-8 rounded-md border-2 flex items-center justify-center transition-all",
                      formData.color === color ? "border-foreground ring-2 ring-foreground/20" : "border-border hover:border-foreground/50"
                    )}
                    style={{ backgroundColor: color }}
                    title={color}
                  >
                    {formData.color === color && <Check className="w-4 h-4 text-slate-700" />}
                  </button>
                ))}
              </div>
            </div>
            {/* Employee assignment section - only when editing and feature enabled */}
            {editingStation && instanceSettings?.assign_employees_to_stations && (
              <div className="space-y-2">
                <Label>Przypisani pracownicy</Label>
                <AssignedEmployeesChips
                  employeeIds={selectedEmployeeIds}
                  employees={employees}
                  onRemove={(id) => setSelectedEmployeeIds(prev => prev.filter(eid => eid !== id))}
                  onAdd={() => setEmployeeDrawerOpen(true)}
                />
              </div>
            )}
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

      {/* Employee Selection Drawer */}
      {instanceId && (
        <EmployeeSelectionDrawer
          open={employeeDrawerOpen}
          onOpenChange={setEmployeeDrawerOpen}
          instanceId={instanceId}
          selectedEmployeeIds={selectedEmployeeIds}
          onSelect={setSelectedEmployeeIds}
        />
      )}
    </div>
  );
};

export default StationsSettings;
