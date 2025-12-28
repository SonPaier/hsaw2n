import { useState, useEffect } from 'react';
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
}

interface Product {
  id: string;
  name: string;
  default_price: number;
  unit: string;
}

interface OfferScopeProductsSettingsProps {
  instanceId: string;
}

export function OfferScopeProductsSettings({ instanceId }: OfferScopeProductsSettingsProps) {
  const [scopes, setScopes] = useState<OfferScope[]>([]);
  const [variants, setVariants] = useState<OfferVariant[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [scopeProducts, setScopeProducts] = useState<ScopeVariantProduct[]>([]);
  const [selectedScope, setSelectedScope] = useState<string | null>(null);
  const [selectedVariant, setSelectedVariant] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, [instanceId]);

  useEffect(() => {
    if (selectedScope && selectedVariant) {
      fetchScopeProducts();
    }
  }, [selectedScope, selectedVariant]);

  const fetchData = async () => {
    try {
      const [scopesRes, variantsRes, productsRes] = await Promise.all([
        supabase.from('offer_scopes').select('id, name').eq('instance_id', instanceId).eq('active', true).order('sort_order'),
        supabase.from('offer_variants').select('id, name').eq('instance_id', instanceId).eq('active', true).order('sort_order'),
        supabase.from('products_library').select('id, name, default_price, unit').eq('instance_id', instanceId).eq('active', true).order('name'),
      ]);

      if (scopesRes.error) throw scopesRes.error;
      if (variantsRes.error) throw variantsRes.error;
      if (productsRes.error) throw productsRes.error;

      setScopes(scopesRes.data || []);
      setVariants(variantsRes.data || []);
      setProducts(productsRes.data || []);

      if (scopesRes.data?.length) setSelectedScope(scopesRes.data[0].id);
      if (variantsRes.data?.length) setSelectedVariant(variantsRes.data[0].id);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Błąd podczas pobierania danych');
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
      setScopeProducts(data || []);
    } catch (error) {
      console.error('Error fetching scope products:', error);
    }
  };

  const handleAddProduct = async () => {
    if (!selectedScope || !selectedVariant) return;

    const newProduct: Partial<ScopeVariantProduct> = {
      scope_id: selectedScope,
      variant_id: selectedVariant,
      custom_name: 'Nowa pozycja',
      quantity: 1,
      unit: 'szt',
      unit_price: 0,
      sort_order: scopeProducts.length,
    };

    try {
      const { data, error } = await supabase
        .from('offer_scope_variant_products')
        .insert({
          instance_id: instanceId,
          scope_id: selectedScope,
          variant_id: selectedVariant,
          custom_name: 'Nowa pozycja',
          quantity: 1,
          unit: 'szt',
          unit_price: 0,
          sort_order: scopeProducts.length,
        })
        .select()
        .single();

      if (error) throw error;
      setScopeProducts([...scopeProducts, data]);
      toast.success('Dodano pozycję');
    } catch (error) {
      console.error('Error adding product:', error);
      toast.error('Błąd podczas dodawania');
    }
  };

  const handleUpdateProduct = async (id: string, updates: Partial<ScopeVariantProduct>) => {
    setScopeProducts(scopeProducts.map(p => p.id === id ? { ...p, ...updates } : p));
  };

  const handleSaveProduct = async (product: ScopeVariantProduct) => {
    try {
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
    } catch (error) {
      console.error('Error updating product:', error);
      toast.error('Błąd podczas zapisywania');
    }
  };

  const handleDeleteProduct = async (id: string) => {
    try {
      const { error } = await supabase
        .from('offer_scope_variant_products')
        .delete()
        .eq('id', id);

      if (error) throw error;
      setScopeProducts(scopeProducts.filter(p => p.id !== id));
      toast.success('Usunięto pozycję');
    } catch (error) {
      console.error('Error deleting product:', error);
      toast.error('Błąd podczas usuwania');
    }
  };

  const handleProductSelect = (productId: string, scopeProduct: ScopeVariantProduct) => {
    const product = products.find(p => p.id === productId);
    if (product) {
      const updates = {
        product_id: productId,
        custom_name: product.name,
        unit: product.unit,
        unit_price: product.default_price,
      };
      handleUpdateProduct(scopeProduct.id, updates);
      handleSaveProduct({ ...scopeProduct, ...updates });
    }
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('pl-PL', {
      style: 'currency',
      currency: 'PLN',
    }).format(price);
  };

  if (loading) {
    return <div className="text-muted-foreground">Ładowanie...</div>;
  }

  if (scopes.length === 0 || variants.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>Najpierw zdefiniuj zakresy i warianty w odpowiednich zakładkach.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-medium">Produkty dla zakresów</h3>
        <p className="text-sm text-muted-foreground">
          Przypisz produkty do kombinacji zakres × wariant
        </p>
      </div>

      <div className="flex gap-4">
        <div className="flex-1">
          <label className="text-sm font-medium mb-2 block">Zakres</label>
          <Select value={selectedScope || ''} onValueChange={setSelectedScope}>
            <SelectTrigger>
              <SelectValue placeholder="Wybierz zakres" />
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
          <label className="text-sm font-medium mb-2 block">Wariant</label>
          <Select value={selectedVariant || ''} onValueChange={setSelectedVariant}>
            <SelectTrigger>
              <SelectValue placeholder="Wybierz wariant" />
            </SelectTrigger>
            <SelectContent>
              {variants.map((variant) => (
                <SelectItem key={variant.id} value={variant.id}>
                  {variant.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {selectedScope && selectedVariant && (
        <Card>
          <CardHeader className="py-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">
                {scopes.find(s => s.id === selectedScope)?.name} - {variants.find(v => v.id === selectedVariant)?.name}
              </CardTitle>
              <Button onClick={handleAddProduct} size="sm">
                <Plus className="h-4 w-4 mr-2" />
                Dodaj pozycję
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {scopeProducts.length === 0 ? (
              <div className="text-center text-muted-foreground py-8">
                Brak produktów dla tej kombinacji. Dodaj pierwszą pozycję.
              </div>
            ) : (
              <div className="space-y-3">
                {scopeProducts.map((sp) => (
                  <div key={sp.id} className="flex items-center gap-3 p-3 border rounded-lg">
                    <div className="flex-1">
                      <Select
                        value={sp.product_id || 'custom'}
                        onValueChange={(value) => {
                          if (value === 'custom') {
                            handleUpdateProduct(sp.id, { product_id: null });
                            handleSaveProduct({ ...sp, product_id: null });
                          } else {
                            handleProductSelect(value, sp);
                          }
                        }}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Wybierz produkt lub wpisz własny" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="custom">Własna pozycja</SelectItem>
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
                      onBlur={() => handleSaveProduct(sp)}
                      placeholder="Nazwa"
                      className="w-48"
                    />
                    <Input
                      type="number"
                      value={sp.quantity}
                      onChange={(e) => handleUpdateProduct(sp.id, { quantity: parseFloat(e.target.value) || 1 })}
                      onBlur={() => handleSaveProduct(sp)}
                      className="w-20"
                    />
                    <Input
                      value={sp.unit}
                      onChange={(e) => handleUpdateProduct(sp.id, { unit: e.target.value })}
                      onBlur={() => handleSaveProduct(sp)}
                      className="w-16"
                    />
                    <Input
                      type="number"
                      value={sp.unit_price}
                      onChange={(e) => handleUpdateProduct(sp.id, { unit_price: parseFloat(e.target.value) || 0 })}
                      onBlur={() => handleSaveProduct(sp)}
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
