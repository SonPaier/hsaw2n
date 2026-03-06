import { useState, useMemo, useEffect, useCallback } from 'react';
import { Search, Plus, MoreHorizontal } from 'lucide-react';
import { ChevronLeft as ChevronLeftIcon, ChevronRight as ChevronRightIcon } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
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
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import AddSalesProductDrawer from './AddSalesProductDrawer';

export interface SalesProduct {
  id: string;
  shortName: string;
  fullName: string;
  description?: string;
  priceNet: number;
  priceUnit: string;
}

const formatCurrency = (value: number) =>
  value.toLocaleString('pl-PL', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' zł';

const ITEMS_PER_PAGE = 10;

const SalesProductsView = () => {
  const { roles } = useAuth();
  const instanceId = roles.find(r => r.instance_id)?.instance_id || null;

  const [searchQuery, setSearchQuery] = useState('');
  const [products, setProducts] = useState<SalesProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editProduct, setEditProduct] = useState<SalesProduct | null>(null);

  const fetchProducts = useCallback(async () => {
    if (!instanceId) return;
    setLoading(true);
    const { data } = await (supabase
      .from('sales_products')
      .select('id, short_name, full_name, description, price_net, price_unit')
      .eq('instance_id', instanceId)
      .order('created_at', { ascending: false }) as any);

    setProducts((data || []).map((p: any) => ({
      id: p.id,
      shortName: p.short_name,
      fullName: p.full_name,
      description: p.description || undefined,
      priceNet: Number(p.price_net),
      priceUnit: p.price_unit,
    })));
    setLoading(false);
  }, [instanceId]);

  useEffect(() => { fetchProducts(); }, [fetchProducts]);

  const filteredProducts = useMemo(() => {
    if (!searchQuery.trim()) return products;
    const q = searchQuery.toLowerCase();
    return products.filter(
      (p) =>
        p.shortName.toLowerCase().includes(q) ||
        p.fullName.toLowerCase().includes(q)
    );
  }, [products, searchQuery]);

  const totalPages = Math.ceil(filteredProducts.length / ITEMS_PER_PAGE);
  const paginatedProducts = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredProducts.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredProducts, currentPage]);

  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    setCurrentPage(1);
  };

  const handleDelete = async (id: string) => {
    const { error } = await (supabase.from('sales_products').delete().eq('id', id) as any);
    if (error) { toast.error('Błąd usuwania'); return; }
    toast.success('Produkt usunięty');
    fetchProducts();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <h2 className="text-xl font-semibold text-foreground">Produkty</h2>
      </div>

      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="relative w-full max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Szukaj po nazwie..."
            value={searchQuery}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="pl-9"
          />
        </div>
        <Button size="sm" onClick={() => { setEditProduct(null); setDrawerOpen(true); }}>
          <Plus className="w-4 h-4" />
          Dodaj produkt
        </Button>
      </div>

      <div className="rounded-lg border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead>Nazwa</TableHead>
              <TableHead>Nazwa pełna</TableHead>
              <TableHead className="text-right w-[120px]">Cena netto</TableHead>
              <TableHead className="w-[50px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredProducts.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                  {loading ? 'Ładowanie...' : 'Brak produktów spełniających kryteria'}
                </TableCell>
              </TableRow>
            ) : (
              paginatedProducts.map((product) => (
                <TableRow key={product.id} className="hover:bg-hover-strong">
                  <TableCell className="font-medium">{product.shortName}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{product.fullName}</TableCell>
                  <TableCell className="text-right text-sm tabular-nums">
                    {formatCurrency(product.priceNet)}
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreHorizontal className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => { setEditProduct(product); setDrawerOpen(true); }}>
                          Edytuj
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-destructive focus:text-destructive"
                          onClick={() => handleDelete(product.id)}
                        >
                          Usuń
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-2">
          <p className="text-sm text-muted-foreground">
            Strona {currentPage} z {totalPages} ({filteredProducts.length} produktów)
          </p>
          <div className="flex items-center gap-1">
            <Button variant="outline" size="sm" disabled={currentPage === 1} onClick={() => setCurrentPage((p) => p - 1)}>
              <ChevronLeftIcon className="w-4 h-4" />
              Poprzednia
            </Button>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
              <Button key={page} variant={page === currentPage ? 'default' : 'outline'} size="sm" className="w-9" onClick={() => setCurrentPage(page)}>
                {page}
              </Button>
            ))}
            <Button variant="outline" size="sm" disabled={currentPage === totalPages} onClick={() => setCurrentPage((p) => p + 1)}>
              Następna
              <ChevronRightIcon className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}
      {instanceId && (
        <AddSalesProductDrawer
          open={drawerOpen}
          onOpenChange={setDrawerOpen}
          instanceId={instanceId}
          onSaved={fetchProducts}
          product={editProduct}
        />
      )}
    </div>
  );
};

export default SalesProductsView;
