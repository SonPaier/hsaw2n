import { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, ChevronDown, ChevronRight, Loader2, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
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

interface Service {
  id: string;
  name: string;
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
  });

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
      });
    } else {
      setEditingService(null);
      setFormData({
        name: '',
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
    try {
      const { error } = await supabase
        .from('services')
        .update({ active: !service.active })
        .eq('id', service.id);
      
      if (error) throw error;
      fetchServices();
    } catch (error) {
      console.error('Error toggling service:', error);
      toast.error('Błąd podczas zmiany statusu usługi');
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
              <div className="mt-2 space-y-2">
                {sectionServices.length === 0 ? (
                  <p className="text-sm text-muted-foreground p-4 text-center">
                    Brak usług w tej kategorii
                  </p>
                ) : (
                  sectionServices.map(service => (
                    <div
                      key={service.id}
                      className={cn(
                        "flex items-center justify-between p-4 border border-border/50 rounded-lg",
                        !service.active && "opacity-50"
                      )}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
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
                      
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={service.active ?? true}
                          onCheckedChange={() => toggleServiceActive(service)}
                        />
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openEditDialog(service)}
                        >
                          <Edit2 className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-destructive"
                          onClick={() => handleDelete(service.id)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </div>
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
            <div className="space-y-2">
              <Label>Nazwa usługi *</Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                placeholder="np. Mycie podstawowe"
              />
            </div>

            <div className="space-y-2">
              <Label>Opis</Label>
              <Input
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Krótki opis usługi"
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
