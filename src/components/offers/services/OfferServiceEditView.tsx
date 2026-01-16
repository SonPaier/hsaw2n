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
import { OfferProductSelectionDrawer } from './OfferProductSelectionDrawer';
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
  default_price: number;
}

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
            {formatPrice(scopeProduct.product?.default_price || 0)}
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
  const [isProductDrawerOpen, setIsProductDrawerOpen] = useState(false);
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(isEditMode);

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
          product:products_library(id, name, short_name, default_price)
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
          product: p.product as Product | undefined
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

  // Handle product selection from drawer
  const handleProductConfirm = async (productIds: string[]) => {
    // Start with current products that are still selected
    const keepProducts = scopeProducts.filter(sp => productIds.includes(sp.product_id));
    
    // Find new product IDs that aren't in current list
    const newProductIds = productIds.filter(
      id => !scopeProducts.some(sp => sp.product_id === id)
    );

    if (newProductIds.length > 0) {
      const { data } = await supabase
        .from('products_library')
        .select('id, name, short_name, default_price')
        .in('id', newProductIds);

      if (data) {
        const newScopeProducts: ScopeProduct[] = data.map((product, index) => ({
          product_id: product.id,
          variant_name: '',
          is_default: keepProducts.length === 0 && index === 0, // First product is default if list was empty
          sort_order: keepProducts.length + index,
          product
        }));

        // Combine kept products with new ones in a single setState
        setScopeProducts([...keepProducts, ...newScopeProducts]);
      } else {
        // No new products fetched, just update with kept products
        setScopeProducts(keepProducts);
      }
    } else {
      // No new products, just update with kept products (handles removals)
      setScopeProducts(keepProducts);
    }
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
            active: true
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

          {/* Nazwa usługi widoczna w ofercie */}
          <div className="space-y-2">
            <Label htmlFor="name">Nazwa usługi widoczna w ofercie</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="PPF Full Front"
              className="bg-white"
            />
          </div>

          {/* Usługa typu dodatki */}
          <div className="flex items-center space-x-2">
            <Checkbox 
              id="isExtrasScope" 
              checked={isExtrasScope}
              onCheckedChange={(checked) => setIsExtrasScope(checked === true)}
            />
            <Label htmlFor="isExtrasScope" className="cursor-pointer">
              Usługa typu dodatki
            </Label>
          </div>

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

          {/* Wybierz usługi */}
          <div className="space-y-3">
            <Button
              variant="outline" 
              onClick={() => setIsProductDrawerOpen(true)}
              className="gap-2"
            >
              <Package className="w-4 h-4" />
              Wybierz usługi
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
              {isSaving ? 'Zapisywanie...' : 'Zapisz usługę'}
            </Button>
          </div>
        </div>
      </div>

      <OfferProductSelectionDrawer
        open={isProductDrawerOpen}
        onClose={() => setIsProductDrawerOpen(false)}
        instanceId={instanceId}
        selectedProductIds={scopeProducts.map(sp => sp.product_id)}
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
              .from('products_library')
              .select('id, name, short_name, default_price')
              .eq('id', editingProductId)
              .single();
            
            if (data) {
              setScopeProducts(prev => 
                prev.map(sp => 
                  sp.product_id === editingProductId 
                    ? { ...sp, product: data }
                    : sp
                )
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