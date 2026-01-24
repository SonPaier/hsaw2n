import { useState, useEffect, useMemo } from 'react';
import { Plus, Edit2, Trash2, Loader2, GripVertical, Search, Settings2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useIsMobile } from '@/hooks/use-mobile';
import { Input } from '@/components/ui/input';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { CategoryManagementDialog } from './CategoryManagementDialog';
import { ServiceFormDialog } from './ServiceFormDialog';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';

interface Service {
  id: string;
  name: string;
  shortcut: string | null;
  description: string | null;
  duration_minutes: number | null;
  duration_small: number | null;
  duration_medium: number | null;
  duration_large: number | null;
  price_from: number | null;
  price_small: number | null;
  price_medium: number | null;
  price_large: number | null;
  requires_size: boolean | null;
  station_type: string | null;
  category_id: string;
  active: boolean | null;
  sort_order: number | null;
  is_popular: boolean | null;
}

interface ServiceCategory {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  sort_order: number;
  active: boolean;
  prices_are_net: boolean;
}

interface PriceListSettingsProps {
  instanceId: string | null;
}

// Removed STATION_TYPES as it's no longer used in the new form

// Simple service row component for flat list
const ServiceRow = ({ 
  service, 
  onEdit, 
  onDelete, 
  isMobile
}: { 
  service: Service; 
  onEdit: () => void; 
  onDelete: () => void; 
  isMobile: boolean;
}) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: service.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const formatPrice = () => {
    if (service.requires_size) {
      if (isMobile) {
        return `${service.price_small || 0} / ${service.price_medium || 0} / ${service.price_large || 0} zł`;
      }
      return `S: ${service.price_small || 0} zł | M: ${service.price_medium || 0} zł | L: ${service.price_large || 0} zł`;
    }
    return service.price_from ? `od ${service.price_from} zł` : '';
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "flex items-center gap-2 px-4 py-3 border-b border-border/30 last:border-b-0",
        !service.active && "opacity-50"
      )}
    >
      <button
        {...attributes}
        {...listeners}
        className="cursor-grab touch-none p-1 text-muted-foreground hover:text-foreground shrink-0"
      >
        <GripVertical className="w-4 h-4" />
      </button>
      
      <div className="flex-1 min-w-0 flex items-center gap-2">
        <span className={cn("truncate", !service.active && "line-through")}>{service.name}</span>
        {!service.active && (
          <span className="text-xs bg-muted px-2 py-0.5 rounded shrink-0">nieaktywna</span>
        )}
      </div>
      
      <div className="flex items-center gap-2 shrink-0">
        <span className="text-sm text-muted-foreground hidden sm:inline whitespace-nowrap">{formatPrice()}</span>
        <Button variant="ghost" size="icon" onClick={onEdit} className="h-8 w-8">
          <Edit2 className="w-4 h-4" />
        </Button>
        <Button variant="ghost" size="icon" className="text-destructive h-8 w-8" onClick={onDelete}>
          <Trash2 className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
};

const PriceListSettings = ({ instanceId }: PriceListSettingsProps) => {
  const { t } = useTranslation();
  const isMobile = useIsMobile();
  const [services, setServices] = useState<Service[]>([]);
  const [categories, setCategories] = useState<ServiceCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingService, setEditingService] = useState<Service | null>(null);
  const [defaultCategoryId, setDefaultCategoryId] = useState<string>('');
  
  // Confirm dialog state
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmData, setConfirmData] = useState<{ id: string; isDeactivate: boolean } | null>(null);
  
  // Category management dialog state
  const [categoryManagementOpen, setCategoryManagementOpen] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const fetchCategories = async () => {
    if (!instanceId) return;
    
    try {
      const { data, error } = await supabase
        .from('unified_categories')
        .select('*')
        .eq('instance_id', instanceId)
        .eq('category_type', 'both')
        .eq('active', true)
        .order('sort_order') as unknown as { data: ServiceCategory[] | null; error: any };
      
      if (error) throw error;
      setCategories(data || []);
    } catch (error) {
      console.error('Error fetching categories:', error);
    }
  };

  const fetchServices = async () => {
    if (!instanceId) return;
    
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('unified_services')
        .select('*')
        .eq('instance_id', instanceId)
        .eq('service_type', 'both')
        .order('sort_order') as unknown as { data: Service[] | null; error: any };
      
      if (error) throw error;
      setServices(data || []);
    } catch (error) {
      console.error('Error fetching services:', error);
      toast.error(t('priceList.errors.fetchError'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const loadData = async () => {
      await fetchCategories();
      await fetchServices();
    };
    loadData();
  }, [instanceId]);

  // Filter services by search query
  const filteredServices = useMemo(() => {
    if (!searchQuery.trim()) return services;
    const query = searchQuery.toLowerCase().trim();
    return services.filter(s => 
      s.name.toLowerCase().includes(query) || 
      (s.shortcut && s.shortcut.toLowerCase().includes(query))
    );
  }, [services, searchQuery]);

  const getServicesByCategory = (categoryId: string | null) => {
    if (categoryId === null) {
      return filteredServices.filter(s => !s.category_id || !categories.some(c => c.id === s.category_id));
    }
    return filteredServices.filter(s => s.category_id === categoryId);
  };

  const openEditDialog = (service?: Service, preselectedCategoryId?: string) => {
    if (service) {
      setEditingService(service);
      setDefaultCategoryId(service.category_id || '');
    } else {
      setEditingService(null);
      setDefaultCategoryId(preselectedCategoryId || '');
    }
    setEditDialogOpen(true);
  };

  const handleDeleteClick = async (serviceId: string) => {
    try {
      const { count } = await supabase
        .from('reservations')
        .select('id', { count: 'exact', head: true })
        .or(`service_id.eq.${serviceId},service_ids.cs.["${serviceId}"]`);
      
      const hasReservations = (count || 0) > 0;
      setConfirmData({ id: serviceId, isDeactivate: hasReservations });
      setConfirmOpen(true);
    } catch (error) {
      console.error('Error checking reservations:', error);
      toast.error(t('priceList.errors.deleteError'));
    }
  };

  const handleConfirmDelete = async () => {
    if (!confirmData) return;
    
    try {
      if (confirmData.isDeactivate) {
        const { error } = await supabase
          .from('unified_services')
          .update({ active: false })
          .eq('id', confirmData.id);
        
        if (error) throw error;
        toast.success(t('priceList.serviceDeactivated'));
      } else {
        const { error } = await supabase
          .from('unified_services')
          .delete()
          .eq('id', confirmData.id);
        
        if (error) throw error;
        toast.success(t('priceList.serviceDeleted'));
      }
      
      fetchServices();
    } catch (error) {
      console.error('Error deleting service:', error);
      toast.error(t('priceList.errors.deleteError'));
    }
  };

  const handleDragEnd = async (event: DragEndEvent, categoryId: string | null) => {
    const { active, over } = event;
    
    if (!over || active.id === over.id) return;
    
    const sectionServices = getServicesByCategory(categoryId);
    const oldIndex = sectionServices.findIndex(s => s.id === active.id);
    const newIndex = sectionServices.findIndex(s => s.id === over.id);
    
    if (oldIndex === -1 || newIndex === -1) return;
    
    const reorderedServices = arrayMove(sectionServices, oldIndex, newIndex);
    
    setServices(prev => {
      const otherServices = prev.filter(s => 
        categoryId === null 
          ? s.category_id && categories.some(c => c.id === s.category_id)
          : s.category_id !== categoryId
      );
      return [...otherServices, ...reorderedServices.map((s, i) => ({ ...s, sort_order: i }))];
    });
    
    try {
      for (let i = 0; i < reorderedServices.length; i++) {
        await supabase
          .from('unified_services')
          .update({ sort_order: i })
          .eq('id', reorderedServices[i].id);
      }
      toast.success(t('priceList.orderSaved'));
    } catch (error) {
      console.error('Error updating order:', error);
      toast.error(t('priceList.errors.orderError'));
      fetchServices();
    }
  };

  // Compute service counts per category for the management dialog
  const serviceCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    categories.forEach(cat => {
      counts[cat.id] = services.filter(s => s.category_id === cat.id).length;
    });
    return counts;
  }, [categories, services]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const uncategorizedServices = getServicesByCategory(null);

  return (
    <div className="space-y-6">
      {/* Top action buttons */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          Usługi będą widoczne do wyboru w rezerwacjach i przy tworzeniu szablonów ofert. Kategorie są opcjonalne.
        </p>
        <div className="flex items-center gap-2 shrink-0">
          <Button onClick={() => openEditDialog()} className="gap-2">
            <Plus className="w-4 h-4" />
            {t('priceList.addService')}
          </Button>
          <Button onClick={() => setCategoryManagementOpen(true)} variant="secondary" className="gap-2">
            <Settings2 className="w-4 h-4" />
            {t('priceList.manageCategories')}
          </Button>
        </div>
      </div>

      {/* Search input */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Szukaj po nazwie lub skrócie..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Uncategorized services */}
      {uncategorizedServices.length > 0 && (
        <div>
          <div className="flex items-center justify-between py-3 border-b-2 border-border">
            <h3 className="font-semibold text-foreground uppercase">{t('priceList.noCategory')}</h3>
            <Button variant="ghost" size="icon" onClick={() => openEditDialog(undefined, '')} className="h-8 w-8">
              <Plus className="w-4 h-4" />
            </Button>
          </div>
          <div className="bg-white rounded-b-lg">
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={(event) => handleDragEnd(event, null)}
            >
              <SortableContext
                items={uncategorizedServices.map(s => s.id)}
                strategy={verticalListSortingStrategy}
              >
                {uncategorizedServices.map(service => (
                  <ServiceRow
                    key={service.id}
                    service={service}
                    onEdit={() => openEditDialog(service)}
                    onDelete={() => handleDeleteClick(service.id)}
                    isMobile={isMobile}
                  />
                ))}
              </SortableContext>
            </DndContext>
          </div>
        </div>
      )}

      {/* Categories */}
      {categories.map(category => {
        const categoryServices = getServicesByCategory(category.id);

        // Hide category when searching and no matching services
        if (searchQuery.trim() && categoryServices.length === 0) {
          return null;
        }

        return (
          <div key={category.id}>
            <div className="flex items-center justify-between py-3 border-b-2 border-border">
              <h3 className="font-semibold text-foreground uppercase">{category.name}</h3>
              <Button variant="ghost" size="icon" onClick={() => openEditDialog(undefined, category.id)} className="h-8 w-8">
                <Plus className="w-4 h-4" />
              </Button>
            </div>
            <div className="bg-white rounded-b-lg">
              {categoryServices.length === 0 ? (
                <p className="text-sm text-muted-foreground p-4 text-center">
                  {t('priceList.noServicesInCategory')}
                </p>
              ) : (
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragEnd={(event) => handleDragEnd(event, category.id)}
                >
                  <SortableContext
                    items={categoryServices.map(s => s.id)}
                    strategy={verticalListSortingStrategy}
                  >
                    {categoryServices.map(service => (
                      <ServiceRow
                        key={service.id}
                        service={service}
                        onEdit={() => openEditDialog(service)}
                        onDelete={() => handleDeleteClick(service.id)}
                        isMobile={isMobile}
                      />
                    ))}
                  </SortableContext>
                </DndContext>
              )}
            </div>
          </div>
        );
      })}
      
      {/* Empty state */}
      {categories.length === 0 && uncategorizedServices.length === 0 && (
        <div className="text-center py-8 text-muted-foreground">
          <p>{t('priceList.noServices')}</p>
        </div>
      )}

      {/* Edit/Add Service Dialog */}
      <ServiceFormDialog
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        instanceId={instanceId || ''}
        service={editingService ? {
          id: editingService.id,
          name: editingService.name,
          short_name: editingService.shortcut,
          description: editingService.description,
          price_from: editingService.price_from,
          price_small: editingService.price_small,
          price_medium: editingService.price_medium,
          price_large: editingService.price_large,
          prices_are_net: true,
          duration_minutes: editingService.duration_minutes,
          category_id: editingService.category_id,
          service_type: 'both',
        } : null}
        categories={categories}
        onSaved={fetchServices}
        defaultCategoryId={defaultCategoryId}
        totalServicesCount={services.length}
      />

      {/* Category Management Dialog */}
      <CategoryManagementDialog
        open={categoryManagementOpen}
        onOpenChange={setCategoryManagementOpen}
        instanceId={instanceId || ''}
        serviceCounts={serviceCounts}
        onCategoriesChanged={fetchCategories}
      />

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={confirmData?.isDeactivate 
          ? t('priceList.confirmDeactivateTitle', 'Dezaktywować usługę?')
          : t('priceList.confirmDeleteTitle', 'Usunąć usługę?')
        }
        description={confirmData?.isDeactivate 
          ? t('priceList.confirmDeactivate')
          : t('priceList.confirmDelete')
        }
        confirmLabel={confirmData?.isDeactivate ? t('common.deactivate', 'Dezaktywuj') : t('common.delete', 'Usuń')}
        onConfirm={handleConfirmDelete}
        variant="destructive"
      />
    </div>
  );
};

export default PriceListSettings;
