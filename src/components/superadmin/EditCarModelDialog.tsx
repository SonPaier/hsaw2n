import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';

interface EditCarModelDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  model: {
    id: string;
    brand: string;
    name: string;
    size: string;
  };
  onSuccess: () => Promise<void>;
}

export const EditCarModelDialog: React.FC<EditCarModelDialogProps> = ({
  open,
  onOpenChange,
  model,
  onSuccess,
}) => {
  const [brand, setBrand] = useState(model.brand);
  const [name, setName] = useState(model.name);
  const [size, setSize] = useState<'S' | 'M' | 'L'>(model.size as 'S' | 'M' | 'L');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    setBrand(model.brand);
    setName(model.name);
    setSize(model.size as 'S' | 'M' | 'L');
  }, [model]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!brand.trim() || !name.trim()) {
      toast.error('Wypełnij wszystkie pola');
      return;
    }

    try {
      setIsSubmitting(true);

      const { error } = await supabase
        .from('car_models')
        .update({
          brand: brand.trim(),
          name: name.trim(),
          size,
          updated_at: new Date().toISOString(),
        })
        .eq('id', model.id);

      if (error) {
        if (error.code === '23505') {
          toast.error(`Model ${brand} ${name} już istnieje`);
        } else {
          throw error;
        }
        return;
      }

      toast.success(`Zaktualizowano ${brand} ${name}`);
      onOpenChange(false);
      await onSuccess();
    } catch (error) {
      console.error('Error updating car model:', error);
      toast.error('Błąd podczas aktualizacji modelu');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edytuj model samochodu</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="brand">Marka</Label>
            <Input
              id="brand"
              value={brand}
              onChange={(e) => setBrand(e.target.value)}
              placeholder="np. Toyota"
              autoFocus
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="name">Model</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="np. Corolla"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="size">Rozmiar</Label>
            <Select value={size} onValueChange={(v: 'S' | 'M' | 'L') => setSize(v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="S">Mały (S) - kompaktowe, hatchbacki</SelectItem>
                <SelectItem value="M">Średni (M) - sedany, kombi</SelectItem>
                <SelectItem value="L">Duży (L) - SUV, vany, pickupy</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Anuluj
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Zapisz
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
