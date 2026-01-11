import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { Plus, Loader2, Building2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import HallCard, { Hall } from './HallCard';
import AddEditHallDrawer from './AddEditHallDrawer';

interface HallsListViewProps {
  instanceId: string;
}

const HallsListView = ({ instanceId }: HallsListViewProps) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [halls, setHalls] = useState<Hall[]>([]);
  const [loading, setLoading] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingHall, setEditingHall] = useState<Hall | null>(null);
  const [instanceSlug, setInstanceSlug] = useState<string>('');

  const fetchHalls = async () => {
    try {
      const { data, error } = await supabase
        .from('halls')
        .select('*')
        .eq('instance_id', instanceId)
        .eq('active', true)
        .order('sort_order');

      if (error) throw error;

      // Map database response to Hall type
      const mappedHalls: Hall[] = (data || []).map(h => ({
        id: h.id,
        instance_id: h.instance_id,
        name: h.name,
        slug: h.slug,
        station_ids: h.station_ids || [],
        visible_fields: (h.visible_fields as Hall['visible_fields']) || {
          customer_name: true,
          customer_phone: false,
          vehicle_plate: true,
          services: true,
          admin_notes: false,
        },
        allowed_actions: (h.allowed_actions as Hall['allowed_actions']) || {
          add_services: false,
          change_time: false,
          change_station: false,
        },
        sort_order: h.sort_order || 0,
        active: h.active,
      }));

      setHalls(mappedHalls);
    } catch (error) {
      console.error('Error fetching halls:', error);
      toast.error(t('common.error'));
    } finally {
      setLoading(false);
    }
  };

  const fetchInstanceSlug = async () => {
    const { data } = await supabase
      .from('instances')
      .select('slug')
      .eq('id', instanceId)
      .single();
    
    if (data) {
      setInstanceSlug(data.slug);
    }
  };

  useEffect(() => {
    fetchHalls();
    fetchInstanceSlug();
  }, [instanceId]);

  const handleEdit = (hall: Hall) => {
    setEditingHall(hall);
    setDrawerOpen(true);
  };

  const handleDelete = async (hallId: string) => {
    try {
      const { error } = await supabase
        .from('halls')
        .update({ active: false })
        .eq('id', hallId);

      if (error) throw error;

      setHalls(prev => prev.filter(h => h.id !== hallId));
      toast.success(t('halls.deleted'));
    } catch (error) {
      console.error('Error deleting hall:', error);
      toast.error(t('common.error'));
    }
  };

  const handleAddNew = () => {
    setEditingHall(null);
    setDrawerOpen(true);
  };

  const handleSaved = () => {
    fetchHalls();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{t('halls.title')}</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {t('halls.description')}
          </p>
        </div>
        <Button onClick={handleAddNew}>
          <Plus className="w-4 h-4 mr-2" />
          {t('halls.add')}
        </Button>
      </div>

      {halls.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Building2 className="w-16 h-16 text-muted-foreground/30 mb-4" />
          <h3 className="text-lg font-medium">{t('halls.noHalls')}</h3>
          <p className="text-muted-foreground text-sm mt-1 max-w-sm">
            {t('halls.noHallsDescription')}
          </p>
          <Button onClick={handleAddNew} className="mt-4">
            <Plus className="w-4 h-4 mr-2" />
            {t('halls.addFirst')}
          </Button>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {halls.map((hall) => (
            <HallCard
              key={hall.id}
              hall={hall}
              instanceSlug={instanceSlug}
              onEdit={handleEdit}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}

      <AddEditHallDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        instanceId={instanceId}
        hall={editingHall}
        onSaved={handleSaved}
      />
    </div>
  );
};

export default HallsListView;
