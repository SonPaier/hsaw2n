import { useState, useMemo } from 'react';
import { toast } from 'sonner';
import AddSalesOrderDrawer from './AddSalesOrderDrawer';
import { Search, Plus, ChevronDown, ChevronRight, ChevronLeft as ChevronLeftIcon, ChevronRight as ChevronRightIcon, MoreHorizontal } from 'lucide-react';
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
import { mockSalesOrders, type SalesOrder } from '@/data/salesMockData';

const formatCurrency = (value: number, currency: 'PLN' | 'EUR') => {
  if (currency === 'EUR') {
    return value.toLocaleString('pl-PL', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
  }
  return value.toLocaleString('pl-PL', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' zł';
};

const ITEMS_PER_PAGE = 10;

const SalesOrdersView = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [orders, setOrders] = useState<SalesOrder[]>(mockSalesOrders);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [currentPage, setCurrentPage] = useState(1);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const filteredOrders = useMemo(() => {
    if (!searchQuery.trim()) return orders;
    const q = searchQuery.toLowerCase();
    return orders.filter(
      (o) =>
        o.customerName.toLowerCase().includes(q) ||
        o.orderNumber.toLowerCase().includes(q)
    );
  }, [orders, searchQuery]);

  const totalPages = Math.ceil(filteredOrders.length / ITEMS_PER_PAGE);
  const paginatedOrders = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredOrders.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredOrders, currentPage]);

  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    setCurrentPage(1);
  };

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
            onChange={(e) => handleSearchChange(e.target.value)}
            className="pl-9"
          />
        </div>
        <Button
          size="sm"
          onClick={() => setDrawerOpen(true)}
        >
          <Plus className="w-4 h-4" />
          Dodaj zamówienie
        </Button>
      </div>

      {/* Table */}
      <div className="rounded-lg border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-[100px]">Nr</TableHead>
              <TableHead className="w-[200px]">Klient</TableHead>
              <TableHead className="w-[130px]">
                <div className="leading-tight">
                  <div>Data utw.</div>
                  <div>Data wys.</div>
                </div>
              </TableHead>
              <TableHead className="w-[100px]">Status</TableHead>
              <TableHead className="w-[180px]">Nr listu przewozowego</TableHead>
              <TableHead className="text-right w-[120px]">Kwota netto</TableHead>
              <TableHead className="w-[50px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredOrders.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                  Brak zamówień spełniających kryteria
                </TableCell>
              </TableRow>
            ) : (
              paginatedOrders.map((order) => {
                const isExpanded = expandedRows.has(order.id);

                return (
                  <>
                    <TableRow
                      key={order.id}
                      className="group hover:bg-[#F1F5F9] cursor-pointer"
                      onClick={() => toggleExpand(order.id)}
                    >
                      <TableCell className="text-sm">
                        <div className="flex items-center gap-1.5">
                          {isExpanded ? (
                            <ChevronDown className="w-3.5 h-3.5 shrink-0 text-muted-foreground" />
                          ) : (
                            <ChevronRight className="w-3.5 h-3.5 shrink-0 text-muted-foreground" />
                          )}
                          {order.orderNumber}
                        </div>
                      </TableCell>
                      <TableCell className="font-medium">{order.customerName}</TableCell>
                      <TableCell className="text-sm">
                        <div className="leading-tight">
                          <div>{format(parseISO(order.createdAt), 'dd.MM.yyyy')}</div>
                          {order.shippedAt && (
                            <div>{format(parseISO(order.shippedAt), 'dd.MM.yyyy')}</div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button className="focus:outline-none" onClick={(e) => e.stopPropagation()}>
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
                      <TableCell>
                        {order.trackingNumber ? (
                          <a
                            href="#"
                            className="text-sm text-primary hover:underline truncate block max-w-[160px]"
                            onClick={(e) => {
                              e.stopPropagation();
                              e.preventDefault();
                              toast.info('Śledzenie przesyłki w przygotowaniu');
                            }}
                          >
                            {order.trackingNumber}
                          </a>
                        ) : (
                          <span className="text-sm text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right text-sm tabular-nums">
                        {formatCurrency(order.totalNet, order.currency)}
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <MoreHorizontal className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => toast.info('Edycja zamówienia w przygotowaniu')}>
                              Edytuj
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              className="text-destructive focus:text-destructive"
                              onClick={() => toast.info('Usuwanie zamówienia w przygotowaniu')}
                            >
                              Usuń
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>

                    {isExpanded && (
                      <TableRow key={`${order.id}-expanded`} className="hover:bg-transparent">
                        <TableCell colSpan={7} className="p-0">
                          <div className="bg-white px-6 py-4 border-t border-border/50">
                            {order.comment && (
                              <p className="text-sm text-muted-foreground mb-3">{order.comment}</p>
                            )}
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
                                    <span className="w-24 text-right">{formatCurrency(product.priceNet, order.currency)}</span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-2">
          <p className="text-sm text-muted-foreground">
            Strona {currentPage} z {totalPages} ({filteredOrders.length} zamówień)
          </p>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="sm"
              disabled={currentPage === 1}
              onClick={() => setCurrentPage((p) => p - 1)}
            >
              <ChevronLeftIcon className="w-4 h-4" />
              Poprzednia
            </Button>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
              <Button
                key={page}
                variant={page === currentPage ? 'default' : 'outline'}
                size="sm"
                className="w-9"
                onClick={() => setCurrentPage(page)}
              >
                {page}
              </Button>
            ))}
            <Button
              variant="outline"
              size="sm"
              disabled={currentPage === totalPages}
              onClick={() => setCurrentPage((p) => p + 1)}
            >
              Następna
              <ChevronRightIcon className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}
      <AddSalesOrderDrawer open={drawerOpen} onOpenChange={setDrawerOpen} />
    </div>
  );
};

export default SalesOrdersView;
