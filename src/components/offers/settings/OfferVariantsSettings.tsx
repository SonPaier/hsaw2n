import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent } from '@/components/ui/card';
import { Plus, Trash2, GripVertical } from 'lucide-react';
import { toast } from 'sonner';

interface OfferVariant {
  id: string;
  name: string;
  description: string | null;
  sort_order: number;
  active: boolean;
}

interface OfferVariantsSettingsProps {
  instanceId: string;
}

export function OfferVariantsSettings({ instanceId }: OfferVariantsSettingsProps) {
  const [variants, setVariants] = useState<OfferVariant[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchVariants();
  }, [instanceId]);

  const fetchVariants = async () => {
    try {
      const { data, error } = await supabase
        .from('offer_variants')
        .select('*')
        .eq('instance_id', instanceId)
        .order('sort_order');

      if (error) throw error;
      setVariants(data || []);
    } catch (error) {
      console.error('Error fetching variants:', error);
      toast.error('Błąd podczas pobierania wariantów');
    } finally {
      setLoading(false);
    }
  };

  const handleAddVariant = async () => {
    const newVariant = {
      instance_id: instanceId,
      name: 'Nowy wariant',
      description: null,
      sort_order: variants.length,
      active: true,
    };

    try {
      const { data, error } = await supabase
        .from('offer_variants')
        .insert(newVariant)
        .select()
        .single();

      if (error) throw error;
      setVariants([...variants, data]);
      toast.success('Dodano nowy wariant');
    } catch (error) {
      console.error('Error adding variant:', error);
      toast.error('Błąd podczas dodawania wariantu');
    }
  };

  const handleUpdateVariant = async (id: string, updates: Partial<OfferVariant>) => {
    setVariants(variants.map(v => v.id === id ? { ...v, ...updates } : v));
  };

  const handleSaveVariant = async (variant: OfferVariant) => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from('offer_variants')
        .update({
          name: variant.name,
          description: variant.description,
          active: variant.active,
          sort_order: variant.sort_order,
        })
        .eq('id', variant.id);

      if (error) throw error;
      toast.success('Zapisano zmiany');
    } catch (error) {
      console.error('Error updating variant:', error);
      toast.error('Błąd podczas zapisywania');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteVariant = async (id: string) => {
    if (!confirm('Czy na pewno chcesz usunąć ten wariant?')) return;

    try {
      const { error } = await supabase
        .from('offer_variants')
        .delete()
        .eq('id', id);

      if (error) throw error;
      setVariants(variants.filter(v => v.id !== id));
      toast.success('Usunięto wariant');
    } catch (error) {
      console.error('Error deleting variant:', error);
      toast.error('Błąd podczas usuwania');
    }
  };

  if (loading) {
    return <div className="text-muted-foreground">Ładowanie...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium">Warianty oferty</h3>
          <p className="text-sm text-muted-foreground">
            Zdefiniuj warianty cenowe (np. Standard, Premium)
          </p>
        </div>
        <Button onClick={handleAddVariant} size="sm">
          <Plus className="h-4 w-4 mr-2" />
          Dodaj wariant
        </Button>
      </div>

      {variants.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            Brak zdefiniowanych wariantów. Kliknij "Dodaj wariant" aby utworzyć pierwszy.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {variants.map((variant) => (
            <Card key={variant.id}>
              <CardContent className="py-4">
                <div className="flex items-start gap-4">
                  <div className="pt-2 cursor-grab text-muted-foreground">
                    <GripVertical className="h-5 w-5" />
                  </div>
                  <div className="flex-1 space-y-3">
                    <div className="flex items-center gap-4">
                      <Input
                        value={variant.name}
                        onChange={(e) => handleUpdateVariant(variant.id, { name: e.target.value })}
                        onBlur={() => handleSaveVariant(variant)}
                        placeholder="Nazwa wariantu"
                        className="flex-1"
                      />
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={variant.active}
                          onCheckedChange={(checked) => {
                            handleUpdateVariant(variant.id, { active: checked });
                            handleSaveVariant({ ...variant, active: checked });
                          }}
                        />
                        <span className="text-sm text-muted-foreground">Aktywny</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <Input
                        value={variant.description || ''}
                        onChange={(e) => handleUpdateVariant(variant.id, { description: e.target.value })}
                        onBlur={() => handleSaveVariant(variant)}
                        placeholder="Opis (opcjonalny)"
                        className="flex-1"
                      />
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteVariant(variant.id)}
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
