import { useState, useEffect } from 'react';
import { X, Loader2 } from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from '@/components/ui/sheet';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

interface SalesProductData {
  id: string;
  fullName: string;
  shortName: string;
  description?: string;
  priceNet: number;
  priceUnit: string;
}

interface AddSalesProductDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  instanceId: string;
  onSaved?: () => void;
  product?: SalesProductData | null;
}

const AddSalesProductDrawer = ({ open, onOpenChange, instanceId, onSaved, product }: AddSalesProductDrawerProps) => {
  const isEdit = !!product;
  const [fullName, setFullName] = useState('');
  const [shortName, setShortName] = useState('');
  const [description, setDescription] = useState('');
  const [priceNet, setPriceNet] = useState('');
  const [priceUnit, setPriceUnit] = useState<'piece' | 'meter'>('piece');
  const [saving, setSaving] = useState(false);

  const resetForm = () => {
    setFullName('');
    setShortName('');
    setDescription('');
    setPriceNet('');
    setPriceUnit('piece');
  };

  useEffect(() => {
    if (!open) return;
    if (product) {
      setFullName(product.fullName);
      setShortName(product.shortName);
      setDescription(product.description || '');
      setPriceNet(product.priceNet ? String(product.priceNet) : '');
      setPriceUnit((product.priceUnit as 'piece' | 'meter') || 'piece');
    } else {
      resetForm();
    }
  }, [open, product]);

  const handleClose = () => {
    onOpenChange(false);
  };

  const handleSubmit = async () => {
    if (!fullName.trim() || !shortName.trim()) {
      toast.error('Uzupełnij wymagane pola');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        full_name: fullName.trim(),
        short_name: shortName.trim(),
        description: description.trim() || null,
        price_net: parseFloat(priceNet) || 0,
        price_unit: priceUnit,
      };

      if (isEdit && product) {
        const { error } = await (supabase
          .from('sales_products')
          .update(payload)
          .eq('id', product.id) as any);
        if (error) throw error;
        toast.success('Produkt zaktualizowany');
      } else {
        const { error } = await (supabase
          .from('sales_products')
          .insert({ instance_id: instanceId, ...payload }) as any);
        if (error) throw error;
        toast.success('Produkt został dodany');
      }
      resetForm();
      handleClose();
      onSaved?.();
    } catch (err: any) {
      toast.error('Błąd: ' + (err.message || ''));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet
      open={open}
      onOpenChange={(isOpen) => {
        if (!isOpen) {
          resetForm();
          onOpenChange(false);
        }
      }}
      modal={false}
    >
      <SheetContent
        side="right"
        className="w-full sm:max-w-[27rem] flex flex-col h-full p-0 gap-0 shadow-[-8px_0_30px_-12px_rgba(0,0,0,0.15)] bg-white [&_input]:border-foreground/60 [&_textarea]:border-foreground/60 [&_select]:border-foreground/60"
        hideOverlay
        hideCloseButton
        onInteractOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <SheetHeader className="px-6 pt-6 pb-4 border-b shrink-0">
          <div className="flex items-center justify-between">
            <SheetTitle>{isEdit ? 'Edytuj produkt' : 'Dodaj produkt'}</SheetTitle>
            <button
              type="button"
              onClick={handleClose}
              className="p-2 rounded-full hover:bg-muted transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-6 py-4">
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="product-full-name">Pełna nazwa produktu</Label>
              <Input
                id="product-full-name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="product-short-name">Skrócona nazwa produktu</Label>
              <Input
                id="product-short-name"
                value={shortName}
                onChange={(e) => setShortName(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="product-description">Opis</Label>
              <Textarea
                id="product-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="product-price">Cena netto</Label>
              <Input
                id="product-price"
                type="number"
                min={0}
                step="0.01"
                placeholder="0.00"
                value={priceNet}
                onChange={(e) => setPriceNet(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>Cena za</Label>
              <RadioGroup
                value={priceUnit}
                onValueChange={(v) => setPriceUnit(v as 'piece' | 'meter')}
                className="flex gap-4"
              >
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="piece" id="unit-piece" />
                  <Label htmlFor="unit-piece" className="font-normal cursor-pointer">
                    Sztukę
                  </Label>
                </div>
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="meter" id="unit-meter" />
                  <Label htmlFor="unit-meter" className="font-normal cursor-pointer">
                    m²
                  </Label>
                </div>
              </RadioGroup>
            </div>
          </div>
        </div>

        <SheetFooter className="px-6 py-4 border-t shrink-0">
          <div className="flex gap-3 w-full">
            <Button variant="outline" className="flex-1" onClick={handleClose}>
              Anuluj
            </Button>
            <Button className="flex-1" onClick={handleSubmit} disabled={saving}>
              {saving ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />Zapisuję...</> : isEdit ? 'Zapisz zmiany' : 'Dodaj produkt'}
            </Button>
          </div>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
};

export default AddSalesProductDrawer;
