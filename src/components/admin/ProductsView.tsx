import { useState, useEffect, useMemo } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
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
  FileText,
  Package,
  Trash2,
  Pencil,
  Loader2,
  Download,
  ChevronLeft,
  ChevronRight,
  MoreHorizontal,
  ArrowLeft,
  Bell,
  FolderOpen,
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
import { ProductDetailsDialog } from '@/components/products/ProductDetailsDialog';
import { AddProductDialog } from '@/components/products/AddProductDialog';
import { ReminderTemplatesDialog } from '@/components/products/ReminderTemplatesDialog';
import { ProductCategoriesDialog } from '@/components/products/ProductCategoriesDialog';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { useTranslation } from 'react-i18next';
import { useIsMobile } from '@/hooks/use-mobile';
import { sortProductsByCategoryAndPrice } from '@/lib/productSortUtils';

interface PriceList {
  id: string;
  name: string;
  file_path: string;
  file_type: string;
  is_global: boolean;
  created_at: string;
  salesperson_name: string | null;
  salesperson_email: string | null;
  salesperson_phone: string | null;
}

interface Product {
  id: string;
  name: string;
  short_name: string | null;
  brand: string | null;
  description: string | null;
  category: string | null;
  unit: string;
  default_price: number;
  metadata: Record<string, unknown> | null;
  source: string;
  instance_id: string | null;
}


const PAGE_SIZE_OPTIONS = [20, 50, 100];

interface ProductsViewProps {
  instanceId: string | null;
  onBackToOffers?: () => void;
}

export default function ProductsView({ instanceId, onBackToOffers }: ProductsViewProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [searchParams, setSearchParams] = useSearchParams();
  const [priceLists, setPriceLists] = useState<PriceList[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [categoryOrder, setCategoryOrder] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [showUploadDialog, setShowUploadDialog] = useState(false);
  const [showAddProductDialog, setShowAddProductDialog] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [activeTab, setActiveTab] = useState('products');
  const [deleteProductDialog, setDeleteProductDialog] = useState<{ open: boolean; product: Product | null }>({ open: false, product: null });
  const [checkingProductUsage, setCheckingProductUsage] = useState(false);
  const [showTemplatesDialog, setShowTemplatesDialog] = useState(false);
  const [showCategoriesDialog, setShowCategoriesDialog] = useState(false);
  
  // Read initial pagination from URL
  const initialPage = parseInt(searchParams.get('page') || '1', 10);
  const initialPageSize = parseInt(searchParams.get('pageSize') || '20', 10);
  const [currentPage, setCurrentPage] = useState(isNaN(initialPage) || initialPage < 1 ? 1 : initialPage);
  const [pageSize, setPageSize] = useState(PAGE_SIZE_OPTIONS.includes(initialPageSize) ? initialPageSize : 20);

  // Fetch data function
  const fetchPriceLists = async () => {
    if (!instanceId) return;
    
    const { data: priceListsData } = await supabase
      .from('price_lists')
      .select('*')
      .eq('instance_id', instanceId)
      .order('created_at', { ascending: false });

    setPriceLists((priceListsData as PriceList[]) || []);
  };

  const fetchProducts = async () => {
    if (!instanceId) return;
    
    const { data: productsData } = await supabase
      .from('unified_services')
      .select('*')
      .eq('service_type', 'offer')
      .eq('instance_id', instanceId) as unknown as { data: Product[] | null };

    setProducts(productsData || []);
  };

  const fetchCategoryOrder = async () => {
    if (!instanceId) return;
    
    const { data } = await supabase
      .from('offer_product_categories')
      .select('name, sort_order')
      .eq('instance_id', instanceId)
      .eq('active', true);

    if (data) {
      const orderMap: Record<string, number> = {};
      data.forEach(cat => {
        orderMap[cat.name] = cat.sort_order;
      });
      setCategoryOrder(orderMap);
    }
  };

  const fetchData = async () => {
    if (!instanceId) return;
    
    setLoading(true);
    await Promise.all([fetchPriceLists(), fetchProducts(), fetchCategoryOrder()]);
    setLoading(false);
  };

  // Fetch data on instanceId change
  useEffect(() => {
    if (!instanceId) return;
    fetchData();
  }, [instanceId]);

  // Get unique categories and counts
  const categories = useMemo(() => {
    const cats = new Set(products.filter(p => p.category).map(p => p.category!));
    return Array.from(cats).sort();
  }, [products]);

  // Product counts per category (for categories dialog)
  const productCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    products.forEach(p => {
      if (p.category) {
        counts[p.category] = (counts[p.category] || 0) + 1;
      }
    });
    return counts;
  }, [products]);

  // Sort products by category order and price
  const sortedProducts = useMemo(() => {
    // Map products to include category and price fields for sorting util
    const productsForSorting = products.map(p => ({
      ...p,
      category: p.category,
      price: p.default_price
    }));
    return sortProductsByCategoryAndPrice(productsForSorting, categoryOrder);
  }, [products, categoryOrder]);

  // Filter products
  const filteredProducts = useMemo(() => {
    const query = searchQuery.toLowerCase().trim();
    return sortedProducts.filter(p => {
      const matchesSearch = query === '' || 
        p.name.toLowerCase().includes(query) ||
        (p.brand && p.brand.toLowerCase().includes(query)) ||
        (p.description && p.description.toLowerCase().includes(query)) ||
        (p.category && p.category.toLowerCase().includes(query));
      
      const matchesCategory = categoryFilter === 'all' || p.category === categoryFilter;
      
      return matchesSearch && matchesCategory;
    });
  }, [sortedProducts, searchQuery, categoryFilter]);

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

  const openDeleteProductDialog = (product: Product) => {
    setDeleteProductDialog({ open: true, product });
  };

  const handleDeleteProduct = async () => {
    const product = deleteProductDialog.product;
    if (!product) return;

    setCheckingProductUsage(true);

    try {
      // Check if product is used in any offers
      const { count, error: checkError } = await supabase
        .from('offer_option_items')
        .select('*', { count: 'exact', head: true })
        .eq('product_id', product.id);

      if (checkError) throw checkError;

      if (count && count > 0) {
        toast.error(t('products.productUsedInOffers'));
        setDeleteProductDialog({ open: false, product: null });
        setCheckingProductUsage(false);
        return;
      }

      const { error } = await supabase
        .from('unified_services')
        .delete()
        .eq('id', product.id);

      if (error) throw error;

      setProducts(prev => prev.filter(p => p.id !== product.id));
      toast.success(t('products.productDeleted'));
      setDeleteProductDialog({ open: false, product: null });
    } catch (error) {
      console.error('Error deleting product:', error);
      toast.error(t('products.deleteProductError'));
    } finally {
      setCheckingProductUsage(false);
    }
  };

  const formatPrice = (value: number) => {
    return `${Math.round(value)} zł`;
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
      <div className="mb-4">
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={() => onBackToOffers?.()}
          className="gap-2 -ml-2"
        >
          <ArrowLeft className="w-4 h-4" />
          {t('offers.backToList')}
        </Button>
      </div>
      <div className="flex flex-col gap-2 mb-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">{t('products.title')}</h1>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" onClick={() => setShowCategoriesDialog(true)} className="sm:w-auto sm:px-4 w-10 h-10">
              <FolderOpen className="h-4 w-4" />
              <span className="hidden sm:inline ml-2">Kategorie usług</span>
            </Button>
            <Button variant="outline" size="icon" onClick={() => setShowTemplatesDialog(true)} className="sm:w-auto sm:px-4 w-10 h-10">
              <Bell className="h-4 w-4" />
              <span className="hidden sm:inline ml-2">{t('reminderTemplates.title')}</span>
            </Button>
            <Button size="icon" onClick={() => setShowAddProductDialog(true)} className="sm:w-auto sm:px-4 w-10 h-10">
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline ml-2">{t('products.addService')}</span>
            </Button>
          </div>
        </div>
        <p className="text-muted-foreground text-sm">
          Na ich podstawie możesz tworzyć własne szablony oraz wykorzystywać je w ofertach.
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-6 bg-muted/50">
          <TabsTrigger value="products" className="gap-2 data-[state=active]:bg-background">
            <Package className="h-4 w-4" />
            {t('products.tabs.products')} ({filteredProducts.length})
          </TabsTrigger>
          <TabsTrigger value="price-lists" className="gap-2 data-[state=active]:bg-background">
            <FileText className="h-4 w-4" />
            {t('products.tabs.priceLists')} ({priceLists.length})
          </TabsTrigger>
        </TabsList>

        {/* Products Tab */}
        <TabsContent value="products">
          <Card>
            <CardContent className="pt-6">
              {/* Filters above table */}
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-4">
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
              ) : isMobile ? (
                // Mobile: Card layout
                <div className="space-y-3 pb-24">
                  {paginatedProducts.map((product) => (
                    <div 
                      key={product.id} 
                      className="p-3 border rounded-lg bg-card"
                    >
                      {/* Line 1: Full name */}
                      <button 
                        onClick={() => setSelectedProduct(product)}
                        className="text-left font-medium hover:text-primary transition-colors w-full"
                      >
                        {product.name}
                      </button>
                      
                      {/* Line 2: Category pill */}
                      {product.category && (
                        <div className="mt-1.5">
                          <Badge variant="outline" className="text-xs">
                            {product.category}
                          </Badge>
                        </div>
                      )}
                      
                      {/* Line 3: Price + menu */}
                      <div className="flex items-center justify-between mt-2">
                        <span className="font-semibold">
                          {formatPrice(product.default_price)}
                        </span>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="bg-background">
                            <DropdownMenuItem onClick={() => setEditingProduct(product)}>
                              <Pencil className="h-4 w-4 mr-2" />
                              {t('common.edit')}
                            </DropdownMenuItem>
                            <DropdownMenuItem 
                              onClick={() => openDeleteProductDialog(product)}
                              className="text-destructive focus:text-destructive"
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              {t('common.delete')}
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  ))}
                  
                  {/* Pagination - Mobile */}
                  {totalPages > 1 && (
                    <div className="flex items-center justify-center gap-2 pt-4">
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
                  )}
                </div>
              ) : (
                // Desktop: Table layout
                <div>
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-primary/10 border border-border">
                        <TableHead>{t('products.columns.name')}</TableHead>
                        <TableHead>{t('products.columns.brand')}</TableHead>
                        <TableHead>{t('products.columns.category')}</TableHead>
                        <TableHead className="text-right min-w-[100px]">{t('products.columns.price')}</TableHead>
                        <TableHead className="w-[50px]"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paginatedProducts.map((product) => (
                        <TableRow key={product.id}>
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
                          <TableCell className="text-right">
                            {formatPrice(product.default_price)}
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
                                <DropdownMenuItem 
                                  onClick={() => openDeleteProductDialog(product)}
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
                  
                  {/* Pagination - Desktop */}
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
              <div className="flex items-center justify-between">
                <CardTitle>{t('products.yourPriceLists')}</CardTitle>
                <Button onClick={() => setShowUploadDialog(true)} variant="secondary" className="gap-2">
                  <Upload className="h-4 w-4" />
                  {t('products.uploadPriceList')}
                </Button>
              </div>
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
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
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

      {selectedProduct && (
        <ProductDetailsDialog
          product={selectedProduct}
          open={!!selectedProduct}
          onOpenChange={(open) => !open && setSelectedProduct(null)}
        />
      )}

      {instanceId && (
        <AddProductDialog
          open={showAddProductDialog || !!editingProduct}
          onOpenChange={(open) => {
            if (!open) {
              setShowAddProductDialog(false);
              setEditingProduct(null);
            }
          }}
          instanceId={instanceId}
          categories={categories}
          onProductAdded={() => { 
            fetchData(); 
            setEditingProduct(null);
            setShowAddProductDialog(false);
          }}
          product={editingProduct}
        />
      )}

      {/* Reminder Templates Dialog */}
      {instanceId && (
        <ReminderTemplatesDialog
          open={showTemplatesDialog}
          onOpenChange={setShowTemplatesDialog}
          instanceId={instanceId}
        />
      )}

      {/* Product Categories Dialog */}
      {instanceId && (
        <ProductCategoriesDialog
          open={showCategoriesDialog}
          onOpenChange={setShowCategoriesDialog}
          instanceId={instanceId}
          productCounts={productCounts}
          onCategoriesChanged={() => {
            fetchProducts();
            fetchCategoryOrder();
          }}
        />
      )}

      {/* Delete Product Confirmation */}
      <ConfirmDialog
        open={deleteProductDialog.open}
        onOpenChange={(open) => !open && setDeleteProductDialog({ open: false, product: null })}
        title={t('products.confirmDeleteProductTitle')}
        description={t('products.confirmDeleteProductDesc', { name: deleteProductDialog.product?.name || '' })}
        confirmLabel={t('common.delete')}
        cancelLabel={t('common.cancel')}
        onConfirm={handleDeleteProduct}
        variant="destructive"
        loading={checkingProductUsage}
      />
    </div>
  );
}
