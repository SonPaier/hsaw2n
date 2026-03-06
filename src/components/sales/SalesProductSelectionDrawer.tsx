import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
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

export interface SalesProductOption {
  id: string;
  fullName: string;
  shortName: string;
  priceNet: number;
  priceUnit: string;
}

interface SalesProductSelectionDrawerProps {
  open: boolean;
  onClose: () => void;
  instanceId: string;
  selectedProductIds: string[];
  onConfirm: (products: SalesProductOption[]) => void;
}

const formatCurrency = (value: number) =>
  value.toLocaleString('pl-PL', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' zł';

const SalesProductSelectionDrawer = ({
  open,
  onClose,
  instanceId,
  selectedProductIds: initialSelectedIds,
  onConfirm,
}: SalesProductSelectionDrawerProps) => {
  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState<SalesProductOption[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>(initialSelectedIds);
  const [searchQuery, setSearchQuery] = useState('');
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setSelectedIds(initialSelectedIds);
      setSearchQuery('');
      setTimeout(() => searchInputRef.current?.focus(), 300);
    }
  }, [open, initialSelectedIds]);

  const fetchProducts = useCallback(async () => {
    if (!open || !instanceId) return;
    setLoading(true);
    const { data } = await (supabase
      .from('sales_products')
      .select('id, full_name, short_name, price_net, price_unit')
      .eq('instance_id', instanceId)
      .order('created_at', { ascending: false }) as any);

    setProducts((data || []).map((p: any) => ({
      id: p.id,
      fullName: p.full_name,
      shortName: p.short_name || '',
      priceNet: Number(p.price_net),
      priceUnit: p.price_unit || 'szt.',
    })));
    setLoading(false);
  }, [open, instanceId]);

  useEffect(() => { fetchProducts(); }, [fetchProducts]);

  const filteredProducts = useMemo(() => {
    if (!searchQuery.trim()) return products;
    const q = searchQuery.toLowerCase();
    return products.filter(p =>
      p.fullName.toLowerCase().includes(q) ||
      p.shortName.toLowerCase().includes(q)
    );
  }, [products, searchQuery]);

  const toggleProduct = (productId: string) => {
    setSelectedIds(prev =>
      prev.includes(productId)
        ? prev.filter(id => id !== productId)
        : [...prev, productId]
    );
  };

  const selectedProducts = useMemo(() => {
    return selectedIds
      .map(id => products.find(p => p.id === id))
      .filter((p): p is SalesProductOption => p !== undefined);
  }, [selectedIds, products]);

  const totalNet = useMemo(() => {
    return selectedProducts.reduce((sum, p) => sum + p.priceNet, 0);
  }, [selectedProducts]);

  const handleConfirm = () => {
    onConfirm(selectedProducts);
    onClose();
  };

  return (
    <Sheet open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <SheetContent
        side="right"
        hideOverlay
        hideCloseButton
        className="w-full sm:w-[400px] sm:max-w-[400px] h-full p-0 flex flex-col shadow-[-8px_0_30px_-12px_rgba(0,0,0,0.15)] z-[1000] bg-white [&_input]:border-foreground/60 [&_textarea]:border-foreground/60 [&_select]:border-foreground/60"
        onFocusOutside={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        {/* Header */}
        <SheetHeader
          className="border-b px-4 py-3 cursor-pointer hover:bg-primary/5 transition-colors shrink-0"
          onClick={onClose}
        >
          <SheetTitle className="flex items-center gap-3 text-lg font-semibold">
            <ArrowLeft className="w-5 h-5" />
            Wybierz produkty
          </SheetTitle>
        </SheetHeader>

        {/* Search */}
        <div className="px-4 py-3 border-b shrink-0">
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

        {/* Product List */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">
              {searchQuery.trim() ? 'Brak pasujących produktów' : 'Brak produktów'}
            </div>
          ) : (
            <div className="pb-4">
              {filteredProducts.map((product) => {
                const isSelected = selectedIds.includes(product.id);
                return (
                  <button
                    key={product.id}
                    type="button"
                    onClick={() => toggleProduct(product.id)}
                    className={cn(
                      "w-full flex items-center px-4 py-3 border-b border-border/50 transition-colors",
                      isSelected ? "bg-primary/5" : "hover:bg-primary/5"
                    )}
                  >
                    <div className="flex-1 text-left min-w-0">
                      {product.shortName ? (
                        <>
                          <p className="font-bold text-primary">{product.shortName}</p>
                          <p className="text-muted-foreground text-xs leading-tight truncate">{product.fullName}</p>
                        </>
                      ) : (
                        <p className="font-medium text-foreground">{product.fullName}</p>
                      )}
                    </div>

                    <div className="text-right mr-4 shrink-0">
                      <p className="font-semibold text-foreground text-sm">{formatCurrency(product.priceNet)}</p>
                      <p className="text-xs text-muted-foreground">netto/{product.priceUnit}</p>
                    </div>

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
          )}
        </div>

        {/* Footer */}
        <div className="border-t px-4 py-4 shrink-0">
          <div className="mb-3 space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-lg font-semibold text-foreground">
                Wybrano: {selectedIds.length}
              </span>
            </div>
            {selectedIds.length > 0 && (
              <div className="text-right">
                <span className="text-xl font-bold text-foreground">
                  {formatCurrency(totalNet)} netto
                </span>
              </div>
            )}
          </div>
          <Button
            onClick={handleConfirm}
            disabled={selectedIds.length === 0}
            className="w-full"
            size="lg"
          >
            Zatwierdź
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default SalesProductSelectionDrawer;
