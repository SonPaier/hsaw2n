import { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet-async';
import { ArrowLeft, Package, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { OfferProductSelectionDrawer } from './OfferProductSelectionDrawer';

interface Product {
  id: string;
  name: string;
  default_price: number;
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
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([]);
  const [selectedProducts, setSelectedProducts] = useState<Product[]>([]);
  const [isProductDrawerOpen, setIsProductDrawerOpen] = useState(false);

  // Fetch product details when selected IDs change
  useEffect(() => {
    const fetchProducts = async () => {
      if (selectedProductIds.length === 0) {
        setSelectedProducts([]);
        return;
      }

      const { data } = await supabase
        .from('products_library')
        .select('id, name, default_price')
        .in('id', selectedProductIds);

      if (data) {
        // Maintain order based on selectedProductIds
        const orderedProducts = selectedProductIds
          .map(id => data.find(p => p.id === id))
          .filter((p): p is Product => p !== undefined);
        setSelectedProducts(orderedProducts);
      }
    };

    fetchProducts();
  }, [selectedProductIds]);

  const handleProductConfirm = (productIds: string[]) => {
    setSelectedProductIds(productIds);
  };

  const removeProduct = (productId: string) => {
    setSelectedProductIds(prev => prev.filter(id => id !== productId));
  };

  const formatPrice = (price: number): string => {
    return `${price.toFixed(0)} zł`;
  };

  return (
    <>
      <Helmet>
        <title>{isEditMode ? 'Edytuj usługę' : 'Nowa usługa'} - {t('common.adminPanel')}</title>
      </Helmet>
      <div className="max-w-4xl mx-auto">
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
            <Label>Wybierz produkty</Label>
            <Button 
              variant="outline" 
              onClick={() => setIsProductDrawerOpen(true)}
              className="gap-2"
            >
              <Package className="w-4 h-4" />
              Wybierz produkty
              {selectedProductIds.length > 0 && (
                <Badge variant="secondary" className="ml-2">
                  {selectedProductIds.length}
                </Badge>
              )}
            </Button>
            
            {/* Lista wybranych produktów */}
            {selectedProducts.length > 0 && (
              <div className="space-y-2 mt-3">
                {selectedProducts.map(product => (
                  <div 
                    key={product.id}
                    className="flex items-center justify-between p-3 bg-white border rounded-lg"
                  >
                    <div className="flex-1">
                      <p className="font-medium">{product.name}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-semibold text-foreground">
                        {formatPrice(product.default_price)}
                      </span>
                      <button
                        type="button"
                        onClick={() => removeProduct(product.id)}
                        className="p-1 text-muted-foreground hover:text-destructive transition-colors"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {isEditMode && (
            <p className="text-sm text-muted-foreground">ID: {scopeId}</p>
          )}
        </div>
      </div>

      <OfferProductSelectionDrawer
        open={isProductDrawerOpen}
        onClose={() => setIsProductDrawerOpen(false)}
        instanceId={instanceId}
        selectedProductIds={selectedProductIds}
        onConfirm={handleProductConfirm}
      />
    </>
  );
}
