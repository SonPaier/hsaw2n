import { useState, useMemo, useEffect } from 'react';
import { Search, X, Plus, Minus } from 'lucide-react';
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
import { toast } from 'sonner';
import { type SalesOrder } from '@/data/salesMockData';
import { getNextOrderNumber } from './SalesOrdersView';

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
}

const AddSalesOrderDrawer = ({ open, onOpenChange, orders, initialCustomer }: AddSalesOrderDrawerProps) => {
  const [customerSearch, setCustomerSearch] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<SalesCustomerRef | null>(null);
  const [customerPopoverOpen, setCustomerPopoverOpen] = useState(false);

  const [productPopoverOpen, setProductPopoverOpen] = useState(false);
  const [products, setProducts] = useState<OrderProduct[]>([]);

  const [applyDiscount, setApplyDiscount] = useState(true);

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

  // Will be replaced with DB data
  const customers: SalesCustomerRef[] = [];
  const availableProducts: SalesProductRef[] = [];

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

  const handleSubmit = () => {
    toast.info('Moduł dodawania zamówień w przygotowaniu');
    handleClose();
  };

  const resetForm = () => {
    setSelectedCustomer(null);
    setCustomerSearch('');
    setProducts([]);
    setApplyDiscount(true);
    setSendEmail(false);
    setComment('');
  };

  return (
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
                <Popover open={customerPopoverOpen} onOpenChange={setCustomerPopoverOpen}>
                  <PopoverTrigger asChild>
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        placeholder="Wyszukaj klienta..."
                        value={customerSearch}
                        onChange={(e) => {
                          setCustomerSearch(e.target.value);
                          if (!customerPopoverOpen && e.target.value.length >= 2) setCustomerPopoverOpen(true);
                        }}
                        onFocus={() => {
                          if (customerSearch.length >= 2) setCustomerPopoverOpen(true);
                        }}
                        className="pl-9"
                      />
                    </div>
                  </PopoverTrigger>
                  <PopoverContent className="p-0 w-[--radix-popover-trigger-width]" align="start">
                    <Command>
                      <CommandList>
                        <CommandEmpty>Nie znaleziono klientów</CommandEmpty>
                        <CommandGroup>
                          {customers
                            .filter((c) =>
                              c.name.toLowerCase().includes(customerSearch.toLowerCase())
                            )
                            .map((c) => (
                              <CommandItem
                                key={c.id}
                                onSelect={() => {
                                  setSelectedCustomer(c);
                                  setCustomerSearch('');
                                  setCustomerPopoverOpen(false);
                                }}
                              >
                                {c.name}
                              </CommandItem>
                            ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              )}
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

              <Popover open={productPopoverOpen} onOpenChange={setProductPopoverOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="w-full gap-2">
                    <Plus className="w-4 h-4" />
                    Dodaj produkt
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="p-0 w-[--radix-popover-trigger-width]" align="start">
                  <Command>
                    <CommandInput placeholder="Szukaj produktu..." />
                    <CommandList>
                      <CommandEmpty>Nie znaleziono produktu</CommandEmpty>
                      <CommandGroup>
                        {availableProducts
                          .filter((p) => !products.find((op) => op.productId === p.id))
                          .map((p) => (
                            <CommandItem key={p.id} onSelect={() => addProduct(p)}>
                              <div className="flex justify-between w-full">
                                <span className="truncate mr-2">{p.name}</span>
                                <span className="text-muted-foreground shrink-0 text-xs">
                                  {formatCurrency(p.priceNet)}
                                </span>
                              </div>
                            </CommandItem>
                          ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
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
            <Button className="flex-1" onClick={handleSubmit}>
              Dodaj zamówienie
            </Button>
          </div>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
};

export default AddSalesOrderDrawer;
