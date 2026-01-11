import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { X, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { Hall } from './HallCard';

interface Station {
  id: string;
  name: string;
  type: string;
}

interface AddEditHallDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  instanceId: string;
  hall?: Hall | null;
  onSaved: () => void;
}

const generateSlug = (name: string): string => {
  return name
    .toLowerCase()
    .replace(/[ąàáâäã]/g, 'a')
    .replace(/[ćčç]/g, 'c')
    .replace(/[ęèéêë]/g, 'e')
    .replace(/[ìíîï]/g, 'i')
    .replace(/[łľ]/g, 'l')
    .replace(/[ńñň]/g, 'n')
    .replace(/[óòôöõ]/g, 'o')
    .replace(/[śšş]/g, 's')
    .replace(/[ùúûü]/g, 'u')
    .replace(/[ýÿ]/g, 'y')
    .replace(/[źżž]/g, 'z')
    .replace(/[^a-z0-9]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
};

const AddEditHallDrawer = ({
  open,
  onOpenChange,
  instanceId,
  hall,
  onSaved,
}: AddEditHallDrawerProps) => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [stations, setStations] = useState<Station[]>([]);
  const [stationsLoading, setStationsLoading] = useState(true);

  // Form state
  const [name, setName] = useState('');
  const [selectedStationIds, setSelectedStationIds] = useState<string[]>([]);
  const [visibleFields, setVisibleFields] = useState({
    customer_name: true,
    customer_phone: false,
    vehicle_plate: true,
    services: true,
    admin_notes: false,
  });
  const [allowedActions, setAllowedActions] = useState({
    add_services: false,
    change_time: false,
    change_station: false,
  });

  const isEditing = !!hall;

  // Fetch stations
  useEffect(() => {
    const fetchStations = async () => {
      setStationsLoading(true);
      const { data, error } = await supabase
        .from('stations')
        .select('id, name, type')
        .eq('instance_id', instanceId)
        .eq('active', true)
        .order('sort_order');

      if (!error && data) {
        setStations(data);
      }
      setStationsLoading(false);
    };

    if (open) {
      fetchStations();
    }
  }, [open, instanceId]);

  // Initialize form when editing
  useEffect(() => {
    if (hall) {
      setName(hall.name);
      setSelectedStationIds(hall.station_ids || []);
      setVisibleFields(hall.visible_fields || {
        customer_name: true,
        customer_phone: false,
        vehicle_plate: true,
        services: true,
        admin_notes: false,
      });
      setAllowedActions(hall.allowed_actions || {
        add_services: false,
        change_time: false,
        change_station: false,
      });
    } else {
      setName('');
      setSelectedStationIds([]);
      setVisibleFields({
        customer_name: true,
        customer_phone: false,
        vehicle_plate: true,
        services: true,
        admin_notes: false,
      });
      setAllowedActions({
        add_services: false,
        change_time: false,
        change_station: false,
      });
    }
  }, [hall, open]);

  const handleStationToggle = (stationId: string) => {
    setSelectedStationIds(prev =>
      prev.includes(stationId)
        ? prev.filter(id => id !== stationId)
        : [...prev, stationId]
    );
  };

  const handleVisibleFieldToggle = (field: keyof typeof visibleFields) => {
    setVisibleFields(prev => ({
      ...prev,
      [field]: !prev[field],
    }));
  };

  const handleAllowedActionToggle = (action: keyof typeof allowedActions) => {
    setAllowedActions(prev => ({
      ...prev,
      [action]: !prev[action],
    }));
  };

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error(t('halls.nameRequired'));
      return;
    }

    if (selectedStationIds.length === 0) {
      toast.error(t('halls.stationsRequired'));
      return;
    }

    setLoading(true);

    try {
      let slug = generateSlug(name);

      // Check if slug already exists (including inactive halls) and make it unique if needed
      const { data: existingHalls } = await supabase
        .from('halls')
        .select('id, slug')
        .eq('instance_id', instanceId)
        .eq('slug', slug);

      // If slug exists and it's not the current hall being edited, add a unique suffix
      const slugConflict = existingHalls?.some(h => 
        h.slug === slug && (!isEditing || h.id !== hall?.id)
      );

      if (slugConflict) {
        // Add timestamp suffix to make slug unique
        slug = `${slug}-${Date.now().toString(36)}`;
      }

      const hallData = {
        instance_id: instanceId,
        name: name.trim(),
        slug,
        station_ids: selectedStationIds,
        visible_fields: visibleFields,
        allowed_actions: allowedActions,
      };

      if (isEditing && hall) {
        const { error } = await supabase
          .from('halls')
          .update(hallData)
          .eq('id', hall.id);

        if (error) throw error;
        toast.success(t('halls.updated'));
      } else {
        const { error } = await supabase
          .from('halls')
          .insert(hallData);

        if (error) throw error;
        toast.success(t('halls.created'));
      }

      onSaved();
      onOpenChange(false);
    } catch (error: any) {
      console.error('Error saving hall:', error);
      if (error.code === '23505') {
        toast.error(t('halls.slugExists'));
      } else {
        toast.error(t('common.error'));
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader className="border-b pb-4 mb-4">
          <div className="flex items-center justify-between">
            <SheetTitle>
              {isEditing ? t('halls.edit') : t('halls.add')}
            </SheetTitle>
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="p-2 rounded-full hover:bg-muted transition-colors -mr-2"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </SheetHeader>

        <div className="space-y-6">
          {/* Name */}
          <div className="space-y-2">
            <Label htmlFor="hall-name">{t('halls.name')}</Label>
            <Input
              id="hall-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t('halls.namePlaceholder')}
              className="bg-white"
            />
          </div>

          {/* Stations */}
          <div className="space-y-3">
            <Label>{t('halls.selectStations')}</Label>
            {stationsLoading ? (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
              </div>
            ) : stations.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t('halls.noStations')}</p>
            ) : (
              <div className="space-y-2">
                {stations.map((station) => (
                  <label
                    key={station.id}
                    className="flex items-center gap-3 p-3 border rounded-lg cursor-pointer hover:bg-muted/50 transition-colors"
                  >
                    <Checkbox
                      checked={selectedStationIds.includes(station.id)}
                      onCheckedChange={() => handleStationToggle(station.id)}
                    />
                    <div className="flex-1">
                      <span className="font-medium">{station.name}</span>
                      <span className="text-xs text-muted-foreground ml-2">
                        ({t(`stations.type${station.type.charAt(0).toUpperCase() + station.type.slice(1)}`)})
                      </span>
                    </div>
                  </label>
                ))}
              </div>
            )}
          </div>

          {/* Visible Fields */}
          <div className="space-y-3">
            <Label>{t('halls.visibleFields')}</Label>
            <p className="text-xs text-muted-foreground">{t('halls.visibleFieldsDesc')}</p>
            <div className="space-y-2">
              {Object.entries(visibleFields).map(([key, value]) => (
                <label
                  key={key}
                  className="flex items-center gap-3 p-3 border rounded-lg cursor-pointer hover:bg-muted/50 transition-colors"
                >
                  <Checkbox
                    checked={value}
                    onCheckedChange={() => handleVisibleFieldToggle(key as keyof typeof visibleFields)}
                    disabled={key === 'vehicle_plate' || key === 'services'} // Always required
                  />
                  <span className="text-sm">
                    {t(`halls.fields.${key}`)}
                    {(key === 'vehicle_plate' || key === 'services') && (
                      <span className="text-xs text-muted-foreground ml-1">({t('common.required')})</span>
                    )}
                  </span>
                </label>
              ))}
            </div>
          </div>

          {/* Allowed Actions */}
          <div className="space-y-3">
            <Label>{t('halls.allowedActions')}</Label>
            <p className="text-xs text-muted-foreground">{t('halls.allowedActionsDesc')}</p>
            <div className="space-y-2">
              {Object.entries(allowedActions).map(([key, value]) => (
                <label
                  key={key}
                  className="flex items-center gap-3 p-3 border rounded-lg cursor-pointer hover:bg-muted/50 transition-colors"
                >
                  <Checkbox
                    checked={value}
                    onCheckedChange={() => handleAllowedActionToggle(key as keyof typeof allowedActions)}
                  />
                  <span className="text-sm">{t(`halls.actions.${key}`)}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Save Button */}
          <div className="pt-4 border-t">
            <Button
              onClick={handleSave}
              disabled={loading}
              className="w-full"
            >
              {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {isEditing ? t('common.save') : t('halls.create')}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default AddEditHallDrawer;
