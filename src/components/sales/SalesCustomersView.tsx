import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { Search, Plus, MoreHorizontal, ChevronLeft as ChevronLeftIcon, ChevronRight as ChevronRightIcon, ChevronDown, ChevronRight, ArrowUp, ArrowDown, ShoppingCart } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
} from '@/components/ui/table';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { format, parseISO } from 'date-fns';
import AddEditSalesCustomerDrawer from './AddEditSalesCustomerDrawer';
import AddSalesOrderDrawer from './AddSalesOrderDrawer';

interface SalesCustomer {
  id: string;
  name: string;
  contact_person: string | null;
  phone: string;
  email: string | null;
  nip: string | null;
  company: string | null;
  is_net_payer: boolean;
  discount_percent: number | null;
  sales_notes: string | null;
  shipping_street: string | null;
  shipping_street_line2: string | null;
  shipping_postal_code: string | null;
  shipping_city: string | null;
  billing_street: string | null;
  billing_postal_code: string | null;
  billing_city: string | null;
}

type SortField = 'name' | 'last_order' | 'city';
type SortDir = 'asc' | 'desc';

const ITEMS_PER_PAGE = 10;

const SalesCustomersView = () => {
  const { roles } = useAuth();
  const instanceId = roles.find(r => r.instance_id)?.instance_id || null;

  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [customers, setCustomers] = useState<SalesCustomer[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortField, setSortField] = useState<SortField>('name');
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  // Customer drawer state
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<SalesCustomer | null>(null);
  const [initialEditMode, setInitialEditMode] = useState(false);

  // Order drawer state
  const [orderDrawerOpen, setOrderDrawerOpen] = useState(false);
  const [orderCustomer, setOrderCustomer] = useState<{ id: string; name: string; discountPercent?: number } | null>(null);

  // Last order dates per customer
  const [lastOrderDates, setLastOrderDates] = useState<Record<string, string>>({});

  const fetchLastOrderDates = useCallback(async () => {
    if (!instanceId) return;
    const { data, error } = await (supabase
      .from('sales_orders')
      .select('customer_id, created_at')
      .eq('instance_id', instanceId)
      .order('created_at', { ascending: false }) as any);
    if (!error && data) {
      const map: Record<string, string> = {};
      for (const row of data as { customer_id: string; created_at: string }[]) {
        if (row.customer_id && !map[row.customer_id]) {
          map[row.customer_id] = row.created_at;
        }
      }
      setLastOrderDates(map);
    }
  }, [instanceId]);

  const fetchCustomers = useCallback(async () => {
    if (!instanceId) return;
    setLoading(true);
    const { data, error } = await (supabase
      .from('customers')
      .select('id, name, contact_person, phone, email, nip, company, is_net_payer, discount_percent, sales_notes, shipping_street, shipping_street_line2, shipping_postal_code, shipping_city, billing_street, billing_postal_code, billing_city')
      .eq('instance_id', instanceId)
      .eq('source', 'sales')
      .order('name') as any);
    if (error) {
      console.error(error);
      toast.error('Błąd ładowania klientów');
    } else {
      setCustomers((data as SalesCustomer[]) || []);
    }
    setLoading(false);
  }, [instanceId]);

  useEffect(() => {
    fetchCustomers();
    fetchLastOrderDates();
  }, [fetchCustomers, fetchLastOrderDates]);

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir('asc');
    }
  };

  const filtered = useMemo(() => {
    let list = customers;
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          (c.nip && c.nip.includes(q)) ||
          (c.email && c.email.toLowerCase().includes(q)) ||
          c.phone.includes(q) ||
          (c.shipping_city && c.shipping_city.toLowerCase().includes(q))
      );
    }
    // Sort
    const sorted = [...list].sort((a, b) => {
      if (sortField === 'name') {
        const cmp = a.name.localeCompare(b.name, 'pl');
        return sortDir === 'asc' ? cmp : -cmp;
      }
      if (sortField === 'city') {
        const cityA = (a.shipping_city || '').toLowerCase();
        const cityB = (b.shipping_city || '').toLowerCase();
        const cmp = cityA.localeCompare(cityB, 'pl');
        return sortDir === 'asc' ? cmp : -cmp;
      }
      const dateA = lastOrderDates[a.id] || '';
      const dateB = lastOrderDates[b.id] || '';
      const cmp = dateA.localeCompare(dateB);
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return sorted;
  }, [search, customers, sortField, sortDir, lastOrderDates]);

  const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE);
  const paginated = filtered.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);

  const toggleExpand = (id: string) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const openDrawer = (customer: SalesCustomer | null, editMode = false) => {
    setSelectedCustomer(customer);
    setInitialEditMode(editMode);
    setDrawerOpen(true);
  };

  const openNewOrder = (customer: SalesCustomer) => {
    setOrderCustomer({
      id: customer.id,
      name: customer.name,
      discountPercent: customer.discount_percent ?? undefined,
    });
    setOrderDrawerOpen(true);
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from('customers').delete().eq('id', id);
    if (error) {
      toast.error('Błąd usuwania klienta');
    } else {
      toast.success('Klient usunięty');
      fetchCustomers();
    }
  };

  const SortableHead = ({ field, children, className }: { field: SortField; children: React.ReactNode; className?: string }) => (
    <TableHead className={className}>
      <button
        className="flex items-center gap-1 hover:text-foreground transition-colors text-left"
        onClick={() => toggleSort(field)}
      >
        {children}
        {sortField === field && (
          sortDir === 'asc' ? <ArrowUp className="w-3.5 h-3.5" /> : <ArrowDown className="w-3.5 h-3.5" />
        )}
      </button>
    </TableHead>
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <h2 className="text-xl font-semibold text-foreground">Klienci</h2>
      </div>

      <div className="flex items-center justify-between gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Szukaj klienta..."
            className="pl-9"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          />
        </div>
        <Button size="sm" className="gap-2" onClick={() => openDrawer(null)}>
          <Plus className="w-4 h-4" />
          Dodaj klienta
        </Button>
      </div>

      <div className="border rounded-lg overflow-hidden bg-white dark:bg-card">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-[30px]" />
              <SortableHead field="name">Nazwa</SortableHead>
              <SortableHead field="last_order">Ostatnie zamówienie</SortableHead>
              <SortableHead field="city">Miasto</SortableHead>
              <TableHead>Telefon</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Płatnik</TableHead>
              <TableHead className="w-[50px]" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                  Ładowanie...
                </TableCell>
              </TableRow>
            ) : paginated.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                  Brak wyników
                </TableCell>
              </TableRow>
            ) : (
              paginated.map((c) => {
                const isExpanded = expandedRows.has(c.id);
                return (
                  <React.Fragment key={c.id}>
                    <TableRow className="hover:bg-muted/50 cursor-pointer" onClick={() => openDrawer(c)}>
                      <TableCell className="pr-0" onClick={(e) => { e.stopPropagation(); toggleExpand(c.id); }}>
                        {isExpanded ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
                      </TableCell>
                      <TableCell className="font-medium max-w-[220px] truncate">{c.name}</TableCell>
                      <TableCell className="text-sm">
                        {lastOrderDates[c.id] ? (
                          <span>{format(parseISO(lastOrderDates[c.id]), 'dd.MM.yyyy')}</span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-sm">
                        {c.shipping_city || <span className="text-muted-foreground">—</span>}
                      </TableCell>
                      <TableCell>
                        <a href={`tel:${c.phone.replace(/\s/g, '')}`} className="text-primary hover:underline text-sm whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                          {c.phone}
                        </a>
                      </TableCell>
                      <TableCell>
                        {c.email ? (
                          <a href={`mailto:${c.email}`} className="text-primary hover:underline text-sm truncate block max-w-[200px]" onClick={(e) => e.stopPropagation()}>
                            {c.email}
                          </a>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-sm">
                        {c.is_net_payer ? 'netto' : 'brutto'}
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreHorizontal className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => openNewOrder(c)}>
                              <ShoppingCart className="w-4 h-4 mr-2" />
                              Nowe zamówienie
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => openDrawer(c)}>Edytuj</DropdownMenuItem>
                            <DropdownMenuItem className="text-destructive" onClick={() => handleDelete(c.id)}>Usuń</DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                    {isExpanded && (
                      <TableRow className="hover:bg-transparent" onClick={(e) => e.stopPropagation()}>
                        <TableCell colSpan={8} className="p-0">
                          <div className="bg-muted/30 px-8 py-4 grid grid-cols-3 gap-6 text-sm border-t">
                            <div>
                              <p className="text-muted-foreground text-xs font-medium mb-1">NIP</p>
                              <p>{c.nip || '—'}</p>
                              {c.contact_person && (
                                <>
                                  <p className="text-muted-foreground text-xs font-medium mb-1 mt-3">Osoba kontaktowa</p>
                                  <p>{c.contact_person}</p>
                                </>
                              )}
                              {(c.discount_percent ?? 0) > 0 && (
                                <>
                                  <p className="text-muted-foreground text-xs font-medium mb-1 mt-3">Rabat</p>
                                  <p>{c.discount_percent}%</p>
                                </>
                              )}
                            </div>
                            <div>
                              <p className="text-muted-foreground text-xs font-medium mb-1">Adres faktury</p>
                              {c.billing_street ? (
                                <>
                                  <p>{c.billing_street}</p>
                                  <p>{c.billing_postal_code} {c.billing_city}</p>
                                </>
                              ) : (
                                <p className="text-muted-foreground">—</p>
                              )}
                            </div>
                            <div>
                              <p className="text-muted-foreground text-xs font-medium mb-1">Adres wysyłki</p>
                              {c.shipping_street ? (
                                <>
                                  <p>{c.shipping_street}</p>
                                  <p>{c.shipping_postal_code} {c.shipping_city}</p>
                                </>
                              ) : (
                                <p className="text-muted-foreground">—</p>
                              )}
                            </div>
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </React.Fragment>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-2">
          <p className="text-sm text-muted-foreground">
            Strona {page} z {totalPages} ({filtered.length} klientów)
          </p>
          <div className="flex items-center gap-1">
            <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage((p) => p - 1)}>
              <ChevronLeftIcon className="w-4 h-4" />
              Poprzednia
            </Button>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
              <Button key={p} variant={p === page ? 'default' : 'outline'} size="sm" className="w-9" onClick={() => setPage(p)}>
                {p}
              </Button>
            ))}
            <Button variant="outline" size="sm" disabled={page === totalPages} onClick={() => setPage((p) => p + 1)}>
              Następna
              <ChevronRightIcon className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}

      {instanceId && (
        <AddEditSalesCustomerDrawer
          open={drawerOpen}
          onOpenChange={setDrawerOpen}
          customer={selectedCustomer}
          instanceId={instanceId}
          onSaved={fetchCustomers}
        />
      )}

      <AddSalesOrderDrawer
        open={orderDrawerOpen}
        onOpenChange={setOrderDrawerOpen}
        orders={[]}
        initialCustomer={orderCustomer}
        onOrderCreated={() => { fetchCustomers(); fetchLastOrderDates(); }}
      />
    </div>
  );
};

export default SalesCustomersView;
