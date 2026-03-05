import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { Search, Plus, MoreHorizontal, ChevronLeft as ChevronLeftIcon, ChevronRight as ChevronRightIcon, ChevronDown, ChevronRight } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
} from '@/components/ui/table';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import AddEditSalesCustomerDrawer from './AddEditSalesCustomerDrawer';

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

const ITEMS_PER_PAGE = 10;

const SalesCustomersView = () => {
  const { roles } = useAuth();
  const instanceId = roles.find(r => r.instance_id)?.instance_id || null;

  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [customers, setCustomers] = useState<SalesCustomer[]>([]);
  const [loading, setLoading] = useState(true);

  // Drawer state
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<SalesCustomer | null>(null);

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
  }, [fetchCustomers]);

  const filtered = useMemo(() => {
    if (!search.trim()) return customers;
    const q = search.toLowerCase();
    return customers.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        (c.nip && c.nip.includes(q)) ||
        (c.email && c.email.toLowerCase().includes(q)) ||
        c.phone.includes(q)
    );
  }, [search, customers]);

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

  const openDrawer = (customer: SalesCustomer | null) => {
    setSelectedCustomer(customer);
    setDrawerOpen(true);
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
              <TableHead>Nazwa</TableHead>
              <TableHead>Telefon</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Płatnik</TableHead>
              <TableHead>Ostatnie zamówienie</TableHead>
              <TableHead className="w-[50px]" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                  Ładowanie...
                </TableCell>
              </TableRow>
            ) : paginated.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
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
                      <TableCell>
                        <Badge variant={c.is_net_payer ? 'default' : 'secondary'} className="text-xs">
                          {c.is_net_payer ? 'netto' : 'brutto'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">—</TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreHorizontal className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => openDrawer(c)}>Edytuj</DropdownMenuItem>
                            <DropdownMenuItem className="text-destructive" onClick={() => handleDelete(c.id)}>Usuń</DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                    {isExpanded && (
                      <TableRow className="hover:bg-transparent" onClick={(e) => e.stopPropagation()}>
                        <TableCell colSpan={7} className="p-0">
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
    </div>
  );
};

export default SalesCustomersView;
