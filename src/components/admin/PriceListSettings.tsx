import { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, ChevronDown, ChevronRight, Loader2, Save, GripVertical, Star, FolderPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useIsMobile } from '@/hooks/use-mobile';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { useTranslation } from 'react-i18next';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
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

const STATION_TYPES = [
  { value: 'washing', labelKey: 'priceList.stationTypes.washing' },
  { value: 'detailing', labelKey: 'priceList.stationTypes.detailing' },
  { value: 'ppf', labelKey: 'priceList.stationTypes.ppf' },
  { value: 'universal', labelKey: 'priceList.stationTypes.universal' },
];

// Sortable service item component
const SortableServiceItem = ({ 
  service, 
  onEdit, 
  onDelete, 
  onToggleActive,
  onTogglePopular,
  t,
  isMobile
}: { 
  service: Service; 
  onEdit: () => void; 
  onDelete: () => void; 
  onToggleActive: () => void;
  onTogglePopular: () => void;
  t: (key: string) => string;
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

  // Mobile layout
  if (isMobile) {
    return (
      <div
        ref={setNodeRef}
        style={style}
        className={cn(
          "p-4 border border-border/50 rounded-lg bg-background",
          !service.active && "opacity-50"
        )}
      >
        <div className="flex items-start gap-2">
          <button
            {...attributes}
            {...listeners}
            className="cursor-grab touch-none p-1 text-muted-foreground hover:text-foreground mt-0.5"
          >
            <GripVertical className="w-4 h-4" />
          </button>
          
          <div className="flex-1 min-w-0 space-y-2">
            {/* Line 1: Service name */}
            <div className="flex items-center gap-2">
              {service.is_popular && <Star className="w-4 h-4 text-amber-500 fill-amber-500 shrink-0" />}
              <span className="font-medium">{service.name}</span>
              {!service.active && (
                <span className="text-xs bg-muted px-2 py-0.5 rounded">{t('priceList.inactive')}</span>
              )}
            </div>
            
            {/* Lines 2-4: Prices per size OR single price */}
            {service.requires_size ? (
              <div className="text-sm text-muted-foreground space-y-1">
                <div>S: <span className="font-bold">{service.price_small} zł</span> / <span className="font-bold">{service.duration_small || service.duration_minutes || '-'} min</span></div>
                <div>M: <span className="font-bold">{service.price_medium} zł</span> / <span className="font-bold">{service.duration_medium || service.duration_minutes || '-'} min</span></div>
                <div>L: <span className="font-bold">{service.price_large} zł</span> / <span className="font-bold">{service.duration_large || service.duration_minutes || '-'} min</span></div>
              </div>
            ) : (
              <div className="text-sm text-muted-foreground">
                {service.price_from && <span>od <span className="font-bold">{service.price_from} zł</span></span>}
                {service.duration_minutes && <span className="ml-2">• <span className="font-bold">{service.duration_minutes} min</span></span>}
              </div>
            )}
            
            {/* Line 5: Actions */}
            <div className="flex items-center gap-1 pt-1">
              <Button
                variant="ghost"
                size="icon"
                onClick={onTogglePopular}
                title={service.is_popular ? t('priceList.removeFromPopular') : t('priceList.markAsPopular')}
                className="h-8 w-8"
              >
                <Star className={cn("w-4 h-4", service.is_popular ? "text-amber-500 fill-amber-500" : "text-muted-foreground")} />
              </Button>
              <Switch
                checked={service.active ?? true}
                onCheckedChange={onToggleActive}
              />
              <Button variant="ghost" size="icon" onClick={onEdit} className="h-8 w-8">
                <Edit2 className="w-4 h-4" />
              </Button>
              <Button variant="ghost" size="icon" className="text-destructive h-8 w-8" onClick={onDelete}>
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Desktop layout
  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "flex items-center gap-2 p-4 border border-border/50 rounded-lg bg-background",
        !service.active && "opacity-50"
      )}
    >
      <button
        {...attributes}
        {...listeners}
        className="cursor-grab touch-none p-1 text-muted-foreground hover:text-foreground"
      >
        <GripVertical className="w-4 h-4" />
      </button>
      
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          {service.is_popular && <Star className="w-4 h-4 text-amber-500 fill-amber-500" />}
          <span className="font-medium truncate">{service.name}</span>
          {!service.active && (
            <span className="text-xs bg-muted px-2 py-0.5 rounded">{t('priceList.inactive')}</span>
          )}
        </div>
        <div className="text-sm text-muted-foreground mt-1">
          {service.requires_size ? (
            <span>
              S: <span className="font-bold">{service.price_small} zł</span> / <span className="font-bold">{service.duration_small || service.duration_minutes || '-'} min</span>
              {' | '}M: <span className="font-bold">{service.price_medium} zł</span> / <span className="font-bold">{service.duration_medium || service.duration_minutes || '-'} min</span>
              {' | '}L: <span className="font-bold">{service.price_large} zł</span> / <span className="font-bold">{service.duration_large || service.duration_minutes || '-'} min</span>
            </span>
          ) : (
            <>
              {service.price_from && <span>od <span className="font-bold">{service.price_from} zł</span></span>}
              {service.duration_minutes && <span className="ml-2">• <span className="font-bold">{service.duration_minutes} min</span></span>}
            </>
          )}
        </div>
      </div>
      
      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="icon"
          onClick={onTogglePopular}
          title={service.is_popular ? t('priceList.removeFromPopular') : t('priceList.markAsPopular')}
        >
          <Star className={cn("w-4 h-4", service.is_popular ? "text-amber-500 fill-amber-500" : "text-muted-foreground")} />
        </Button>
        <Switch
          checked={service.active ?? true}
          onCheckedChange={onToggleActive}
        />
        <Button variant="ghost" size="icon" onClick={onEdit}>
          <Edit2 className="w-4 h-4" />
        </Button>
        <Button variant="ghost" size="icon" className="text-destructive" onClick={onDelete}>
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
  const [saving, setSaving] = useState(false);
  const [openSections, setOpenSections] = useState<string[]>([]);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingService, setEditingService] = useState<Service | null>(null);
  
  // Category dialog state
  const [categoryDialogOpen, setCategoryDialogOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<ServiceCategory | null>(null);
  const [categoryFormData, setCategoryFormData] = useState({
    name: '',
    description: '',
    prices_are_net: false,
  });
  const [savingCategory, setSavingCategory] = useState(false);
  
  // Form state for editing/adding service
  const [formData, setFormData] = useState({
    name: '',
    shortcut: '',
    description: '',
    duration_minutes: 60,
    duration_small: 60,
    duration_medium: 60,
    duration_large: 60,
    price_from: 0,
    price_small: 0,
    price_medium: 0,
    price_large: 0,
    requires_size: true,
    station_type: 'washing',
    category_id: '',
    active: true,
    is_popular: false,
  });

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
        .from('service_categories')
        .select('*')
        .eq('instance_id', instanceId)
        .eq('active', true)
        .order('sort_order');
      
      if (error) throw error;
      setCategories(data || []);
      
      // Open first category by default
      if (data && data.length > 0 && openSections.length === 0) {
        setOpenSections([data[0].id]);
      }
    } catch (error) {
      console.error('Error fetching categories:', error);
    }
  };

  const fetchServices = async () => {
    if (!instanceId) return;
    
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('services')
        .select('*')
        .eq('instance_id', instanceId)
        .order('sort_order');
      
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

  const toggleSection = (key: string) => {
    setOpenSections(prev => 
      prev.includes(key) 
        ? prev.filter(k => k !== key)
        : [...prev, key]
    );
  };

  const getServicesByCategory = (categoryId: string) => {
    return services.filter(s => s.category_id === categoryId);
  };

  const openEditDialog = (service?: Service, preselectedCategoryId?: string) => {
    if (service) {
      setEditingService(service);
      setFormData({
        name: service.name,
        shortcut: service.shortcut || '',
        description: service.description || '',
        duration_minutes: service.duration_minutes || 60,
        duration_small: service.duration_small || service.duration_minutes || 60,
        duration_medium: service.duration_medium || service.duration_minutes || 60,
        duration_large: service.duration_large || service.duration_minutes || 60,
        price_from: service.price_from || 0,
        price_small: service.price_small || 0,
        price_medium: service.price_medium || 0,
        price_large: service.price_large || 0,
        requires_size: service.requires_size ?? true,
        station_type: service.station_type || 'washing',
        category_id: service.category_id,
        active: service.active ?? true,
        is_popular: service.is_popular ?? false,
      });
    } else {
      setEditingService(null);
      const defaultCategoryId = preselectedCategoryId || (categories.length > 0 ? categories[0].id : '');
      setFormData({
        name: '',
        shortcut: '',
        description: '',
        duration_minutes: 60,
        duration_small: 60,
        duration_medium: 60,
        duration_large: 60,
        price_from: 0,
        price_small: 0,
        price_medium: 0,
        price_large: 0,
        requires_size: true,
        station_type: 'washing',
        category_id: defaultCategoryId,
        active: true,
        is_popular: false,
      });
    }
    setEditDialogOpen(true);
  };

  const handleSave = async () => {
    if (!instanceId) return;
    if (!formData.name.trim()) {
      toast.error(t('priceList.errors.nameRequired'));
      return;
    }
    if (!formData.category_id) {
      toast.error(t('priceList.errors.categoryRequired'));
      return;
    }

    setSaving(true);
    try {
      const serviceData = {
        instance_id: instanceId,
        name: formData.name.trim(),
        shortcut: formData.shortcut.trim() || null,
        description: formData.description.trim() || null,
        duration_minutes: formData.duration_minutes,
        duration_small: formData.requires_size ? formData.duration_small : null,
        duration_medium: formData.requires_size ? formData.duration_medium : null,
        duration_large: formData.requires_size ? formData.duration_large : null,
        price_from: formData.price_from || null,
        price_small: formData.requires_size ? formData.price_small : null,
        price_medium: formData.requires_size ? formData.price_medium : null,
        price_large: formData.requires_size ? formData.price_large : null,
        requires_size: formData.requires_size,
        station_type: formData.station_type as any,
        category_id: formData.category_id,
        active: formData.active,
        is_popular: formData.is_popular,
        sort_order: editingService?.sort_order ?? services.length,
      };

      if (editingService) {
        const { error } = await supabase
          .from('services')
          .update(serviceData)
          .eq('id', editingService.id);
        
        if (error) throw error;
        toast.success(t('priceList.serviceUpdated'));
      } else {
        const { error } = await supabase
          .from('services')
          .insert(serviceData);
        
        if (error) throw error;
        toast.success(t('priceList.serviceAdded'));
      }

      setEditDialogOpen(false);
      fetchServices();
    } catch (error) {
      console.error('Error saving service:', error);
      toast.error(t('priceList.errors.saveError'));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (serviceId: string) => {
    try {
      // Check if service is linked to any reservations
      const { count } = await supabase
        .from('reservations')
        .select('id', { count: 'exact', head: true })
        .or(`service_id.eq.${serviceId},service_ids.cs.["${serviceId}"]`);
      
      const hasReservations = (count || 0) > 0;
      
      if (hasReservations) {
        // Service has reservations - soft delete (deactivate)
        if (!confirm(t('priceList.confirmDeactivate'))) return;
        
        const { error } = await supabase
          .from('services')
          .update({ active: false })
          .eq('id', serviceId);
        
        if (error) throw error;
        toast.success(t('priceList.serviceDeactivated'));
      } else {
        // No reservations - can delete physically
        if (!confirm(t('priceList.confirmDelete'))) return;
        
        const { error } = await supabase
          .from('services')
          .delete()
          .eq('id', serviceId);
        
        if (error) throw error;
        toast.success(t('priceList.serviceDeleted'));
      }
      
      fetchServices();
    } catch (error) {
      console.error('Error deleting service:', error);
      toast.error(t('priceList.errors.deleteError'));
    }
  };

  const toggleServiceActive = async (service: Service) => {
    const newValue = !service.active;
    
    // Optimistic update
    setServices(prev => prev.map(s => 
      s.id === service.id ? { ...s, active: newValue } : s
    ));
    
    try {
      const { error } = await supabase
        .from('services')
        .update({ active: newValue })
        .eq('id', service.id);
      
      if (error) throw error;
    } catch (error) {
      console.error('Error toggling service:', error);
      toast.error(t('priceList.errors.statusError'));
      // Revert on error
      setServices(prev => prev.map(s => 
        s.id === service.id ? { ...s, active: !newValue } : s
      ));
    }
  };

  const toggleServicePopular = async (service: Service) => {
    const newValue = !service.is_popular;
    
    // Optimistic update - update local state immediately
    setServices(prev => prev.map(s => 
      s.id === service.id ? { ...s, is_popular: newValue } : s
    ));
    
    try {
      const { error } = await supabase
        .from('services')
        .update({ is_popular: newValue })
        .eq('id', service.id);
      
      if (error) throw error;
    } catch (error) {
      console.error('Error toggling popular:', error);
      toast.error(t('priceList.errors.popularError'));
      // Revert on error
      setServices(prev => prev.map(s => 
        s.id === service.id ? { ...s, is_popular: !newValue } : s
      ));
    }
  };

  const handleDragEnd = async (event: DragEndEvent, categoryId: string) => {
    const { active, over } = event;
    
    if (!over || active.id === over.id) return;
    
    const sectionServices = getServicesByCategory(categoryId);
    const oldIndex = sectionServices.findIndex(s => s.id === active.id);
    const newIndex = sectionServices.findIndex(s => s.id === over.id);
    
    if (oldIndex === -1 || newIndex === -1) return;
    
    const reorderedServices = arrayMove(sectionServices, oldIndex, newIndex);
    
    // Update local state immediately
    setServices(prev => {
      const otherServices = prev.filter(s => s.category_id !== categoryId);
      return [...otherServices, ...reorderedServices.map((s, i) => ({ ...s, sort_order: i }))];
    });
    
    // Update in database
    try {
      for (let i = 0; i < reorderedServices.length; i++) {
        await supabase
          .from('services')
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

  // Category management functions
  const openCategoryDialog = (category?: ServiceCategory) => {
    if (category) {
      setEditingCategory(category);
      setCategoryFormData({
        name: category.name,
        description: category.description || '',
        prices_are_net: category.prices_are_net ?? false,
      });
    } else {
      setEditingCategory(null);
      setCategoryFormData({
        name: '',
        description: '',
        prices_are_net: false,
      });
    }
    setCategoryDialogOpen(true);
  };

  const handleSaveCategory = async () => {
    if (!instanceId) return;
    if (!categoryFormData.name.trim()) {
      toast.error(t('priceList.errors.categoryNameRequired'));
      return;
    }

    setSavingCategory(true);
    try {
      const slug = categoryFormData.name.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
      
      if (editingCategory) {
        const { error } = await supabase
          .from('service_categories')
          .update({
            name: categoryFormData.name.trim(),
            description: categoryFormData.description.trim() || null,
            slug,
            prices_are_net: categoryFormData.prices_are_net,
          })
          .eq('id', editingCategory.id);
        
        if (error) throw error;
        toast.success(t('priceList.categoryUpdated'));
      } else {
        const maxSortOrder = categories.length > 0 ? Math.max(...categories.map(c => c.sort_order)) + 1 : 0;
        const { error } = await supabase
          .from('service_categories')
          .insert({
            instance_id: instanceId,
            name: categoryFormData.name.trim(),
            description: categoryFormData.description.trim() || null,
            slug,
            sort_order: maxSortOrder,
            active: true,
            prices_are_net: categoryFormData.prices_are_net,
          });
        
        if (error) throw error;
        toast.success(t('priceList.categoryAdded'));
      }

      setCategoryDialogOpen(false);
      fetchCategories();
    } catch (error) {
      console.error('Error saving category:', error);
      toast.error(t('priceList.errors.categorySaveError'));
    } finally {
      setSavingCategory(false);
    }
  };

  const handleDeleteCategory = async (categoryId: string) => {
    // Check if there are services in this category
    const servicesInCategory = services.filter(s => s.category_id === categoryId);
    
    if (servicesInCategory.length > 0) {
      toast.error(t('priceList.categoryHasServices'));
      return;
    }
    
    try {
      // Check if any services that WERE in this category are linked to reservations
      const { count } = await supabase
        .from('reservations')
        .select('id', { count: 'exact', head: true })
        .in('service_id', servicesInCategory.map(s => s.id));
      
      const hasReservations = (count || 0) > 0;
      
      if (hasReservations) {
        // Soft delete
        if (!confirm(t('priceList.confirmDeactivateCategory'))) return;
        
        const { error } = await supabase
          .from('service_categories')
          .update({ active: false })
          .eq('id', categoryId);
        
        if (error) throw error;
        toast.success(t('priceList.categoryDeactivated'));
      } else {
        // Physical delete
        if (!confirm(t('priceList.confirmDeleteCategory'))) return;
        
        const { error } = await supabase
          .from('service_categories')
          .delete()
          .eq('id', categoryId);
        
        if (error) throw error;
        toast.success(t('priceList.categoryDeleted'));
      }
      
      fetchCategories();
    } catch (error) {
      console.error('Error deleting category:', error);
      toast.error(t('priceList.errors.categoryDeleteError'));
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">{t('priceList.title')}</h3>
        <Button onClick={() => openCategoryDialog()} size="sm" className="gap-2">
          <FolderPlus className="w-4 h-4" />
          {t('priceList.addCategory')}
        </Button>
      </div>

      {categories.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          <p>{t('priceList.noCategories')}</p>
          <Button onClick={() => openCategoryDialog()} variant="outline" className="mt-4 gap-2">
            <FolderPlus className="w-4 h-4" />
            {t('priceList.addCategory')}
          </Button>
        </div>
      ) : (
        categories.map(category => {
          const categoryServices = getServicesByCategory(category.id);
          const isOpen = openSections.includes(category.id);

          return (
            <Collapsible
              key={category.id}
              open={isOpen}
              onOpenChange={() => toggleSection(category.id)}
            >
              <CollapsibleTrigger asChild>
                <div className="p-4 bg-slate-100 rounded-lg cursor-pointer hover:bg-slate-200 transition-colors">
                  {/* Mobile: 2 lines */}
                  <div className="md:hidden space-y-2">
                    <div className="flex items-center gap-3">
                      {isOpen ? (
                        <ChevronDown className="w-4 h-4" />
                      ) : (
                        <ChevronRight className="w-4 h-4" />
                      )}
                      <span className="font-medium">{category.name}</span>
                      <span className="text-sm text-muted-foreground">
                        ({categoryServices.length} {t('priceList.servicesCount')})
                      </span>
                    </div>
                    <div className="flex items-center gap-1 pl-7" onClick={(e) => e.stopPropagation()}>
                      <Button variant="ghost" size="sm" onClick={() => openEditDialog(undefined, category.id)} className="h-8 px-2">
                        <Plus className="w-4 h-4 mr-1" />{t('common.add')}
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => openCategoryDialog(category)} className="h-8 w-8">
                        <Edit2 className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="text-destructive h-8 w-8" onClick={() => handleDeleteCategory(category.id)}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                  
                  {/* Desktop: single line */}
                  <div className="hidden md:flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {isOpen ? (
                        <ChevronDown className="w-4 h-4" />
                      ) : (
                        <ChevronRight className="w-4 h-4" />
                      )}
                      <span className="font-medium">{category.name}</span>
                      <span className="text-sm text-muted-foreground">
                        ({categoryServices.length} {t('priceList.servicesCount')})
                      </span>
                    </div>
                    <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                      <Button variant="ghost" size="icon" onClick={() => openEditDialog(undefined, category.id)} title={t('priceList.addService')}>
                        <Plus className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => openCategoryDialog(category)} title={t('priceList.editCategory')}>
                        <Edit2 className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="text-destructive" onClick={() => handleDeleteCategory(category.id)} title={t('priceList.deleteCategory')}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              </CollapsibleTrigger>
              
              <CollapsibleContent>
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragEnd={(event) => handleDragEnd(event, category.id)}
                >
                  <SortableContext
                    items={categoryServices.map(s => s.id)}
                    strategy={verticalListSortingStrategy}
                  >
                    <div className="mt-2 space-y-2">
                      {categoryServices.length === 0 ? (
                        <p className="text-sm text-muted-foreground p-4 text-center">
                          {t('priceList.noServicesInCategory')}
                        </p>
                      ) : (
                        categoryServices.map(service => (
                          <SortableServiceItem
                            key={service.id}
                            service={service}
                            onEdit={() => openEditDialog(service)}
                            onDelete={() => handleDelete(service.id)}
                            onToggleActive={() => toggleServiceActive(service)}
                            onTogglePopular={() => toggleServicePopular(service)}
                            t={t}
                            isMobile={isMobile}
                          />
                        ))
                      )}
                    </div>
                  </SortableContext>
                </DndContext>
              </CollapsibleContent>
            </Collapsible>
          );
        })
      )}

      {/* Edit/Add Service Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingService ? t('priceList.editService') : t('priceList.addNewService')}
            </DialogTitle>
            <DialogDescription>
              {t('priceList.dialogDescription')}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-2 col-span-2">
                <Label>{t('priceList.form.serviceName')} *</Label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  placeholder={t('priceList.form.serviceNamePlaceholder')}
                />
              </div>
              <div className="space-y-2">
                <Label>{t('priceList.form.shortcut')}</Label>
                <Input
                  value={formData.shortcut}
                  onChange={(e) => setFormData(prev => ({ ...prev, shortcut: e.target.value.toUpperCase() }))}
                  placeholder={t('priceList.form.shortcutPlaceholder')}
                  maxLength={10}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>{t('priceList.form.description')}</Label>
              <Textarea
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                placeholder={t('priceList.form.descriptionPlaceholder')}
                rows={2}
              />
            </div>

            <div className="space-y-2">
              <Label>{t('priceList.form.category')} *</Label>
              <Select
                value={formData.category_id}
                onValueChange={(v) => setFormData(prev => ({ ...prev, category_id: v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t('priceList.form.selectCategory')} />
                </SelectTrigger>
                <SelectContent className="bg-popover">
                  {categories.map(cat => (
                    <SelectItem key={cat.id} value={cat.id}>
                      {cat.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>{t('priceList.form.stationType')}</Label>
              <Select
                value={formData.station_type}
                onValueChange={(v) => setFormData(prev => ({ ...prev, station_type: v }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-popover">
                  {STATION_TYPES.map(type => (
                    <SelectItem key={type.value} value={type.value}>
                      {t(type.labelKey)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>{t('priceList.form.duration')}</Label>
              <Input
                type="number"
                value={formData.duration_minutes}
                onChange={(e) => setFormData(prev => ({ ...prev, duration_minutes: parseInt(e.target.value) || 60 }))}
              />
            </div>

            <div className="flex items-center justify-between">
              <Label>{t('priceList.form.priceBySize')}</Label>
              <Switch
                checked={formData.requires_size}
                onCheckedChange={(v) => setFormData(prev => ({ ...prev, requires_size: v }))}
              />
            </div>

            {formData.requires_size ? (
              <>
                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-2">
                    <Label className="text-xs">{t('priceList.form.sizeSmall')}</Label>
                    <Input
                      type="number"
                      value={formData.price_small}
                      onChange={(e) => setFormData(prev => ({ ...prev, price_small: parseFloat(e.target.value) || 0 }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs">{t('priceList.form.sizeMedium')}</Label>
                    <Input
                      type="number"
                      value={formData.price_medium}
                      onChange={(e) => setFormData(prev => ({ ...prev, price_medium: parseFloat(e.target.value) || 0 }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs">{t('priceList.form.sizeLarge')}</Label>
                    <Input
                      type="number"
                      value={formData.price_large}
                      onChange={(e) => setFormData(prev => ({ ...prev, price_large: parseFloat(e.target.value) || 0 }))}
                    />
                  </div>
                </div>

                <Label className="text-sm text-muted-foreground">{t('priceList.form.durationBySize')}</Label>
                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-2">
                    <Label className="text-xs">{t('priceList.form.small')}</Label>
                    <Input
                      type="number"
                      value={formData.duration_small}
                      onChange={(e) => setFormData(prev => ({ ...prev, duration_small: parseInt(e.target.value) || 60 }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs">{t('priceList.form.medium')}</Label>
                    <Input
                      type="number"
                      value={formData.duration_medium}
                      onChange={(e) => setFormData(prev => ({ ...prev, duration_medium: parseInt(e.target.value) || 60 }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs">{t('priceList.form.large')}</Label>
                    <Input
                      type="number"
                      value={formData.duration_large}
                      onChange={(e) => setFormData(prev => ({ ...prev, duration_large: parseInt(e.target.value) || 60 }))}
                    />
                  </div>
                </div>
              </>
            ) : (
              <div className="space-y-2">
                <Label>{t('priceList.form.priceFrom')}</Label>
                <Input
                  type="number"
                  value={formData.price_from}
                  onChange={(e) => setFormData(prev => ({ ...prev, price_from: parseFloat(e.target.value) || 0 }))}
                />
              </div>
            )}

            <div className="flex items-center justify-between">
              <Label>{t('priceList.form.serviceActive')}</Label>
              <Switch
                checked={formData.active}
                onCheckedChange={(v) => setFormData(prev => ({ ...prev, active: v }))}
              />
            </div>

            <div className="flex items-center gap-3 p-3 bg-amber-500/10 rounded-lg border border-amber-500/30">
              <Checkbox
                id="is_popular"
                checked={formData.is_popular}
                onCheckedChange={(v) => setFormData(prev => ({ ...prev, is_popular: !!v }))}
              />
              <Label htmlFor="is_popular" className="flex items-center gap-2 cursor-pointer">
                <Star className="w-4 h-4 text-amber-500" />
                {t('priceList.form.popularService')}
              </Label>
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

      {/* Add/Edit Category Dialog */}
      <Dialog open={categoryDialogOpen} onOpenChange={setCategoryDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>
              {editingCategory ? t('priceList.editCategory') : t('priceList.addCategory')}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>{t('priceList.categoryName')} *</Label>
              <Input
                value={categoryFormData.name}
                onChange={(e) => setCategoryFormData(prev => ({ ...prev, name: e.target.value }))}
                placeholder={t('priceList.categoryNamePlaceholder')}
              />
            </div>
            <div className="space-y-2">
              <Label>{t('priceList.categoryDescription')}</Label>
              <Textarea
                value={categoryFormData.description}
                onChange={(e) => setCategoryFormData(prev => ({ ...prev, description: e.target.value }))}
                placeholder={t('priceList.categoryDescriptionPlaceholder')}
                rows={2}
              />
            </div>
            
            <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
              <div className="space-y-0.5">
                <Label>{t('priceList.pricesAreNet')}</Label>
                <p className="text-xs text-muted-foreground">
                  {categoryFormData.prices_are_net 
                    ? t('priceList.pricesNetDescription')
                    : t('priceList.pricesGrossDescription')
                  }
                </p>
              </div>
              <Switch
                checked={categoryFormData.prices_are_net}
                onCheckedChange={(v) => setCategoryFormData(prev => ({ ...prev, prices_are_net: v }))}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setCategoryDialogOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button onClick={handleSaveCategory} disabled={savingCategory} className="gap-2">
              {savingCategory && <Loader2 className="w-4 h-4 animate-spin" />}
              {t('common.save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PriceListSettings;
