import { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
  Pencil,
  ToggleLeft,
  ToggleRight,
  Loader2,
  Check,
  X,
  AlertCircle,
  Download,
  ChevronLeft,
  ChevronRight,
  MoreHorizontal,
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
import { PriceListUploadDialog } from '@/components/products/PriceListUploadDialog';
import { PriceListViewer } from '@/components/products/PriceListViewer';
import { ProductDetailsDialog } from '@/components/products/ProductDetailsDialog';
import { AddProductDialog } from '@/components/products/AddProductDialog';
import { EditProductDialog } from '@/components/products/EditProductDialog';
import { useTranslation } from 'react-i18next';

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

const statusColors: Record<string, string> = {
  pending: 'bg-yellow-500/20 text-yellow-600 border-yellow-500/30',
  processing: 'bg-blue-500/20 text-blue-600 border-blue-500/30',
  completed: 'bg-green-500/20 text-green-600 border-green-500/30',
  failed: 'bg-red-500/20 text-red-600 border-red-500/30',
};

const PAGE_SIZE_OPTIONS = [20, 50, 100];

interface ProductsViewProps {
  instanceId: string | null;
}

export default function ProductsView({ instanceId }: ProductsViewProps) {
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const [priceLists, setPriceLists] = useState<PriceList[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [globalPriceLists, setGlobalPriceLists] = useState<PriceList[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [showPriceListProducts, setShowPriceListProducts] = useState(false);
  const [showUploadDialog, setShowUploadDialog] = useState(false);
  const [showAddProductDialog, setShowAddProductDialog] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [selectedPriceList, setSelectedPriceList] = useState<PriceList | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [activeTab, setActiveTab] = useState('products');
  
  // Read initial pagination from URL
  const initialPage = parseInt(searchParams.get('page') || '1', 10);
  const initialPageSize = parseInt(searchParams.get('pageSize') || '20', 10);
  const [currentPage, setCurrentPage] = useState(isNaN(initialPage) || initialPage < 1 ? 1 : initialPage);
  const [pageSize, setPageSize] = useState(PAGE_SIZE_OPTIONS.includes(initialPageSize) ? initialPageSize : 20);

  // Fetch data function
  const fetchData = async () => {
    if (!instanceId) return;
    
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

  // Fetch data on instanceId change
  useEffect(() => {
    if (!instanceId) return;

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
      if (!showPriceListProducts && p.source === 'instance') {
        const metadata = p.metadata as Record<string, unknown> | null;
        const isManuallyAdded = !metadata || metadata._source === 'manual';
        if (!isManuallyAdded) return false;
      }
      
      const matchesSearch = query === '' || 
        p.name.toLowerCase().includes(query) ||
        (p.brand && p.brand.toLowerCase().includes(query)) ||
        (p.description && p.description.toLowerCase().includes(query)) ||
        (p.category && p.category.toLowerCase().includes(query));
      
      const matchesCategory = categoryFilter === 'all' || p.category === categoryFilter;
      
      return matchesSearch && matchesCategory;
    });
  }, [products, searchQuery, categoryFilter, showPriceListProducts]);

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
      toast.error(t('products.downloadError'));
    }
  };

  const handleDeletePriceList = async (priceList: PriceList) => {
    if (!confirm(t('products.confirmDeletePriceList', { name: priceList.name }))) return;

    try {
      await supabase.storage
        .from('price-lists')
        .remove([priceList.file_path]);

      const { error } = await supabase
        .from('price_lists')
        .delete()
        .eq('id', priceList.id);

      if (error) throw error;

      setPriceLists(prev => prev.filter(p => p.id !== priceList.id));
      toast.success(t('products.priceListDeleted'));
    } catch (error) {
      console.error('Error deleting price list:', error);
      toast.error(t('products.deletePriceListError'));
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
      toast.success(product.active ? t('products.productDeactivated') : t('products.productActivated'));
    } catch (error) {
      console.error('Error toggling product:', error);
      toast.error(t('products.toggleError'));
    }
  };

  const handleDeleteProduct = async (product: Product) => {
    if (!confirm(t('products.confirmDeleteProduct', { name: product.name }))) return;

    try {
      const { error } = await supabase
        .from('products_library')
        .delete()
        .eq('id', product.id);

      if (error) throw error;

      setProducts(prev => prev.filter(p => p.id !== product.id));
      toast.success(t('products.productDeleted'));
    } catch (error) {
      console.error('Error deleting product:', error);
      toast.error(t('products.deleteProductError'));
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
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">{t('products.title')}</h1>
        <div className="flex gap-2">
          <Button onClick={() => setShowAddProductDialog(true)} variant="outline" className="gap-2">
            <Plus className="h-4 w-4" />
            {t('products.addProduct')}
          </Button>
          <Button onClick={() => setShowUploadDialog(true)} className="gap-2">
            <Upload className="h-4 w-4" />
            {t('products.uploadPriceList')}
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-6 bg-muted/50">
          <TabsTrigger value="products" className="gap-2 data-[state=active]:bg-background">
            <Package className="h-4 w-4" />
            {t('products.tabs.products')} ({products.length})
          </TabsTrigger>
          <TabsTrigger value="price-lists" className="gap-2 data-[state=active]:bg-background">
            <FileText className="h-4 w-4" />
            {t('products.tabs.priceLists')} ({priceLists.length})
          </TabsTrigger>
          <TabsTrigger value="global" className="gap-2 data-[state=active]:bg-background">
            <Sparkles className="h-4 w-4" />
            {t('products.tabs.global')} ({globalPriceLists.length})
          </TabsTrigger>
        </TabsList>

        {/* Products Tab */}
        <TabsContent value="products">
          <Card>
            <CardHeader>
              <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <CardTitle>{t('products.library')}</CardTitle>
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        placeholder={t('products.searchPlaceholder')}
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
                      <option value="all">{t('products.allCategories')}</option>
                      {categories.map(cat => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="checkbox"
                      checked={showPriceListProducts}
                      onChange={(e) => setShowPriceListProducts(e.target.checked)}
                      className="h-4 w-4 rounded border-input"
                    />
                    <span className="text-muted-foreground">{t('products.showPriceListProducts')}</span>
                  </label>
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
                      ? t('products.noProducts')
                      : t('products.noProductsFound')}
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-primary/10 border border-border">
                        <TableHead>{t('products.columns.name')}</TableHead>
                        <TableHead>{t('products.columns.brand')}</TableHead>
                        <TableHead>{t('products.columns.category')}</TableHead>
                        <TableHead className="text-right">{t('products.columns.price')}</TableHead>
                        <TableHead>{t('products.columns.unit')}</TableHead>
                        <TableHead>{t('products.columns.status')}</TableHead>
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
                          <TableCell className="text-right font-mono">
                            {formatPrice(product.default_price)}
                          </TableCell>
                          <TableCell>{product.unit}</TableCell>
                          <TableCell>
                            <Badge variant={product.active ? 'default' : 'secondary'}>
                              {product.active ? t('products.active') : t('products.inactive')}
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
                                <DropdownMenuItem onClick={() => setEditingProduct(product)}>
                                  <Pencil className="h-4 w-4 mr-2" />
                                  {t('common.edit')}
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleToggleProduct(product)}>
                                  {product.active ? (
                                    <>
                                      <ToggleLeft className="h-4 w-4 mr-2" />
                                      {t('products.deactivate')}
                                    </>
                                  ) : (
                                    <>
                                      <ToggleRight className="h-4 w-4 mr-2" />
                                      {t('products.activate')}
                                    </>
                                  )}
                                </DropdownMenuItem>
                                <DropdownMenuItem 
                                  onClick={() => handleDeleteProduct(product)}
                                  className="text-destructive focus:text-destructive"
                                >
                                  <Trash2 className="h-4 w-4 mr-2" />
                                  {t('common.delete')}
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  
                  {/* Pagination */}
                  {totalPages > 1 && (
                    <div className="flex items-center justify-between mt-4 pt-4 border-t">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <span>{t('products.show')}</span>
                        <Select value={String(pageSize)} onValueChange={v => { setPageSize(Number(v)); setCurrentPage(1); }}>
                          <SelectTrigger className="w-20 h-8">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {PAGE_SIZE_OPTIONS.map(size => (
                              <SelectItem key={size} value={String(size)}>{size}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <span>{t('products.perPage')}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-8 w-8"
                          disabled={currentPage === 1}
                          onClick={() => setCurrentPage(p => p - 1)}
                        >
                          <ChevronLeft className="w-4 h-4" />
                        </Button>
                        <span className="text-sm text-muted-foreground px-2">
                          {currentPage} / {totalPages}
                        </span>
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-8 w-8"
                          disabled={currentPage === totalPages}
                          onClick={() => setCurrentPage(p => p + 1)}
                        >
                          <ChevronRight className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Price Lists Tab */}
        <TabsContent value="price-lists">
          <Card>
            <CardHeader>
              <CardTitle>{t('products.yourPriceLists')}</CardTitle>
            </CardHeader>
            <CardContent>
              {priceLists.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <FileText className="h-12 w-12 text-muted-foreground/50 mb-4" />
                  <p className="text-muted-foreground">{t('products.noPriceLists')}</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {priceLists.map((priceList) => (
                    <div
                      key={priceList.id}
                      className="flex items-center justify-between p-4 rounded-lg border bg-card"
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                          <FileText className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <div className="font-medium">{priceList.name}</div>
                          <div className="text-sm text-muted-foreground">
                            {formatDate(priceList.created_at)}
                            {priceList.products_count > 0 && ` • ${priceList.products_count} ${t('products.productsCount')}`}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge className={statusColors[priceList.status]}>
                          {priceList.status === 'pending' && t('products.statusPending')}
                          {priceList.status === 'processing' && t('products.statusProcessing')}
                          {priceList.status === 'completed' && t('products.statusCompleted')}
                          {priceList.status === 'failed' && t('products.statusFailed')}
                        </Badge>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setSelectedPriceList(priceList)}
                        >
                          <Package className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDownloadPdf(priceList)}
                        >
                          <Download className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDeletePriceList(priceList)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Global Price Lists Tab */}
        <TabsContent value="global">
          <Card>
            <CardHeader>
              <CardTitle>{t('products.globalPriceLists')}</CardTitle>
            </CardHeader>
            <CardContent>
              {globalPriceLists.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <Sparkles className="h-12 w-12 text-muted-foreground/50 mb-4" />
                  <p className="text-muted-foreground">{t('products.noGlobalPriceLists')}</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {globalPriceLists.map((priceList) => (
                    <div
                      key={priceList.id}
                      className="flex items-center justify-between p-4 rounded-lg border bg-card"
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center">
                          <Sparkles className="h-5 w-5 text-amber-500" />
                        </div>
                        <div>
                          <div className="font-medium">{priceList.name}</div>
                          <div className="text-sm text-muted-foreground">
                            {priceList.salesperson_name && `${priceList.salesperson_name} • `}
                            {priceList.products_count > 0 && `${priceList.products_count} ${t('products.productsCount')}`}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge className={statusColors[priceList.status]}>
                          {priceList.status === 'completed' && t('products.statusCompleted')}
                        </Badge>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setSelectedPriceList(priceList)}
                        >
                          <Package className="h-4 w-4" />
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

      {/* Dialogs */}
      {instanceId && (
        <PriceListUploadDialog
          open={showUploadDialog}
          onOpenChange={setShowUploadDialog}
          instanceId={instanceId}
          onSuccess={() => fetchData()}
        />
      )}

      {selectedPriceList && (
        <PriceListViewer
          priceList={selectedPriceList}
          products={products.filter(p => {
            const metadata = p.metadata as Record<string, unknown> | null;
            return metadata?.price_list_id === selectedPriceList.id;
          })}
          open={!!selectedPriceList}
          onOpenChange={(open) => !open && setSelectedPriceList(null)}
        />
      )}

      {selectedProduct && (
        <ProductDetailsDialog
          product={selectedProduct}
          open={!!selectedProduct}
          onOpenChange={(open) => !open && setSelectedProduct(null)}
        />
      )}

      {instanceId && (
        <AddProductDialog
          open={showAddProductDialog}
          onOpenChange={setShowAddProductDialog}
          instanceId={instanceId}
          categories={categories}
          onProductAdded={() => fetchData()}
        />
      )}

      {editingProduct && instanceId && (
        <EditProductDialog
          open={!!editingProduct}
          onOpenChange={(open) => !open && setEditingProduct(null)}
          product={editingProduct}
          categories={categories}
          onProductUpdated={() => { fetchData(); setEditingProduct(null); }}
        />
      )}
    </div>
  );
}
