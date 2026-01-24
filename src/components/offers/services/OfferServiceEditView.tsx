import { useState, useEffect, useMemo } from 'react';
import { Helmet } from 'react-helmet-async';
import { ArrowLeft, Package, X, Star, GripVertical, Pencil } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { ScopeProductSelectionDrawer } from './ScopeProductSelectionDrawer';
import { AddProductDialog } from '@/components/products/AddProductDialog';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface Product {
  id: string;
  name: string;
  short_name: string | null;
  default_price: number | null;
  price_from: number | null;
  price_small: number | null;
  price_medium: number | null;
  price_large: number | null;
  category_id?: string | null;
}

// Get the lowest available price for display
const getLowestPrice = (p: Product): number => {
  // Priority: price_from, then lowest of S/M/L, then default_price
  if (p.price_from != null) return p.price_from;
  
  const sizes = [p.price_small, p.price_medium, p.price_large].filter(
    (v): v is number => v != null
  );
  if (sizes.length > 0) return Math.min(...sizes);
  
  return p.default_price ?? 0;
};

type DrawerProduct = {
  id: string;
  productId: string;
  productName: string;
  productShortName: string | null;
  variantName: string | null;
  price: number;
  category?: string | null;
};

interface ScopeProduct {
  id?: string;
  product_id: string;
  variant_name: string;
  is_default: boolean;
  sort_order: number;
  product?: Product;
}

interface OfferServiceEditViewProps {
  instanceId: string;
  scopeId?: string; // undefined = create mode
  onBack: () => void;
}

// Sortable product item component
function SortableProductItem({
  scopeProduct,
  formatPrice,
  toggleDefault,
  removeProduct,
  updateVariantName,
  onEditProduct,
}: {
  scopeProduct: ScopeProduct;
  formatPrice: (price: number) => string;
  toggleDefault: (productId: string) => void;
  removeProduct: (productId: string) => void;
  updateVariantName: (productId: string, variantName: string) => void;
  onEditProduct: (productId: string) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: scopeProduct.product_id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="p-3 bg-white border rounded-lg space-y-3"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 flex-1">
          <button
            type="button"
            className="cursor-grab active:cursor-grabbing touch-none text-muted-foreground hover:text-foreground"
            {...attributes}
            {...listeners}
          >
            <GripVertical className="w-4 h-4" />
          </button>
          <div className="flex-1">
            <div className="flex items-center gap-1.5">
              <p className="font-medium">{scopeProduct.product?.name}</p>
              <button
                type="button"
                onClick={() => onEditProduct(scopeProduct.product_id)}
                className="p-1 text-muted-foreground hover:text-primary transition-colors"
                title="Edytuj usługę"
              >
                <Pencil className="w-3.5 h-3.5" />
              </button>
            </div>
            {scopeProduct.product?.short_name && (
              <p className="text-xs text-muted-foreground">Skrót: {scopeProduct.product.short_name}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="font-semibold text-foreground">
            {formatPrice(scopeProduct.product ? getLowestPrice(scopeProduct.product) : 0)}
          </span>
          <button
            type="button"
            onClick={() => toggleDefault(scopeProduct.product_id)}
            className={`p-1 transition-colors ${
              scopeProduct.is_default 
                ? 'text-yellow-500' 
                : 'text-muted-foreground hover:text-yellow-500'
            }`}
            title={scopeProduct.is_default ? 'Domyślny' : 'Ustaw jako domyślny'}
          >
            <Star className={`w-4 h-4 ${scopeProduct.is_default ? 'fill-current' : ''}`} />
          </button>
          <button
            type="button"
            onClick={() => removeProduct(scopeProduct.product_id)}
            className="p-1 text-muted-foreground hover:text-destructive transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
      <div className="space-y-1">
        <Label className="text-xs text-muted-foreground">Dodatkowa nazwa pozycji</Label>
        <Input
          value={scopeProduct.variant_name}
          onChange={(e) => updateVariantName(scopeProduct.product_id, e.target.value)}
          placeholder="Np. Premium"
          className="bg-slate-50"
        />
      </div>
    </div>
  );
}

export function OfferServiceEditView({ instanceId, scopeId, onBack }: OfferServiceEditViewProps) {
  const { t } = useTranslation();
  const isEditMode = !!scopeId;
  
  const [shortName, setShortName] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isExtrasScope, setIsExtrasScope] = useState(false);
  const [defaultWarranty, setDefaultWarranty] = useState('');
  const [defaultPaymentTerms, setDefaultPaymentTerms] = useState('');
  const [defaultNotes, setDefaultNotes] = useState('');
  const [defaultServiceInfo, setDefaultServiceInfo] = useState('');
  const [scopeProducts, setScopeProducts] = useState<ScopeProduct[]>([]);
  const [availableProducts, setAvailableProducts] = useState<Product[]>([]);
  const [categoryMap, setCategoryMap] = useState<Record<string, string>>({}); // id -> name
  const [categoryOrder, setCategoryOrder] = useState<Record<string, number>>({});
  const [isProductDrawerOpen, setIsProductDrawerOpen] = useState(false);
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(isEditMode);

  // Prefetch services with service_type='both' (unified model)
  useEffect(() => {
    const fetchDrawerData = async () => {
      const [productsRes, categoriesRes] = await Promise.all([
        supabase
          .from('unified_services')
          .select('id, name, short_name, default_price, price_from, price_small, price_medium, price_large, category_id, service_type')
          .eq('instance_id', instanceId)
          .eq('service_type', 'both')
          .eq('active', true)
          .order('name'),
        supabase
          .from('unified_categories')
          .select('id, name, sort_order')
          .eq('instance_id', instanceId)
          .eq('category_type', 'both')
          .eq('active', true),
      ]);

      if (!productsRes.error && productsRes.data) {
        setAvailableProducts(productsRes.data as Product[]);
      }

      // Build category id->name map and name->sort_order map
      const catMap: Record<string, string> = {};
      const order: Record<string, number> = {};
      if (!categoriesRes.error && categoriesRes.data) {
        categoriesRes.data.forEach((cat) => {
          catMap[cat.id] = cat.name;
          order[cat.name] = cat.sort_order ?? 0;
        });
      }
      setCategoryMap(catMap);
      setCategoryOrder(order);
    };

    if (instanceId) fetchDrawerData();
  }, [instanceId]);

  const drawerProducts = useMemo<DrawerProduct[]>(() => {
    return availableProducts.map((p) => ({
      id: p.id,
      productId: p.id,
      productName: p.name,
      productShortName: p.short_name,
      variantName: null,
      // Use lowest available price (price_from -> min(S/M/L) -> default_price)
      price: getLowestPrice(p),
      // Map category_id to category NAME (drawer groups by name)
      category: p.category_id ? (categoryMap[p.category_id] ?? null) : null,
    }));
  }, [availableProducts, categoryMap]);

  // DnD sensors
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Load instance defaults for new service
  useEffect(() => {
    if (scopeId) return; // Only for create mode
    
    const fetchInstanceDefaults = async () => {
      const { data } = await supabase
        .from('instances')
        .select('offer_default_payment_terms')
        .eq('id', instanceId)
        .single();
      
      if (data) {
        setDefaultPaymentTerms(data.offer_default_payment_terms || '');
      }
    };
    
    fetchInstanceDefaults();
  }, [instanceId, scopeId]);

  // Load existing scope data in edit mode
  useEffect(() => {
    if (!scopeId) return;

    const fetchScopeData = async () => {
      setIsLoading(true);
      
      // Fetch scope
      const { data: scope } = await supabase
        .from('offer_scopes')
        .select('short_name, name, description, is_extras_scope, default_warranty, default_payment_terms, default_notes, default_service_info')
        .eq('id', scopeId)
        .single();

      if (scope) {
        setShortName(scope.short_name || '');
        setName(scope.name || '');
        setDescription(scope.description || '');
        setIsExtrasScope(scope.is_extras_scope || false);
        setDefaultWarranty(scope.default_warranty || '');
        setDefaultPaymentTerms(scope.default_payment_terms || '');
        setDefaultNotes(scope.default_notes || '');
        setDefaultServiceInfo(scope.default_service_info || '');
      }

      // Fetch scope products with product details
      const { data: products } = await supabase
        .from('offer_scope_products')
        .select(`
          id,
          product_id,
          variant_name,
          is_default,
          sort_order,
          product:unified_services!product_id(id, name, short_name, default_price, price_from, price_small, price_medium, price_large, category_id)
        `)
        .eq('scope_id', scopeId)
        .order('sort_order');

      if (products) {
        setScopeProducts(products.map(p => ({
          id: p.id,
          product_id: p.product_id,
          variant_name: p.variant_name || '',
          is_default: p.is_default,
          sort_order: p.sort_order,
          product: (p as any).product as Product | undefined
        })));
      }

      setIsLoading(false);
    };

    fetchScopeData();
  }, [scopeId]);

  // Handle drag end for reordering
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      setScopeProducts((items) => {
        const oldIndex = items.findIndex((item) => item.product_id === active.id);
        const newIndex = items.findIndex((item) => item.product_id === over.id);
        return arrayMove(items, oldIndex, newIndex).map((item, index) => ({
          ...item,
          sort_order: index,
        }));
      });
    }
  };

  // Handle product selection from drawer (same behavior as SummaryStepV2 drawer sync)
  const handleProductConfirm = (products: DrawerProduct[]) => {
    const selectedIds = new Set(products.map((p) => p.id));

    const kept = scopeProducts.filter((sp) => selectedIds.has(sp.product_id));
    const keptIds = new Set(kept.map((sp) => sp.product_id));

    const added: ScopeProduct[] = products
      .filter((p) => !keptIds.has(p.id))
      .map((p, idx) => ({
        product_id: p.productId,
        variant_name: '',
        is_default: kept.length === 0 && idx === 0,
        sort_order: 0,
        // Use the full product record (with price_from + S/M/L) from drawer prefetch
        // so price display stays consistent after save/reload.
        product:
          availableProducts.find((ap) => ap.id === p.productId) ??
          {
            id: p.productId,
            name: p.productName,
            short_name: p.productShortName,
            default_price: null,
            // If we don't have full record, at least keep the computed lowest price
            // for immediate UI feedback.
            price_from: p.price,
            price_small: null,
            price_medium: null,
            price_large: null,
            category_id: null,
          },
      }));

    const next = [...kept, ...added].map((sp, index) => ({
      ...sp,
      sort_order: index,
    }));

    setScopeProducts(next);
  };

  const removeProduct = (productId: string) => {
    setScopeProducts(prev => prev.filter(sp => sp.product_id !== productId));
  };

  const updateVariantName = (productId: string, variantName: string) => {
    setScopeProducts(prev => 
      prev.map(sp => 
        sp.product_id === productId 
          ? { ...sp, variant_name: variantName }
          : sp
      )
    );
  };

  const toggleDefault = (productId: string) => {
    setScopeProducts(prev => 
      prev.map(sp => ({
        ...sp,
        is_default: sp.product_id === productId ? !sp.is_default : sp.is_default
      }))
    );
  };

  const formatPrice = (price: number): string => {
    return `${price.toFixed(0)} zł`;
  };

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error('Podaj nazwę szablonu');
      return;
    }

    setIsSaving(true);

    try {
      let currentScopeId = scopeId;

      const scopeData = {
        short_name: shortName || null,
        name,
        description: description || null,
        is_extras_scope: isExtrasScope,
        default_warranty: defaultWarranty || null,
        default_payment_terms: defaultPaymentTerms || null,
        default_notes: defaultNotes || null,
        default_service_info: defaultServiceInfo || null
      };

      if (isEditMode && scopeId) {
        // Update existing scope
        const { error } = await supabase
          .from('offer_scopes')
          .update(scopeData)
          .eq('id', scopeId);

        if (error) throw error;
      } else {
        // Create new scope
        const { data, error } = await supabase
          .from('offer_scopes')
          .insert({
            ...scopeData,
            instance_id: instanceId,
            active: true,
            has_unified_services: true // New templates always use unified services
          })
          .select('id')
          .single();

        if (error) throw error;
        currentScopeId = data.id;
      }

      // Handle scope products
      if (currentScopeId) {
        // Delete existing products for this scope
        await supabase
          .from('offer_scope_products')
          .delete()
          .eq('scope_id', currentScopeId);

        // Insert new products with correct sort_order
        if (scopeProducts.length > 0) {
          const productsToInsert = scopeProducts.map((sp, index) => ({
            scope_id: currentScopeId,
            product_id: sp.product_id,
            variant_name: sp.variant_name || null,
            is_default: sp.is_default,
            sort_order: index,
            instance_id: instanceId
          }));

          const { error } = await supabase
            .from('offer_scope_products')
            .insert(productsToInsert);

          if (error) throw error;
        }
      }

      toast.success(isEditMode ? 'Szablon zaktualizowany' : 'Szablon utworzony');
      onBack();
    } catch (error) {
      console.error('Error saving scope:', error);
      toast.error('Błąd podczas zapisywania');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <>
      <Helmet>
        <title>{isEditMode ? `Edytuj szablon ${name}` : 'Nowy szablon'} - {t('common.adminPanel')}</title>
      </Helmet>
      <div className="max-w-4xl mx-auto pb-24">
        <div className="mb-6">
          <Button variant="ghost" onClick={onBack} className="gap-2">
            <ArrowLeft className="w-4 h-4" />
            Wróć
          </Button>
        </div>

        <h1 className="text-2xl font-bold mb-6">
          {isEditMode ? `Edytuj szablon ${name}` : 'Nowy szablon'}
        </h1>

        <div className="space-y-6">
          {/* Nazwa skrócona */}
          <div className="space-y-2">
            <Label htmlFor="shortName">Nazwa skrócona</Label>
            <Input
              id="shortName"
              value={shortName}
              onChange={(e) => setShortName(e.target.value)}
              placeholder="PPF"
              className="bg-white"
            />
          </div>

          {/* Nazwa szablonu widoczna w ofercie */}
          <div className="space-y-2">
            <Label htmlFor="name">Nazwa szablonu widoczna w ofercie</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="PPF Full Front"
              className="bg-white"
            />
          </div>

          {/* Hidden: Szablon typu dodatki - internal field, not exposed in UI */}

          {/* Opis */}
          <div className="space-y-2">
            <Label htmlFor="description">Opis</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Opis usługi..."
              rows={12}
              className="bg-white resize-none"
            />
          </div>

          {/* Wybierz usługi dla szablonu */}
          <div className="space-y-3">
            <Button
              variant="outline" 
              onClick={() => setIsProductDrawerOpen(true)}
              className="gap-2"
            >
              <Package className="w-4 h-4" />
              Wybierz usługi do szablonu
              {scopeProducts.length > 0 && (
                <Badge variant="secondary" className="ml-2">
                  {scopeProducts.length}
                </Badge>
              )}
            </Button>
            
            {/* Lista wybranych usług z drag & drop */}
            {scopeProducts.length > 0 && (
              <div className="space-y-2 mt-3">
                <p className="text-sm text-muted-foreground flex items-center gap-1">
                  <Star className="w-3 h-3 text-yellow-500 fill-yellow-500" />
                  oznacza, że usługa będzie zawsze dodana w kreatorze dla tego szablonu
                </p>
                <p className="text-xs text-muted-foreground">
                  Przeciągnij aby zmienić kolejność usług
                </p>
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragEnd={handleDragEnd}
                >
                  <SortableContext
                    items={scopeProducts.map(sp => sp.product_id)}
                    strategy={verticalListSortingStrategy}
                  >
                    <div className="space-y-2">
                      {scopeProducts.map(scopeProduct => (
                        <SortableProductItem
                          key={scopeProduct.product_id}
                          scopeProduct={scopeProduct}
                          formatPrice={formatPrice}
                          toggleDefault={toggleDefault}
                          removeProduct={removeProduct}
                          updateVariantName={updateVariantName}
                          onEditProduct={setEditingProductId}
                        />
                      ))}
                    </div>
                  </SortableContext>
                </DndContext>
              </div>
            )}
          </div>

          {/* Domyślne wartości dla oferty */}
          <div className="space-y-4 pt-4 border-t">
            <h3 className="font-medium text-lg">Domyślne wartości dla oferty</h3>
            
            <div className="space-y-2">
              <Label htmlFor="defaultWarranty">Gwarancja</Label>
              <Textarea
                id="defaultWarranty"
                value={defaultWarranty}
                onChange={(e) => setDefaultWarranty(e.target.value)}
                placeholder="Np. 5 lat gwarancji na powłokę..."
                rows={5}
                className="bg-white resize-none"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="defaultPaymentTerms">Warunki płatności</Label>
              <Textarea
                id="defaultPaymentTerms"
                value={defaultPaymentTerms}
                onChange={(e) => setDefaultPaymentTerms(e.target.value)}
                placeholder="Np. 50% zaliczki, reszta przy odbiorze..."
                rows={5}
                className="bg-white resize-none"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="defaultServiceInfo">Informacje o serwisie</Label>
              <Textarea
                id="defaultServiceInfo"
                value={defaultServiceInfo}
                onChange={(e) => setDefaultServiceInfo(e.target.value)}
                placeholder="Np. Czas realizacji 3-5 dni roboczych..."
                rows={5}
                className="bg-white resize-none"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="defaultNotes">Inne uwagi</Label>
              <Textarea
                id="defaultNotes"
                value={defaultNotes}
                onChange={(e) => setDefaultNotes(e.target.value)}
                placeholder="Dodatkowe informacje..."
                rows={5}
                className="bg-white resize-none"
              />
            </div>
          </div>

          {/* Przycisk zapisz */}
          <div className="pt-4">
            <Button 
              onClick={handleSave} 
              disabled={isSaving}
              className="w-full sm:w-auto"
            >
              {isSaving ? 'Zapisywanie...' : 'Zapisz szablon'}
            </Button>
          </div>
        </div>
      </div>

      <ScopeProductSelectionDrawer
        open={isProductDrawerOpen}
        onClose={() => setIsProductDrawerOpen(false)}
        availableProducts={drawerProducts}
        alreadySelectedIds={scopeProducts.map((sp) => sp.product_id)}
        categoryOrder={categoryOrder}
        onConfirm={handleProductConfirm}
      />

      {/* Product Edit Dialog */}
      <AddProductDialog
        open={!!editingProductId}
        onOpenChange={(open) => !open && setEditingProductId(null)}
        instanceId={instanceId}
        categories={[]}
        onProductAdded={async () => {
          // Refresh the product data after edit
          if (editingProductId) {
            const { data } = await supabase
              .from('unified_services')
              .select('id, name, short_name, default_price, price_from, price_small, price_medium, price_large, category_id')
              .eq('id', editingProductId)
              .single();
            
            if (data) {
              setScopeProducts(prev => 
                prev.map(sp => 
                  sp.product_id === editingProductId 
                    ? { ...sp, product: data as Product }
                    : sp
                )
              );

              // Also refresh the drawer list so prices/names stay in sync
              setAvailableProducts((prev) =>
                prev.map((p) => (p.id === editingProductId ? (data as Product) : p))
              );
            }
          }
          setEditingProductId(null);
        }}
        product={scopeProducts.find(sp => sp.product_id === editingProductId)?.product as any}
      />
    </>
  );
}