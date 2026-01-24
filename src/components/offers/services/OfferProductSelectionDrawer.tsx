import { useState, useEffect, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, Check, Loader2, Search, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';

interface Product {
  id: string;
  name: string;
  short_name: string | null;
  category_id: string | null;
  default_price: number;
  unit: string;
}

interface OfferProductSelectionDrawerProps {
  open: boolean;
  onClose: () => void;
  instanceId: string;
  selectedProductIds: string[];
  onConfirm: (productIds: string[]) => void;
}

export function OfferProductSelectionDrawer({
  open,
  onClose,
  instanceId,
  selectedProductIds: initialSelectedIds,
  onConfirm,
}: OfferProductSelectionDrawerProps) {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>(initialSelectedIds);
  const [searchQuery, setSearchQuery] = useState('');
  const initRef = useRef(false);

  // Reset selected and search when drawer opens (but don't keep resetting while open)
  useEffect(() => {
    if (open && !initRef.current) {
      initRef.current = true;
      setSelectedIds(initialSelectedIds);
      setSearchQuery('');
    }

    if (!open) {
      initRef.current = false;
    }
  }, [open, initialSelectedIds]);

  // Fetch products
  useEffect(() => {
    const fetchData = async () => {
      if (!open || !instanceId) return;
      
      setLoading(true);
      
      const { data, error } = await supabase
        .from('unified_services')
        .select('id, name, short_name, category_id, default_price, unit')
        .eq('service_type', 'offer')
        .eq('instance_id', instanceId)
        .eq('active', true)
        .order('category_id')
        .order('name');

      if (data && !error) {
        setProducts(data);
      }
      
      setLoading(false);
    };
    
    fetchData();
  }, [open, instanceId]);

  // Get selected products with details
  const selectedProducts = useMemo(() => {
    return selectedIds
      .map(id => products.find(p => p.id === id))
      .filter((p): p is Product => p !== undefined);
  }, [selectedIds, products]);

  // Group products by category - filter based on search
  const groupedProducts = useMemo(() => {
    const groups: Map<string, Product[]> = new Map();
    
    products.forEach(product => {
      const category = product.category_id || 'Inne';
      
      // Filter by search if there's a query
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        if (!product.name.toLowerCase().includes(query) && 
            !category.toLowerCase().includes(query)) {
          return;
        }
      }
      
      if (!groups.has(category)) {
        groups.set(category, []);
      }
      groups.get(category)!.push(product);
    });
    
    return Array.from(groups.entries()).map(([category, products]) => ({
      category,
      products,
    }));
  }, [products, searchQuery]);

  // Format price
  const formatPrice = (price: number): string => {
    return `${price.toFixed(0)} zł`;
  };

  // Toggle product selection
  const toggleProduct = (productId: string) => {
    setSelectedIds(prev => 
      prev.includes(productId) 
        ? prev.filter(id => id !== productId)
        : [...prev, productId]
    );
  };

  // Remove selected product
  const removeProduct = (productId: string) => {
    setSelectedIds(prev => prev.filter(id => id !== productId));
  };

  // Handle confirm
  const handleConfirm = () => {
    onConfirm(selectedIds);
    onClose();
  };

  // Get display label for product chip - use short_name if available
  const getChipLabel = (product: Product): string => {
    const displayName = product.short_name || product.name;
    return displayName.length > 20 ? displayName.substring(0, 18) + '...' : displayName;
  };

  return (
    <Sheet open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <SheetContent 
        side="right" 
        hideOverlay
        hideCloseButton
        className="w-full sm:max-w-lg p-0 flex flex-col shadow-[-8px_0_30px_-12px_rgba(0,0,0,0.15)]"
        onOpenAutoFocus={(e) => e.preventDefault()}
        onFocusOutside={(e) => e.preventDefault()}
      >
        {/* Header - clicking closes drawer */}
        <SheetHeader 
          className="border-b px-4 py-3 cursor-pointer hover:bg-muted/50 transition-colors shrink-0"
          onClick={onClose}
        >
          <SheetTitle className="flex items-center gap-3 text-lg font-semibold">
            <ArrowLeft className="w-5 h-5" />
            Wybierz usługi
          </SheetTitle>
        </SheetHeader>

        {/* Search Section */}
        <div className="px-4 py-3 border-b space-y-3 shrink-0">
          {/* Search Input */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              type="search"
              inputMode="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Szukaj usługi..."
              className="pl-9 pr-9 h-11"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                }}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="pb-4">
              {groupedProducts.map(({ category, products: categoryProducts }) => {
                // Hide empty categories when searching
                if (searchQuery.trim() && categoryProducts.length === 0) {
                  return null;
                }
                
                return (
                  <div key={category}>
                    {/* Category header - centered, readonly */}
                    <div className="py-2 px-4 bg-muted/50">
                      <p className="text-sm font-semibold text-muted-foreground text-center uppercase tracking-wide">
                        {category}
                      </p>
                    </div>
                    
                    {/* Products list - flat */}
                    {categoryProducts.map((product) => {
                      const isSelected = selectedIds.includes(product.id);
                      
                      return (
                        <button
                          key={product.id}
                          type="button"
                          onClick={() => toggleProduct(product.id)}
                          className={cn(
                            "w-full flex items-center px-4 py-3 border-b border-border/50 transition-colors",
                            isSelected ? "bg-primary/5" : "hover:bg-muted/30"
                          )}
                        >
                          {/* Product name only */}
                          <div className="flex-1 text-left">
                            <p className="font-medium text-foreground">
                              {product.short_name || product.name}
                            </p>
                          </div>
                          
                          {/* Price */}
                          <div className="text-right mr-4">
                            <p className="font-semibold text-foreground">{formatPrice(product.default_price)}</p>
                          </div>
                          
                          {/* Checkmark */}
                          <div className={cn(
                            "w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors",
                            isSelected 
                              ? "bg-primary border-primary" 
                              : "border-muted-foreground/40"
                          )}>
                            {isSelected && <Check className="w-4 h-4 text-primary-foreground" />}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Fixed Footer */}
        <div className="border-t px-4 py-4 shrink-0 bg-background">
          <div className="mb-3">
            <span className="text-lg font-semibold text-foreground">
              Wybrano: {selectedIds.length}
            </span>
          </div>
          <Button 
            onClick={handleConfirm}
            className="w-full h-12 text-base font-semibold"
          >
            Zatwierdź wybór
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
