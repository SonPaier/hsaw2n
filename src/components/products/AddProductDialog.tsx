import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Plus, Trash2, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { ScrollArea } from '@/components/ui/scroll-area';

interface MetadataField {
  key: string;
  value: string;
}

interface Product {
  id: string;
  name: string;
  short_name: string | null;
  brand: string | null;
  description: string | null;
  category: string | null;
  unit: string;
  default_price: number;
  metadata: Record<string, unknown> | null;
  source: string;
  instance_id: string | null;
  reminder_template_id?: string | null;
}

interface ReminderTemplateOption {
  id: string;
  name: string;
}

interface AddProductDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  instanceId: string;
  categories: string[];
  onProductAdded: () => void;
  product?: Product | null; // For edit mode
}

export function AddProductDialog({
  open,
  onOpenChange,
  instanceId,
  categories,
  onProductAdded,
  product,
}: AddProductDialogProps) {
  const { t } = useTranslation();
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState('');
  const [shortName, setShortName] = useState('');
  const [brand, setBrand] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [customCategory, setCustomCategory] = useState('');
  const [price, setPrice] = useState('');
  const [metadataFields, setMetadataFields] = useState<MetadataField[]>([]);
  const [reminderTemplateId, setReminderTemplateId] = useState<string>('__none__');
  const [reminderTemplates, setReminderTemplates] = useState<ReminderTemplateOption[]>([]);

  const isEditMode = !!product;

  // Fetch reminder templates
  useEffect(() => {
    const fetchTemplates = async () => {
      const { data } = await supabase
        .from('reminder_templates')
        .select('id, name')
        .eq('instance_id', instanceId)
        .order('name');
      setReminderTemplates(data || []);
    };
    if (open && instanceId) {
      fetchTemplates();
    }
  }, [open, instanceId]);

  const resetForm = () => {
    setName('');
    setShortName('');
    setBrand('');
    setDescription('');
    setCategory('');
    setCustomCategory('');
    setPrice('');
    setMetadataFields([]);
    setReminderTemplateId('__none__');
  };

  // Initialize form with product data in edit mode
  useEffect(() => {
    if (product && open) {
      setName(product.name || '');
      setShortName(product.short_name || '');
      setBrand(product.brand || '');
      setDescription(product.description || '');
      setPrice(product.default_price?.toString() || '0');
      setReminderTemplateId(product.reminder_template_id || '__none__');
      
      // Handle category
      if (product.category) {
        if (categories.includes(product.category)) {
          setCategory(product.category);
          setCustomCategory('');
        } else {
          setCategory('__custom__');
          setCustomCategory(product.category);
        }
      } else {
        setCategory('__none__');
        setCustomCategory('');
      }
      
      // Handle metadata - exclude internal fields like _source
      if (product.metadata && typeof product.metadata === 'object') {
        const fields: MetadataField[] = [];
        Object.entries(product.metadata).forEach(([key, value]) => {
          if (!key.startsWith('_')) {
            fields.push({ key, value: String(value) });
          }
        });
        setMetadataFields(fields);
      } else {
        setMetadataFields([]);
      }
    } else if (!product && open) {
      resetForm();
    }
  }, [product, open, categories]);

  const handleClose = () => {
    if (!isEditMode) {
      resetForm();
    }
    onOpenChange(false);
  };

  const addMetadataField = () => {
    setMetadataFields([...metadataFields, { key: '', value: '' }]);
  };

  const updateMetadataField = (index: number, field: 'key' | 'value', value: string) => {
    const updated = [...metadataFields];
    updated[index][field] = value;
    setMetadataFields(updated);
  };

  const removeMetadataField = (index: number) => {
    setMetadataFields(metadataFields.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!name.trim()) {
      toast.error(t('productDialog.nameRequired'));
      return;
    }

    const priceValue = parseFloat(price.replace(',', '.'));
    if (isNaN(priceValue) || priceValue < 0) {
      toast.error(t('productDialog.invalidPrice'));
      return;
    }

    setSaving(true);

    try {
      // Build metadata object from fields
      const metadata: Record<string, string> = {
        _source: 'manual',
      };
      
      // Preserve existing _source if editing
      if (isEditMode && product?.metadata) {
        const existingMetadata = product.metadata as Record<string, unknown>;
        if (existingMetadata._source) {
          metadata._source = String(existingMetadata._source);
        }
      }
      
      metadataFields.forEach(field => {
        if (field.key.trim() && field.value.trim()) {
          metadata[field.key.trim()] = field.value.trim();
        }
      });

      const finalCategory = category === '__custom__' ? customCategory.trim() : (category === '__none__' ? null : category);
      const finalTemplateId = reminderTemplateId === '__none__' ? null : reminderTemplateId;

      if (isEditMode && product) {
        // Update existing product
        const { error } = await supabase
          .from('products_library')
          .update({
            name: name.trim(),
            short_name: shortName.trim() || null,
            brand: brand.trim() || null,
            description: description.trim() || null,
            category: finalCategory || null,
            unit: 'szt',
            default_price: priceValue,
            metadata: Object.keys(metadata).length > 0 ? metadata : null,
            reminder_template_id: finalTemplateId,
          })
          .eq('id', product.id);

        if (error) throw error;
        toast.success(t('productDialog.productUpdated'));
      } else {
        // Create new product
        const { error } = await supabase
          .from('products_library')
          .insert({
            instance_id: instanceId,
            name: name.trim(),
            short_name: shortName.trim() || null,
            brand: brand.trim() || null,
            description: description.trim() || null,
            category: finalCategory || null,
            unit: 'szt',
            default_price: priceValue,
            metadata: metadata,
            source: 'instance',
            active: true,
            reminder_template_id: finalTemplateId,
          });

        if (error) throw error;
        toast.success(t('productDialog.productAdded'));
      }

      onProductAdded();
      handleClose();
    } catch (error) {
      console.error('Error saving product:', error);
      toast.error(isEditMode ? t('productDialog.updateError') : t('productDialog.addError'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-[1100px] max-h-[90vh] p-0 w-[calc(100%-2rem)] sm:w-full">
        <DialogHeader className="p-4 sm:p-6 pb-0">
          <DialogTitle>
            {isEditMode ? t('productDialog.editTitle') : t('productDialog.addTitle')}
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="max-h-[calc(90vh-140px)]">
          <form onSubmit={handleSubmit} className="space-y-4 p-4 sm:p-6 pt-4">
            {/* Mobile: stacked layout, Desktop: grid */}
            {/* 1. Nazwa */}
            <div className="space-y-2">
              <Label htmlFor="name">{t('productDialog.name')} *</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t('productDialog.namePlaceholder')}
                required
              />
            </div>

            {/* 2. Nazwa skrócona + 3. Cena netto - side by side */}
            <div className="grid grid-cols-2 gap-3 sm:gap-4">
              <div className="space-y-2">
                <Label htmlFor="shortName">Nazwa skrócona</Label>
                <Input
                  id="shortName"
                  value={shortName}
                  onChange={(e) => setShortName(e.target.value)}
                  placeholder="Np. Q² Pure"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="price">{t('productDialog.price')} *</Label>
                <Input
                  id="price"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  placeholder="0"
                  type="text"
                  inputMode="numeric"
                />
              </div>
            </div>

            {/* 4. Marka + 5. Kategoria - side by side */}
            <div className="grid grid-cols-2 gap-3 sm:gap-4">
              <div className="space-y-2">
                <Label htmlFor="brand">{t('productDialog.brand')}</Label>
                <Input
                  id="brand"
                  value={brand}
                  onChange={(e) => setBrand(e.target.value)}
                  placeholder={t('productDialog.brandPlaceholder')}
                />
              </div>

              <div className="space-y-2">
                <Label>{t('productDialog.category')}</Label>
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger className="bg-white">
                    <SelectValue placeholder={t('productDialog.selectCategory')} />
                  </SelectTrigger>
                  <SelectContent className="bg-white">
                    <SelectItem value="__none__">{t('productDialog.noCategory')}</SelectItem>
                    {categories.map(cat => (
                      <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                    ))}
                    <SelectItem value="__custom__">{t('productDialog.newCategory')}</SelectItem>
                  </SelectContent>
                </Select>
                {category === '__custom__' && (
                  <Input
                    value={customCategory}
                    onChange={(e) => setCustomCategory(e.target.value)}
                    placeholder={t('productDialog.newCategoryPlaceholder')}
                    className="mt-2"
                  />
                )}
              </div>
            </div>

            {/* 6. Opis */}
            <div className="space-y-2">
              <Label htmlFor="description">{t('productDialog.description')}</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={t('productDialog.descriptionPlaceholder')}
                rows={6}
                className="min-h-[120px] sm:min-h-[240px] sm:rows-10"
              />
            </div>

            {/* 7. Szablon przypomnień */}
            {reminderTemplates.length > 0 && (
              <div className="space-y-2 w-full sm:w-[30%]">
                <Label>{t('productDialog.reminderTemplate')}</Label>
                <Select value={reminderTemplateId} onValueChange={setReminderTemplateId}>
                  <SelectTrigger className="bg-white">
                    <SelectValue placeholder={t('reminderTemplates.noTemplate')} />
                  </SelectTrigger>
                  <SelectContent className="bg-white">
                    <SelectItem value="__none__">{t('reminderTemplates.noTemplate')}</SelectItem>
                    {reminderTemplates.map(template => (
                      <SelectItem key={template.id} value={template.id}>{template.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  {t('productDialog.reminderTemplateHelp')}
                </p>
              </div>
            )}

            {/* Custom metadata - at the bottom */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>{t('productDialog.additionalParams')}</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addMetadataField}
                  className="gap-1"
                >
                  <Plus className="h-3 w-3" />
                  {t('common.add')}
                </Button>
              </div>
              
              {metadataFields.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  {t('productDialog.noParams')}
                </p>
              ) : (
                <div className="space-y-2">
                  {metadataFields.map((field, index) => (
                    <div key={index} className="flex gap-2 items-center">
                      <Input
                        value={field.key}
                        onChange={(e) => updateMetadataField(index, 'key', e.target.value)}
                        placeholder={t('productDialog.paramName')}
                        className="flex-1"
                      />
                      <Input
                        value={field.value}
                        onChange={(e) => updateMetadataField(index, 'value', e.target.value)}
                        placeholder={t('productDialog.paramValue')}
                        className="flex-1"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => removeMetadataField(index)}
                        className="shrink-0 text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <DialogFooter className="pt-4">
              <Button type="button" variant="outline" onClick={handleClose}>
                {t('common.cancel')}
              </Button>
              <Button type="submit" disabled={saving}>
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {isEditMode ? t('productDialog.saveChanges') : t('productDialog.addProduct')}
              </Button>
            </DialogFooter>
          </form>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
