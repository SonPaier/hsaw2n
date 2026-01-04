import { useState, useEffect, forwardRef, useImperativeHandle } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Trash2, Package } from 'lucide-react';
import { toast } from 'sonner';

interface OfferScope {
  id: string;
  name: string;
}

interface OfferVariant {
  id: string;
  name: string;
}

interface ScopeVariantProduct {
  id: string;
  scope_id: string;
  variant_id: string;
  product_id: string | null;
  custom_name: string | null;
  custom_description: string | null;
  quantity: number;
  unit: string;
  unit_price: number;
  sort_order: number;
  isNew?: boolean;
  isDeleted?: boolean;
  isDirty?: boolean;
}

interface Product {
  id: string;
  name: string;
  default_price: number;
  unit: string;
}

interface OfferScopeProductsSettingsProps {
  instanceId: string;
  onChange?: () => void;
}

export interface OfferScopeProductsSettingsRef {
  saveAll: () => Promise<boolean>;
}

export const OfferScopeProductsSettings = forwardRef<OfferScopeProductsSettingsRef, OfferScopeProductsSettingsProps>(
  ({ instanceId, onChange }, ref) => {
    const { t } = useTranslation();
    const [scopes, setScopes] = useState<OfferScope[]>([]);
    const [allVariants, setAllVariants] = useState<OfferVariant[]>([]);
    const [scopeVariantLinks, setScopeVariantLinks] = useState<{ scope_id: string; variant_id: string }[]>([]);
    const [products, setProducts] = useState<Product[]>([]);
    const [scopeProducts, setScopeProducts] = useState<ScopeVariantProduct[]>([]);
    const [selectedScope, setSelectedScope] = useState<string | null>(null);
    const [selectedVariant, setSelectedVariant] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);

    // Get variants available for the selected scope
    const availableVariants = selectedScope
      ? allVariants.filter(v => 
          scopeVariantLinks.some(link => link.scope_id === selectedScope && link.variant_id === v.id)
        )
      : [];

    useEffect(() => {
      fetchData();
    }, [instanceId]);

    // When scope changes, auto-select first available variant for that scope
    useEffect(() => {
      if (selectedScope && scopeVariantLinks.length > 0) {
        const linksForScope = scopeVariantLinks.filter(l => l.scope_id === selectedScope);
        if (linksForScope.length > 0) {
          const firstVariantForScope = linksForScope[0].variant_id;
          // Only update if current variant is not valid for this scope
          if (!linksForScope.some(l => l.variant_id === selectedVariant)) {
            setSelectedVariant(firstVariantForScope);
          }
        } else {
          setSelectedVariant(null);
        }
      }
    }, [selectedScope, scopeVariantLinks]);

    useEffect(() => {
      if (selectedScope && selectedVariant) {
        fetchScopeProducts();
      } else {
        setScopeProducts([]);
      }
    }, [selectedScope, selectedVariant]);

    useImperativeHandle(ref, () => ({
      saveAll: async () => {
        try {
          // Handle deletions
          const deletedProducts = scopeProducts.filter(p => p.isDeleted);
          for (const product of deletedProducts) {
            if (!product.isNew) {
              const { error } = await supabase
                .from('offer_scope_variant_products')
                .delete()
                .eq('id', product.id);
              if (error) throw error;
            }
          }

          // Handle new products
          const newProducts = scopeProducts.filter(p => p.isNew && !p.isDeleted);
          for (const product of newProducts) {
            const { error } = await supabase
              .from('offer_scope_variant_products')
              .insert({
                instance_id: instanceId,
                scope_id: product.scope_id,
                variant_id: product.variant_id,
                product_id: product.product_id,
                custom_name: product.custom_name,
                custom_description: product.custom_description,
                quantity: product.quantity,
                unit: product.unit,
                unit_price: product.unit_price,
                sort_order: product.sort_order,
              });
            if (error) throw error;
          }

          // Handle updates
          const dirtyProducts = scopeProducts.filter(p => p.isDirty && !p.isNew && !p.isDeleted);
          for (const product of dirtyProducts) {
            const { error } = await supabase
              .from('offer_scope_variant_products')
              .update({
                product_id: product.product_id,
                custom_name: product.custom_name,
                custom_description: product.custom_description,
                quantity: product.quantity,
                unit: product.unit,
                unit_price: product.unit_price,
                sort_order: product.sort_order,
              })
              .eq('id', product.id);
            if (error) throw error;
          }

          // Refresh data
          if (selectedScope && selectedVariant) {
            await fetchScopeProducts();
          }
          return true;
        } catch (error) {
          console.error('Error saving products:', error);
          toast.error(t('offerSettings.products.saveError'));
          return false;
        }
      },
    }));

    const fetchData = async () => {
      try {
        const [scopesRes, variantsRes, productsRes, linksRes] = await Promise.all([
          supabase.from('offer_scopes').select('id, name').eq('instance_id', instanceId).eq('active', true).order('sort_order'),
          supabase.from('offer_variants').select('id, name').eq('instance_id', instanceId).eq('active', true).order('sort_order'),
          supabase.from('products_library').select('id, name, default_price, unit').eq('instance_id', instanceId).eq('active', true).order('name'),
          supabase.from('offer_scope_variants').select('scope_id, variant_id').eq('instance_id', instanceId),
        ]);

        if (scopesRes.error) throw scopesRes.error;
        if (variantsRes.error) throw variantsRes.error;
        if (productsRes.error) throw productsRes.error;
        if (linksRes.error) throw linksRes.error;

        setScopes(scopesRes.data || []);
        setAllVariants(variantsRes.data || []);
        setProducts(productsRes.data || []);
        setScopeVariantLinks(linksRes.data || []);

        if (scopesRes.data?.length) {
          const firstScope = scopesRes.data[0].id;
          setSelectedScope(firstScope);
          
          // Find first variant linked to this scope
          const firstVariant = (linksRes.data || []).find(l => l.scope_id === firstScope);
          if (firstVariant) {
            setSelectedVariant(firstVariant.variant_id);
          }
        }
      } catch (error) {
        console.error('Error fetching data:', error);
        toast.error(t('offerSettings.products.fetchError'));
      } finally {
        setLoading(false);
      }
    };

    const fetchScopeProducts = async () => {
      if (!selectedScope || !selectedVariant) return;

      try {
        const { data, error } = await supabase
          .from('offer_scope_variant_products')
          .select('*')
          .eq('instance_id', instanceId)
          .eq('scope_id', selectedScope)
          .eq('variant_id', selectedVariant)
          .order('sort_order');

        if (error) throw error;
        setScopeProducts((data || []).map(p => ({ ...p, isNew: false, isDeleted: false, isDirty: false })));
      } catch (error) {
        console.error('Error fetching scope products:', error);
      }
    };

    const handleAddProduct = () => {
      if (!selectedScope || !selectedVariant) return;

      const newProduct: ScopeVariantProduct = {
        id: crypto.randomUUID(),
        scope_id: selectedScope,
        variant_id: selectedVariant,
        product_id: null,
        custom_name: t('offerSettings.products.newItem'),
        custom_description: null,
        quantity: 1,
        unit: t('offerSettings.products.defaultUnit'),
        unit_price: 0,
        sort_order: scopeProducts.filter(p => !p.isDeleted).length,
        isNew: true,
        isDirty: true,
      };
      setScopeProducts([...scopeProducts, newProduct]);
      onChange?.();
    };

    const handleUpdateProduct = (id: string, updates: Partial<ScopeVariantProduct>) => {
      setScopeProducts(scopeProducts.map(p => 
        p.id === id ? { ...p, ...updates, isDirty: true } : p
      ));
      onChange?.();
    };

    const handleDeleteProduct = (id: string) => {
      const product = scopeProducts.find(p => p.id === id);
      if (product?.isNew) {
        setScopeProducts(scopeProducts.filter(p => p.id !== id));
      } else {
        setScopeProducts(scopeProducts.map(p => p.id === id ? { ...p, isDeleted: true } : p));
      }
      onChange?.();
    };

    const handleProductSelect = (productId: string, scopeProduct: ScopeVariantProduct) => {
      const product = products.find(p => p.id === productId);
      if (product) {
        handleUpdateProduct(scopeProduct.id, {
          product_id: productId,
          custom_name: product.name,
          unit: product.unit,
          unit_price: product.default_price,
        });
      }
    };

    const formatPrice = (price: number) => {
      return new Intl.NumberFormat('pl-PL', {
        style: 'currency',
        currency: 'PLN',
      }).format(price);
    };

    if (loading) {
      return <div className="text-muted-foreground">{t('common.loading')}</div>;
    }

    if (scopes.length === 0 || allVariants.length === 0) {
      return (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>{t('offerSettings.products.setupRequired')}</p>
          </CardContent>
        </Card>
      );
    }

    const visibleProducts = scopeProducts.filter(p => !p.isDeleted);

    return (
      <div className="space-y-4">
        <div>
          <h3 className="text-lg font-medium">{t('offerSettings.products.title')}</h3>
          <p className="text-sm text-muted-foreground">
            {t('offerSettings.products.description')}
          </p>
        </div>

        <div className="flex gap-4">
          <div className="flex-1">
            <label className="text-sm font-medium mb-2 block">{t('offerSettings.products.service')}</label>
            <Select value={selectedScope || ''} onValueChange={setSelectedScope}>
              <SelectTrigger>
                <SelectValue placeholder={t('offerSettings.products.selectService')} />
              </SelectTrigger>
              <SelectContent>
                {scopes.map((scope) => (
                  <SelectItem key={scope.id} value={scope.id}>
                    {scope.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex-1">
            <label className="text-sm font-medium mb-2 block">{t('offerSettings.products.variant')}</label>
            {availableVariants.length === 0 ? (
              <div className="h-10 px-3 py-2 text-sm text-muted-foreground border rounded-md bg-muted/50 flex items-center">
                {t('offerSettings.products.noVariantsForService')}
              </div>
            ) : (
              <Select value={selectedVariant || ''} onValueChange={setSelectedVariant}>
                <SelectTrigger>
                  <SelectValue placeholder={t('offerSettings.products.selectVariant')} />
                </SelectTrigger>
                <SelectContent>
                  {availableVariants.map((variant) => (
                    <SelectItem key={variant.id} value={variant.id}>
                      {variant.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        </div>

        {selectedScope && selectedVariant && (
          <Card>
            <CardHeader className="py-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">
                  {scopes.find(s => s.id === selectedScope)?.name} - {allVariants.find(v => v.id === selectedVariant)?.name}
                </CardTitle>
                <Button onClick={handleAddProduct} size="sm">
                  <Plus className="h-4 w-4 mr-2" />
                  {t('offerSettings.products.addItem')}
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {visibleProducts.length === 0 ? (
                <div className="text-center text-muted-foreground py-8">
                  {t('offerSettings.products.noProducts')}
                </div>
              ) : (
                <div className="space-y-3">
                  {visibleProducts.map((sp) => (
                    <div 
                      key={sp.id} 
                      className={`flex items-center gap-3 p-3 border rounded-lg ${sp.isDirty ? 'ring-2 ring-primary/20' : ''}`}
                    >
                      <div className="flex-1">
                        <Select
                          value={sp.product_id || 'custom'}
                          onValueChange={(value) => {
                            if (value === 'custom') {
                              handleUpdateProduct(sp.id, { product_id: null });
                            } else {
                              handleProductSelect(value, sp);
                            }
                          }}
                        >
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder={t('offerSettings.products.selectOrCustom')} />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="custom">{t('offerSettings.products.customItem')}</SelectItem>
                            {products.map((product) => (
                              <SelectItem key={product.id} value={product.id}>
                                {product.name} - {formatPrice(product.default_price)}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <Input
                        value={sp.custom_name || ''}
                        onChange={(e) => handleUpdateProduct(sp.id, { custom_name: e.target.value })}
                        placeholder={t('offerSettings.products.name')}
                        className="w-48"
                      />
                      <Input
                        type="number"
                        value={sp.quantity}
                        onChange={(e) => handleUpdateProduct(sp.id, { quantity: parseFloat(e.target.value) || 1 })}
                        className="w-20"
                      />
                      <Input
                        value={sp.unit}
                        onChange={(e) => handleUpdateProduct(sp.id, { unit: e.target.value })}
                        className="w-16"
                      />
                      <Input
                        type="number"
                        value={sp.unit_price}
                        onChange={(e) => handleUpdateProduct(sp.id, { unit_price: parseFloat(e.target.value) || 0 })}
                        className="w-28"
                      />
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteProduct(sp.id)}
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    );
  }
);

OfferScopeProductsSettings.displayName = 'OfferScopeProductsSettings';
