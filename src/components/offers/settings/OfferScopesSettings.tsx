import { useState, useEffect, forwardRef, useImperativeHandle } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent } from '@/components/ui/card';
import { Plus, Trash2, GripVertical, Tag, ChevronDown, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

interface OfferVariant {
  id: string;
  name: string;
  active: boolean;
}

interface ScopeVariantLink {
  variant_id: string;
  isNew?: boolean;
  isDeleted?: boolean;
}

interface ScopeExtra {
  id: string;
  name: string;
  description: string | null;
  is_upsell: boolean;
  sort_order: number;
  isNew?: boolean;
  isDeleted?: boolean;
  isDirty?: boolean;
}

interface OfferScope {
  id: string;
  name: string;
  description: string | null;
  sort_order: number;
  active: boolean;
  has_coating_upsell: boolean;
  is_extras_scope: boolean;
  variantLinks: ScopeVariantLink[];
  extras: ScopeExtra[];
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
    const [allVariants, setAllVariants] = useState<OfferVariant[]>([]);
    const [loading, setLoading] = useState(true);
    const [expandedScopes, setExpandedScopes] = useState<Set<string>>(new Set());

    useEffect(() => {
      fetchData();
    }, [instanceId]);

    useImperativeHandle(ref, () => ({
      saveAll: async () => {
        try {
          // Handle scope deletions
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

          // Handle new scopes - need to insert and get the real ID
          const newScopes = scopes.filter(s => s.isNew && !s.isDeleted);
          const scopeIdMap = new Map<string, string>(); // temp id -> real id
          
          for (const scope of newScopes) {
            const { data, error } = await supabase
              .from('offer_scopes')
              .insert({
                instance_id: instanceId,
                name: scope.name,
                description: scope.description,
                sort_order: scope.sort_order,
                active: scope.active,
                has_coating_upsell: false,
                is_extras_scope: scope.is_extras_scope,
              })
              .select('id')
              .single();
            if (error) throw error;
            scopeIdMap.set(scope.id, data.id);
          }

          // Handle scope updates
          const dirtyScopes = scopes.filter(s => s.isDirty && !s.isNew && !s.isDeleted);
          for (const scope of dirtyScopes) {
            const { error } = await supabase
              .from('offer_scopes')
              .update({
                name: scope.name,
                description: scope.description,
                active: scope.active,
                sort_order: scope.sort_order,
                is_extras_scope: scope.is_extras_scope,
              })
              .eq('id', scope.id);
            if (error) throw error;
          }

          // Handle variant links and extras for all scopes
          for (const scope of scopes.filter(s => !s.isDeleted)) {
            const realScopeId = scope.isNew ? scopeIdMap.get(scope.id) : scope.id;
            if (!realScopeId) continue;

            // Delete removed variant links
            const deletedLinks = scope.variantLinks.filter(l => l.isDeleted && !l.isNew);
            for (const link of deletedLinks) {
              await supabase
                .from('offer_scope_variants')
                .delete()
                .eq('scope_id', realScopeId)
                .eq('variant_id', link.variant_id);
            }

            // Add new variant links
            const newLinks = scope.variantLinks.filter(l => l.isNew && !l.isDeleted);
            for (const link of newLinks) {
              await supabase
                .from('offer_scope_variants')
                .insert({
                  scope_id: realScopeId,
                  variant_id: link.variant_id,
                  instance_id: instanceId,
                });
            }

            // Handle extras
            // Delete removed extras
            const deletedExtras = scope.extras.filter(e => e.isDeleted && !e.isNew);
            for (const extra of deletedExtras) {
              await supabase
                .from('offer_scope_extras')
                .delete()
                .eq('id', extra.id);
            }

            // Add new extras
            const newExtras = scope.extras.filter(e => e.isNew && !e.isDeleted);
            for (const extra of newExtras) {
              await supabase
                .from('offer_scope_extras')
                .insert({
                  scope_id: realScopeId,
                  instance_id: instanceId,
                  name: extra.name,
                  description: extra.description,
                  is_upsell: extra.is_upsell,
                  sort_order: extra.sort_order,
                });
            }

            // Update dirty extras
            const dirtyExtras = scope.extras.filter(e => e.isDirty && !e.isNew && !e.isDeleted);
            for (const extra of dirtyExtras) {
              await supabase
                .from('offer_scope_extras')
                .update({
                  name: extra.name,
                  description: extra.description,
                  is_upsell: extra.is_upsell,
                  sort_order: extra.sort_order,
                })
                .eq('id', extra.id);
            }
          }

          // Refresh data
          await fetchData();
          return true;
        } catch (error) {
          console.error('Error saving scopes:', error);
          toast.error('Błąd podczas zapisywania usług');
          return false;
        }
      },
    }));

    const fetchData = async () => {
      try {
        // Fetch variants
        const { data: variantsData, error: variantsError } = await supabase
          .from('offer_variants')
          .select('id, name, active')
          .eq('instance_id', instanceId)
          .eq('active', true)
          .order('sort_order');

        if (variantsError) throw variantsError;
        setAllVariants(variantsData || []);

        // Fetch scopes
        const { data: scopesData, error: scopesError } = await supabase
          .from('offer_scopes')
          .select('*')
          .eq('instance_id', instanceId)
          .order('sort_order');

        if (scopesError) throw scopesError;

        // Fetch scope-variant links
        const { data: linksData, error: linksError } = await supabase
          .from('offer_scope_variants')
          .select('scope_id, variant_id')
          .eq('instance_id', instanceId);

        if (linksError) throw linksError;

        // Fetch scope extras
        const { data: extrasData, error: extrasError } = await supabase
          .from('offer_scope_extras')
          .select('*')
          .eq('instance_id', instanceId)
          .order('sort_order');

        if (extrasError) throw extrasError;

        // Map links to scopes
        const linksByScope = (linksData || []).reduce((acc, link) => {
          if (!acc[link.scope_id]) acc[link.scope_id] = [];
          acc[link.scope_id].push({ variant_id: link.variant_id });
          return acc;
        }, {} as Record<string, ScopeVariantLink[]>);

        // Map extras to scopes
        const extrasByScope = (extrasData || []).reduce((acc, extra) => {
          if (!acc[extra.scope_id]) acc[extra.scope_id] = [];
          acc[extra.scope_id].push({
            id: extra.id,
            name: extra.name,
            description: extra.description,
            is_upsell: extra.is_upsell,
            sort_order: extra.sort_order || 0,
          });
          return acc;
        }, {} as Record<string, ScopeExtra[]>);

        setScopes((scopesData || []).map(s => ({ 
          ...s, 
          variantLinks: linksByScope[s.id] || [],
          extras: extrasByScope[s.id] || [],
          isNew: false, 
          isDeleted: false, 
          isDirty: false 
        })));
      } catch (error) {
        console.error('Error fetching data:', error);
        toast.error('Błąd podczas pobierania danych');
      } finally {
        setLoading(false);
      }
    };

    const handleAddScope = () => {
      const newScope: OfferScope = {
        id: crypto.randomUUID(),
        name: 'Nowa usługa',
        description: null,
        sort_order: scopes.filter(s => !s.isDeleted).length,
        active: true,
        has_coating_upsell: false,
        is_extras_scope: false,
        variantLinks: [],
        extras: [],
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
      if (!confirm('Czy na pewno chcesz usunąć tę usługę?')) return;
      
      const scope = scopes.find(s => s.id === id);
      if (scope?.isNew) {
        setScopes(scopes.filter(s => s.id !== id));
      } else {
        setScopes(scopes.map(s => s.id === id ? { ...s, isDeleted: true } : s));
      }
      onChange?.();
    };

    const toggleVariant = (scopeId: string, variantId: string) => {
      setScopes(scopes.map(scope => {
        if (scope.id !== scopeId) return scope;
        
        const existingLink = scope.variantLinks.find(l => l.variant_id === variantId);
        let newLinks: ScopeVariantLink[];
        
        if (existingLink) {
          if (existingLink.isNew) {
            newLinks = scope.variantLinks.filter(l => l.variant_id !== variantId);
          } else {
            newLinks = scope.variantLinks.map(l => 
              l.variant_id === variantId ? { ...l, isDeleted: true } : l
            );
          }
        } else {
          newLinks = [...scope.variantLinks, { variant_id: variantId, isNew: true }];
        }
        
        return { ...scope, variantLinks: newLinks, isDirty: true };
      }));
      onChange?.();
    };

    const handleAddExtra = (scopeId: string) => {
      setScopes(scopes.map(scope => {
        if (scope.id !== scopeId) return scope;
        
        const newExtra: ScopeExtra = {
          id: crypto.randomUUID(),
          name: 'Nowa opcja',
          description: null,
          is_upsell: true,
          sort_order: scope.extras.filter(e => !e.isDeleted).length,
          isNew: true,
          isDirty: true,
        };
        
        return { ...scope, extras: [...scope.extras, newExtra], isDirty: true };
      }));
      onChange?.();
    };

    const handleUpdateExtra = (scopeId: string, extraId: string, updates: Partial<ScopeExtra>) => {
      setScopes(scopes.map(scope => {
        if (scope.id !== scopeId) return scope;
        
        return {
          ...scope,
          extras: scope.extras.map(e => 
            e.id === extraId ? { ...e, ...updates, isDirty: true } : e
          ),
          isDirty: true,
        };
      }));
      onChange?.();
    };

    const handleDeleteExtra = (scopeId: string, extraId: string) => {
      setScopes(scopes.map(scope => {
        if (scope.id !== scopeId) return scope;
        
        const extra = scope.extras.find(e => e.id === extraId);
        let newExtras: ScopeExtra[];
        
        if (extra?.isNew) {
          newExtras = scope.extras.filter(e => e.id !== extraId);
        } else {
          newExtras = scope.extras.map(e => 
            e.id === extraId ? { ...e, isDeleted: true } : e
          );
        }
        
        return { ...scope, extras: newExtras, isDirty: true };
      }));
      onChange?.();
    };

    const isVariantLinked = (scope: OfferScope, variantId: string): boolean => {
      const link = scope.variantLinks.find(l => l.variant_id === variantId);
      return link ? !link.isDeleted : false;
    };

    const getLinkedVariantsCount = (scope: OfferScope): number => {
      return scope.variantLinks.filter(l => !l.isDeleted).length;
    };

    const getExtrasCount = (scope: OfferScope): number => {
      return scope.extras.filter(e => !e.isDeleted).length;
    };

    const toggleExpanded = (scopeId: string) => {
      setExpandedScopes(prev => {
        const next = new Set(prev);
        if (next.has(scopeId)) {
          next.delete(scopeId);
        } else {
          next.add(scopeId);
        }
        return next;
      });
    };

    if (loading) {
      return <div className="text-muted-foreground">Ładowanie...</div>;
    }

    const visibleScopes = scopes.filter(s => !s.isDeleted);

    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-medium">Usługi oferty</h3>
            <p className="text-sm text-muted-foreground">
              Zdefiniuj usługi, przypisz warianty i dodatkowe opcje
            </p>
          </div>
          <Button onClick={handleAddScope} size="sm">
            <Plus className="h-4 w-4 mr-2" />
            Dodaj usługę
          </Button>
        </div>

        {visibleScopes.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              Brak zdefiniowanych usług. Kliknij "Dodaj usługę" aby utworzyć pierwszą.
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
                          placeholder="Nazwa usługi"
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
                      
                      {/* Extras scope toggle */}
                      <div className="flex items-center gap-2 p-2 rounded-md bg-muted/50">
                        <Checkbox
                          id={`extras-${scope.id}`}
                          checked={scope.is_extras_scope}
                          onCheckedChange={(checked) => handleUpdateScope(scope.id, { is_extras_scope: !!checked })}
                        />
                        <label htmlFor={`extras-${scope.id}`} className="text-sm cursor-pointer">
                          <span className="font-medium">Usługa typu "Dodatki"</span>
                          <span className="text-muted-foreground ml-2">
                            — każda opcja jest niezależna, można dodać dowolne kombinacje
                          </span>
                        </label>
                      </div>
                      
                      {/* Variants and Extras */}
                      <Collapsible open={expandedScopes.has(scope.id)} onOpenChange={() => toggleExpanded(scope.id)}>
                        <div className="flex items-center justify-between">
                          <CollapsibleTrigger asChild>
                            <Button variant="ghost" size="sm" className="gap-2 px-2">
                              <Tag className="h-4 w-4" />
                              <span>Warianty</span>
                              <Badge variant="secondary" className="ml-1">
                                {getLinkedVariantsCount(scope)}
                              </Badge>
                              <span className="mx-2 text-muted-foreground">|</span>
                              <Sparkles className="h-4 w-4" />
                              <span>Opcje</span>
                              <Badge variant="secondary" className="ml-1">
                                {getExtrasCount(scope)}
                              </Badge>
                              <ChevronDown className={`h-4 w-4 transition-transform ${expandedScopes.has(scope.id) ? 'rotate-180' : ''}`} />
                            </Button>
                          </CollapsibleTrigger>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteScope(scope.id)}
                            className="text-destructive hover:text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                        <CollapsibleContent className="pt-3 space-y-4">
                          {/* Variants section */}
                          <div className="space-y-2">
                            <h4 className="text-sm font-medium flex items-center gap-2">
                              <Tag className="h-4 w-4" />
                              Przypisane warianty
                            </h4>
                            {allVariants.length === 0 ? (
                              <p className="text-sm text-muted-foreground">
                                Brak zdefiniowanych wariantów. Dodaj je w zakładce "Warianty".
                              </p>
                            ) : (
                              <div className="flex flex-wrap gap-2">
                                {allVariants.map((variant) => {
                                  const isLinked = isVariantLinked(scope, variant.id);
                                  return (
                                    <label
                                      key={variant.id}
                                      className={`flex items-center gap-2 px-3 py-2 rounded-md border cursor-pointer transition-colors ${
                                        isLinked 
                                          ? 'bg-primary/10 border-primary' 
                                          : 'bg-muted/50 border-border hover:bg-muted'
                                      }`}
                                    >
                                      <Checkbox
                                        checked={isLinked}
                                        onCheckedChange={() => toggleVariant(scope.id, variant.id)}
                                      />
                                      <span className="text-sm">{variant.name}</span>
                                    </label>
                                  );
                                })}
                              </div>
                            )}
                          </div>

                          {/* Extras section */}
                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                              <h4 className="text-sm font-medium flex items-center gap-2">
                                <Sparkles className="h-4 w-4" />
                                Dodatkowe opcje (np. Powłoka)
                              </h4>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleAddExtra(scope.id)}
                              >
                                <Plus className="h-4 w-4 mr-1" />
                                Dodaj opcję
                              </Button>
                            </div>
                            {scope.extras.filter(e => !e.isDeleted).length === 0 ? (
                              <p className="text-sm text-muted-foreground">
                                Brak dodatkowych opcji. Kliknij "Dodaj opcję" aby utworzyć.
                              </p>
                            ) : (
                              <div className="space-y-2">
                                {scope.extras.filter(e => !e.isDeleted).map((extra) => (
                                  <div key={extra.id} className="flex items-center gap-2 p-2 bg-muted/50 rounded-md">
                                    <Input
                                      value={extra.name}
                                      onChange={(e) => handleUpdateExtra(scope.id, extra.id, { name: e.target.value })}
                                      placeholder="Nazwa opcji"
                                      className="flex-1"
                                    />
                                    <Input
                                      value={extra.description || ''}
                                      onChange={(e) => handleUpdateExtra(scope.id, extra.id, { description: e.target.value })}
                                      placeholder="Opis (opcjonalny)"
                                      className="flex-1"
                                    />
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => handleDeleteExtra(scope.id, extra.id)}
                                      className="text-destructive hover:text-destructive shrink-0"
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </CollapsibleContent>
                      </Collapsible>
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
