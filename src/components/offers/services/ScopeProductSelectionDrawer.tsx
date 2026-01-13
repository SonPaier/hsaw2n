import { useState, useEffect, useMemo, useRef } from 'react';
import { ArrowLeft, Check, Loader2, Search, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';

interface ScopeProduct {
  id: string;
  productId: string;
  productName: string;
  variantName: string | null;
  price: number;
}

interface ScopeProductSelectionDrawerProps {
  open: boolean;
  onClose: () => void;
  availableProducts: ScopeProduct[];
  selectedProductIds: string[];
  onSelect: (product: ScopeProduct) => void;
}

export function ScopeProductSelectionDrawer({
  open,
  onClose,
  availableProducts,
  selectedProductIds,
  onSelect,
}: ScopeProductSelectionDrawerProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Reset search when drawer opens
  useEffect(() => {
    if (open) {
      setSearchQuery('');
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 300);
    }
  }, [open]);

  // Filter products based on search
  const filteredProducts = useMemo(() => {
    if (!searchQuery.trim()) return availableProducts;
    
    const query = searchQuery.toLowerCase();
    return availableProducts.filter(p => 
      p.productName.toLowerCase().includes(query) ||
      (p.variantName && p.variantName.toLowerCase().includes(query))
    );
  }, [availableProducts, searchQuery]);

  // Format price
  const formatPrice = (price: number): string => {
    return `${price.toFixed(0)} zł`;
  };

  // Handle product selection
  const handleSelectProduct = (product: ScopeProduct) => {
    onSelect(product);
    onClose();
  };

  return (
    <Sheet open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <SheetContent 
        side="right" 
        hideOverlay
        hideCloseButton
        className="w-full sm:max-w-lg p-0 flex flex-col shadow-[-8px_0_30px_-12px_rgba(0,0,0,0.15)]"
        onFocusOutside={(e) => e.preventDefault()}
      >
        {/* Header - clicking closes drawer */}
        <SheetHeader 
          className="border-b px-4 py-3 cursor-pointer hover:bg-muted/50 transition-colors shrink-0"
          onClick={onClose}
        >
          <SheetTitle className="flex items-center gap-3 text-lg font-semibold">
            <ArrowLeft className="w-5 h-5" />
            Dodaj produkt
          </SheetTitle>
        </SheetHeader>

        {/* Search Section */}
        <div className="px-4 py-3 border-b space-y-3 shrink-0">
          {/* Search Input */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              ref={searchInputRef}
              type="search"
              inputMode="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Szukaj produktu..."
              className="pl-9 pr-9 h-11"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  searchInputRef.current?.focus();
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
          <div className="pb-4">
            {filteredProducts.length === 0 ? (
              <div className="py-12 text-center text-muted-foreground">
                {searchQuery ? 'Nie znaleziono produktów' : 'Brak dostępnych produktów'}
              </div>
            ) : (
              filteredProducts.map((product) => {
                const isSelected = selectedProductIds.includes(product.id);
                
                return (
                  <button
                    key={product.id}
                    type="button"
                    onClick={() => handleSelectProduct(product)}
                    disabled={isSelected}
                    className={cn(
                      "w-full flex items-center px-4 py-3 border-b border-border/50 transition-colors",
                      isSelected 
                        ? "bg-muted/50 opacity-50 cursor-not-allowed" 
                        : "hover:bg-muted/30"
                    )}
                  >
                    {/* Product info */}
                    <div className="flex-1 text-left">
                      {product.variantName && (
                        <p className="text-xs text-muted-foreground font-medium uppercase">
                          {product.variantName}
                        </p>
                      )}
                      <p className="font-medium text-foreground">
                        {product.productName}
                      </p>
                    </div>
                    
                    {/* Price */}
                    <div className="text-right mr-4">
                      <p className="font-semibold text-foreground">{formatPrice(product.price)}</p>
                    </div>
                    
                    {/* Checkmark for already selected */}
                    {isSelected && (
                      <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center shrink-0">
                        <Check className="w-4 h-4 text-primary-foreground" />
                      </div>
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
