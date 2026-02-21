import { useState, useMemo } from 'react';
import { Search, Plus, ChevronDown, ChevronRight, MessageSquare } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { mockSalesOrders, type SalesOrder } from '@/data/salesMockData';
import { toast } from 'sonner';

const formatCurrency = (value: number) =>
  value.toLocaleString('pl-PL', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' zł';

const SalesOrdersView = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [orders, setOrders] = useState<SalesOrder[]>(mockSalesOrders);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  const filteredOrders = useMemo(() => {
    if (!searchQuery.trim()) return orders;
    const q = searchQuery.toLowerCase();
    return orders.filter(
      (o) =>
        o.customerName.toLowerCase().includes(q) ||
        o.orderNumber.toLowerCase().includes(q)
    );
  }, [orders, searchQuery]);

  const toggleExpand = (id: string) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const changeStatus = (id: string, newStatus: SalesOrder['status']) => {
    setOrders((prev) =>
      prev.map((o) => (o.id === id ? { ...o, status: newStatus } : o))
    );
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <h2 className="text-xl font-semibold text-foreground">Zamówienia</h2>
      </div>

      {/* Toolbar */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="relative w-full max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Szukaj klienta lub nr zamówienia..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <Button
          size="sm"
          onClick={() => toast.info('Moduł dodawania zamówień w przygotowaniu')}
        >
          <Plus className="w-4 h-4" />
          Dodaj zamówienie
        </Button>
      </div>

      {/* Table */}
      <div className="rounded-lg border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[120px]">Nr zamówienia</TableHead>
              <TableHead className="w-[110px]">Data</TableHead>
              <TableHead>Klient</TableHead>
              <TableHead className="text-right w-[110px]">Netto</TableHead>
              <TableHead className="text-right w-[110px]">Brutto</TableHead>
              <TableHead>Produkty</TableHead>
              <TableHead className="w-[50px] text-center">Uwagi</TableHead>
              <TableHead className="w-[110px]">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredOrders.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                  Brak zamówień spełniających kryteria
                </TableCell>
              </TableRow>
            ) : (
              filteredOrders.map((order) => {
                const isExpanded = expandedRows.has(order.id);
                const hasMultipleProducts = order.products.length > 1;

                return (
                  <Collapsible key={order.id} open={isExpanded} onOpenChange={() => toggleExpand(order.id)} asChild>
                    <>
                      <TableRow className="group">
                        <TableCell className="font-mono text-sm">{order.orderNumber}</TableCell>
                        <TableCell className="text-sm">
                          {format(parseISO(order.createdAt), 'dd.MM.yyyy')}
                        </TableCell>
                        <TableCell className="font-medium">{order.customerName}</TableCell>
                        <TableCell className="text-right text-sm tabular-nums">
                          {formatCurrency(order.totalNet)}
                        </TableCell>
                        <TableCell className="text-right text-sm tabular-nums">
                          {formatCurrency(order.totalGross)}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {hasMultipleProducts ? (
                              <CollapsibleTrigger asChild>
                                <button className="flex items-center gap-1.5 text-sm text-left hover:text-primary transition-colors">
                                  {isExpanded ? (
                                    <ChevronDown className="w-3.5 h-3.5 shrink-0" />
                                  ) : (
                                    <ChevronRight className="w-3.5 h-3.5 shrink-0" />
                                  )}
                                  <span className="truncate max-w-[200px]">{order.products[0].name}</span>
                                  <Badge variant="secondary" className="text-xs shrink-0">
                                    +{order.products.length - 1}
                                  </Badge>
                                </button>
                              </CollapsibleTrigger>
                            ) : (
                              <span className="text-sm truncate max-w-[260px]">{order.products[0].name}</span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-center">
                          {order.comment ? (
                            <TooltipProvider delayDuration={200}>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <MessageSquare className="w-4 h-4 text-muted-foreground mx-auto cursor-help" />
                                </TooltipTrigger>
                                <TooltipContent side="top" className="max-w-xs">
                                  <p className="text-sm">{order.comment}</p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          ) : null}
                        </TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <button className="focus:outline-none">
                                <Badge
                                  variant={order.status === 'wysłany' ? 'default' : 'outline'}
                                  className={
                                    order.status === 'wysłany'
                                      ? 'bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer'
                                      : 'border-amber-500 text-amber-600 cursor-pointer'
                                  }
                                >
                                  {order.status}
                                </Badge>
                              </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => changeStatus(order.id, 'nowy')}>
                                <Badge variant="outline" className="border-amber-500 text-amber-600 mr-2">
                                  nowy
                                </Badge>
                                Oznacz jako nowy
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => changeStatus(order.id, 'wysłany')}>
                                <Badge className="bg-emerald-600 text-white mr-2">wysłany</Badge>
                                Oznacz jako wysłany
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>

                      {hasMultipleProducts && (
                        <CollapsibleContent asChild>
                          <tr>
                            <td colSpan={8} className="p-0">
                              <div className="bg-muted/30 px-6 py-3 border-t border-border/50">
                                <div className="space-y-1.5">
                                  {order.products.map((product, idx) => (
                                    <div
                                      key={idx}
                                      className="flex items-center justify-between text-sm gap-4"
                                    >
                                      <span className="text-muted-foreground min-w-0 truncate">
                                        {product.name}
                                      </span>
                                      <div className="flex items-center gap-4 shrink-0 tabular-nums text-xs text-muted-foreground">
                                        <span>{product.quantity} szt.</span>
                                        <span className="w-24 text-right">{formatCurrency(product.priceNet)}</span>
                                        <span className="w-24 text-right">{formatCurrency(product.priceGross)}</span>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </td>
                          </tr>
                        </CollapsibleContent>
                      )}
                    </>
                  </Collapsible>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};

export default SalesOrdersView;
