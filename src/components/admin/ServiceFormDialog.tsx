import { useState, useEffect } from 'react';
import { Loader2, Save, Sparkles, ChevronDown, ChevronUp, Car } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useTranslation } from 'react-i18next';
import { useIsMobile } from '@/hooks/use-mobile';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
  DrawerFooter,
} from '@/components/ui/drawer';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface ServiceCategory {
  id: string;
  name: string;
}

interface ServiceData {
  id?: string;
  name: string;
  short_name: string | null;
  description: string | null;
  price_from: number | null;
  price_small: number | null;
  price_medium: number | null;
  price_large: number | null;
  prices_are_net: boolean;
  duration_minutes: number | null;
  category_id: string | null;
  service_type: 'both' | 'reservation' | 'offer';
  sort_order?: number | null;
}

interface ServiceFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  instanceId: string;
  service?: ServiceData | null;
  categories: ServiceCategory[];
  onSaved: () => void;
  defaultCategoryId?: string;
  totalServicesCount?: number;
}

const ServiceFormContent = ({
  service,
  categories,
  instanceId,
  onSaved,
  onClose,
  defaultCategoryId,
  totalServicesCount = 0,
}: {
  service?: ServiceData | null;
  categories: ServiceCategory[];
  instanceId: string;
  onSaved: () => void;
  onClose: () => void;
  defaultCategoryId?: string;
  totalServicesCount?: number;
}) => {
  const { t } = useTranslation();
  const [saving, setSaving] = useState(false);
  const [generatingDescription, setGeneratingDescription] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  
  // Auto-expand size prices if any exist
  const hasSizePrices = !!(service?.price_small || service?.price_medium || service?.price_large);
  const [showSizePrices, setShowSizePrices] = useState(hasSizePrices);

  const [formData, setFormData] = useState({
    name: service?.name || '',
    short_name: service?.short_name || '',
    description: service?.description || '',
    price_from: service?.price_from ?? null,
    price_small: service?.price_small ?? null,
    price_medium: service?.price_medium ?? null,
    price_large: service?.price_large ?? null,
    prices_are_net: service?.prices_are_net ?? true,
    duration_minutes: service?.duration_minutes ?? 60,
    category_id: service?.category_id || defaultCategoryId || '',
    service_type: service?.service_type || 'both',
  });

  useEffect(() => {
    if (service) {
      const hasSizes = !!(service.price_small || service.price_medium || service.price_large);
      setShowSizePrices(hasSizes);
      setFormData({
        name: service.name || '',
        short_name: service.short_name || '',
        description: service.description || '',
        price_from: service.price_from ?? null,
        price_small: service.price_small ?? null,
        price_medium: service.price_medium ?? null,
        price_large: service.price_large ?? null,
        prices_are_net: service.prices_are_net ?? true,
        duration_minutes: service.duration_minutes ?? 60,
        category_id: service.category_id || defaultCategoryId || '',
        service_type: service.service_type || 'both',
      });
    }
  }, [service, defaultCategoryId]);

  const handleSave = async () => {
    if (!formData.name.trim()) {
      toast.error(t('priceList.errors.nameRequired'));
      return;
    }

    setSaving(true);
    try {
      const serviceData = {
        instance_id: instanceId,
        name: formData.name.trim(),
        short_name: formData.short_name.trim() || null,
        description: formData.description.trim() || null,
        price_from: formData.price_from,
        price_small: showSizePrices ? formData.price_small : null,
        price_medium: showSizePrices ? formData.price_medium : null,
        price_large: showSizePrices ? formData.price_large : null,
        prices_are_net: formData.prices_are_net,
        duration_minutes: formData.duration_minutes,
        category_id: formData.category_id || null,
        service_type: formData.service_type,
        requires_size: showSizePrices,
        active: true,
      };

      if (service?.id) {
        const { error } = await supabase
          .from('unified_services')
          .update(serviceData as any)
          .eq('id', service.id);
        
        if (error) throw error;
        toast.success(t('priceList.serviceUpdated'));
      } else {
        const { error } = await supabase
          .from('unified_services')
          .insert({ ...serviceData, sort_order: totalServicesCount } as any);
        
        if (error) throw error;
        toast.success(t('priceList.serviceAdded'));
      }

      onSaved();
      onClose();
    } catch (error) {
      console.error('Error saving service:', error);
      toast.error(t('priceList.errors.saveError'));
    } finally {
      setSaving(false);
    }
  };

  const handleGenerateDescription = async () => {
    if (!formData.name.trim()) {
      toast.error(t('priceList.form.nameRequiredForAi'));
      return;
    }

    setGeneratingDescription(true);
    try {
      const category = categories.find(c => c.id === formData.category_id);
      
      const { data, error } = await supabase.functions.invoke('generate-product-description', {
        body: {
          productName: formData.name,
          category: category?.name || 'Usługa samochodowa',
        },
      });

      if (error) throw error;

      if (data?.description) {
        setFormData(prev => ({ ...prev, description: data.description }));
        toast.success(t('priceList.form.descriptionGenerated'));
      }
    } catch (error) {
      console.error('Error generating description:', error);
      toast.error(t('priceList.form.descriptionError'));
    } finally {
      setGeneratingDescription(false);
    }
  };

  const handlePriceChange = (field: 'price_from' | 'price_small' | 'price_medium' | 'price_large', value: string) => {
    const numValue = value === '' ? null : parseFloat(value);
    setFormData(prev => ({ ...prev, [field]: numValue }));
  };

  return (
    <div className="space-y-4">
      {/* Short Name & Name */}
      <div className="grid grid-cols-3 gap-3">
        <div className="space-y-2">
          <Label className="text-sm">{t('priceList.form.shortName')}</Label>
          <Input
            value={formData.short_name}
            onChange={(e) => setFormData(prev => ({ ...prev, short_name: e.target.value.toUpperCase() }))}
            placeholder="np. MZ"
            maxLength={10}
          />
        </div>
        <div className="space-y-2 col-span-2">
          <Label className="text-sm">{t('priceList.form.clientVisibleName')} *</Label>
          <Input
            value={formData.name}
            onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
            placeholder={t('priceList.form.serviceNamePlaceholder')}
          />
        </div>
      </div>

      {/* Price Section */}
      <div className="space-y-3">
        <div className="flex items-center gap-4">
          <div className="flex-1 space-y-2">
            <Label className="text-sm">{t('priceList.form.priceOptional')}</Label>
            <Input
              type="number"
              value={formData.price_from ?? ''}
              onChange={(e) => handlePriceChange('price_from', e.target.value)}
              placeholder="-"
            />
          </div>
          <div className="flex items-center gap-2 pt-6">
            <span className={cn("text-sm", !formData.prices_are_net && "text-muted-foreground")}>
              {t('priceList.form.netPrice')}
            </span>
            <Switch
              checked={!formData.prices_are_net}
              onCheckedChange={(v) => setFormData(prev => ({ ...prev, prices_are_net: !v }))}
            />
            <span className={cn("text-sm", formData.prices_are_net && "text-muted-foreground")}>
              {t('priceList.form.grossPrice')}
            </span>
          </div>
        </div>

        {/* Size prices toggle link */}
        {!showSizePrices && (
          <button
            type="button"
            onClick={() => setShowSizePrices(true)}
            className="flex items-center gap-2 text-sm text-primary hover:underline"
          >
            <Car className="w-4 h-4" />
            {t('priceList.form.priceBySizeLink')}
          </button>
        )}

        {/* Size prices */}
        {showSizePrices && (
          <div className="space-y-2 p-3 bg-muted/50 rounded-lg border">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium">{t('priceList.form.priceBySizeLink')}</Label>
              <button
                type="button"
                onClick={() => {
                  setShowSizePrices(false);
                  setFormData(prev => ({ 
                    ...prev, 
                    price_small: null, 
                    price_medium: null, 
                    price_large: null 
                  }));
                }}
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                {t('common.hide')}
              </button>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">S (mały)</Label>
                <Input
                  type="number"
                  value={formData.price_small ?? ''}
                  onChange={(e) => handlePriceChange('price_small', e.target.value)}
                  placeholder="-"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">M (średni)</Label>
                <Input
                  type="number"
                  value={formData.price_medium ?? ''}
                  onChange={(e) => handlePriceChange('price_medium', e.target.value)}
                  placeholder="-"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">L (duży)</Label>
                <Input
                  type="number"
                  value={formData.price_large ?? ''}
                  onChange={(e) => handlePriceChange('price_large', e.target.value)}
                  placeholder="-"
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Description with AI */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-sm">{t('priceList.form.description')}</Label>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleGenerateDescription}
            disabled={generatingDescription || !formData.name.trim()}
            className="h-7 text-xs gap-1"
          >
            {generatingDescription ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : (
              <Sparkles className="w-3 h-3" />
            )}
            {t('priceList.form.generateDescription')}
          </Button>
        </div>
        <Textarea
          value={formData.description}
          onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
          placeholder={t('priceList.form.descriptionPlaceholder')}
          rows={3}
        />
      </div>

      {/* Advanced Section */}
      <Collapsible open={advancedOpen} onOpenChange={setAdvancedOpen}>
        <CollapsibleTrigger asChild>
          <button
            type="button"
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground w-full py-2"
          >
            {advancedOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            {t('priceList.form.advanced')}
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent className="space-y-4 pt-2">
          {/* Category */}
          <div className="space-y-2">
            <Label className="text-sm">{t('priceList.form.category')}</Label>
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

          {/* Duration */}
          <div className="space-y-2">
            <Label className="text-sm">{t('priceList.form.duration')}</Label>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                value={formData.duration_minutes ?? ''}
                onChange={(e) => setFormData(prev => ({ 
                  ...prev, 
                  duration_minutes: e.target.value ? parseInt(e.target.value) : null 
                }))}
                className="w-24"
              />
              <span className="text-sm text-muted-foreground">{t('common.minutes')}</span>
            </div>
          </div>

          {/* Visibility */}
          <div className="space-y-2">
            <Label className="text-sm">{t('priceList.form.visibility')}</Label>
            <Select
              value={formData.service_type}
              onValueChange={(v) => setFormData(prev => ({ ...prev, service_type: v as 'both' | 'reservation' | 'offer' }))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-popover">
                <SelectItem value="both">{t('priceList.form.visibilityAll')}</SelectItem>
                <SelectItem value="reservation">{t('priceList.form.visibilityReservations')}</SelectItem>
                <SelectItem value="offer">{t('priceList.form.visibilityOffers')}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CollapsibleContent>
      </Collapsible>

      {/* Footer Buttons */}
      <div className="flex justify-end gap-2 pt-4 border-t">
        <Button variant="outline" onClick={onClose}>
          {t('common.cancel')}
        </Button>
        <Button onClick={handleSave} disabled={saving} className="gap-2">
          {saving && <Loader2 className="w-4 h-4 animate-spin" />}
          <Save className="w-4 h-4" />
          {t('common.save')}
        </Button>
      </div>
    </div>
  );
};

export const ServiceFormDialog = ({
  open,
  onOpenChange,
  instanceId,
  service,
  categories,
  onSaved,
  defaultCategoryId,
  totalServicesCount = 0,
}: ServiceFormDialogProps) => {
  const { t } = useTranslation();
  const isMobile = useIsMobile();

  const title = service?.id ? t('priceList.editService') : t('priceList.addNewService');
  const description = t('priceList.dialogDescription');

  const handleClose = () => onOpenChange(false);

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent className="max-h-[90vh]">
          <DrawerHeader>
            <DrawerTitle>{title}</DrawerTitle>
            <DrawerDescription>{description}</DrawerDescription>
          </DrawerHeader>
          <div className="px-4 pb-4 overflow-y-auto">
            <ServiceFormContent
              service={service}
              categories={categories}
              instanceId={instanceId}
              onSaved={onSaved}
              onClose={handleClose}
              defaultCategoryId={defaultCategoryId}
              totalServicesCount={totalServicesCount}
            />
          </div>
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <ServiceFormContent
          service={service}
          categories={categories}
          instanceId={instanceId}
          onSaved={onSaved}
          onClose={handleClose}
          defaultCategoryId={defaultCategoryId}
          totalServicesCount={totalServicesCount}
        />
      </DialogContent>
    </Dialog>
  );
};

export default ServiceFormDialog;
