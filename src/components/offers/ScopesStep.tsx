import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Check, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

interface OfferScope {
  id: string;
  name: string;
  description: string | null;
  has_coating_upsell: boolean;
  is_extras_scope: boolean;
}

interface ScopesStepProps {
  instanceId: string;
  selectedScopeIds: string[];
  onScopesChange: (scopeIds: string[]) => void;
}

export function ScopesStep({ instanceId, selectedScopeIds, onScopesChange }: ScopesStepProps) {
  const [scopes, setScopes] = useState<OfferScope[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchScopes();
  }, [instanceId]);

  const fetchScopes = async () => {
    try {
      const { data, error } = await supabase
        .from('offer_scopes')
        .select('id, name, description, has_coating_upsell, is_extras_scope')
        .eq('instance_id', instanceId)
        .eq('active', true)
        .eq('is_extras_scope', false) // Exclude extras scopes - they are always shown in step 3
        .order('sort_order');

      if (error) throw error;
      setScopes(data || []);
    } catch (error) {
      console.error('Error fetching scopes:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleScope = (scopeId: string) => {
    if (selectedScopeIds.includes(scopeId)) {
      onScopesChange(selectedScopeIds.filter(id => id !== scopeId));
    } else {
      onScopesChange([...selectedScopeIds, scopeId]);
    }
  };

  if (loading) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        Ładowanie zakresów...
      </div>
    );
  }

  if (scopes.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-muted-foreground mb-4">
          Brak zdefiniowanych zakresów. Dodaj zakresy w ustawieniach ofert.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="text-center mb-6">
        <h2 className="text-lg font-semibold">Wybierz zakresy usług</h2>
        <p className="text-sm text-muted-foreground">
          Zaznacz jeden lub więcej zakresów, które chcesz uwzględnić w ofercie
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {scopes.map((scope) => {
          const isSelected = selectedScopeIds.includes(scope.id);
          
          return (
            <Card
              key={scope.id}
              className={cn(
                "cursor-pointer transition-all duration-200 hover:shadow-md",
                isSelected 
                  ? "ring-2 ring-primary bg-primary/5 border-primary" 
                  : "hover:border-primary/50"
              )}
              onClick={() => toggleScope(scope.id)}
            >
              <CardContent className="p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="font-semibold truncate">{scope.name}</h3>
                      {scope.has_coating_upsell && (
                        <Badge variant="secondary" className="gap-1 shrink-0">
                          <Sparkles className="h-3 w-3" />
                          +Powłoka
                        </Badge>
                      )}
                    </div>
                    {scope.description && (
                      <p className="text-sm text-muted-foreground line-clamp-2">
                        {scope.description}
                      </p>
                    )}
                  </div>
                  <div className={cn(
                    "w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors",
                    isSelected 
                      ? "bg-primary border-primary text-primary-foreground" 
                      : "border-muted-foreground/30"
                  )}>
                    {isSelected && <Check className="h-4 w-4" />}
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {selectedScopeIds.length > 0 && (
        <div className="text-center text-sm text-muted-foreground pt-4">
          Wybrano: {selectedScopeIds.length} {selectedScopeIds.length === 1 ? 'zakres' : 
            selectedScopeIds.length < 5 ? 'zakresy' : 'zakresów'}
        </div>
      )}
    </div>
  );
}
