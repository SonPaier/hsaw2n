import { useState, useEffect, useMemo } from 'react';
import { Plus, Edit2, Trash2, Loader2, Save, GripVertical, Search, Settings2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useIsMobile } from '@/hooks/use-mobile';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { useTranslation } from 'react-i18next';
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
import { CategoryManagementDialog } from './CategoryManagementDialog';

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
  const [saving, setSaving] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingService, setEditingService] = useState<Service | null>(null);
  
  // Category management dialog state
  const [categoryManagementOpen, setCategoryManagementOpen] = useState(false);
  
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
          .from('unified_services')
          .update({ ...serviceData, service_type: 'both' })
          .eq('id', editingService.id);
        
        if (error) throw error;
        toast.success(t('priceList.serviceUpdated'));
      } else {
        const { error } = await supabase
          .from('unified_services')
          .insert({ ...serviceData, service_type: 'both' });
        
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
      const { count } = await supabase
        .from('reservations')
        .select('id', { count: 'exact', head: true })
        .or(`service_id.eq.${serviceId},service_ids.cs.["${serviceId}"]`);
      
      const hasReservations = (count || 0) > 0;
      
      if (hasReservations) {
        if (!confirm(t('priceList.confirmDeactivate'))) return;
        
        const { error } = await supabase
          .from('unified_services')
          .update({ active: false })
          .eq('id', serviceId);
        
        if (error) throw error;
        toast.success(t('priceList.serviceDeactivated'));
      } else {
        if (!confirm(t('priceList.confirmDelete'))) return;
        
        const { error } = await supabase
          .from('unified_services')
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
                    onDelete={() => handleDelete(service.id)}
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
                        onDelete={() => handleDelete(service.id)}
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
              <Label>{t('priceList.form.category')}</Label>
              <Select
                value={formData.category_id || 'none'}
                onValueChange={(v) => setFormData(prev => ({ ...prev, category_id: v === 'none' ? '' : v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t('priceList.form.selectCategory')} />
                </SelectTrigger>
                <SelectContent className="bg-popover">
                  <SelectItem value="none">{t('priceList.noCategory')}</SelectItem>
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

            <div className="flex items-center gap-3 p-3 bg-muted rounded-lg border border-border">
              <Checkbox
                id="is_popular"
                checked={formData.is_popular}
                onCheckedChange={(v) => setFormData(prev => ({ ...prev, is_popular: !!v }))}
              />
              <Label htmlFor="is_popular" className="cursor-pointer">
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

      {/* Category Management Dialog */}
      <CategoryManagementDialog
        open={categoryManagementOpen}
        onOpenChange={setCategoryManagementOpen}
        instanceId={instanceId || ''}
        serviceCounts={serviceCounts}
        onCategoriesChanged={fetchCategories}
      />
    </div>
  );
};

export default PriceListSettings;
