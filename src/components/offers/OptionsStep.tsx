import { useState, useEffect } from 'react';
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface Product {
  id: string;
  name: string;
  description: string | null;
  default_price: number;
  unit: string;
  category: string | null;
}

interface OptionsStepProps {
  instanceId: string;
  options: OfferOption[];
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
  const [expandedOptions, setExpandedOptions] = useState<Set<string>>(new Set());

  useEffect(() => {
    const fetchProducts = async () => {
      // Fetch both global and instance products
      const { data, error } = await supabase
        .from('products_library')
        .select('*')
        .eq('active', true)
        .or(`instance_id.eq.${instanceId},source.eq.global`)
        .order('sort_order');
      
      if (!error && data) {
        setProducts(data);
      }
    };
    fetchProducts();
  }, [instanceId]);

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

  const handleAddProductItem = (optionId: string, product: Product) => {
    onAddItem(optionId, {
      productId: product.id,
      customName: product.name,
      customDescription: product.description || '',
      quantity: 1,
      unitPrice: product.default_price,
      unit: product.unit,
      discountPercent: 0,
      isOptional: false,
      isCustom: false,
    });
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

  return (
    <div className="space-y-6">
      {/* Options List */}
      {options.map((option, index) => (
        <Card key={option.id} className="overflow-hidden">
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
                    <Input
                      value={option.name}
                      onChange={(e) => onUpdateOption(option.id, { name: e.target.value })}
                      className="font-semibold text-lg border-none p-0 h-auto focus-visible:ring-0"
                      placeholder="Nazwa opcji"
                    />
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
                    placeholder="Krótki opis tej opcji..."
                  />
                </div>

                {/* Items */}
                <div className="space-y-3">
                  <Label className="text-sm font-medium">Pozycje</Label>
                  
                  {option.items.map((item, itemIndex) => (
                    <div
                      key={item.id}
                      className={cn(
                        "grid grid-cols-12 gap-2 p-3 rounded-lg border",
                        item.isOptional && "bg-muted/50"
                      )}
                    >
                      <div className="col-span-12 md:col-span-4">
                        <Input
                          value={item.customName || ''}
                          onChange={(e) => onUpdateItem(option.id, item.id, { customName: e.target.value })}
                          placeholder="Nazwa pozycji"
                        />
                      </div>
                      <div className="col-span-4 md:col-span-2">
                        <Input
                          type="number"
                          value={item.quantity}
                          onChange={(e) => onUpdateItem(option.id, item.id, { quantity: parseFloat(e.target.value) || 0 })}
                          placeholder="Ilość"
                          min={0}
                          step={0.01}
                        />
                      </div>
                      <div className="col-span-4 md:col-span-1">
                        <Input
                          value={item.unit}
                          onChange={(e) => onUpdateItem(option.id, item.id, { unit: e.target.value })}
                          placeholder="j.m."
                        />
                      </div>
                      <div className="col-span-4 md:col-span-2">
                        <Input
                          type="number"
                          value={item.unitPrice}
                          onChange={(e) => onUpdateItem(option.id, item.id, { unitPrice: parseFloat(e.target.value) || 0 })}
                          placeholder="Cena"
                          min={0}
                          step={0.01}
                        />
                      </div>
                      <div className="col-span-6 md:col-span-2">
                        <div className="flex items-center gap-2">
                          <Input
                            type="number"
                            value={item.discountPercent}
                            onChange={(e) => onUpdateItem(option.id, item.id, { discountPercent: parseFloat(e.target.value) || 0 })}
                            placeholder="%"
                            min={0}
                            max={100}
                            className="w-16"
                          />
                          <span className="text-sm text-muted-foreground">%</span>
                        </div>
                      </div>
                      <div className="col-span-6 md:col-span-1 flex items-center justify-end gap-1">
                        <Checkbox
                          checked={item.isOptional}
                          onCheckedChange={(checked) => 
                            onUpdateItem(option.id, item.id, { isOptional: !!checked })
                          }
                          title="Opcjonalna"
                        />
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

                  {/* Add Item Buttons */}
                  <div className="flex flex-wrap gap-2 pt-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleAddItem(option.id)}
                      className="gap-1"
                    >
                      <Plus className="w-3 h-3" />
                      Dodaj własną pozycję
                    </Button>
                    
                    <Select onValueChange={(productId) => {
                      const product = products.find(p => p.id === productId);
                      if (product) handleAddProductItem(option.id, product);
                    }}>
                      <SelectTrigger className="w-auto">
                        <div className="flex items-center gap-1">
                          <Package className="w-3 h-3" />
                          <span>Dodaj z biblioteki</span>
                        </div>
                      </SelectTrigger>
                      <SelectContent>
                        {products.map((product) => (
                          <SelectItem key={product.id} value={product.id}>
                            <div className="flex items-center justify-between gap-4">
                              <span>{product.name}</span>
                              <span className="text-muted-foreground text-sm">
                                {formatPrice(product.default_price)}
                              </span>
                            </div>
                          </SelectItem>
                        ))}
                        {products.length === 0 && (
                          <div className="p-2 text-sm text-muted-foreground">
                            Brak produktów w bibliotece
                          </div>
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardContent>
            </CollapsibleContent>
          </Collapsible>
        </Card>
      ))}

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
