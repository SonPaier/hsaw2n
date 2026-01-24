import { useState, useEffect, useMemo } from 'react';
import { Plus, Loader2, Search, Settings2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useIsMobile } from '@/hooks/use-mobile';
import { Input } from '@/components/ui/input';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
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
  isMobile
}: { 
  service: Service; 
  onEdit: () => void; 
  isMobile: boolean;
}) => {
  const formatPrice = () => {
    if (service.requires_size) {
      // Show "od X zł" with smallest price (S size)
      const prices = [service.price_small, service.price_medium, service.price_large].filter(p => p != null && p > 0) as number[];
      if (prices.length === 0) return '-';
      const minPrice = Math.min(...prices);
      return `od ${minPrice} zł`;
    }
    return service.price_from ? `od ${service.price_from} zł` : '-';
  };

  return (
    <button
      type="button"
      onClick={onEdit}
      className={cn(
        "flex items-center gap-2 px-4 py-3 border-b border-border/30 last:border-b-0 w-full text-left hover:bg-muted/50 transition-colors",
        !service.active && "opacity-50"
      )}
    >
      <div className="flex-1 min-w-0 flex items-center gap-2">
        <span className={cn("truncate", !service.active && "line-through")}>{service.name}</span>
        {!service.active && (
          <span className="text-xs bg-muted px-2 py-0.5 rounded shrink-0">nieaktywna</span>
        )}
      </div>
      
      <div className="flex items-center gap-2 shrink-0">
        <span className="text-sm font-semibold text-primary whitespace-nowrap">{formatPrice()}</span>
      </div>
    </button>
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
    // Close the edit dialog before showing confirm
    setEditDialogOpen(false);
    
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
      {/* Header with buttons inline on desktop */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold">Cennik usług</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Usługi będą widoczne do wyboru w rezerwacjach i przy tworzeniu szablonów ofert. Kategorie są opcjonalne.
          </p>
        </div>
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
          <div className="flex items-center justify-between py-3">
            <h3 className="font-semibold text-foreground uppercase">{t('priceList.noCategory')}</h3>
            <Button variant="ghost" size="icon" onClick={() => openEditDialog(undefined, '')} className="h-8 w-8">
              <Plus className="w-4 h-4" />
            </Button>
          </div>
          <div className="bg-white rounded-lg">
            {uncategorizedServices.map(service => (
              <ServiceRow
                key={service.id}
                service={service}
                onEdit={() => openEditDialog(service)}
                isMobile={isMobile}
              />
            ))}
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
            <div className="flex items-center justify-between py-3">
              <h3 className="font-semibold text-foreground uppercase">{category.name}</h3>
              <Button variant="ghost" size="icon" onClick={() => openEditDialog(undefined, category.id)} className="h-8 w-8">
                <Plus className="w-4 h-4" />
              </Button>
            </div>
            <div className="bg-white rounded-lg">
              {categoryServices.length === 0 ? (
                <p className="text-sm text-muted-foreground p-4 text-center">
                  {t('priceList.noServicesInCategory')}
                </p>
              ) : (
                categoryServices.map(service => (
                  <ServiceRow
                    key={service.id}
                    service={service}
                    onEdit={() => openEditDialog(service)}
                    isMobile={isMobile}
                  />
                ))
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
          duration_small: editingService.duration_small,
          duration_medium: editingService.duration_medium,
          duration_large: editingService.duration_large,
          category_id: editingService.category_id,
          service_type: 'both',
        } : null}
        categories={categories}
        onSaved={fetchServices}
        defaultCategoryId={defaultCategoryId}
        totalServicesCount={services.length}
        onDelete={editingService ? () => handleDeleteClick(editingService.id) : undefined}
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
