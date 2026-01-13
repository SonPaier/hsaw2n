import { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet-async';
import { ArrowLeft, Package, X, Star } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { OfferProductSelectionDrawer } from './OfferProductSelectionDrawer';

interface Product {
  id: string;
  name: string;
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

export function OfferServiceEditView({ instanceId, scopeId, onBack }: OfferServiceEditViewProps) {
  const { t } = useTranslation();
  const isEditMode = !!scopeId;
  
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [defaultWarranty, setDefaultWarranty] = useState('');
  const [defaultPaymentTerms, setDefaultPaymentTerms] = useState('');
  const [defaultNotes, setDefaultNotes] = useState('');
  const [defaultServiceInfo, setDefaultServiceInfo] = useState('');
  const [scopeProducts, setScopeProducts] = useState<ScopeProduct[]>([]);
  const [isProductDrawerOpen, setIsProductDrawerOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(isEditMode);

  // Load existing scope data in edit mode
  useEffect(() => {
    if (!scopeId) return;

    const fetchScopeData = async () => {
      setIsLoading(true);
      
      // Fetch scope
      const { data: scope } = await supabase
        .from('offer_scopes')
        .select('name, description, default_warranty, default_payment_terms, default_notes, default_service_info')
        .eq('id', scopeId)
        .single();

      if (scope) {
        setName(scope.name || '');
        setDescription(scope.description || '');
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
          product:products_library(id, name, default_price)
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

  // Handle product selection from drawer
  const handleProductConfirm = async (productIds: string[]) => {
    // Fetch product details for new IDs
    const newProductIds = productIds.filter(
      id => !scopeProducts.some(sp => sp.product_id === id)
    );

    if (newProductIds.length > 0) {
      const { data } = await supabase
        .from('products_library')
        .select('id, name, default_price')
        .in('id', newProductIds);

      if (data) {
        const newScopeProducts: ScopeProduct[] = data.map((product, index) => ({
          product_id: product.id,
          variant_name: '',
          is_default: scopeProducts.length === 0 && index === 0, // First product is default
          sort_order: scopeProducts.length + index,
          product
        }));

        setScopeProducts(prev => [...prev, ...newScopeProducts]);
      }
    }

    // Remove products that were deselected
    setScopeProducts(prev => 
      prev.filter(sp => productIds.includes(sp.product_id))
    );
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
      toast.error('Podaj nazwę usługi');
      return;
    }

    setIsSaving(true);

    try {
      let currentScopeId = scopeId;

      const scopeData = {
        name,
        description: description || null,
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

        // Insert new products
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

      toast.success(isEditMode ? 'Usługa zaktualizowana' : 'Usługa utworzona');
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
        <title>{isEditMode ? 'Edytuj usługę' : 'Nowa usługa'} - {t('common.adminPanel')}</title>
      </Helmet>
      <div className="max-w-4xl mx-auto pb-24">
        <div className="mb-6">
          <Button variant="ghost" onClick={onBack} className="gap-2">
            <ArrowLeft className="w-4 h-4" />
            Wróć
          </Button>
        </div>

        <h1 className="text-2xl font-bold mb-6">
          {isEditMode ? 'Edytuj usługę' : 'Nowa usługa'}
        </h1>

        <div className="space-y-6">
          {/* Nazwa usługi */}
          <div className="space-y-2">
            <Label htmlFor="name">Nazwa usługi</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="PPF Full Front"
              className="bg-white"
            />
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

          {/* Wybierz produkty */}
          <div className="space-y-3">
            <Label>Produkty</Label>
            <Button 
              variant="outline" 
              onClick={() => setIsProductDrawerOpen(true)}
              className="gap-2"
            >
              <Package className="w-4 h-4" />
              Wybierz produkty
              {scopeProducts.length > 0 && (
                <Badge variant="secondary" className="ml-2">
                  {scopeProducts.length}
                </Badge>
              )}
            </Button>
            
            {/* Lista wybranych produktów */}
            {scopeProducts.length > 0 && (
              <div className="space-y-2 mt-3">
                {scopeProducts.map(scopeProduct => (
                  <div 
                    key={scopeProduct.product_id}
                    className="p-3 bg-white border rounded-lg space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <p className="font-medium">{scopeProduct.product?.name}</p>
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
                    <Input
                      value={scopeProduct.variant_name}
                      onChange={(e) => updateVariantName(scopeProduct.product_id, e.target.value)}
                      placeholder="Np. Premium"
                      className="bg-slate-50"
                    />
                  </div>
                ))}
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
    </>
  );
}
