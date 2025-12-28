import { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { 
  Plus, 
  Trash2, 
  Copy, 
  Package, 
  ChevronDown, 
  ChevronUp,
  GripVertical 
} from 'lucide-react';
import { OfferOption, OfferItem } from '@/hooks/useOffer';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';

interface Product {
  id: string;
  name: string;
  description: string | null;
  default_price: number;
  unit: string;
  category: string | null;
}

interface Scope {
  id: string;
  name: string;
  description: string | null;
}

interface OptionsStepProps {
  instanceId: string;
  options: OfferOption[];
  selectedScopeIds: string[];
  onAddOption: (option: Omit<OfferOption, 'id' | 'sortOrder'>) => string;
  onUpdateOption: (optionId: string, data: Partial<OfferOption>) => void;
  onRemoveOption: (optionId: string) => void;
  onDuplicateOption: (optionId: string) => void;
  onAddItem: (optionId: string, item: Omit<OfferItem, 'id'>) => string;
  onUpdateItem: (optionId: string, itemId: string, data: Partial<OfferItem>) => void;
  onRemoveItem: (optionId: string, itemId: string) => void;
  calculateOptionTotal: (option: OfferOption) => number;
}

export const OptionsStep = ({
  instanceId,
  options,
  selectedScopeIds,
  onAddOption,
  onUpdateOption,
  onRemoveOption,
  onDuplicateOption,
  onAddItem,
  onUpdateItem,
  onRemoveItem,
  calculateOptionTotal,
}: OptionsStepProps) => {
  const [products, setProducts] = useState<Product[]>([]);
  const [scopes, setScopes] = useState<Scope[]>([]);
  const [expandedOptions, setExpandedOptions] = useState<Set<string>>(
    new Set(options.map(o => o.id))
  );
  const [autocompleteOpen, setAutocompleteOpen] = useState<{ [key: string]: boolean }>({});
  const [searchTerms, setSearchTerms] = useState<{ [key: string]: string }>({});
  const [justSelected, setJustSelected] = useState<{ [key: string]: boolean }>({});

  // Fetch products
  useEffect(() => {
    const fetchProducts = async () => {
      const { data, error } = await supabase
        .from('products_library')
        .select('*')
        .eq('active', true)
        .or(`instance_id.eq.${instanceId},and(source.eq.global,instance_id.is.null)`)
        .order('sort_order');
      
      if (!error && data) {
        setProducts(data);
      } else {
        console.error('Error fetching products:', error);
      }
    };
    fetchProducts();
  }, [instanceId]);

  // Fetch scopes for grouping
  useEffect(() => {
    const fetchScopes = async () => {
      if (selectedScopeIds.length === 0) {
        setScopes([]);
        return;
      }
      
      const { data, error } = await supabase
        .from('offer_scopes')
        .select('id, name, description')
        .in('id', selectedScopeIds)
        .order('sort_order');
      
      if (!error && data) {
        setScopes(data);
      }
    };
    fetchScopes();
  }, [selectedScopeIds]);

  // Group options by scopeId
  const groupedOptions = useMemo(() => {
    const groups: { scope: Scope | null; options: OfferOption[] }[] = [];
    
    // Group by scope
    for (const scope of scopes) {
      const scopeOptions = options.filter(o => o.scopeId === scope.id && !o.isUpsell);
      const upsellOptions = options.filter(o => o.scopeId === scope.id && o.isUpsell);
      if (scopeOptions.length > 0 || upsellOptions.length > 0) {
        groups.push({ scope, options: [...scopeOptions, ...upsellOptions] });
      }
    }
    
    // Options without scope (manual additions)
    const ungroupedOptions = options.filter(o => !o.scopeId);
    if (ungroupedOptions.length > 0) {
      groups.push({ scope: null, options: ungroupedOptions });
    }
    
    return groups;
  }, [options, scopes]);

  const handleAddOption = () => {
    const id = onAddOption({
      name: `Opcja ${options.length + 1}`,
      description: '',
      items: [],
      isSelected: true,
    });
    setExpandedOptions(prev => new Set([...prev, id]));
  };

  const handleAddItem = (optionId: string) => {
    onAddItem(optionId, {
      productId: undefined,
      customName: '',
      customDescription: '',
      quantity: 1,
      unitPrice: 0,
      unit: 'szt',
      discountPercent: 0,
      isOptional: false,
      isCustom: true,
    });
  };

  const handleProductSelect = (optionId: string, itemId: string, product: Product) => {
    onUpdateItem(optionId, itemId, {
      productId: product.id,
      customName: product.name,
      unitPrice: product.default_price,
      unit: product.unit,
      isCustom: false,
    });
    setJustSelected(prev => ({ ...prev, [itemId]: true }));
    setAutocompleteOpen(prev => ({ ...prev, [itemId]: false }));
    setSearchTerms(prev => ({ ...prev, [itemId]: '' }));
    // Prevent reopening on focus after selection - use longer timeout
    setTimeout(() => {
      setJustSelected(prev => ({ ...prev, [itemId]: false }));
    }, 300);
  };

  const toggleOption = (optionId: string) => {
    setExpandedOptions(prev => {
      const next = new Set(prev);
      if (next.has(optionId)) {
        next.delete(optionId);
      } else {
        next.add(optionId);
      }
      return next;
    });
  };

  const formatPrice = (value: number) => {
    return new Intl.NumberFormat('pl-PL', {
      style: 'currency',
      currency: 'PLN',
    }).format(value);
  };

  // Render single option card
  const renderOptionCard = (option: OfferOption) => (
    <Card key={option.id} className={cn("overflow-hidden", option.isUpsell && "border-amber-500/50 bg-amber-500/5")}>
      <Collapsible
        open={expandedOptions.has(option.id)}
        onOpenChange={() => toggleOption(option.id)}
      >
        <CardHeader className="pb-0">
          <div className="flex items-start gap-3">
            <div className="flex items-center gap-2 text-muted-foreground cursor-grab">
              <GripVertical className="w-4 h-4" />
            </div>
            
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3">
                <Checkbox
                  checked={option.isSelected}
                  onCheckedChange={(checked) => 
                    onUpdateOption(option.id, { isSelected: !!checked })
                  }
                />
                <div className="flex items-center gap-2">
                  {option.isUpsell && (
                    <span className="text-xs bg-amber-500/20 text-amber-700 dark:text-amber-400 px-2 py-0.5 rounded-full">
                      Upsell
                    </span>
                  )}
                  <Input
                    value={option.name.replace(/^.*? - /, '')} // Show only variant name
                    onChange={(e) => {
                      const scopeName = option.name.includes(' - ') 
                        ? option.name.split(' - ')[0] + ' - ' 
                        : '';
                      onUpdateOption(option.id, { name: scopeName + e.target.value });
                    }}
                    className="font-semibold text-lg border-none p-0 h-auto focus-visible:ring-0"
                  />
                </div>
              </div>
              <div className="ml-7 mt-1 text-sm text-muted-foreground">
                {option.items.length} pozycji • {formatPrice(calculateOptionTotal(option))} netto
              </div>
            </div>

            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => onDuplicateOption(option.id)}
                title="Duplikuj opcję"
              >
                <Copy className="w-4 h-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => onRemoveOption(option.id)}
                className="text-destructive hover:text-destructive"
                title="Usuń opcję"
              >
                <Trash2 className="w-4 h-4" />
              </Button>
              <CollapsibleTrigger asChild>
                <Button variant="ghost" size="icon">
                  {expandedOptions.has(option.id) ? (
                    <ChevronUp className="w-4 h-4" />
                  ) : (
                    <ChevronDown className="w-4 h-4" />
                  )}
                </Button>
              </CollapsibleTrigger>
            </div>
          </div>
        </CardHeader>

        <CollapsibleContent>
          <CardContent className="pt-4 space-y-4">
            {/* Option Description */}
            <div className="space-y-2">
              <Label>Opis opcji</Label>
              <Input
                value={option.description || ''}
                onChange={(e) => onUpdateOption(option.id, { description: e.target.value })}
              />
            </div>

            {/* Items Table */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Pozycje</Label>
              
              {/* Table Header */}
              <div className="grid grid-cols-12 gap-2 px-3 py-2 bg-primary/10 border border-border rounded-t-lg text-xs font-medium text-foreground">
                <div className="col-span-4">Nazwa</div>
                <div className="col-span-2 text-center">Ilość</div>
                <div className="col-span-1 text-center">J.m.</div>
                <div className="col-span-2 text-center">Cena netto</div>
                <div className="col-span-1 text-center">Rabat %</div>
                <div className="col-span-1 text-center" title="Pozycja opcjonalna">Opc.</div>
                <div className="col-span-1"></div>
              </div>
              
              {option.items.map((item, itemIndex) => (
                <div
                  key={item.id}
                  className={cn(
                    "grid grid-cols-12 gap-2 p-3 border-x border-b first:border-t rounded-none last:rounded-b-lg",
                    item.isOptional && "bg-muted/30"
                  )}
                >
                  {/* Name with Autocomplete */}
                  <div className="col-span-4">
                    <Popover 
                      open={autocompleteOpen[item.id]} 
                      onOpenChange={(open) => {
                        if (!open || !justSelected[item.id]) {
                          setAutocompleteOpen(prev => ({ ...prev, [item.id]: open }));
                        }
                      }}
                      modal={true}
                    >
                      <PopoverTrigger asChild>
                        <Input
                          value={item.customName || ''}
                          onChange={(e) => {
                            onUpdateItem(option.id, item.id, { customName: e.target.value, isCustom: true });
                            if (e.target.value.length > 0 && !justSelected[item.id]) {
                              setAutocompleteOpen(prev => ({ ...prev, [item.id]: true }));
                            }
                          }}
                          onFocus={() => {
                            if (products.length > 0 && !justSelected[item.id]) {
                              setAutocompleteOpen(prev => ({ ...prev, [item.id]: true }));
                            }
                          }}
                        />
                      </PopoverTrigger>
                      <PopoverContent className="p-0 w-[300px]" align="start" onOpenAutoFocus={(e) => e.preventDefault()}>
                        <Command shouldFilter={false}>
                          <CommandInput 
                            placeholder="Szukaj w bibliotece..." 
                            value={searchTerms[item.id] || ''}
                            onValueChange={(value) => setSearchTerms(prev => ({ ...prev, [item.id]: value }))}
                          />
                          <CommandList>
                            <CommandEmpty>Brak produktów</CommandEmpty>
                            <CommandGroup>
                              {products
                                .filter(p => {
                                  const searchTerm = searchTerms[item.id] || '';
                                  if (!searchTerm) return true;
                                  return p.name.toLowerCase().includes(searchTerm.toLowerCase());
                                })
                                .slice(0, 10)
                                .map(product => (
                                  <CommandItem
                                    key={product.id}
                                    value={product.id}
                                    onSelect={() => handleProductSelect(option.id, item.id, product)}
                                    className="flex justify-between cursor-pointer"
                                  >
                                    <span>{product.name}</span>
                                    <span className="text-muted-foreground text-sm">
                                      {formatPrice(product.default_price)}
                                    </span>
                                  </CommandItem>
                                ))
                              }
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                  </div>
                  
                  {/* Quantity */}
                  <div className="col-span-2">
                    <Input
                      type="number"
                      value={item.quantity}
                      onChange={(e) => onUpdateItem(option.id, item.id, { quantity: parseFloat(e.target.value) || 0 })}
                      min={0}
                      step={0.01}
                      className="text-center"
                    />
                  </div>
                  
                  {/* Unit */}
                  <div className="col-span-1">
                    <Input
                      value={item.unit}
                      onChange={(e) => onUpdateItem(option.id, item.id, { unit: e.target.value })}
                      className="text-center"
                    />
                  </div>
                  
                  {/* Price */}
                  <div className="col-span-2">
                    <Input
                      type="number"
                      value={item.unitPrice}
                      onChange={(e) => onUpdateItem(option.id, item.id, { unitPrice: parseFloat(e.target.value) || 0 })}
                      min={0}
                      step={0.01}
                      className="text-center"
                    />
                  </div>
                  
                  {/* Discount */}
                  <div className="col-span-1">
                    <div className="flex items-center gap-1">
                      <Input
                        type="number"
                        value={item.discountPercent}
                        onChange={(e) => onUpdateItem(option.id, item.id, { discountPercent: parseFloat(e.target.value) || 0 })}
                        min={0}
                        max={100}
                        className="text-center"
                      />
                    </div>
                  </div>
                  
                  {/* Optional checkbox */}
                  <div className="col-span-1 flex items-center justify-center">
                    <Checkbox
                      checked={item.isOptional}
                      onCheckedChange={(checked) => 
                        onUpdateItem(option.id, item.id, { isOptional: !!checked })
                      }
                      title="Pozycja opcjonalna - klient może ją wybrać lub odrzucić"
                    />
                  </div>
                  
                  {/* Delete */}
                  <div className="col-span-1 flex items-center justify-end">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => onRemoveItem(option.id, item.id)}
                      className="h-8 w-8 text-destructive hover:text-destructive"
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
              ))}

              {option.items.length === 0 && (
                <div className="border rounded-b-lg p-4 text-center text-muted-foreground text-sm">
                  Brak pozycji. Dodaj pierwszą pozycję poniżej.
                </div>
              )}

              {/* Add Item Button */}
              <div className="flex gap-2 pt-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleAddItem(option.id)}
                  className="gap-1"
                >
                  <Plus className="w-3 h-3" />
                  Dodaj pozycję
                </Button>
              </div>
            </div>
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );

  return (
    <div className="space-y-8">
      {/* Grouped Options by Scope */}
      {groupedOptions.map((group, groupIndex) => (
        <div key={group.scope?.id || 'ungrouped'} className="space-y-4">
          {/* Scope Header */}
          {group.scope && (
            <div className="flex items-center gap-3 pb-2 border-b">
              <Package className="w-5 h-5 text-primary" />
              <div>
                <h3 className="font-semibold text-lg">{group.scope.name}</h3>
                {group.scope.description && (
                  <p className="text-sm text-muted-foreground">{group.scope.description}</p>
                )}
              </div>
            </div>
          )}
          
          {group.scope === null && groupedOptions.length > 1 && (
            <div className="flex items-center gap-3 pb-2 border-b">
              <Package className="w-5 h-5 text-muted-foreground" />
              <h3 className="font-semibold text-lg text-muted-foreground">Pozostałe opcje</h3>
            </div>
          )}

          {/* Options in this group */}
          <div className="space-y-4 pl-0 md:pl-4">
            {group.options.map(option => renderOptionCard(option))}
          </div>
        </div>
      ))}

      {/* Empty state */}
      {options.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          <Package className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p className="text-lg mb-2">Brak opcji</p>
          <p className="text-sm">Wybierz zakresy w poprzednim kroku lub dodaj opcję ręcznie</p>
        </div>
      )}

      {/* Add Option Button */}
      <Button
        variant="outline"
        onClick={handleAddOption}
        className="w-full gap-2 border-dashed"
      >
        <Plus className="w-4 h-4" />
        Dodaj nową opcję
      </Button>
    </div>
  );
};
