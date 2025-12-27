import { useState, useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import {
  Plus,
  Upload,
  Search,
  Sparkles,
  FileText,
  Package,
  Trash2,
  Eye,
  ToggleLeft,
  ToggleRight,
  Loader2,
  Check,
  X,
  AlertCircle,
  Download,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { MoreHorizontal } from 'lucide-react';
import { PriceListUploadDialog } from '@/components/products/PriceListUploadDialog';
import { PriceListViewer } from '@/components/products/PriceListViewer';
import { ProductDetailsDialog } from '@/components/products/ProductDetailsDialog';
import AdminLayout from '@/components/layout/AdminLayout';

interface PriceList {
  id: string;
  name: string;
  file_path: string;
  file_type: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  products_count: number;
  extracted_at: string | null;
  error_message: string | null;
  is_global: boolean;
  created_at: string;
  salesperson_name: string | null;
  salesperson_email: string | null;
  salesperson_phone: string | null;
}

interface Product {
  id: string;
  name: string;
  brand: string | null;
  description: string | null;
  category: string | null;
  unit: string;
  default_price: number;
  metadata: Record<string, unknown> | null;
  active: boolean;
  source: string;
  instance_id: string | null;
}

const statusLabels: Record<string, string> = {
  pending: 'Oczekuje',
  processing: 'Przetwarzanie',
  completed: 'Zakończono',
  failed: 'Błąd',
};

const statusColors: Record<string, string> = {
  pending: 'bg-yellow-500/20 text-yellow-600 border-yellow-500/30',
  processing: 'bg-blue-500/20 text-blue-600 border-blue-500/30',
  completed: 'bg-green-500/20 text-green-600 border-green-500/30',
  failed: 'bg-red-500/20 text-red-600 border-red-500/30',
};

const PAGE_SIZE_OPTIONS = [20, 50, 100];

export default function ProductsPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuth();
  const [instanceId, setInstanceId] = useState<string | null>(null);
  const [priceLists, setPriceLists] = useState<PriceList[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [globalPriceLists, setGlobalPriceLists] = useState<PriceList[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [showUploadDialog, setShowUploadDialog] = useState(false);
  const [selectedPriceList, setSelectedPriceList] = useState<PriceList | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [activeTab, setActiveTab] = useState('products');
  
  // Read initial pagination from URL
  const initialPage = parseInt(searchParams.get('page') || '1', 10);
  const initialPageSize = parseInt(searchParams.get('pageSize') || '20', 10);
  const [currentPage, setCurrentPage] = useState(isNaN(initialPage) || initialPage < 1 ? 1 : initialPage);
  const [pageSize, setPageSize] = useState(PAGE_SIZE_OPTIONS.includes(initialPageSize) ? initialPageSize : 20);

  // Fetch instance ID
  useEffect(() => {
    const fetchInstanceId = async () => {
      if (!user) return;

      const { data: profile } = await supabase
        .from('profiles')
        .select('instance_id')
        .eq('id', user.id)
        .single();

      if (profile?.instance_id) {
        setInstanceId(profile.instance_id);
      }
    };

    fetchInstanceId();
  }, [user]);

  // Fetch data
  useEffect(() => {
    if (!instanceId) return;

    const fetchData = async () => {
      setLoading(true);

      // Fetch price lists
      const { data: priceListsData } = await supabase
        .from('price_lists')
        .select('*')
        .eq('instance_id', instanceId)
        .order('created_at', { ascending: false });

      // Fetch global price lists
      const { data: globalPriceListsData } = await supabase
        .from('price_lists')
        .select('*')
        .eq('is_global', true)
        .order('created_at', { ascending: false });

      // Fetch products
      const { data: productsData } = await supabase
        .from('products_library')
        .select('*')
        .or(`instance_id.eq.${instanceId},and(source.eq.global,instance_id.is.null)`)
        .order('category', { ascending: true })
        .order('name', { ascending: true });

      setPriceLists((priceListsData as PriceList[]) || []);
      setGlobalPriceLists((globalPriceListsData as PriceList[]) || []);
      setProducts((productsData as Product[]) || []);
      setLoading(false);
    };

    fetchData();

    // Subscribe to price_lists changes for real-time status updates
    const channel = supabase
      .channel('price-lists-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'price_lists',
        },
        () => {
          fetchData();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [instanceId]);

  // Get unique categories
  const categories = useMemo(() => {
    const cats = new Set(products.filter(p => p.category).map(p => p.category!));
    return Array.from(cats).sort();
  }, [products]);

  // Filter products
  const filteredProducts = useMemo(() => {
    const query = searchQuery.toLowerCase().trim();
    return products.filter(p => {
      const matchesSearch = query === '' || 
        p.name.toLowerCase().includes(query) ||
        (p.brand && p.brand.toLowerCase().includes(query)) ||
        (p.description && p.description.toLowerCase().includes(query)) ||
        (p.category && p.category.toLowerCase().includes(query));
      
      const matchesCategory = categoryFilter === 'all' || p.category === categoryFilter;
      
      return matchesSearch && matchesCategory;
    });
  }, [products, searchQuery, categoryFilter]);

  // Pagination for products
  const totalPages = Math.ceil(filteredProducts.length / pageSize);
  const paginatedProducts = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    return filteredProducts.slice(startIndex, startIndex + pageSize);
  }, [filteredProducts, currentPage, pageSize]);

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, categoryFilter]);

  // Sync pagination with URL
  useEffect(() => {
    const params = new URLSearchParams(searchParams);
    params.set('page', String(currentPage));
    params.set('pageSize', String(pageSize));
    setSearchParams(params, { replace: true });
  }, [currentPage, pageSize, setSearchParams]);

  // Download PDF from storage
  const handleDownloadPdf = async (priceList: PriceList) => {
    try {
      const { data, error } = await supabase.storage
        .from('price-lists')
        .download(priceList.file_path);
      
      if (error) throw error;
      
      const url = URL.createObjectURL(data);
      const link = document.createElement('a');
      link.href = url;
      link.download = priceList.name + '.' + priceList.file_type;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Download error:', error);
      toast.error('Nie udało się pobrać pliku');
    }
  };

  const handleDeletePriceList = async (priceList: PriceList) => {
    if (!confirm(`Czy na pewno chcesz usunąć cennik "${priceList.name}"?`)) return;

    try {
      // Delete from storage
      await supabase.storage
        .from('price-lists')
        .remove([priceList.file_path]);

      // Delete from database
      const { error } = await supabase
        .from('price_lists')
        .delete()
        .eq('id', priceList.id);

      if (error) throw error;

      setPriceLists(prev => prev.filter(p => p.id !== priceList.id));
      toast.success('Cennik został usunięty');
    } catch (error) {
      console.error('Error deleting price list:', error);
      toast.error('Nie udało się usunąć cennika');
    }
  };

  const handleToggleProduct = async (product: Product) => {
    try {
      const { error } = await supabase
        .from('products_library')
        .update({ active: !product.active })
        .eq('id', product.id);

      if (error) throw error;

      setProducts(prev => 
        prev.map(p => p.id === product.id ? { ...p, active: !p.active } : p)
      );
      toast.success(product.active ? 'Produkt dezaktywowany' : 'Produkt aktywowany');
    } catch (error) {
      console.error('Error toggling product:', error);
      toast.error('Nie udało się zmienić statusu produktu');
    }
  };

  const handleDeleteProduct = async (product: Product) => {
    if (!confirm(`Czy na pewno chcesz usunąć produkt "${product.name}"?`)) return;

    try {
      const { error } = await supabase
        .from('products_library')
        .delete()
        .eq('id', product.id);

      if (error) throw error;

      setProducts(prev => prev.filter(p => p.id !== product.id));
      toast.success('Produkt został usunięty');
    } catch (error) {
      console.error('Error deleting product:', error);
      toast.error('Nie udało się usunąć produktu');
    }
  };

  const formatPrice = (value: number) => {
    return new Intl.NumberFormat('pl-PL', {
      style: 'currency',
      currency: 'PLN',
    }).format(value);
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('pl-PL', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <AdminLayout title="Produkty">
      <div className="p-4 lg:p-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold">Produkty</h1>
          <Button onClick={() => setShowUploadDialog(true)} className="gap-2">
            <Upload className="h-4 w-4" />
            Wgraj cennik
          </Button>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-6 bg-muted/50">
            <TabsTrigger value="products" className="gap-2 data-[state=active]:bg-background">
              <Package className="h-4 w-4" />
              Produkty ({products.length})
            </TabsTrigger>
            <TabsTrigger value="price-lists" className="gap-2 data-[state=active]:bg-background">
              <FileText className="h-4 w-4" />
              Cenniki ({priceLists.length})
            </TabsTrigger>
            <TabsTrigger value="global" className="gap-2 data-[state=active]:bg-background">
              <Sparkles className="h-4 w-4" />
              Globalne ({globalPriceLists.length})
            </TabsTrigger>
          </TabsList>

          {/* Products Tab */}
          <TabsContent value="products">
            <Card>
              <CardHeader>
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <CardTitle>Biblioteka produktów</CardTitle>
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        placeholder="Szukaj produktów..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-9 w-full sm:w-64"
                      />
                    </div>
                    <select
                      value={categoryFilter}
                      onChange={(e) => setCategoryFilter(e.target.value)}
                      className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                    >
                      <option value="all">Wszystkie kategorie</option>
                      {categories.map(cat => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                  </div>
                ) : filteredProducts.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <Package className="h-12 w-12 text-muted-foreground/50 mb-4" />
                    <p className="text-muted-foreground">
                      {products.length === 0 
                        ? 'Brak produktów. Wgraj cennik, aby rozpocząć.'
                        : 'Nie znaleziono produktów spełniających kryteria.'}
                    </p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-primary/10 border border-border">
                          <TableHead>Nazwa</TableHead>
                          <TableHead>Marka</TableHead>
                          <TableHead>Kategoria</TableHead>
                          <TableHead className="text-right">Cena</TableHead>
                          <TableHead>Jednostka</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead className="w-[50px]"></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {paginatedProducts.map((product) => (
                          <TableRow 
                            key={product.id}
                            className={!product.active ? 'opacity-50' : ''}
                          >
                            <TableCell className="font-medium">
                              <button 
                                onClick={() => setSelectedProduct(product)}
                                className="text-left hover:text-primary transition-colors"
                              >
                                {product.name}
                              </button>
                            </TableCell>
                            <TableCell>{product.brand || '-'}</TableCell>
                            <TableCell>
                              {product.category && (
                                <Badge variant="outline" className="text-xs">
                                  {product.category}
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell className="text-right font-medium">
                              {formatPrice(product.default_price)}
                            </TableCell>
                            <TableCell>{product.unit}</TableCell>
                            <TableCell>
                              <Badge 
                                variant={product.source === 'global' ? 'secondary' : 'default'}
                                className="text-xs"
                              >
                                {product.source === 'global' ? 'Globalny' : 'Własny'}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="icon" className="h-8 w-8">
                                    <MoreHorizontal className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem onClick={() => setSelectedProduct(product)}>
                                    <Eye className="mr-2 h-4 w-4" />
                                    Szczegóły
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => handleToggleProduct(product)}>
                                    {product.active ? (
                                      <>
                                        <ToggleLeft className="mr-2 h-4 w-4" />
                                        Dezaktywuj
                                      </>
                                    ) : (
                                      <>
                                        <ToggleRight className="mr-2 h-4 w-4" />
                                        Aktywuj
                                      </>
                                    )}
                                  </DropdownMenuItem>
                                  {product.source !== 'global' && (
                                    <DropdownMenuItem 
                                      onClick={() => handleDeleteProduct(product)}
                                      className="text-destructive"
                                    >
                                      <Trash2 className="mr-2 h-4 w-4" />
                                      Usuń
                                    </DropdownMenuItem>
                                  )}
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>

                    {/* Pagination */}
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mt-4 pt-4 border-t">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <span>Pokaż</span>
                        <Select value={String(pageSize)} onValueChange={(val) => setPageSize(Number(val))}>
                          <SelectTrigger className="w-20 h-8">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {PAGE_SIZE_OPTIONS.map(size => (
                              <SelectItem key={size} value={String(size)}>{size}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <span>na stronie</span>
                        <span className="ml-2">({filteredProducts.length} produktów{totalPages > 1 && `, strona ${currentPage} z ${totalPages}`})</span>
                      </div>
                      
                      {totalPages > 1 && (
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                            disabled={currentPage === 1}
                          >
                            <ChevronLeft className="w-4 h-4" />
                          </Button>
                          <div className="flex items-center gap-1">
                            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                              let pageNum: number;
                              if (totalPages <= 5) {
                                pageNum = i + 1;
                              } else if (currentPage <= 3) {
                                pageNum = i + 1;
                              } else if (currentPage >= totalPages - 2) {
                                pageNum = totalPages - 4 + i;
                              } else {
                                pageNum = currentPage - 2 + i;
                              }
                              return (
                                <Button
                                  key={pageNum}
                                  variant={currentPage === pageNum ? 'default' : 'outline'}
                                  size="sm"
                                  onClick={() => setCurrentPage(pageNum)}
                                  className="w-9"
                                >
                                  {pageNum}
                                </Button>
                              );
                            })}
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                            disabled={currentPage === totalPages}
                          >
                            <ChevronRight className="w-4 h-4" />
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Price Lists Tab */}
          <TabsContent value="price-lists">
            <Card>
              <CardHeader>
                <CardTitle>Twoje cenniki</CardTitle>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                  </div>
                ) : priceLists.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <FileText className="h-12 w-12 text-muted-foreground/50 mb-4" />
                    <p className="text-muted-foreground mb-4">
                      Brak wgranych cenników
                    </p>
                    <Button onClick={() => setShowUploadDialog(true)} className="gap-2">
                      <Upload className="h-4 w-4" />
                      Wgraj pierwszy cennik
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {priceLists.map((priceList) => {
                      const progressValue =
                        priceList.status === 'pending'
                          ? 20
                          : priceList.status === 'processing'
                            ? 60
                            : 100;

                      return (
                        <div
                          key={priceList.id}
                          className="border rounded-lg p-4 hover:bg-muted/50 transition-colors"
                        >
                          <div className="flex items-center justify-between gap-4">
                            <div className="flex items-center gap-4">
                              <button 
                                onClick={() => handleDownloadPdf(priceList)}
                                className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center hover:bg-primary/20 transition-colors"
                                title="Pobierz plik"
                              >
                                <Download className="h-5 w-5 text-primary" />
                              </button>
                              <div>
                                <button
                                  onClick={() => handleDownloadPdf(priceList)}
                                  className="font-medium hover:text-primary hover:underline transition-colors text-left"
                                >
                                  {priceList.name}
                                </button>
                                <p className="text-sm text-muted-foreground">
                                  {formatDate(priceList.created_at)}
                                  {priceList.products_count > 0 && (
                                    <span> • {priceList.products_count} produktów</span>
                                  )}
                                </p>
                                {(priceList.salesperson_name || priceList.salesperson_phone || priceList.salesperson_email) && (
                                  <p className="text-xs text-muted-foreground mt-1">
                                    Handlowiec: {priceList.salesperson_name}
                                    {priceList.salesperson_phone && (
                                      <>
                                        {' • '}
                                        <a 
                                          href={`tel:${priceList.salesperson_phone}`} 
                                          className="text-primary hover:underline"
                                          onClick={(e) => e.stopPropagation()}
                                        >
                                          {priceList.salesperson_phone}
                                        </a>
                                      </>
                                    )}
                                    {priceList.salesperson_email && (
                                      <>
                                        {' • '}
                                        <a 
                                          href={`mailto:${priceList.salesperson_email}`} 
                                          className="text-primary hover:underline"
                                          onClick={(e) => e.stopPropagation()}
                                        >
                                          {priceList.salesperson_email}
                                        </a>
                                      </>
                                    )}
                                  </p>
                                )}
                              </div>
                            </div>

                            <div className="flex items-center gap-3">
                              <Badge className={statusColors[priceList.status]}>
                                {priceList.status === 'processing' && (
                                  <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                                )}
                                {priceList.status === 'completed' && (
                                  <Check className="mr-1 h-3 w-3" />
                                )}
                                {priceList.status === 'failed' && (
                                  <X className="mr-1 h-3 w-3" />
                                )}
                                {statusLabels[priceList.status]}
                              </Badge>

                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="icon" className="h-8 w-8">
                                    <MoreHorizontal className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem onClick={() => setSelectedPriceList(priceList)}>
                                    <Eye className="mr-2 h-4 w-4" />
                                    Zobacz cennik
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    onClick={() => handleDeletePriceList(priceList)}
                                    className="text-destructive"
                                  >
                                    <Trash2 className="mr-2 h-4 w-4" />
                                    Usuń
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>
                          </div>

                          {(priceList.status === 'pending' || priceList.status === 'processing') && (
                            <div className="mt-3 space-y-2">
                              <Progress value={progressValue} />
                              <p className="text-xs text-muted-foreground">
                                {priceList.status === 'pending'
                                  ? 'Czeka w kolejce do przetworzenia.'
                                  : 'AI przetwarza cennik — możesz pracować dalej.'}
                              </p>
                            </div>
                          )}

                          {priceList.status === 'failed' && priceList.error_message && (
                            <div className="mt-3 flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-3">
                              <AlertCircle className="h-4 w-4 text-destructive mt-0.5" />
                              <p className="text-sm text-destructive">{priceList.error_message}</p>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Global Price Lists Tab */}
          <TabsContent value="global">
            <Card>
              <CardHeader>
                <CardTitle>Globalne cenniki</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Cenniki dostarczone przez administratora systemu. Możesz aktywować produkty z tych cenników.
                </p>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                  </div>
                ) : globalPriceLists.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <Sparkles className="h-12 w-12 text-muted-foreground/50 mb-4" />
                    <p className="text-muted-foreground">
                      Brak globalnych cenników
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {globalPriceLists.map((priceList) => (
                      <div 
                        key={priceList.id}
                        className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                      >
                        <div className="flex items-center gap-4">
                          <div className="h-10 w-10 rounded-lg bg-secondary/20 flex items-center justify-center">
                            <Sparkles className="h-5 w-5 text-secondary-foreground" />
                          </div>
                          <div>
                            <p className="font-medium">{priceList.name}</p>
                            <p className="text-sm text-muted-foreground">
                              {priceList.products_count} produktów
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <Badge variant="secondary">Globalny</Badge>
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => setSelectedPriceList(priceList)}
                          >
                            <Eye className="mr-2 h-4 w-4" />
                            Zobacz
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Upload Dialog */}
      {showUploadDialog && instanceId && (
        <PriceListUploadDialog
          instanceId={instanceId}
          open={showUploadDialog}
          onOpenChange={setShowUploadDialog}
          onSuccess={() => {
            setShowUploadDialog(false);
            setActiveTab('price-lists');
          }}
        />
      )}

      {/* Price List Viewer */}
      {selectedPriceList && (
        <PriceListViewer
          priceList={selectedPriceList}
          products={products.filter(p => p.category === selectedPriceList.name || true)}
          open={!!selectedPriceList}
          onOpenChange={(open) => !open && setSelectedPriceList(null)}
        />
      )}

      {/* Product Details Dialog */}
      {selectedProduct && (
        <ProductDetailsDialog
          product={selectedProduct}
          open={!!selectedProduct}
          onOpenChange={(open) => !open && setSelectedProduct(null)}
        />
      )}
    </AdminLayout>
  );
}
