import { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  Plus, 
  Trash2, 
  Package, 
  ChevronDown, 
  ChevronUp
} from 'lucide-react';
import { OfferOption, OfferItem } from '@/hooks/useOffer';
import { supabase } from '@/integrations/supabase/client';
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
  showUnitPrices: boolean;
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
  showUnitPrices,
  onAddOption,
  onUpdateOption,
  onRemoveOption,
  onDuplicateOption,
  onAddItem,
  onUpdateItem,
  onRemoveItem,
  calculateOptionTotal,
}: OptionsStepProps) => {
  const { t } = useTranslation();
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

  // Render single option section - flat design
  const renderOptionSection = (option: OfferOption) => (
    <div key={option.id} className="border-b last:border-b-0 pb-6 last:pb-0">
      <Collapsible
        open={expandedOptions.has(option.id)}
        onOpenChange={() => toggleOption(option.id)}
      >
        {/* Option Header */}
        <div className="flex items-center justify-between py-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3">
              <span className="font-semibold text-base">
                {option.name.replace(/^.*? - /, '')}
              </span>
              <span className="text-sm text-muted-foreground">
                {option.items.length} poz. • {formatPrice(calculateOptionTotal(option))} netto
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onRemoveOption(option.id)}
              className="text-destructive hover:text-destructive h-8 w-8 p-0"
            >
              <Trash2 className="w-4 h-4" />
            </Button>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                {expandedOptions.has(option.id) ? (
                  <ChevronUp className="w-4 h-4" />
                ) : (
                  <ChevronDown className="w-4 h-4" />
                )}
              </Button>
            </CollapsibleTrigger>
          </div>
        </div>

        <CollapsibleContent>
          <div className="space-y-4 pt-2">
            {/* Option Description */}
            <div className="space-y-1">
              <Label className="text-sm text-muted-foreground">Opis opcji</Label>
              <Input
                value={option.description || ''}
                onChange={(e) => onUpdateOption(option.id, { description: e.target.value })}
                className="bg-white"
              />
            </div>

            {/* Items List - flat design */}
            <div className="space-y-3">
              <Label className="text-sm text-muted-foreground">Pozycje</Label>
              
              {/* Table Header */}
              {showUnitPrices ? (
                <div className="grid grid-cols-12 gap-3 text-xs font-medium text-muted-foreground px-1">
                  <div className="col-span-5">Nazwa</div>
                  <div className="col-span-2 text-left">Cena netto</div>
                  <div className="col-span-2 text-left">Rabat %</div>
                  <div className="col-span-3"></div>
                </div>
              ) : (
                <div className="grid grid-cols-12 gap-3 text-xs font-medium text-muted-foreground px-1">
                  <div className="col-span-6">Nazwa</div>
                  <div className="col-span-3 text-left">Cena netto</div>
                  <div className="col-span-2 text-left">Rabat %</div>
                  <div className="col-span-1"></div>
                </div>
              )}
              
              {option.items.map((item) => (
                <div key={item.id} className="grid grid-cols-12 gap-3 items-center">
                  {showUnitPrices ? (
                    <>
                      {/* Name with Autocomplete */}
                      <div className="col-span-5">
                        <Popover 
                          open={autocompleteOpen[item.id]} 
                          onOpenChange={(open) => {
                            if (!open || !justSelected[item.id]) {
                              setAutocompleteOpen((prev) => ({ ...prev, [item.id]: open }));
                            }
                          }}
                        >
                          <PopoverTrigger asChild>
                            <Input
                              value={item.customName || ''}
                              onChange={(e) => {
                                onUpdateItem(option.id, item.id, { customName: e.target.value, isCustom: true });
                                if (e.target.value.length > 0 && !justSelected[item.id]) {
                                  setAutocompleteOpen((prev) => ({ ...prev, [item.id]: true }));
                                }
                              }}
                              onFocus={() => {
                                if (products.length > 0 && !justSelected[item.id]) {
                                  setAutocompleteOpen((prev) => ({ ...prev, [item.id]: true }));
                                }
                              }}
                              className="bg-white"
                            />
                          </PopoverTrigger>
                          <PopoverContent
                            className="p-0 w-[300px]"
                            align="start"
                            onOpenAutoFocus={(e) => e.preventDefault()}
                            onCloseAutoFocus={(e) => e.preventDefault()}
                          >
                            <Command shouldFilter={false}>
                              <CommandInput
                                placeholder="Szukaj w bibliotece..."
                                value={searchTerms[item.id] || ''}
                                onValueChange={(value) => setSearchTerms((prev) => ({ ...prev, [item.id]: value }))}
                              />
                              <CommandList>
                                <CommandEmpty>Brak produktów</CommandEmpty>
                                <CommandGroup>
                                  {products
                                    .filter((p) => {
                                      const searchTerm = searchTerms[item.id] || '';
                                      if (!searchTerm) return true;
                                      return p.name.toLowerCase().includes(searchTerm.toLowerCase());
                                    })
                                    .slice(0, 10)
                                    .map((product) => (
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
                                    ))}
                                </CommandGroup>
                              </CommandList>
                            </Command>
                          </PopoverContent>
                        </Popover>
                      </div>
                      
                      {/* Price */}
                      <div className="col-span-2">
                        <Input
                          type="number"
                          value={item.unitPrice}
                          onChange={(e) => onUpdateItem(option.id, item.id, { unitPrice: parseFloat(e.target.value) || 0 })}
                          min={0}
                          step={0.01}
                          className="bg-white text-left"
                        />
                      </div>
                      
                      {/* Discount */}
                      <div className="col-span-2">
                        <Input
                          type="number"
                          value={item.discountPercent}
                          onChange={(e) => onUpdateItem(option.id, item.id, { discountPercent: parseFloat(e.target.value) || 0 })}
                          min={0}
                          max={100}
                          className="bg-white text-left"
                        />
                      </div>
                      
                      {/* Hidden fields for unit prices mode */}
                      <div className="col-span-2 flex gap-2">
                        <Input
                          type="number"
                          value={item.quantity}
                          onChange={(e) => onUpdateItem(option.id, item.id, { quantity: parseFloat(e.target.value) || 0 })}
                          min={0}
                          step={0.01}
                          className="bg-white text-left"
                          placeholder="Ilość"
                        />
                        <Input
                          value={item.unit}
                          onChange={(e) => onUpdateItem(option.id, item.id, { unit: e.target.value })}
                          className="bg-white text-left w-16"
                          placeholder="J.m."
                        />
                      </div>
                      
                      {/* Delete */}
                      <div className="col-span-1 flex justify-end">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onRemoveItem(option.id, item.id)}
                          className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </>
                  ) : (
                    <>
                      {/* Name with Autocomplete */}
                      <div className="col-span-6">
                        <Popover 
                          open={autocompleteOpen[item.id]} 
                          onOpenChange={(open) => {
                            if (!open || !justSelected[item.id]) {
                              setAutocompleteOpen((prev) => ({ ...prev, [item.id]: open }));
                            }
                          }}
                        >
                          <PopoverTrigger asChild>
                            <Input
                              value={item.customName || ''}
                              onChange={(e) => {
                                onUpdateItem(option.id, item.id, { customName: e.target.value, isCustom: true });
                                if (e.target.value.length > 0 && !justSelected[item.id]) {
                                  setAutocompleteOpen((prev) => ({ ...prev, [item.id]: true }));
                                }
                              }}
                              onFocus={() => {
                                if (products.length > 0 && !justSelected[item.id]) {
                                  setAutocompleteOpen((prev) => ({ ...prev, [item.id]: true }));
                                }
                              }}
                              className="bg-white"
                            />
                          </PopoverTrigger>
                          <PopoverContent
                            className="p-0 w-[300px]"
                            align="start"
                            onOpenAutoFocus={(e) => e.preventDefault()}
                            onCloseAutoFocus={(e) => e.preventDefault()}
                          >
                            <Command shouldFilter={false}>
                              <CommandInput
                                placeholder="Szukaj w bibliotece..."
                                value={searchTerms[item.id] || ''}
                                onValueChange={(value) => setSearchTerms((prev) => ({ ...prev, [item.id]: value }))}
                              />
                              <CommandList>
                                <CommandEmpty>Brak produktów</CommandEmpty>
                                <CommandGroup>
                                  {products
                                    .filter((p) => {
                                      const searchTerm = searchTerms[item.id] || '';
                                      if (!searchTerm) return true;
                                      return p.name.toLowerCase().includes(searchTerm.toLowerCase());
                                    })
                                    .slice(0, 10)
                                    .map((product) => (
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
                                    ))}
                                </CommandGroup>
                              </CommandList>
                            </Command>
                          </PopoverContent>
                        </Popover>
                      </div>
                      
                      {/* Price (total = quantity * unitPrice) */}
                      <div className="col-span-3">
                        <Input
                          type="number"
                          value={item.quantity * item.unitPrice}
                          onChange={(e) => onUpdateItem(option.id, item.id, { unitPrice: (parseFloat(e.target.value) || 0) / (item.quantity || 1), quantity: 1 })}
                          min={0}
                          step={0.01}
                          className="bg-white text-left"
                        />
                      </div>
                      
                      {/* Discount */}
                      <div className="col-span-2">
                        <Input
                          type="number"
                          value={item.discountPercent}
                          onChange={(e) => onUpdateItem(option.id, item.id, { discountPercent: parseFloat(e.target.value) || 0 })}
                          min={0}
                          max={100}
                          className="bg-white text-left"
                        />
                      </div>
                      
                      {/* Delete */}
                      <div className="col-span-1 flex justify-end">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onRemoveItem(option.id, item.id)}
                          className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </>
                  )}
                </div>
              ))}

              {option.items.length === 0 && (
                <div className="text-center py-4 text-muted-foreground text-sm">
                  Brak pozycji. Dodaj pierwszą pozycję poniżej.
                </div>
              )}

              {/* Add Item Button */}
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleAddItem(option.id)}
                className="gap-1 mt-2"
              >
                <Plus className="w-3 h-3" />
                Dodaj pozycję
              </Button>
            </div>
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );

  return (
    <div className="space-y-8">
      {/* Grouped Options by Scope */}
      {groupedOptions.map((group) => (
        <div key={group.scope?.id || 'ungrouped'} className="space-y-4">
          {/* Scope Header */}
          {group.scope && (
            <div className="flex items-center gap-3 pb-2 border-b">
              <Package className="w-5 h-5 text-primary" />
              <div>
                <h3 className="font-bold text-xl">{group.scope.name}</h3>
                {group.scope.description && (
                  <p className="text-sm text-muted-foreground">{group.scope.description}</p>
                )}
              </div>
            </div>
          )}
          
          {group.scope === null && groupedOptions.length > 1 && (
            <div className="flex items-center gap-3 pb-2 border-b">
              <Package className="w-5 h-5 text-muted-foreground" />
              <h3 className="font-bold text-xl text-muted-foreground">Pozostałe opcje</h3>
            </div>
          )}

          {/* Options in this group - flat list */}
          <div className="space-y-0 pl-0 md:pl-4">
            {group.options.map(option => renderOptionSection(option))}
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
    </div>
  );
};
