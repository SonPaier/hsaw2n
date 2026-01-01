import { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, ChevronDown, ChevronRight, Loader2, Save, GripVertical, Star } from 'lucide-react';
import { Button } from '@/components/ui/button';
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
  active: boolean | null;
  sort_order: number | null;
  is_popular: boolean | null;
}

interface PriceListSettingsProps {
  instanceId: string | null;
}

const STATION_TYPES = [
  { value: 'washing', label: 'Myjnia' },
  { value: 'detailing', label: 'Detailing' },
  { value: 'ppf', label: 'Folia PPF' },
  { value: 'universal', label: 'Uniwersalne' },
];

const CATEGORY_SECTIONS = [
  { key: 'washing', label: 'Mycie', stationType: 'washing' },
  { key: 'detailing', label: 'Detailing', stationType: 'detailing' },
  { key: 'ppf', label: 'Folia PPF', stationType: 'ppf' },
  { key: 'universal', label: 'Pranie tapicerki', stationType: 'universal' },
];

// Sortable service item component
const SortableServiceItem = ({ 
  service, 
  onEdit, 
  onDelete, 
  onToggleActive,
  onTogglePopular 
}: { 
  service: Service; 
  onEdit: () => void; 
  onDelete: () => void; 
  onToggleActive: () => void;
  onTogglePopular: () => void;
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
            <span className="text-xs bg-muted px-2 py-0.5 rounded">Nieaktywna</span>
          )}
        </div>
        <div className="text-sm text-muted-foreground mt-1">
          {service.duration_minutes} min
          {service.requires_size ? (
            <span className="ml-2">
              • S: {service.price_small} zł | M: {service.price_medium} zł | L: {service.price_large} zł
            </span>
          ) : service.price_from ? (
            <span className="ml-2">• od {service.price_from} zł</span>
          ) : null}
        </div>
      </div>
      
      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="icon"
          onClick={onTogglePopular}
          title={service.is_popular ? "Usuń z popularnych" : "Oznacz jako popularna"}
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
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [openSections, setOpenSections] = useState<string[]>(['washing']);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingService, setEditingService] = useState<Service | null>(null);
  
  // Form state for editing/adding
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
    active: true,
    is_popular: false,
  });

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

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
      toast.error('Błąd podczas pobierania usług');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchServices();
  }, [instanceId]);

  const toggleSection = (key: string) => {
    setOpenSections(prev => 
      prev.includes(key) 
        ? prev.filter(k => k !== key)
        : [...prev, key]
    );
  };

  const getServicesByType = (stationType: string) => {
    return services.filter(s => s.station_type === stationType);
  };

  const openEditDialog = (service?: Service) => {
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
        active: service.active ?? true,
        is_popular: service.is_popular ?? false,
      });
    } else {
      setEditingService(null);
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
        active: true,
        is_popular: false,
      });
    }
    setEditDialogOpen(true);
  };

  const handleSave = async () => {
    if (!instanceId) return;
    if (!formData.name.trim()) {
      toast.error('Nazwa usługi jest wymagana');
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
        toast.success('Usługa została zaktualizowana');
      } else {
        const { error } = await supabase
          .from('services')
          .insert(serviceData);
        
        if (error) throw error;
        toast.success('Usługa została dodana');
      }

      setEditDialogOpen(false);
      fetchServices();
    } catch (error) {
      console.error('Error saving service:', error);
      toast.error('Błąd podczas zapisywania usługi');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (serviceId: string) => {
    if (!confirm('Czy na pewno chcesz usunąć tę usługę?')) return;

    try {
      const { error } = await supabase
        .from('services')
        .delete()
        .eq('id', serviceId);
      
      if (error) throw error;
      toast.success('Usługa została usunięta');
      fetchServices();
    } catch (error) {
      console.error('Error deleting service:', error);
      toast.error('Błąd podczas usuwania usługi');
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
      toast.error('Błąd podczas zmiany statusu usługi');
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
      toast.error('Błąd podczas zmiany statusu popularności');
      // Revert on error
      setServices(prev => prev.map(s => 
        s.id === service.id ? { ...s, is_popular: !newValue } : s
      ));
    }
  };

  const handleDragEnd = async (event: DragEndEvent, stationType: string) => {
    const { active, over } = event;
    
    if (!over || active.id === over.id) return;
    
    const sectionServices = getServicesByType(stationType);
    const oldIndex = sectionServices.findIndex(s => s.id === active.id);
    const newIndex = sectionServices.findIndex(s => s.id === over.id);
    
    if (oldIndex === -1 || newIndex === -1) return;
    
    const reorderedServices = arrayMove(sectionServices, oldIndex, newIndex);
    
    // Update local state immediately
    setServices(prev => {
      const otherServices = prev.filter(s => s.station_type !== stationType);
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
      toast.success('Kolejność zapisana');
    } catch (error) {
      console.error('Error updating order:', error);
      toast.error('Błąd podczas zapisywania kolejności');
      fetchServices();
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
        <h3 className="text-lg font-semibold">Cennik usług</h3>
        <Button onClick={() => openEditDialog()} size="sm" className="gap-2">
          <Plus className="w-4 h-4" />
          Dodaj usługę
        </Button>
      </div>

      {CATEGORY_SECTIONS.map(section => {
        const sectionServices = getServicesByType(section.stationType);
        const isOpen = openSections.includes(section.key);

        return (
          <Collapsible
            key={section.key}
            open={isOpen}
            onOpenChange={() => toggleSection(section.key)}
          >
            <CollapsibleTrigger asChild>
              <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg cursor-pointer hover:bg-muted/70 transition-colors">
                <div className="flex items-center gap-3">
                  {isOpen ? (
                    <ChevronDown className="w-4 h-4" />
                  ) : (
                    <ChevronRight className="w-4 h-4" />
                  )}
                  <span className="font-medium">{section.label}</span>
                  <span className="text-sm text-muted-foreground">
                    ({sectionServices.length} usług)
                  </span>
                </div>
              </div>
            </CollapsibleTrigger>
            
            <CollapsibleContent>
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={(event) => handleDragEnd(event, section.stationType)}
              >
                <SortableContext
                  items={sectionServices.map(s => s.id)}
                  strategy={verticalListSortingStrategy}
                >
                  <div className="mt-2 space-y-2">
                    {sectionServices.length === 0 ? (
                      <p className="text-sm text-muted-foreground p-4 text-center">
                        Brak usług w tej kategorii
                      </p>
                    ) : (
                      sectionServices.map(service => (
                        <SortableServiceItem
                          key={service.id}
                          service={service}
                          onEdit={() => openEditDialog(service)}
                          onDelete={() => handleDelete(service.id)}
                          onToggleActive={() => toggleServiceActive(service)}
                          onTogglePopular={() => toggleServicePopular(service)}
                        />
                      ))
                    )}
                  </div>
                </SortableContext>
              </DndContext>
            </CollapsibleContent>
          </Collapsible>
        );
      })}

      {/* Edit/Add Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingService ? 'Edytuj usługę' : 'Dodaj nową usługę'}
            </DialogTitle>
            <DialogDescription>
              Uzupełnij dane usługi i zapisz zmiany
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-2 col-span-2">
                <Label>Nazwa usługi *</Label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="np. Mycie podstawowe"
                />
              </div>
              <div className="space-y-2">
                <Label>Skrót</Label>
                <Input
                  value={formData.shortcut}
                  onChange={(e) => setFormData(prev => ({ ...prev, shortcut: e.target.value.toUpperCase() }))}
                  placeholder="np. KPL"
                  maxLength={10}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Opis (wyświetlany klientowi)</Label>
              <Textarea
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Opis usługi widoczny dla klienta podczas rezerwacji"
                rows={2}
              />
            </div>

            <div className="space-y-2">
              <Label>Kategoria</Label>
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
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Czas trwania (minuty)</Label>
              <Input
                type="number"
                value={formData.duration_minutes}
                onChange={(e) => setFormData(prev => ({ ...prev, duration_minutes: parseInt(e.target.value) || 60 }))}
              />
            </div>

            <div className="flex items-center justify-between">
              <Label>Ceny zależne od wielkości auta</Label>
              <Switch
                checked={formData.requires_size}
                onCheckedChange={(v) => setFormData(prev => ({ ...prev, requires_size: v }))}
              />
            </div>

            {formData.requires_size ? (
              <>
                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-2">
                    <Label className="text-xs">Mały (zł)</Label>
                    <Input
                      type="number"
                      value={formData.price_small}
                      onChange={(e) => setFormData(prev => ({ ...prev, price_small: parseFloat(e.target.value) || 0 }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs">Średni (zł)</Label>
                    <Input
                      type="number"
                      value={formData.price_medium}
                      onChange={(e) => setFormData(prev => ({ ...prev, price_medium: parseFloat(e.target.value) || 0 }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs">Duży (zł)</Label>
                    <Input
                      type="number"
                      value={formData.price_large}
                      onChange={(e) => setFormData(prev => ({ ...prev, price_large: parseFloat(e.target.value) || 0 }))}
                    />
                  </div>
                </div>

                <Label className="text-sm text-muted-foreground">Czas trwania wg wielkości (min)</Label>
                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-2">
                    <Label className="text-xs">Mały</Label>
                    <Input
                      type="number"
                      value={formData.duration_small}
                      onChange={(e) => setFormData(prev => ({ ...prev, duration_small: parseInt(e.target.value) || 60 }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs">Średni</Label>
                    <Input
                      type="number"
                      value={formData.duration_medium}
                      onChange={(e) => setFormData(prev => ({ ...prev, duration_medium: parseInt(e.target.value) || 60 }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs">Duży</Label>
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
                <Label>Cena od (zł)</Label>
                <Input
                  type="number"
                  value={formData.price_from}
                  onChange={(e) => setFormData(prev => ({ ...prev, price_from: parseFloat(e.target.value) || 0 }))}
                />
              </div>
            )}

            <div className="flex items-center justify-between">
              <Label>Usługa aktywna</Label>
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
                Popularna usługa (pokazuj jako pierwszą)
              </Label>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
              Anuluj
            </Button>
            <Button onClick={handleSave} disabled={saving} className="gap-2">
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              <Save className="w-4 h-4" />
              Zapisz
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PriceListSettings;
