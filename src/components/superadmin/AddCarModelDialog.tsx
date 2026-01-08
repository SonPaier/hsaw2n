import React, { useState } from 'react';
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

interface AddCarModelDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => Promise<void>;
}

export const AddCarModelDialog: React.FC<AddCarModelDialogProps> = ({
  open,
  onOpenChange,
  onSuccess,
}) => {
  const [brand, setBrand] = useState('');
  const [name, setName] = useState('');
  const [size, setSize] = useState<'S' | 'M' | 'L'>('M');
  const [isSubmitting, setIsSubmitting] = useState(false);

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
        .insert({
          brand: brand.trim(),
          name: name.trim(),
          size,
        });

      if (error) {
        if (error.code === '23505') {
          toast.error(`Model ${brand} ${name} już istnieje`);
        } else {
          throw error;
        }
        return;
      }

      toast.success(`Dodano ${brand} ${name}`);
      setBrand('');
      setName('');
      setSize('M');
      onOpenChange(false);
      await onSuccess();
    } catch (error) {
      console.error('Error adding car model:', error);
      toast.error('Błąd podczas dodawania modelu');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Dodaj nowy model samochodu</DialogTitle>
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
              Dodaj
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
