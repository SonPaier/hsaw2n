import { useState, useEffect, forwardRef, useImperativeHandle } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent } from '@/components/ui/card';
import { Plus, Trash2, GripVertical, Sparkles } from 'lucide-react';
import { toast } from 'sonner';

interface OfferScope {
  id: string;
  name: string;
  description: string | null;
  sort_order: number;
  active: boolean;
  has_coating_upsell: boolean;
  isNew?: boolean;
  isDeleted?: boolean;
  isDirty?: boolean;
}

interface OfferScopesSettingsProps {
  instanceId: string;
  onChange?: () => void;
}

export interface OfferScopesSettingsRef {
  saveAll: () => Promise<boolean>;
}

export const OfferScopesSettings = forwardRef<OfferScopesSettingsRef, OfferScopesSettingsProps>(
  ({ instanceId, onChange }, ref) => {
    const [scopes, setScopes] = useState<OfferScope[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
      fetchScopes();
    }, [instanceId]);

    useImperativeHandle(ref, () => ({
      saveAll: async () => {
        try {
          // Handle deletions
          const deletedScopes = scopes.filter(s => s.isDeleted);
          for (const scope of deletedScopes) {
            if (!scope.isNew) {
              const { error } = await supabase
                .from('offer_scopes')
                .delete()
                .eq('id', scope.id);
              if (error) throw error;
            }
          }

          // Handle new scopes
          const newScopes = scopes.filter(s => s.isNew && !s.isDeleted);
          for (const scope of newScopes) {
            const { error } = await supabase
              .from('offer_scopes')
              .insert({
                instance_id: instanceId,
                name: scope.name,
                description: scope.description,
                sort_order: scope.sort_order,
                active: scope.active,
                has_coating_upsell: scope.has_coating_upsell,
              });
            if (error) throw error;
          }

          // Handle updates
          const dirtyScopes = scopes.filter(s => s.isDirty && !s.isNew && !s.isDeleted);
          for (const scope of dirtyScopes) {
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
          }

          // Refresh data
          await fetchScopes();
          return true;
        } catch (error) {
          console.error('Error saving scopes:', error);
          toast.error('Błąd podczas zapisywania zakresów');
          return false;
        }
      },
    }));

    const fetchScopes = async () => {
      try {
        const { data, error } = await supabase
          .from('offer_scopes')
          .select('*')
          .eq('instance_id', instanceId)
          .order('sort_order');

        if (error) throw error;
        setScopes((data || []).map(s => ({ ...s, isNew: false, isDeleted: false, isDirty: false })));
      } catch (error) {
        console.error('Error fetching scopes:', error);
        toast.error('Błąd podczas pobierania zakresów');
      } finally {
        setLoading(false);
      }
    };

    const handleAddScope = () => {
      const newScope: OfferScope = {
        id: crypto.randomUUID(),
        name: 'Nowy zakres',
        description: null,
        sort_order: scopes.filter(s => !s.isDeleted).length,
        active: true,
        has_coating_upsell: false,
        isNew: true,
        isDirty: true,
      };
      setScopes([...scopes, newScope]);
      onChange?.();
    };

    const handleUpdateScope = (id: string, updates: Partial<OfferScope>) => {
      setScopes(scopes.map(s => 
        s.id === id ? { ...s, ...updates, isDirty: true } : s
      ));
      onChange?.();
    };

    const handleDeleteScope = (id: string) => {
      if (!confirm('Czy na pewno chcesz usunąć ten zakres?')) return;
      
      const scope = scopes.find(s => s.id === id);
      if (scope?.isNew) {
        setScopes(scopes.filter(s => s.id !== id));
      } else {
        setScopes(scopes.map(s => s.id === id ? { ...s, isDeleted: true } : s));
      }
      onChange?.();
    };

    if (loading) {
      return <div className="text-muted-foreground">Ładowanie...</div>;
    }

    const visibleScopes = scopes.filter(s => !s.isDeleted);

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

        {visibleScopes.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              Brak zdefiniowanych zakresów. Kliknij "Dodaj zakres" aby utworzyć pierwszy.
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {visibleScopes.map((scope) => (
              <Card key={scope.id} className={scope.isDirty ? 'ring-2 ring-primary/20' : ''}>
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
                          placeholder="Nazwa zakresu"
                          className="flex-1"
                        />
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={scope.active}
                            onCheckedChange={(checked) => handleUpdateScope(scope.id, { active: checked })}
                          />
                          <span className="text-sm text-muted-foreground">Aktywny</span>
                        </div>
                      </div>
                      <Input
                        value={scope.description || ''}
                        onChange={(e) => handleUpdateScope(scope.id, { description: e.target.value })}
                        placeholder="Opis (opcjonalny)"
                      />
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={scope.has_coating_upsell}
                            onCheckedChange={(checked) => handleUpdateScope(scope.id, { has_coating_upsell: checked })}
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
);

OfferScopesSettings.displayName = 'OfferScopesSettings';
