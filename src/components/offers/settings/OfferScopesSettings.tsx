import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Plus, Trash2, GripVertical, Sparkles } from 'lucide-react';
import { toast } from 'sonner';

interface OfferScope {
  id: string;
  name: string;
  description: string | null;
  sort_order: number;
  active: boolean;
  has_coating_upsell: boolean;
}

interface OfferScopesSettingsProps {
  instanceId: string;
}

export function OfferScopesSettings({ instanceId }: OfferScopesSettingsProps) {
  const [scopes, setScopes] = useState<OfferScope[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchScopes();
  }, [instanceId]);

  const fetchScopes = async () => {
    try {
      const { data, error } = await supabase
        .from('offer_scopes')
        .select('*')
        .eq('instance_id', instanceId)
        .order('sort_order');

      if (error) throw error;
      setScopes(data || []);
    } catch (error) {
      console.error('Error fetching scopes:', error);
      toast.error('Błąd podczas pobierania zakresów');
    } finally {
      setLoading(false);
    }
  };

  const handleAddScope = async () => {
    const newScope = {
      instance_id: instanceId,
      name: 'Nowy zakres',
      description: null,
      sort_order: scopes.length,
      active: true,
      has_coating_upsell: false,
    };

    try {
      const { data, error } = await supabase
        .from('offer_scopes')
        .insert(newScope)
        .select()
        .single();

      if (error) throw error;
      setScopes([...scopes, data]);
      toast.success('Dodano nowy zakres');
    } catch (error) {
      console.error('Error adding scope:', error);
      toast.error('Błąd podczas dodawania zakresu');
    }
  };

  const handleUpdateScope = async (id: string, updates: Partial<OfferScope>) => {
    setScopes(scopes.map(s => s.id === id ? { ...s, ...updates } : s));
  };

  const handleSaveScope = async (scope: OfferScope) => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from('offer_scopes')
        .update({
          name: scope.name,
          description: scope.description,
          active: scope.active,
          has_coating_upsell: scope.has_coating_upsell,
          sort_order: scope.sort_order,
        })
        .eq('id', scope.id);

      if (error) throw error;
      toast.success('Zapisano zmiany');
    } catch (error) {
      console.error('Error updating scope:', error);
      toast.error('Błąd podczas zapisywania');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteScope = async (id: string) => {
    if (!confirm('Czy na pewno chcesz usunąć ten zakres?')) return;

    try {
      const { error } = await supabase
        .from('offer_scopes')
        .delete()
        .eq('id', id);

      if (error) throw error;
      setScopes(scopes.filter(s => s.id !== id));
      toast.success('Usunięto zakres');
    } catch (error) {
      console.error('Error deleting scope:', error);
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
          <h3 className="text-lg font-medium">Zakresy oferty</h3>
          <p className="text-sm text-muted-foreground">
            Zdefiniuj zakresy usług (np. PPF Full Front, Cała karoseria)
          </p>
        </div>
        <Button onClick={handleAddScope} size="sm">
          <Plus className="h-4 w-4 mr-2" />
          Dodaj zakres
        </Button>
      </div>

      {scopes.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            Brak zdefiniowanych zakresów. Kliknij "Dodaj zakres" aby utworzyć pierwszy.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {scopes.map((scope) => (
            <Card key={scope.id}>
              <CardContent className="py-4">
                <div className="flex items-start gap-4">
                  <div className="pt-2 cursor-grab text-muted-foreground">
                    <GripVertical className="h-5 w-5" />
                  </div>
                  <div className="flex-1 space-y-3">
                    <div className="flex items-center gap-4">
                      <Input
                        value={scope.name}
                        onChange={(e) => handleUpdateScope(scope.id, { name: e.target.value })}
                        onBlur={() => handleSaveScope(scope)}
                        placeholder="Nazwa zakresu"
                        className="flex-1"
                      />
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={scope.active}
                          onCheckedChange={(checked) => {
                            handleUpdateScope(scope.id, { active: checked });
                            handleSaveScope({ ...scope, active: checked });
                          }}
                        />
                        <span className="text-sm text-muted-foreground">Aktywny</span>
                      </div>
                    </div>
                    <Input
                      value={scope.description || ''}
                      onChange={(e) => handleUpdateScope(scope.id, { description: e.target.value })}
                      onBlur={() => handleSaveScope(scope)}
                      placeholder="Opis (opcjonalny)"
                    />
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={scope.has_coating_upsell}
                          onCheckedChange={(checked) => {
                            handleUpdateScope(scope.id, { has_coating_upsell: checked });
                            handleSaveScope({ ...scope, has_coating_upsell: checked });
                          }}
                        />
                        <div className="flex items-center gap-1">
                          <Sparkles className="h-4 w-4 text-amber-500" />
                          <span className="text-sm">Automatyczny upsell powłoki</span>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteScope(scope.id)}
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
