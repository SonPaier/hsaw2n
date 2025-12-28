import { useState } from 'react';
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

interface MetadataField {
  key: string;
  value: string;
}

interface AddProductDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  instanceId: string;
  categories: string[];
  onProductAdded: () => void;
}

const COMMON_UNITS = ['szt', 'mb', 'm²', 'l', 'kg', 'opak', 'kpl'];

export function AddProductDialog({
  open,
  onOpenChange,
  instanceId,
  categories,
  onProductAdded,
}: AddProductDialogProps) {
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState('');
  const [brand, setBrand] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [customCategory, setCustomCategory] = useState('');
  const [unit, setUnit] = useState('szt');
  const [customUnit, setCustomUnit] = useState('');
  const [price, setPrice] = useState('');
  const [metadataFields, setMetadataFields] = useState<MetadataField[]>([]);

  const resetForm = () => {
    setName('');
    setBrand('');
    setDescription('');
    setCategory('');
    setCustomCategory('');
    setUnit('szt');
    setCustomUnit('');
    setPrice('');
    setMetadataFields([]);
  };

  const handleClose = () => {
    resetForm();
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
      toast.error('Nazwa produktu jest wymagana');
      return;
    }

    const priceValue = parseFloat(price.replace(',', '.'));
    if (isNaN(priceValue) || priceValue < 0) {
      toast.error('Podaj prawidłową cenę');
      return;
    }

    setSaving(true);

    try {
      // Build metadata object from fields - always include _source: 'manual'
      const metadata: Record<string, string> = {
        _source: 'manual',
      };
      metadataFields.forEach(field => {
        if (field.key.trim() && field.value.trim()) {
          metadata[field.key.trim()] = field.value.trim();
        }
      });

      const finalCategory = category === '__custom__' ? customCategory.trim() : category;
      const finalUnit = unit === '__custom__' ? customUnit.trim() : unit;

      const { error } = await supabase
        .from('products_library')
        .insert({
          instance_id: instanceId,
          name: name.trim(),
          brand: brand.trim() || null,
          description: description.trim() || null,
          category: finalCategory || null,
          unit: finalUnit || 'szt',
          default_price: priceValue,
          metadata: metadata,
          source: 'instance',
          active: true,
        });

      if (error) throw error;

      toast.success('Produkt został dodany');
      handleClose();
      onProductAdded();
    } catch (error) {
      console.error('Error adding product:', error);
      toast.error('Nie udało się dodać produktu');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Dodaj produkt</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Basic info */}
          <div className="space-y-2">
            <Label htmlFor="name">Nazwa *</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Nazwa produktu"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="brand">Marka</Label>
              <Input
                id="brand"
                value={brand}
                onChange={(e) => setBrand(e.target.value)}
                placeholder="np. 3M, Koch Chemie"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="price">Cena (PLN) *</Label>
              <Input
                id="price"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="0.00"
                type="text"
                inputMode="decimal"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Kategoria</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger>
                  <SelectValue placeholder="Wybierz kategorię" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Brak kategorii</SelectItem>
                  {categories.map(cat => (
                    <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                  ))}
                  <SelectItem value="__custom__">+ Nowa kategoria</SelectItem>
                </SelectContent>
              </Select>
              {category === '__custom__' && (
                <Input
                  value={customCategory}
                  onChange={(e) => setCustomCategory(e.target.value)}
                  placeholder="Nazwa nowej kategorii"
                  className="mt-2"
                />
              )}
            </div>

            <div className="space-y-2">
              <Label>Jednostka</Label>
              <Select value={unit} onValueChange={setUnit}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {COMMON_UNITS.map(u => (
                    <SelectItem key={u} value={u}>{u}</SelectItem>
                  ))}
                  <SelectItem value="__custom__">+ Inna</SelectItem>
                </SelectContent>
              </Select>
              {unit === '__custom__' && (
                <Input
                  value={customUnit}
                  onChange={(e) => setCustomUnit(e.target.value)}
                  placeholder="Własna jednostka"
                  className="mt-2"
                />
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Opis</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Opis produktu (opcjonalnie)"
              rows={3}
            />
          </div>

          {/* Custom metadata */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Dodatkowe parametry</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addMetadataField}
                className="gap-1"
              >
                <Plus className="h-3 w-3" />
                Dodaj
              </Button>
            </div>
            
            {metadataFields.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Brak dodatkowych parametrów. Kliknij "Dodaj" aby dodać własne pola.
              </p>
            ) : (
              <div className="space-y-2">
                {metadataFields.map((field, index) => (
                  <div key={index} className="flex gap-2 items-center">
                    <Input
                      value={field.key}
                      onChange={(e) => updateMetadataField(index, 'key', e.target.value)}
                      placeholder="Nazwa parametru"
                      className="flex-1"
                    />
                    <Input
                      value={field.value}
                      onChange={(e) => updateMetadataField(index, 'value', e.target.value)}
                      placeholder="Wartość"
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

          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleClose}>
              Anuluj
            </Button>
            <Button type="submit" disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Dodaj produkt
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
