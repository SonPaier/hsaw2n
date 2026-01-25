import { useState, useEffect, useRef } from 'react';
import { Loader2, Sparkles, ChevronDown, Info, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface ServiceCategory {
  id: string;
  name: string;
}

interface ReminderTemplateItem {
  months: number;
  is_paid: boolean;
  service_type: string;
}

interface ReminderTemplateOption {
  id: string;
  name: string;
  items?: ReminderTemplateItem[];
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
  reminder_template_id?: string | null;
}

interface ExistingService {
  id?: string;
  name: string;
  short_name: string | null;
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
  onDelete?: () => void;
  existingServices?: ExistingService[];
}

// Info icon with tooltip component - only shows on click, not on focus
function FieldInfo({ tooltip }: { tooltip: string }) {
  const [open, setOpen] = useState(false);
  
  return (
    <TooltipProvider>
      <Tooltip open={open} onOpenChange={setOpen}>
        <TooltipTrigger asChild>
          <button 
            type="button" 
            className="p-0.5 text-muted-foreground hover:text-foreground"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setOpen(!open);
            }}
            onFocus={(e) => e.preventDefault()}
          >
            <Info className="w-5 h-5" />
          </button>
        </TooltipTrigger>
        <TooltipContent>
          <p className="max-w-xs text-sm">{tooltip}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
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
        onDelete,
        existingServices = [],
      }: {
        service?: ServiceData | null;
        categories: ServiceCategory[];
        instanceId: string;
        onSaved: () => void;
        onClose: () => void;
        defaultCategoryId?: string;
        totalServicesCount?: number;
        isMobile?: boolean;
        onDelete?: () => void;
        existingServices?: ExistingService[];
      }) => {
      const { t } = useTranslation();
        const textareaRef = useRef<HTMLTextAreaElement>(null);
        const nameInputRef = useRef<HTMLInputElement>(null);
        const [saving, setSaving] = useState(false);
        const [generatingDescription, setGeneratingDescription] = useState(false);
        const [reminderTemplates, setReminderTemplates] = useState<ReminderTemplateOption[]>([]);
        const [nameError, setNameError] = useState(false);
        const [shortNameError, setShortNameError] = useState(false);
        
        // Auto-expand advanced section if any advanced field has value
        const hasAdvancedValues = !!(
          service?.duration_minutes || 
          service?.duration_small || 
          service?.duration_medium || 
          service?.duration_large ||
          (service?.service_type && service.service_type !== 'both') ||
          service?.reminder_template_id
        );
        const [advancedOpen, setAdvancedOpen] = useState(hasAdvancedValues);
        
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
          reminder_template_id: service?.reminder_template_id || '__none__',
        });

  // Fetch reminder templates
  useEffect(() => {
    const fetchTemplates = async () => {
      const { data } = await supabase
        .from('reminder_templates')
        .select('id, name, items')
        .eq('instance_id', instanceId)
        .order('name');
      // Cast items from Json to our expected type
      const templates: ReminderTemplateOption[] = (data || []).map(t => ({
        id: t.id,
        name: t.name,
        items: Array.isArray(t.items) ? (t.items as unknown as ReminderTemplateItem[]) : [],
      }));
      setReminderTemplates(templates);
    };
    if (instanceId) {
      fetchTemplates();
    }
  }, [instanceId]);

  // Get selected template's items
  const selectedTemplate = reminderTemplates.find(t => t.id === formData.reminder_template_id);
  const templateItems = selectedTemplate?.items || [];

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
        reminder_template_id: service.reminder_template_id || '__none__',
      });
    }
  }, [service, defaultCategoryId]);

  const handleSave = async () => {
    // Clear previous errors
    setNameError(false);
    setShortNameError(false);
    
    // Validate required name
    if (!formData.name.trim()) {
      setNameError(true);
      toast.error(t('priceList.errors.nameRequired'));
      nameInputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setTimeout(() => nameInputRef.current?.focus(), 300);
      return;
    }

    // Validate unique name (case-insensitive, trimmed)
    const nameExists = existingServices.some(
      s => s.id !== service?.id && 
           s.name.toLowerCase().trim() === formData.name.toLowerCase().trim()
    );
    if (nameExists) {
      setNameError(true);
      nameInputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setTimeout(() => nameInputRef.current?.focus(), 300);
      return;
    }

    // Validate unique short_name if provided (case-insensitive, trimmed)
    if (formData.short_name?.trim()) {
      const shortNameExists = existingServices.some(
        s => s.id !== service?.id && 
             s.short_name?.toLowerCase().trim() === formData.short_name.toLowerCase().trim()
      );
      if (shortNameExists) {
        setShortNameError(true);
        return;
      }
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
        reminder_template_id: formData.reminder_template_id === '__none__' ? null : formData.reminder_template_id,
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
          isMobile ? "grid-cols-1" : "grid-cols-[3fr_1.5fr_1.5fr]"
        )}>
          <div className="space-y-2">
            <div className="flex items-center gap-1.5">
              <Label className="text-sm leading-5">{t('priceList.form.fullOfficialName', 'Pełna, oficjalna nazwa usługi')} *</Label>
              <FieldInfo tooltip="Nazwa wyświetlana klientom w ofercie i cenniku" />
            </div>
            <Input
              ref={nameInputRef}
              value={formData.name}
              onChange={(e) => {
                setFormData(prev => ({ ...prev, name: e.target.value }));
                if (nameError && e.target.value.trim()) setNameError(false);
              }}
              className={cn(nameError && "border-destructive focus-visible:ring-destructive")}
            />
            {nameError && (
              <p className="text-sm text-destructive">
                {existingServices.some(s => s.id !== service?.id && s.name.toLowerCase().trim() === formData.name.toLowerCase().trim())
                  ? t('priceList.errors.nameExists', 'Nazwa jest już używana')
                  : t('priceList.errors.nameRequired', 'Nazwa usługi jest wymagana')}
              </p>
            )}
          </div>
          <div className="space-y-2">
            <div className="flex items-center gap-1.5">
              <Label className="text-sm leading-5">{t('priceList.form.shortNameLabel', 'Twoja nazwa lub skrót')}</Label>
              <FieldInfo tooltip="Wewnętrzna nazwa robocza widoczna tylko dla Ciebie" />
            </div>
            <Input
              value={formData.short_name}
              onChange={(e) => {
                setFormData(prev => ({ ...prev, short_name: e.target.value.toUpperCase() }));
                if (shortNameError) setShortNameError(false);
              }}
              maxLength={10}
              className={cn(shortNameError && "border-destructive focus-visible:ring-destructive")}
            />
            {shortNameError && (
              <p className="text-sm text-destructive">{t('priceList.errors.shortNameExists', 'Skrót jest już używany')}</p>
            )}
          </div>
          <div className="space-y-2">
            <div className="flex items-center gap-1.5">
              <Label className="text-sm leading-5">{t('priceList.form.category')}</Label>
              <FieldInfo tooltip="Grupowanie usług w cenniku" />
            </div>
            <Select
              value={formData.category_id || 'none'}
              onValueChange={(v) => setFormData(prev => ({ ...prev, category_id: v === 'none' ? '' : v }))}
            >
              <SelectTrigger className="bg-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-white">
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

        {/* Row 2: Price section */}
        <div className="space-y-4">
          {/* Radio for net/gross above price label */}
          <div className="space-y-2">
            <Label className="text-sm leading-5">{t('priceList.form.priceTypeQuestion', 'Ustal, czy cena jest netto czy brutto')}</Label>
            <RadioGroup
              value={formData.prices_are_net ? 'net' : 'gross'}
              onValueChange={(v) => setFormData(prev => ({ ...prev, prices_are_net: v === 'net' }))}
              className="flex items-center gap-4"
            >
              <div className="flex items-center gap-2">
                <RadioGroupItem value="gross" id="price-gross" />
                <Label htmlFor="price-gross" className="text-sm font-normal cursor-pointer">
                  {t('priceList.form.priceGross', 'Cena brutto')}
                </Label>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem value="net" id="price-net" />
                <Label htmlFor="price-net" className="text-sm font-normal cursor-pointer">
                  {t('priceList.form.priceNet', 'Cena netto')}
                </Label>
              </div>
            </RadioGroup>
          </div>
          
          {!showSizePrices && (
            <div className="flex items-center gap-1.5">
              <Label className="text-sm leading-5">{t('priceList.form.priceType', 'Cena')}</Label>
              <FieldInfo tooltip="Cena bazowa usługi" />
            </div>
          )}

          {!showSizePrices ? (
            <div className="space-y-1">
              <div className={cn("grid gap-4", isMobile ? "grid-cols-1" : "grid-cols-3")}>
                <Input
                  type="number"
                  value={formData.price_from ?? ''}
                  onChange={(e) => handlePriceChange('price_from', e.target.value)}
                  step="0.01"
                  min="0"
                />
              </div>
              <button
                type="button"
                onClick={() => setShowSizePrices(true)}
                className="text-sm text-primary font-semibold hover:underline"
              >
                {t('priceList.form.priceBySizeLink')}
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="flex gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-1.5">
                    <Label className="text-sm leading-5">{t('priceList.form.sizeSmall', 'Mały (S)')}</Label>
                    <FieldInfo tooltip="Cena bazowa usługi" />
                  </div>
                  <Input
                    type="number"
                    value={formData.price_small ?? ''}
                    onChange={(e) => handlePriceChange('price_small', e.target.value)}
                    step="0.01"
                    min="0"
                    className="w-24"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-sm leading-5">{t('priceList.form.sizeMedium', 'Średni (M)')}</Label>
                  <Input
                    type="number"
                    value={formData.price_medium ?? ''}
                    onChange={(e) => handlePriceChange('price_medium', e.target.value)}
                    step="0.01"
                    min="0"
                    className="w-24"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-sm leading-5">{t('priceList.form.sizeLarge', 'Duży (L)')}</Label>
                  <Input
                    type="number"
                    value={formData.price_large ?? ''}
                    onChange={(e) => handlePriceChange('price_large', e.target.value)}
                    step="0.01"
                    min="0"
                    className="w-24"
                  />
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowSizePrices(false)}
                className="text-sm text-primary font-semibold hover:underline"
              >
                {t('priceList.form.useSinglePrice', 'Użyj jednej ceny')}
              </button>
            </div>
          )}
        </div>

        {/* Row 3: Description */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Label className="text-sm">{t('priceList.form.descriptionShort', 'Opis')}</Label>
              <FieldInfo tooltip="Opis wyświetlany klientom podczas rezerwacji" />
            </div>
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
            className="min-h-[288px] resize-none overflow-hidden"
            style={{ height: 'auto' }}
          />
        </div>

        {/* Advanced Section */}
        <Collapsible open={advancedOpen} onOpenChange={setAdvancedOpen}>
          <CollapsibleTrigger asChild>
            <button
              type="button"
              className="flex items-center gap-2 text-sm text-primary font-semibold hover:text-primary/80 w-full py-2"
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
            <div className="space-y-2">
              <div className="flex items-center gap-1.5">
                <Label className="text-sm">{t('priceList.form.duration')}</Label>
                <FieldInfo tooltip="Czas trwania usługi w minutach" />
              </div>
              {!showSizeDurations ? (
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      value={formData.duration_minutes ?? ''}
                      onChange={(e) => handleDurationChange('duration_minutes', e.target.value)}
                      className="w-24"
                      min="0"
                    />
                    <span className="text-sm text-muted-foreground">{t('common.minutes', 'min')}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowSizeDurations(true)}
                    className="text-sm text-primary font-semibold hover:underline"
                  >
                    {t('priceList.form.durationBySizeLink', 'Czas zależny od wielkości samochodu')}
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="flex gap-3">
                    <div className="space-y-1">
                      <Label className="text-sm leading-5">{t('priceList.form.sizeSmall', 'Mały (S)')}</Label>
                      <Input
                        type="number"
                        value={formData.duration_small ?? ''}
                        onChange={(e) => handleDurationChange('duration_small', e.target.value)}
                        min="0"
                        className="w-24"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-sm leading-5">{t('priceList.form.sizeMedium', 'Średni (M)')}</Label>
                      <Input
                        type="number"
                        value={formData.duration_medium ?? ''}
                        onChange={(e) => handleDurationChange('duration_medium', e.target.value)}
                        min="0"
                        className="w-24"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-sm leading-5">{t('priceList.form.sizeLarge', 'Duży (L)')}</Label>
                      <Input
                        type="number"
                        value={formData.duration_large ?? ''}
                        onChange={(e) => handleDurationChange('duration_large', e.target.value)}
                        min="0"
                        className="w-24"
                      />
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowSizeDurations(false)}
                    className="text-sm text-primary font-semibold hover:underline"
                  >
                    {t('priceList.form.useSingleDuration', 'Użyj jednego czasu')}
                  </button>
                </div>
              )}
            </div>

            {/* Visibility - only show for legacy services, hidden for unified ones */}
            {formData.service_type !== 'both' && (
              <div className="space-y-2">
                <div className="flex items-center gap-1.5">
                  <Label className="text-sm">{t('priceList.form.visibilityService', 'Widoczność usługi')}</Label>
                  <FieldInfo tooltip="Gdzie usługa będzie widoczna" />
                </div>
                <Select
                  value={formData.service_type}
                  onValueChange={(v) => setFormData(prev => ({ ...prev, service_type: v as 'both' | 'reservation' | 'offer' }))}
                >
                  <SelectTrigger className="bg-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-white">
                    <SelectItem value="both">{t('priceList.form.visibilityAll')}</SelectItem>
                    <SelectItem value="reservation">{t('priceList.form.visibilityReservations')}</SelectItem>
                    <SelectItem value="offer">{t('priceList.form.visibilityOffers')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Reminder Template */}
            {reminderTemplates.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-1.5">
                  <Label className="text-sm">{t('productDialog.reminderTemplate', 'Szablon przypomnień')}</Label>
                  <FieldInfo tooltip="Automatyczne przypomnienia SMS po wykonaniu usługi" />
                </div>
                <Select
                  value={formData.reminder_template_id}
                  onValueChange={(v) => setFormData(prev => ({ ...prev, reminder_template_id: v }))}
                >
                  <SelectTrigger className="bg-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-white">
                    <SelectItem value="__none__">{t('reminderTemplates.noTemplate', 'Brak')}</SelectItem>
                    {reminderTemplates.map(template => (
                      <SelectItem key={template.id} value={template.id}>{template.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {/* Show reminder items list when template is selected */}
                {templateItems.length > 0 && (
                  <div className="mt-4 pl-3 border-l-2 border-muted space-y-1.5">
                    {templateItems.map((item, idx) => (
                      <div key={idx} className="text-sm text-foreground/50">
                        {item.months} mies. – {item.service_type === 'inspection' ? 'Przegląd' : item.service_type === 'maintenance' ? 'Konserwacja' : 'Serwis'}{item.is_paid ? ', płatne' : ''}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </CollapsibleContent>
        </Collapsible>
      </div>

      {/* Fixed Footer */}
      <div className="fixed bottom-0 left-0 right-0 bg-background border-t p-4 flex items-center z-50">
        {service?.id && onDelete && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onDelete}
            className="text-destructive hover:text-destructive hover:bg-destructive/10 gap-2"
          >
            <Trash2 className="w-4 h-4" />
            {t('common.delete', 'Usuń')}
          </Button>
        )}
        <div className="flex-1" />
        <div className="flex gap-3">
          <Button variant="outline" onClick={onClose} disabled={saving}>
            {t('common.cancel')}
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
            {t('common.save')}
          </Button>
        </div>
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
  onDelete,
  existingServices = [],
}: ServiceFormDialogProps) => {
  const { t } = useTranslation();
  const isMobile = useIsMobile();

  const title = service?.id ? t('priceList.editService') : t('priceList.addNewService');
  const description = '';

  const handleClose = () => onOpenChange(false);

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent className="h-[100dvh] max-h-[100dvh]">
          <DrawerHeader className="flex-shrink-0">
            <DrawerTitle>{title}</DrawerTitle>
            <DrawerDescription>{description}</DrawerDescription>
          </DrawerHeader>
          <div className="px-4 pb-4 overflow-y-auto flex-1">
            <ServiceFormContent
              service={service}
              categories={categories}
              instanceId={instanceId}
              onSaved={onSaved}
              onClose={handleClose}
              defaultCategoryId={defaultCategoryId}
              totalServicesCount={totalServicesCount}
              isMobile={true}
              onDelete={onDelete}
              existingServices={existingServices}
            />
          </div>
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent 
        className="w-[80vw] max-w-[1000px] h-[80vh] max-h-[80vh] flex flex-col p-0 gap-0 [&>button]:h-10 [&>button]:w-10 [&>button]:rounded-full [&>button]:bg-transparent [&>button]:hover:bg-muted [&>button]:absolute [&>button]:right-4 [&>button]:top-4"
        onPointerDownOutside={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
      >
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
            onDelete={onDelete}
            existingServices={existingServices}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
};
