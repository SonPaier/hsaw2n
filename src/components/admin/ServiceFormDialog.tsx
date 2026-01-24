import { useState, useEffect, useRef } from 'react';
import { Loader2, Sparkles, ChevronDown } from 'lucide-react';
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
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
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
  duration_small?: number | null;
  duration_medium?: number | null;
  duration_large?: number | null;
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
  isMobile = false,
}: {
  service?: ServiceData | null;
  categories: ServiceCategory[];
  instanceId: string;
  onSaved: () => void;
  onClose: () => void;
  defaultCategoryId?: string;
  totalServicesCount?: number;
  isMobile?: boolean;
}) => {
  const { t } = useTranslation();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [saving, setSaving] = useState(false);
  const [generatingDescription, setGeneratingDescription] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  
  // Auto-expand size prices/durations if any exist
  const hasSizePrices = !!(service?.price_small || service?.price_medium || service?.price_large);
  const hasSizeDurations = !!(service?.duration_small || service?.duration_medium || service?.duration_large);
  const [showSizePrices, setShowSizePrices] = useState(hasSizePrices);
  const [showSizeDurations, setShowSizeDurations] = useState(hasSizeDurations);

  const [formData, setFormData] = useState({
    name: service?.name || '',
    short_name: service?.short_name || '',
    description: service?.description || '',
    price_from: service?.price_from ?? null,
    price_small: service?.price_small ?? null,
    price_medium: service?.price_medium ?? null,
    price_large: service?.price_large ?? null,
    prices_are_net: service?.prices_are_net ?? true,
    duration_minutes: service?.duration_minutes ?? null,
    duration_small: service?.duration_small ?? null,
    duration_medium: service?.duration_medium ?? null,
    duration_large: service?.duration_large ?? null,
    category_id: service?.category_id || defaultCategoryId || '',
    service_type: service?.service_type || 'both',
  });

  // Auto-resize textarea
  const adjustTextareaHeight = () => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      const minHeight = 12 * 24; // 12 rows * ~24px line height
      const scrollHeight = textarea.scrollHeight;
      textarea.style.height = `${Math.max(minHeight, scrollHeight)}px`;
    }
  };

  useEffect(() => {
    adjustTextareaHeight();
  }, [formData.description]);

  useEffect(() => {
    if (service) {
      const hasSizes = !!(service.price_small || service.price_medium || service.price_large);
      const hasDurations = !!(service.duration_small || service.duration_medium || service.duration_large);
      setShowSizePrices(hasSizes);
      setShowSizeDurations(hasDurations);
      setFormData({
        name: service.name || '',
        short_name: service.short_name || '',
        description: service.description || '',
        price_from: service.price_from ?? null,
        price_small: service.price_small ?? null,
        price_medium: service.price_medium ?? null,
        price_large: service.price_large ?? null,
        prices_are_net: service.prices_are_net ?? true,
        duration_minutes: service.duration_minutes ?? null,
        duration_small: service.duration_small ?? null,
        duration_medium: service.duration_medium ?? null,
        duration_large: service.duration_large ?? null,
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
        price_from: showSizePrices ? null : formData.price_from,
        price_small: showSizePrices ? formData.price_small : null,
        price_medium: showSizePrices ? formData.price_medium : null,
        price_large: showSizePrices ? formData.price_large : null,
        prices_are_net: formData.prices_are_net,
        duration_minutes: showSizeDurations ? null : formData.duration_minutes,
        duration_small: showSizeDurations ? formData.duration_small : null,
        duration_medium: showSizeDurations ? formData.duration_medium : null,
        duration_large: showSizeDurations ? formData.duration_large : null,
        category_id: formData.category_id || null,
        service_type: formData.service_type,
        requires_size: showSizePrices || showSizeDurations,
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

  const handleDurationChange = (field: 'duration_minutes' | 'duration_small' | 'duration_medium' | 'duration_large', value: string) => {
    const numValue = value === '' ? null : parseInt(value);
    setFormData(prev => ({ ...prev, [field]: numValue }));
  };

  const priceLabel = formData.prices_are_net 
    ? t('priceList.form.priceNet', 'Cena netto')
    : t('priceList.form.priceGross', 'Cena brutto');

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto space-y-6 pb-24">
        {/* Row 1: Name, Short Name, Category */}
        <div className={cn(
          "grid gap-4",
          isMobile ? "grid-cols-1" : "grid-cols-[3fr_1fr_1fr]"
        )}>
          <div className="space-y-2">
            <Label className="text-sm">{t('priceList.form.clientVisibleName')} *</Label>
            <Input
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              placeholder={t('priceList.form.serviceNamePlaceholder')}
            />
          </div>
          <div className="space-y-2">
            <Label className="text-sm">{t('priceList.form.shortNameLabel', 'Twoja nazwa lub skrót')}</Label>
            <Input
              value={formData.short_name}
              onChange={(e) => setFormData(prev => ({ ...prev, short_name: e.target.value.toUpperCase() }))}
              placeholder="np. MZ"
              maxLength={10}
            />
          </div>
          <div className="space-y-2">
            <Label className="text-sm">{t('priceList.form.category')}</Label>
            <Select
              value={formData.category_id || 'none'}
              onValueChange={(v) => setFormData(prev => ({ ...prev, category_id: v === 'none' ? '' : v }))}
            >
              <SelectTrigger>
                <SelectValue placeholder={t('priceList.noCategory')} />
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
        </div>

        {/* Row 2: Price Section */}
        <div className="space-y-3">
          <div className="flex items-center gap-4">
            <Label className="text-sm">{priceLabel}</Label>
            <div className="flex items-center gap-2 ml-auto">
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

          {!showSizePrices ? (
            <div className={cn("grid gap-4", isMobile ? "grid-cols-1" : "grid-cols-3")}>
              <Input
                type="number"
                value={formData.price_from ?? ''}
                onChange={(e) => handlePriceChange('price_from', e.target.value)}
                placeholder="-"
              />
              {!isMobile && (
                <div className="col-span-2 flex items-center">
                  <button
                    type="button"
                    onClick={() => setShowSizePrices(true)}
                    className="text-sm text-primary hover:underline"
                  >
                    {t('priceList.form.priceBySizeLink')}
                  </button>
                </div>
              )}
              {isMobile && (
                <button
                  type="button"
                  onClick={() => setShowSizePrices(true)}
                  className="text-sm text-primary hover:underline text-left"
                >
                  {t('priceList.form.priceBySizeLink')}
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">S</Label>
                  <Input
                    type="number"
                    value={formData.price_small ?? ''}
                    onChange={(e) => handlePriceChange('price_small', e.target.value)}
                    placeholder="-"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">M</Label>
                  <Input
                    type="number"
                    value={formData.price_medium ?? ''}
                    onChange={(e) => handlePriceChange('price_medium', e.target.value)}
                    placeholder="-"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">L</Label>
                  <Input
                    type="number"
                    value={formData.price_large ?? ''}
                    onChange={(e) => handlePriceChange('price_large', e.target.value)}
                    placeholder="-"
                  />
                </div>
              </div>
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
                className="text-sm text-muted-foreground hover:underline"
              >
                {t('priceList.form.useSinglePrice', 'Użyj jednej ceny')}
              </button>
            </div>
          )}
        </div>

        {/* Row 3: Description */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-sm">{t('priceList.form.description')}</Label>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleGenerateDescription}
              disabled={generatingDescription || !formData.name.trim()}
              className="h-7 text-sm gap-1.5 text-primary font-semibold hover:text-primary/80"
            >
              {generatingDescription ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Sparkles className="w-4 h-4" />
              )}
              {t('priceList.form.generateDescription')}
            </Button>
          </div>
          <Textarea
            ref={textareaRef}
            value={formData.description}
            onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
            placeholder={t('priceList.form.descriptionPlaceholder')}
            className="min-h-[288px] resize-none overflow-hidden"
            style={{ height: 'auto' }}
          />
        </div>

        {/* Advanced Section */}
        <Collapsible open={advancedOpen} onOpenChange={setAdvancedOpen}>
          <CollapsibleTrigger asChild>
            <button
              type="button"
              className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground w-full py-2"
            >
              <ChevronDown className={cn(
                "w-4 h-4 transition-transform",
                advancedOpen && "rotate-180"
              )} />
              {t('priceList.form.advancedProperties', 'Zobacz zaawansowane właściwości usługi')}
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent className="space-y-4 pt-2">
            {/* Duration */}
            <div className="space-y-3">
              <Label className="text-sm">{t('priceList.form.duration')}</Label>
              {!showSizeDurations ? (
                <div className={cn("grid gap-4", isMobile ? "grid-cols-1" : "grid-cols-3")}>
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      value={formData.duration_minutes ?? ''}
                      onChange={(e) => handleDurationChange('duration_minutes', e.target.value)}
                      placeholder="60"
                      className="w-24"
                    />
                    <span className="text-sm text-muted-foreground">{t('common.minutes', 'min')}</span>
                  </div>
                  <div className="col-span-2 flex items-center">
                    <button
                      type="button"
                      onClick={() => setShowSizeDurations(true)}
                      className="text-sm text-primary hover:underline"
                    >
                      {t('priceList.form.durationBySizeLink', 'Czas zależny od wielkości samochodu')}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="grid grid-cols-3 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">S</Label>
                      <Input
                        type="number"
                        value={formData.duration_small ?? ''}
                        onChange={(e) => handleDurationChange('duration_small', e.target.value)}
                        placeholder="60"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">M</Label>
                      <Input
                        type="number"
                        value={formData.duration_medium ?? ''}
                        onChange={(e) => handleDurationChange('duration_medium', e.target.value)}
                        placeholder="60"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">L</Label>
                      <Input
                        type="number"
                        value={formData.duration_large ?? ''}
                        onChange={(e) => handleDurationChange('duration_large', e.target.value)}
                        placeholder="60"
                      />
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setShowSizeDurations(false);
                      setFormData(prev => ({ 
                        ...prev, 
                        duration_small: null, 
                        duration_medium: null, 
                        duration_large: null 
                      }));
                    }}
                    className="text-sm text-muted-foreground hover:underline"
                  >
                    {t('priceList.form.useSingleDuration', 'Użyj jednego czasu')}
                  </button>
                </div>
              )}
            </div>

            {/* Visibility */}
            <div className="space-y-2">
              <Label className="text-sm">{t('priceList.form.visibilityService', 'Widoczność usługi')}</Label>
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
      </div>

      {/* Fixed Footer */}
      <div className="fixed bottom-0 left-0 right-0 bg-background border-t p-4 flex justify-end gap-3">
        <Button variant="outline" onClick={onClose} disabled={saving}>
          {t('common.cancel')}
        </Button>
        <Button onClick={handleSave} disabled={saving || !formData.name.trim()}>
          {saving && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
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
  const description = service?.id 
    ? t('priceList.form.editDescription', 'Zmień dane usługi')
    : t('priceList.form.addDescription', 'Dodaj nową usługę do cennika');

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
              isMobile={true}
            />
          </div>
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[80vw] max-w-[1000px] h-[80vh] max-h-[80vh] flex flex-col p-0 gap-0 [&>button]:h-10 [&>button]:w-10 [&>button]:rounded-full [&>button]:hover:bg-muted">
        <DialogHeader className="flex-shrink-0 p-6 pb-4">
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <div className="flex-1 overflow-hidden px-6">
          <ServiceFormContent
            service={service}
            categories={categories}
            instanceId={instanceId}
            onSaved={onSaved}
            onClose={handleClose}
            defaultCategoryId={defaultCategoryId}
            totalServicesCount={totalServicesCount}
            isMobile={false}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
};
