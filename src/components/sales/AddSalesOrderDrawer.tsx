import { useState, useMemo } from 'react';
import { Search, X, Plus, Percent, Minus } from 'lucide-react';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerFooter,
  DrawerClose,
} from '@/components/ui/drawer';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
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

// Mock customers
const mockCustomers = [
  { id: '1', name: 'Auto Detailing Kraków Sp. z o.o.' },
  { id: '2', name: 'Wrap Studio Warszawa' },
  { id: '3', name: 'PPF Master Poznań' },
  { id: '4', name: 'FolioTech Wrocław' },
  { id: '5', name: 'CarWrap Pro Gdańsk' },
  { id: '6', name: 'Detailing Center Łódź' },
  { id: '7', name: 'Auto Spa Premium Katowice' },
  { id: '8', name: 'Shield Car Studio Lublin' },
  { id: '9', name: 'MaxProtect Szczecin' },
  { id: '10', name: 'Elite Detailing Białystok' },
];

// Mock products
const mockProducts = [
  { id: 'p1', name: 'Folia ochronna PPF ULTRAFIT Premium 152cm', priceNet: 1200 },
  { id: 'p2', name: 'Folia ochronna PPF ULTRAFIT Matte 152cm', priceNet: 1800 },
  { id: 'p3', name: 'Folia ochronna PPF ULTRAFIT Gloss 152cm', priceNet: 1400 },
  { id: 'p4', name: 'Folia ochronna PPF ULTRAFIT Gloss 76cm', priceNet: 650 },
  { id: 'p5', name: 'Folia ochronna PPF ULTRAFIT Matte 76cm', priceNet: 950 },
  { id: 'p6', name: 'Folia przyciemniająca ULTRAFIT IR Nano 50cm', priceNet: 300 },
  { id: 'p7', name: 'Folia przyciemniająca ULTRAFIT IR Nano 76cm', priceNet: 500 },
  { id: 'p8', name: 'Folia przyciemniająca ULTRAFIT Hybrid 50cm', priceNet: 350 },
  { id: 'p9', name: 'Folia przyciemniająca ULTRAFIT Hybrid 76cm', priceNet: 550 },
  { id: 'p10', name: 'Folia ochronna przedniej szyby ULTRAFIT 100cm', priceNet: 475 },
  { id: 'p11', name: 'Folia ochronna przedniej szyby ULTRAFIT 130cm', priceNet: 675 },
];

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
}

const AddSalesOrderDrawer = ({ open, onOpenChange }: AddSalesOrderDrawerProps) => {
  const [customerSearch, setCustomerSearch] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<{ id: string; name: string } | null>(null);
  const [customerPopoverOpen, setCustomerPopoverOpen] = useState(false);

  const [productPopoverOpen, setProductPopoverOpen] = useState(false);
  const [products, setProducts] = useState<OrderProduct[]>([]);

  const [discountType, setDiscountType] = useState<'percent' | 'amount'>('percent');
  const [discountValue, setDiscountValue] = useState('');

  const [sendEmail, setSendEmail] = useState(false);
  const [comment, setComment] = useState('');

  const addProduct = (product: typeof mockProducts[0]) => {
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

  const discountAmount = useMemo(() => {
    const val = parseFloat(discountValue) || 0;
    if (discountType === 'percent') return subtotalNet * (val / 100);
    return val;
  }, [discountType, discountValue, subtotalNet]);

  const totalNet = Math.max(0, subtotalNet - discountAmount);
  const totalGross = totalNet * (1 + VAT_RATE);

  const handleSubmit = () => {
    toast.info('Moduł dodawania zamówień w przygotowaniu');
    onOpenChange(false);
  };

  const resetForm = () => {
    setSelectedCustomer(null);
    setCustomerSearch('');
    setProducts([]);
    setDiscountValue('');
    setDiscountType('percent');
    setSendEmail(false);
    setComment('');
  };

  return (
    <Drawer
      open={open}
      onOpenChange={(o) => {
        if (!o) resetForm();
        onOpenChange(o);
      }}
      direction="right"
    >
      <DrawerContent
        className="fixed inset-y-0 right-0 left-auto w-full sm:w-[480px] rounded-none rounded-l-lg"
        hideOverlay={false}
      >
        <div className="flex flex-col h-full overflow-hidden">
          <DrawerHeader className="text-left border-b border-border pb-4">
            <DrawerTitle>Dodaj zamówienie</DrawerTitle>
          </DrawerHeader>

          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-6">
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
                          {mockCustomers
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
                        {mockProducts
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

                  {/* Discount */}
                  <div className="space-y-2">
                    <p className="text-sm text-muted-foreground">Rabat</p>
                    <div className="flex items-center gap-2">
                      <div className="flex border border-border rounded-md overflow-hidden">
                        <button
                          className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                            discountType === 'percent'
                              ? 'bg-primary text-primary-foreground'
                              : 'bg-card text-muted-foreground hover:bg-muted/20'
                          }`}
                          onClick={() => setDiscountType('percent')}
                        >
                          <Percent className="w-3 h-3" />
                        </button>
                        <button
                          className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                            discountType === 'amount'
                              ? 'bg-primary text-primary-foreground'
                              : 'bg-card text-muted-foreground hover:bg-muted/20'
                          }`}
                          onClick={() => setDiscountType('amount')}
                        >
                          zł
                        </button>
                      </div>
                      <Input
                        type="number"
                        min={0}
                        placeholder={discountType === 'percent' ? '0' : '0.00'}
                        value={discountValue}
                        onChange={(e) => setDiscountValue(e.target.value)}
                        className="w-28 h-8 text-sm"
                      />
                    </div>
                  </div>

                  {/* Totals */}
                  <div className="bg-card border border-border rounded-md p-3 space-y-1.5 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Suma netto</span>
                      <span className="tabular-nums">{formatCurrency(subtotalNet)}</span>
                    </div>
                    {discountAmount > 0 && (
                      <div className="flex justify-between text-destructive">
                        <span>Rabat</span>
                        <span className="tabular-nums">-{formatCurrency(discountAmount)}</span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Netto po rabacie</span>
                      <span className="tabular-nums font-medium">{formatCurrency(totalNet)}</span>
                    </div>
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
                    <p className="text-foreground">ul. Krakowska 15/3</p>
                    <p className="text-foreground">30-150 Kraków</p>
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
                placeholder="Opcjonalne uwagi..."
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                rows={3}
              />
            </div>
          </div>

          {/* Footer */}
          <DrawerFooter className="border-t border-border pt-4 flex-row gap-3">
            <DrawerClose asChild>
              <Button variant="outline" className="flex-1">
                Anuluj
              </Button>
            </DrawerClose>
            <Button className="flex-1" onClick={handleSubmit}>
              Dodaj zamówienie
            </Button>
          </DrawerFooter>
        </div>
      </DrawerContent>
    </Drawer>
  );
};

export default AddSalesOrderDrawer;
