import { useState, useEffect, useMemo, useRef } from 'react';
import { ArrowLeft, Check, Search, X } from 'lucide-react';
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
  productShortName: string | null;
  variantName: string | null;
  price: number;
}

interface ScopeProductSelectionDrawerProps {
  open: boolean;
  onClose: () => void;
  availableProducts: ScopeProduct[];
  alreadySelectedIds: string[];
  onConfirm: (products: ScopeProduct[]) => void;
}

export function ScopeProductSelectionDrawer({
  open,
  onClose,
  availableProducts,
  alreadySelectedIds,
  onConfirm,
}: ScopeProductSelectionDrawerProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const initRef = useRef(false);

  // Initialize with already selected products when drawer opens
  useEffect(() => {
    if (open && !initRef.current) {
      initRef.current = true;
      setSearchQuery('');
      setSelectedIds(alreadySelectedIds); // Start with already selected
    }

    if (!open) {
      initRef.current = false;
    }
  }, [open, alreadySelectedIds]);

  // Filter products based on search
  const filteredProducts = useMemo(() => {
    if (!searchQuery.trim()) return availableProducts;
    
    const query = searchQuery.toLowerCase();
    return availableProducts.filter(p => 
      p.productName.toLowerCase().includes(query) ||
      (p.variantName && p.variantName.toLowerCase().includes(query))
    );
  }, [availableProducts, searchQuery]);

  // Get selected products details
  const selectedProducts = useMemo(() => {
    return selectedIds
      .map(id => availableProducts.find(p => p.id === id))
      .filter((p): p is ScopeProduct => p !== undefined);
  }, [selectedIds, availableProducts]);

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

  // Remove from selection
  const removeProduct = (productId: string) => {
    setSelectedIds(prev => prev.filter(id => id !== productId));
  };

  // Handle confirm
  const handleConfirm = () => {
    onConfirm(selectedProducts);
    onClose();
  };

  // Get chip label - use short_name if available
  const getChipLabel = (product: ScopeProduct): string => {
    const displayName = product.productShortName || product.variantName || product.productName;
    return displayName.length > 20 ? displayName.substring(0, 18) + '...' : displayName;
  };

  // Get display name for list - use short_name if available
  const getDisplayName = (product: ScopeProduct): string => {
    return product.productShortName || product.productName;
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
        {/* Header */}
        <SheetHeader 
          className="border-b px-4 py-3 cursor-pointer hover:bg-muted/50 transition-colors shrink-0"
          onClick={onClose}
        >
          <SheetTitle className="flex items-center gap-3 text-lg font-semibold">
            <ArrowLeft className="w-5 h-5" />
            Dodaj produkty
          </SheetTitle>
        </SheetHeader>

        {/* Search Section */}
        <div className="px-4 py-3 border-b space-y-3 shrink-0">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
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
                const isSelected = selectedIds.includes(product.id);
                
                return (
                  <button
                    key={product.id}
                    type="button"
                    onClick={() => toggleProduct(product.id)}
                    className={cn(
                      "w-full flex items-center px-4 py-3 border-b border-border/50 transition-colors",
                      isSelected 
                        ? "bg-primary/5" 
                        : "hover:bg-muted/30"
                    )}
                  >
                    {/* Product name only */}
                    <div className="flex-1 text-left">
                      <p className="font-medium text-foreground">
                        {getDisplayName(product)}
                      </p>
                    </div>
                    
                    {/* Price */}
                    <div className="text-right mr-4 sm:mr-4 ml-4">
                      <p className="font-semibold text-primary">{formatPrice(product.price)}</p>
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
              })
            )}
          </div>
        </div>

        {/* Fixed Footer */}
        <div className="border-t px-4 py-4 shrink-0 bg-background">
          <Button 
            onClick={handleConfirm}
            disabled={selectedIds.length === 0}
            className="w-full h-12 text-base font-semibold"
          >
            Dodaj wybrane ({selectedIds.length})
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
