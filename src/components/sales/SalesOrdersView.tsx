import { useState, useMemo, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import AddSalesOrderDrawer from './AddSalesOrderDrawer';
import { Search, Plus, ChevronDown, ChevronRight, ChevronLeft as ChevronLeftIcon, ChevronRight as ChevronRightIcon, MoreHorizontal, ArrowUp, ArrowDown } from 'lucide-react';
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
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { type SalesOrder } from '@/data/salesMockData';

const formatCurrency = (value: number, currency: 'PLN' | 'EUR') => {
  if (currency === 'EUR') {
    return value.toLocaleString('pl-PL', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
  }
  return value.toLocaleString('pl-PL', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' zł';
};

export const getNextOrderNumber = (orders: SalesOrder[], date: Date = new Date()): string => {
  const month = date.getMonth() + 1;
  const year = date.getFullYear();
  const monthStr = String(month).padStart(2, '0');
  const prefix = `/${monthStr}/${year}`;
  const countInMonth = orders.filter((o) => o.orderNumber.endsWith(prefix)).length;
  return `${countInMonth + 1}/${monthStr}/${year}`;
};

type SortColumn = 'orderNumber' | 'customerName' | 'createdAt' | 'shippedAt' | 'status' | 'totalNet';
type SortDirection = 'asc' | 'desc';

const parseOrderNumber = (orderNumber: string): number => {
  const parts = orderNumber.split('/');
  if (parts.length < 3) return 0;
  const num = parseInt(parts[0]) || 0;
  const month = parseInt(parts[1]) || 0;
  const year = parseInt(parts[2]) || 0;
  return year * 10000 + month * 100 + num;
};

const ITEMS_PER_PAGE = 10;

const SalesOrdersView = () => {
  const { roles } = useAuth();
  const instanceId = roles.find(r => r.instance_id)?.instance_id || null;

  const [searchQuery, setSearchQuery] = useState('');
  const [orders, setOrders] = useState<SalesOrder[]>([]);
  const [customerCompanyMap, setCustomerCompanyMap] = useState<Record<string, string>>({});
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [currentPage, setCurrentPage] = useState(1);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editOrder, setEditOrder] = useState<any>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ open: boolean; orderId: string; orderNumber: string }>({ open: false, orderId: '', orderNumber: '' });
  const [sortColumn, setSortColumn] = useState<SortColumn>('orderNumber');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  const fetchOrders = useCallback(async () => {
    if (!instanceId) return;
    const { data, error } = await (supabase
      .from('sales_orders')
      .select('*, sales_order_items(*)')
      .eq('instance_id', instanceId)
      .order('created_at', { ascending: false }) as any);

    if (error) {
      console.error('Error fetching orders:', error);
      return;
    }

    const mapped: SalesOrder[] = (data || []).map((o: any) => ({
      id: o.id,
      orderNumber: o.order_number,
      createdAt: o.created_at,
      shippedAt: o.shipped_at || undefined,
      customerName: o.customer_name,
      customerId: o.customer_id || undefined,
      city: o.city || undefined,
      contactPerson: o.contact_person || undefined,
      totalNet: Number(o.total_net),
      totalGross: Number(o.total_gross),
      currency: (o.currency || 'PLN') as 'PLN' | 'EUR',
      products: (o.sales_order_items || []).map((item: any) => ({
        name: item.name,
        quantity: item.quantity,
        priceNet: Number(item.price_net),
        priceGross: Number(item.price_net) * 1.23,
      })),
      comment: o.comment || undefined,
      status: o.status as 'nowy' | 'wysłany',
      trackingNumber: o.tracking_number || undefined,
    }));

    setOrders(mapped);

    // Fetch customer company names for search
    const customerIds: string[] = Array.from(new Set((data || []).map((o: any) => o.customer_id).filter((id: any): id is string => typeof id === 'string' && id.length > 0)));
    if (customerIds.length > 0) {
      const { data: customers } = await (supabase
        .from('customers')
        .select('id, company')
        .in('id', customerIds) as any);
      if (customers) {
        const map: Record<string, string> = {};
        for (const c of customers as { id: string; company: string | null }[]) {
          if (c.company) map[c.id] = c.company;
        }
        setCustomerCompanyMap(map);
      }
    }
  }, [instanceId]);

  useEffect(() => { fetchOrders(); }, [fetchOrders]);

  const handleSort = (column: SortColumn) => {
    if (sortColumn === column) {
      setSortDirection((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortColumn(column);
      setSortDirection('desc');
    }
  };

  const filteredOrders = useMemo(() => {
    if (!searchQuery.trim()) return orders;
    const q = searchQuery.toLowerCase();
    return orders.filter(
      (o) =>
        o.customerName.toLowerCase().includes(q) ||
        o.orderNumber.toLowerCase().includes(q) ||
        (o.city && o.city.toLowerCase().includes(q)) ||
        (o.contactPerson && o.contactPerson.toLowerCase().includes(q)) ||
        o.products.some((p) => p.name.toLowerCase().includes(q)) ||
        ((o as any).customerId && customerCompanyMap[(o as any).customerId]?.toLowerCase().includes(q))
    );
  }, [orders, searchQuery, customerCompanyMap]);

  const sortedOrders = useMemo(() => {
    const sorted = [...filteredOrders];
    const dir = sortDirection === 'asc' ? 1 : -1;
    sorted.sort((a, b) => {
      switch (sortColumn) {
        case 'orderNumber':
          return (parseOrderNumber(a.orderNumber) - parseOrderNumber(b.orderNumber)) * dir;
        case 'customerName':
          return a.customerName.localeCompare(b.customerName) * dir;
        case 'createdAt':
          return (a.createdAt.localeCompare(b.createdAt)) * dir;
        case 'shippedAt':
          return ((a.shippedAt || '').localeCompare(b.shippedAt || '')) * dir;
        case 'status':
          return a.status.localeCompare(b.status) * dir;
        case 'totalNet':
          return (a.totalNet - b.totalNet) * dir;
        default:
          return 0;
      }
    });
    return sorted;
  }, [filteredOrders, sortColumn, sortDirection]);

  const totalPages = Math.ceil(sortedOrders.length / ITEMS_PER_PAGE);
  const paginatedOrders = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return sortedOrders.slice(start, start + ITEMS_PER_PAGE);
  }, [sortedOrders, currentPage]);

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

  const changeStatus = async (id: string, newStatus: SalesOrder['status']) => {
    const updates: any = { status: newStatus, updated_at: new Date().toISOString() };
    if (newStatus === 'wysłany') {
      updates.shipped_at = new Date().toISOString();
    } else {
      updates.shipped_at = null;
    }
    await (supabase.from('sales_orders').update(updates).eq('id', id) as any);
    setOrders((prev) =>
      prev.map((o) => (o.id === id ? { ...o, status: newStatus, shippedAt: newStatus === 'wysłany' ? new Date().toISOString() : undefined } : o))
    );
  };

  const handleDeleteOrder = async (orderId: string) => {
    try {
      await (supabase.from('sales_order_items').delete().eq('order_id', orderId) as any);
      await (supabase.from('sales_orders').delete().eq('id', orderId) as any);
      setOrders((prev) => prev.filter((o) => o.id !== orderId));
      toast.success('Zamówienie usunięte');
    } catch (err: any) {
      toast.error('Błąd usuwania: ' + (err.message || ''));
    }
  };

  const handleEditOrder = async (order: SalesOrder) => {
    // Fetch order items with vehicle info from DB
    const { data: items } = await (supabase
      .from('sales_order_items')
      .select('product_id, name, price_net, quantity, vehicle, sort_order')
      .eq('order_id', order.id)
      .order('sort_order') as any);
    
    // Fetch delivery_type from the order
    const { data: orderData } = await (supabase
      .from('sales_orders')
      .select('delivery_type, payment_method, bank_account_number, comment, customer_id, customer_name')
      .eq('id', order.id)
      .single() as any);

    // Fetch customer discount
    let customerDiscount: number | undefined;
    if (orderData?.customer_id) {
      const { data: cust } = await (supabase
        .from('customers')
        .select('discount_percent')
        .eq('id', orderData.customer_id)
        .single() as any);
      customerDiscount = cust?.discount_percent ?? undefined;
    }

    setEditOrder({
      id: order.id,
      orderNumber: order.orderNumber,
      customerId: orderData?.customer_id || '',
      customerName: orderData?.customer_name || order.customerName,
      customerDiscount,
      products: (items || []).map((item: any) => ({
        productId: item.product_id || item.name,
        name: item.name,
        priceNet: Number(item.price_net),
        quantity: item.quantity,
        vehicle: item.vehicle || '',
      })),
      deliveryType: (orderData?.delivery_type || 'shipping') as 'shipping' | 'pickup' | 'uber',
      paymentMethod: (orderData?.payment_method || 'cod') as 'cod' | 'transfer',
      bankAccountNumber: orderData?.bank_account_number || '',
      comment: orderData?.comment || '',
      sendEmail: false,
    });
    setDrawerOpen(true);
  };

  const SortableHead = ({ column, children, className }: { column: SortColumn; children: React.ReactNode; className?: string }) => (
    <TableHead className={className}>
      <button
        className="flex items-center gap-1 hover:text-foreground transition-colors text-left"
        onClick={() => handleSort(column)}
      >
        {children}
        {sortColumn === column && (
          sortDirection === 'asc' ? <ArrowUp className="w-3.5 h-3.5" /> : <ArrowDown className="w-3.5 h-3.5" />
        )}
      </button>
    </TableHead>
  );

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
            placeholder="Szukaj po firmie, mieście, osobie, produkcie..."
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
              <SortableHead column="orderNumber" className="w-[120px]">Nr zamówienia</SortableHead>
              <SortableHead column="customerName" className="w-[200px]">Klient</SortableHead>
              <SortableHead column="createdAt" className="w-[100px]">Utworzono</SortableHead>
              <SortableHead column="shippedAt" className="w-[100px]">Wysłano</SortableHead>
              <TableHead className="w-[180px]">Nr listu przewozowego</TableHead>
              <SortableHead column="totalNet" className="text-right w-[120px]">Kwota netto</SortableHead>
              <SortableHead column="status" className="w-[100px]">Status</SortableHead>
              <TableHead className="w-[50px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedOrders.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
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
                      className="group hover:bg-muted/50 cursor-pointer"
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
                        {format(parseISO(order.createdAt), 'dd.MM.yyyy')}
                      </TableCell>
                      <TableCell className="text-sm">
                        {order.shippedAt ? format(parseISO(order.shippedAt), 'dd.MM.yyyy') : <span className="text-muted-foreground">—</span>}
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
                            <DropdownMenuItem onClick={() => handleEditOrder(order)}>
                              Edytuj
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              className="text-destructive focus:text-destructive"
                              onClick={() => setDeleteConfirm({ open: true, orderId: order.id, orderNumber: order.orderNumber })}
                            >
                              Usuń
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>

                    {isExpanded && (
                      <TableRow key={`${order.id}-expanded`} className="hover:bg-transparent">
                        <TableCell colSpan={8} className="p-0">
                          <div className="bg-card px-6 py-4 border-t border-border/50">
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
            Strona {currentPage} z {totalPages} ({sortedOrders.length} zamówień)
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
      <AddSalesOrderDrawer
        open={drawerOpen}
        onOpenChange={(open) => {
          setDrawerOpen(open);
          if (!open) setEditOrder(null);
        }}
        orders={orders}
        editOrder={editOrder}
        onOrderCreated={fetchOrders}
      />
      <ConfirmDialog
        open={deleteConfirm.open}
        onOpenChange={(open) => setDeleteConfirm(prev => ({ ...prev, open }))}
        title="Usuń zamówienie"
        description={`Czy na pewno chcesz usunąć zamówienie ${deleteConfirm.orderNumber}? Tej operacji nie można cofnąć.`}
        confirmLabel="Usuń"
        variant="destructive"
        onConfirm={() => handleDeleteOrder(deleteConfirm.orderId)}
      />
    </div>
  );
};

export default SalesOrdersView;
