import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { Search, X, Plus, Minus, Loader2 } from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from '@/components/ui/sheet';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { type SalesOrder } from '@/data/salesMockData';
import { getNextOrderNumber } from './SalesOrdersView';
import AddEditSalesCustomerDrawer from './AddEditSalesCustomerDrawer';

interface SalesCustomerRef {
  id: string;
  name: string;
  discountPercent?: number;
}

interface SalesProductRef {
  id: string;
  name: string;
  priceNet: number;
}

interface OrderProduct {
  productId: string;
  name: string;
  priceNet: number;
  quantity: number;
}

const VAT_RATE = 0.23;

const formatCurrency = (value: number) =>
  value.toLocaleString('pl-PL', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' zł';

interface AddSalesOrderDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orders: SalesOrder[];
  initialCustomer?: { id: string; name: string; discountPercent?: number } | null;
  onOrderCreated?: () => void;
}

const AddSalesOrderDrawer = ({ open, onOpenChange, orders, initialCustomer, onOrderCreated }: AddSalesOrderDrawerProps) => {
  const { roles } = useAuth();
  const instanceId = roles.find(r => r.instance_id)?.instance_id || null;

  const [customerSearch, setCustomerSearch] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<SalesCustomerRef | null>(null);
  const [searchResults, setSearchResults] = useState<SalesCustomerRef[]>([]);
  const [searching, setSearching] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Add customer drawer state
  const [addCustomerOpen, setAddCustomerOpen] = useState(false);
  const [addCustomerInitialQuery, setAddCustomerInitialQuery] = useState('');

  const [productPopoverOpen, setProductPopoverOpen] = useState(false);
  const [products, setProducts] = useState<OrderProduct[]>([]);

  const [applyDiscount, setApplyDiscount] = useState(true);
  const [vehicle, setVehicle] = useState('');

  const [sendEmail, setSendEmail] = useState(false);
  const [comment, setComment] = useState('');

  // Set initial customer when provided
  useEffect(() => {
    if (open && initialCustomer) {
      setSelectedCustomer({
        id: initialCustomer.id,
        name: initialCustomer.name,
        discountPercent: initialCustomer.discountPercent,
      });
    }
    if (!open) {
      setSelectedCustomer(null);
    }
  }, [open, initialCustomer]);

  // Search customers from DB
  const searchCustomers = useCallback(async (q: string) => {
    if (!instanceId || q.length < 2) {
      setSearchResults([]);
      setDropdownOpen(false);
      return;
    }
    setSearching(true);
    const { data } = await (supabase
      .from('customers')
      .select('id, name, discount_percent')
      .eq('instance_id', instanceId)
      .eq('source', 'sales')
      .ilike('name', `%${q}%`)
      .order('name')
      .limit(10) as any);
    
    const results: SalesCustomerRef[] = (data || []).map((c: any) => ({
      id: c.id,
      name: c.name,
      discountPercent: c.discount_percent ?? undefined,
    }));
    setSearchResults(results);
    setDropdownOpen(true);
    setActiveIndex(-1);
    setSearching(false);
  }, [instanceId]);

  useEffect(() => {
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    searchTimeoutRef.current = setTimeout(() => searchCustomers(customerSearch), 300);
    return () => { if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current); };
  }, [customerSearch, searchCustomers]);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleCustomerKeyDown = (e: React.KeyboardEvent) => {
    if (!dropdownOpen) return;
    const totalItems = searchResults.length + (searchResults.length === 0 && customerSearch.length >= 2 ? 1 : 0);
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setActiveIndex(prev => Math.min(prev + 1, totalItems - 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setActiveIndex(prev => Math.max(prev - 1, 0));
        break;
      case 'Enter':
        e.preventDefault();
        if (activeIndex >= 0 && activeIndex < searchResults.length) {
          handleSelectCustomer(searchResults[activeIndex]);
        }
        break;
      case 'Escape':
        setDropdownOpen(false);
        break;
    }
  };

  const handleSelectCustomer = (c: SalesCustomerRef) => {
    setSelectedCustomer(c);
    setCustomerSearch('');
    setDropdownOpen(false);
    setSearchResults([]);
  };

  const handleAddNewCustomer = () => {
    setAddCustomerInitialQuery(customerSearch);
    setDropdownOpen(false);
    setAddCustomerOpen(true);
  };

  const handleCustomerSaved = () => {
    // Re-search to find the newly created customer
    if (customerSearch.length >= 2) {
      searchCustomers(customerSearch);
    }
  };

  const nextOrderNumber = useMemo(() => getNextOrderNumber(orders), [orders]);

  const addProduct = (product: SalesProductRef) => {
    if (products.find((p) => p.productId === product.id)) return;
    setProducts((prev) => [
      ...prev,
      { productId: product.id, name: product.name, priceNet: product.priceNet, quantity: 1 },
    ]);
    setProductPopoverOpen(false);
  };

  const removeProduct = (productId: string) => {
    setProducts((prev) => prev.filter((p) => p.productId !== productId));
  };

  const updateQuantity = (productId: string, quantity: number) => {
    if (quantity < 1) return;
    setProducts((prev) =>
      prev.map((p) => (p.productId === productId ? { ...p, quantity } : p))
    );
  };

  const subtotalNet = useMemo(
    () => products.reduce((sum, p) => sum + p.priceNet * p.quantity, 0),
    [products]
  );

  const customerDiscount = selectedCustomer?.discountPercent || 0;
  const discountAmount = applyDiscount && customerDiscount > 0
    ? subtotalNet * (customerDiscount / 100)
    : 0;

  const totalNet = Math.max(0, subtotalNet - discountAmount);
  const totalGross = totalNet * (1 + VAT_RATE);

  const handleClose = () => {
    onOpenChange(false);
  };

  const [saving, setSaving] = useState(false);

  const handleSubmit = async () => {
    if (!instanceId) { toast.error('Brak instancji'); return; }
    if (!selectedCustomer) { toast.error('Wybierz klienta'); return; }
    if (products.length === 0) { toast.error('Dodaj przynajmniej jeden produkt'); return; }

    setSaving(true);
    try {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();

      const { data: order, error } = await (supabase
        .from('sales_orders')
        .insert({
          instance_id: instanceId,
          customer_id: selectedCustomer.id,
          order_number: nextOrderNumber,
          customer_name: selectedCustomer.name,
          total_net: totalNet,
          total_gross: totalGross,
          currency: 'PLN',
          comment: comment || null,
          vehicle: vehicle || null,
          status: 'nowy',
          created_by: user?.id || null,
        })
        .select('id')
        .single() as any);

      if (error) throw error;

      // Insert order items
      if (order?.id && products.length > 0) {
        const items = products.map((p, idx) => ({
          order_id: order.id,
          product_id: p.productId || null,
          name: p.name,
          quantity: p.quantity,
          price_net: p.priceNet,
          sort_order: idx,
        }));
        await (supabase.from('sales_order_items').insert(items) as any);
      }

      toast.success('Zamówienie zostało dodane');
      resetForm();
      onOpenChange(false);
      onOrderCreated?.();
    } catch (err: any) {
      toast.error('Błąd przy zapisie zamówienia: ' + (err.message || ''));
    } finally {
      setSaving(false);
    }
  };

  const resetForm = () => {
    setSelectedCustomer(null);
    setCustomerSearch('');
    setProducts([]);
    setApplyDiscount(true);
    setVehicle('');
    setSendEmail(false);
    setComment('');
  };

  return (
    <>
    <Sheet open={open} onOpenChange={(isOpen) => {
      if (!isOpen) {
        resetForm();
        onOpenChange(false);
      }
    }} modal={false}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-[27rem] flex flex-col h-full p-0 gap-0 shadow-[-8px_0_30px_-12px_rgba(0,0,0,0.15)]"
        hideOverlay
        hideCloseButton
        onInteractOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        {/* Fixed Header */}
        <SheetHeader className="px-6 pt-6 pb-4 border-b shrink-0">
          <div className="flex items-center justify-between">
            <SheetTitle>Dodaj zamówienie: {nextOrderNumber}</SheetTitle>
            <button
              type="button"
              onClick={handleClose}
              className="p-2 rounded-full hover:bg-muted transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </SheetHeader>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          <div className="space-y-4">
            {/* Customer selection */}
            <div className="space-y-2">
              <Label>Klient</Label>
              {selectedCustomer ? (
                <div className="flex items-center justify-between bg-muted/20 border border-border rounded-md px-3 py-2">
                  <span className="text-sm font-medium">{selectedCustomer.name}</span>
                  <button
                    onClick={() => setSelectedCustomer(null)}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <div ref={containerRef} className="relative">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      placeholder="Wyszukaj klienta..."
                      value={customerSearch}
                      onChange={(e) => setCustomerSearch(e.target.value)}
                      onFocus={() => { if (customerSearch.length >= 2 && searchResults.length > 0) setDropdownOpen(true); }}
                      onKeyDown={handleCustomerKeyDown}
                      className="pl-9 pr-9"
                    />
                    {searching && (
                      <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-muted-foreground" />
                    )}
                  </div>
                  {dropdownOpen && customerSearch.length >= 2 && (
                    <div className="absolute top-full left-0 right-0 mt-1 border border-border rounded-lg overflow-hidden bg-card shadow-lg z-[9999]">
                      {searchResults.length > 0 ? (
                        searchResults.map((c, i) => (
                          <button
                            key={c.id}
                            type="button"
                            className={`w-full px-4 py-3 text-left transition-colors border-b border-border last:border-0 ${
                              i === activeIndex ? 'bg-accent' : 'hover:bg-muted/30'
                            }`}
                            onClick={() => handleSelectCustomer(c)}
                            onMouseEnter={() => setActiveIndex(i)}
                          >
                            <span className="text-sm font-medium">{c.name}</span>
                          </button>
                        ))
                      ) : !searching ? (
                        <div className="p-4 text-center space-y-3">
                          <p className="text-sm text-muted-foreground">Nie znaleziono klientów</p>
                          <Button type="button" className="w-full" onClick={handleAddNewCustomer}>
                            <Plus className="w-4 h-4 mr-1" />
                            Dodaj klienta
                          </Button>
                        </div>
                      ) : null}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Vehicle */}
            <div className="space-y-2">
              <Label htmlFor="order-vehicle">Pojazd</Label>
              <Input
                id="order-vehicle"
                placeholder="np. BMW X5 2020"
                value={vehicle}
                onChange={(e) => setVehicle(e.target.value)}
              />
            </div>

            {/* Products */}
            <div className="space-y-2">
              <Label>Produkty</Label>
              {products.length > 0 && (
                <div className="space-y-2">
                  {products.map((p) => (
                    <div
                      key={p.productId}
                      className="flex items-start gap-3 bg-card border border-border rounded-md p-3"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium leading-tight truncate">{p.name}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {formatCurrency(p.priceNet)} netto/szt.
                        </p>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => updateQuantity(p.productId, p.quantity - 1)}
                          disabled={p.quantity <= 1}
                        >
                          <Minus className="w-3 h-3" />
                        </Button>
                        <Input
                          type="number"
                          min={1}
                          value={p.quantity}
                          onChange={(e) =>
                            updateQuantity(p.productId, parseInt(e.target.value) || 1)
                          }
                          className="w-14 h-7 text-center text-sm px-1"
                        />
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => updateQuantity(p.productId, p.quantity + 1)}
                        >
                          <Plus className="w-3 h-3" />
                        </Button>
                      </div>
                      <button
                        onClick={() => removeProduct(p.productId)}
                        className="text-muted-foreground hover:text-destructive mt-0.5"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <Button variant="outline" size="sm" className="w-full gap-2" onClick={() => toast.info('Produkty w przygotowaniu')}>
                <Plus className="w-4 h-4" />
                Dodaj produkt
              </Button>
            </div>

            {/* Summary */}
            {products.length > 0 && (
              <>
                <Separator />
                <div className="space-y-3">
                  <Label>Podsumowanie</Label>

                  {/* Customer discount info */}
                  {selectedCustomer && customerDiscount > 0 && (
                    <div className="flex items-center justify-between bg-muted/20 border border-border rounded-md px-3 py-2">
                      <span className="text-sm">Rabat: {customerDiscount}%</span>
                      <div className="flex items-center gap-2">
                        <Label htmlFor="apply-discount" className="text-xs text-muted-foreground font-normal">
                          Zastosuj
                        </Label>
                        <Switch
                          id="apply-discount"
                          checked={applyDiscount}
                          onCheckedChange={setApplyDiscount}
                        />
                      </div>
                    </div>
                  )}

                  {/* Totals */}
                  <div className="bg-card border border-border rounded-md p-3 space-y-1.5 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Suma netto</span>
                      <span className="tabular-nums">{formatCurrency(subtotalNet)}</span>
                    </div>
                    {discountAmount > 0 && (
                      <div className="flex justify-between text-destructive">
                        <span>Rabat ({customerDiscount}%)</span>
                        <span className="tabular-nums">-{formatCurrency(discountAmount)}</span>
                      </div>
                    )}
                    {discountAmount > 0 && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Netto po rabacie</span>
                        <span className="tabular-nums font-medium">{formatCurrency(totalNet)}</span>
                      </div>
                    )}
                    <Separator className="my-1" />
                    <div className="flex justify-between font-semibold">
                      <span>Brutto (23% VAT)</span>
                      <span className="tabular-nums">{formatCurrency(totalGross)}</span>
                    </div>
                  </div>

                  {/* Shipping address */}
                  <div className="bg-card border border-border rounded-md p-3 text-sm">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-muted-foreground">Adres wysyłki</span>
                      <button className="text-xs text-primary hover:underline">Edytuj adres wysyłki</button>
                    </div>
                    <p className="text-muted-foreground">—</p>
                  </div>
                </div>
              </>
            )}

            {/* Email checkbox */}
            <div className="flex items-center gap-2">
              <Checkbox
                id="send-email"
                checked={sendEmail}
                onCheckedChange={(v) => setSendEmail(v === true)}
              />
              <Label htmlFor="send-email" className="text-sm font-normal cursor-pointer">
                Wyślij email z potwierdzeniem zamówienia
              </Label>
            </div>

            {/* Comment */}
            <div className="space-y-2">
              <Label htmlFor="order-comment">Uwagi do zamówienia</Label>
              <Textarea
                id="order-comment"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                rows={3}
              />
            </div>
          </div>
        </div>

        {/* Fixed Footer */}
        <SheetFooter className="px-6 py-4 border-t shrink-0">
          <div className="flex gap-3 w-full">
            <Button variant="outline" className="flex-1" onClick={handleClose}>
              Anuluj
            </Button>
            <Button className="flex-1" onClick={handleSubmit} disabled={saving}>
              {saving ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />Zapisuję...</> : 'Dodaj zamówienie'}
            </Button>
          </div>
        </SheetFooter>
      </SheetContent>
    </Sheet>

    {instanceId && (
      <AddEditSalesCustomerDrawer
        open={addCustomerOpen}
        onOpenChange={setAddCustomerOpen}
        customer={null}
        instanceId={instanceId}
        onSaved={handleCustomerSaved}
      />
    )}
    </>
  );
};

export default AddSalesOrderDrawer;
