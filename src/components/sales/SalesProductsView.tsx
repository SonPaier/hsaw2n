import { useState, useMemo } from 'react';
import { Search, Plus, MoreHorizontal } from 'lucide-react';
import { ChevronLeft as ChevronLeftIcon, ChevronRight as ChevronRightIcon } from 'lucide-react';
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
import { toast } from 'sonner';

export interface SalesProduct {
  id: string;
  code: string;
  shortName: string;
  fullName: string;
  priceNet: number;
  status: 'dostępny' | 'niedostępny';
}

const generateMockProducts = (): SalesProduct[] => {
  const products: SalesProduct[] = [
    { id: '1', code: 'UF-481', shortName: 'PPF Premium 152', fullName: 'Folia ochronna PPF ULTRAFIT Premium 152cm', priceNet: 1200, status: 'dostępny' },
    { id: '2', code: 'UF-237', shortName: 'PPF Matte 152', fullName: 'Folia ochronna PPF ULTRAFIT Matte 152cm', priceNet: 1800, status: 'dostępny' },
    { id: '3', code: 'UF-694', shortName: 'PPF Gloss 152', fullName: 'Folia ochronna PPF ULTRAFIT Gloss 152cm', priceNet: 1400, status: 'dostępny' },
    { id: '4', code: 'UF-312', shortName: 'PPF Gloss 76', fullName: 'Folia ochronna PPF ULTRAFIT Gloss 76cm', priceNet: 650, status: 'dostępny' },
    { id: '5', code: 'UF-158', shortName: 'PPF Matte 76', fullName: 'Folia ochronna PPF ULTRAFIT Matte 76cm', priceNet: 950, status: 'niedostępny' },
    { id: '6', code: 'UF-729', shortName: 'IR Nano 50', fullName: 'Folia przyciemniająca ULTRAFIT IR Nano 50cm', priceNet: 300, status: 'dostępny' },
    { id: '7', code: 'UF-845', shortName: 'IR Nano 76', fullName: 'Folia przyciemniająca ULTRAFIT IR Nano 76cm', priceNet: 500, status: 'dostępny' },
    { id: '8', code: 'UF-563', shortName: 'Hybrid 50', fullName: 'Folia przyciemniająca ULTRAFIT Hybrid 50cm', priceNet: 350, status: 'dostępny' },
    { id: '9', code: 'UF-190', shortName: 'Hybrid 76', fullName: 'Folia przyciemniająca ULTRAFIT Hybrid 76cm', priceNet: 550, status: 'niedostępny' },
    { id: '10', code: 'UF-407', shortName: 'Szyba 100', fullName: 'Folia ochronna przedniej szyby ULTRAFIT 100cm', priceNet: 475, status: 'dostępny' },
    { id: '11', code: 'UF-621', shortName: 'Szyba 130', fullName: 'Folia ochronna przedniej szyby ULTRAFIT 130cm', priceNet: 675, status: 'dostępny' },
    { id: '12', code: 'UF-333', shortName: 'PPF Premium 76', fullName: 'Folia ochronna PPF ULTRAFIT Premium 76cm', priceNet: 750, status: 'dostępny' },
    { id: '13', code: 'UF-876', shortName: 'Color Wrap Red', fullName: 'Folia zmiana koloru ULTRAFIT Gloss Red 152cm', priceNet: 2200, status: 'dostępny' },
    { id: '14', code: 'UF-502', shortName: 'Color Wrap Blue', fullName: 'Folia zmiana koloru ULTRAFIT Gloss Blue 152cm', priceNet: 2200, status: 'niedostępny' },
    { id: '15', code: 'UF-118', shortName: 'Color Wrap Black', fullName: 'Folia zmiana koloru ULTRAFIT Satin Black 152cm', priceNet: 2400, status: 'dostępny' },
    { id: '16', code: 'UF-945', shortName: 'PPF Headlight', fullName: 'Folia ochronna PPF ULTRAFIT na reflektory 30cm', priceNet: 280, status: 'dostępny' },
    { id: '17', code: 'UF-267', shortName: 'Ceramic Coat', fullName: 'Powłoka ceramiczna ULTRAFIT Shield Pro', priceNet: 890, status: 'dostępny' },
    { id: '18', code: 'UF-714', shortName: 'Squeegee Set', fullName: 'Zestaw rakli montażowych ULTRAFIT Pro Kit', priceNet: 120, status: 'dostępny' },
    { id: '19', code: 'UF-389', shortName: 'Mounting Fluid', fullName: 'Płyn montażowy ULTRAFIT Slip Solution 1L', priceNet: 45, status: 'niedostępny' },
    { id: '20', code: 'UF-053', shortName: 'Heat Gun Pro', fullName: 'Opalaraka przemysłowa ULTRAFIT HeatPro 2000W', priceNet: 650, status: 'dostępny' },
  ];
  return products;
};

const formatCurrency = (value: number) =>
  value.toLocaleString('pl-PL', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' zł';

const ITEMS_PER_PAGE = 10;

const SalesProductsView = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [products] = useState<SalesProduct[]>(generateMockProducts);
  const [currentPage, setCurrentPage] = useState(1);

  const filteredProducts = useMemo(() => {
    if (!searchQuery.trim()) return products;
    const q = searchQuery.toLowerCase();
    return products.filter(
      (p) =>
        p.code.toLowerCase().includes(q) ||
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

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <h2 className="text-xl font-semibold text-foreground">Produkty</h2>
      </div>

      {/* Toolbar */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="relative w-full max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Szukaj po kodzie lub nazwie..."
            value={searchQuery}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="pl-9"
          />
        </div>
        <Button
          size="sm"
          onClick={() => toast.info('Moduł dodawania produktów w przygotowaniu')}
        >
          <Plus className="w-4 h-4" />
          Dodaj produkt
        </Button>
      </div>

      {/* Table */}
      <div className="rounded-lg border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-[110px]">Kod</TableHead>
              <TableHead>Nazwa skrócona</TableHead>
              <TableHead>Nazwa pełna</TableHead>
              <TableHead className="text-right w-[120px]">Cena netto</TableHead>
              <TableHead className="w-[110px]">Status</TableHead>
              <TableHead className="w-[50px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredProducts.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                  Brak produktów spełniających kryteria
                </TableCell>
              </TableRow>
            ) : (
              paginatedProducts.map((product) => (
                <TableRow key={product.id} className="hover:bg-[#F1F5F9]">
                  <TableCell className="font-mono text-sm">{product.code}</TableCell>
                  <TableCell className="font-medium">{product.shortName}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{product.fullName}</TableCell>
                  <TableCell className="text-right text-sm tabular-nums">
                    {formatCurrency(product.priceNet)}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={product.status === 'dostępny' ? 'default' : 'outline'}
                      className={
                        product.status === 'dostępny'
                          ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                          : 'border-red-400 text-red-500'
                      }
                    >
                      {product.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreHorizontal className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => toast.info('Edycja produktu w przygotowaniu')}>
                          Edytuj
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-destructive focus:text-destructive"
                          onClick={() => toast.info('Usuwanie produktu w przygotowaniu')}
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

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-2">
          <p className="text-sm text-muted-foreground">
            Strona {currentPage} z {totalPages} ({filteredProducts.length} produktów)
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
    </div>
  );
};

export default SalesProductsView;
