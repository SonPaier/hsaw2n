import { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { 
  User, 
  Building2, 
  Car, 
  FileText, 
  Calculator,
  ChevronDown,
  Plus,
  X,
} from 'lucide-react';
import { ScopeProductSelectionDrawer } from './services/ScopeProductSelectionDrawer';
import { CustomerData, VehicleData, OfferState, OfferItem } from '@/hooks/useOffer';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';

interface ScopeData {
  id: string;
  name: string;
  short_name: string | null;
  is_extras_scope: boolean;
}

interface ScopeProduct {
  id: string;
  product_id: string;
  variant_name: string | null;
  is_default: boolean;
  product: {
    id: string;
    name: string;
    default_price: number;
  } | null;
}

interface ServiceState {
  scopeId: string;
  name: string;
  shortName: string | null;
  isExtrasScope: boolean;
  availableProducts: ScopeProduct[];
  selectedProducts: SelectedProduct[];
  totalPrice: number;
}

interface SelectedProduct {
  id: string; // unique ID for this selection
  scopeProductId: string;
  productId: string;
  variantName: string | null;
  productName: string;
  price: number;
  isDefault: boolean;
}

interface SummaryStepV2Props {
  instanceId: string;
  offer: OfferState;
  showUnitPrices: boolean;
  onUpdateOffer: (data: Partial<OfferState>) => void;
  calculateTotalNet: () => number;
  calculateTotalGross: () => number;
  onShowPreview?: () => void;
}

interface OfferTemplate {
  id: string;
  name: string;
  payment_terms: string | null;
  notes: string | null;
}

const paintTypeLabels: Record<string, string> = {
  matte: 'Mat',
  dark: 'Ciemny',
  other: 'Inny',
};

const getPaintTypeLabel = (type: string) => paintTypeLabels[type] || type;

export const SummaryStepV2 = ({
  instanceId,
  offer,
  showUnitPrices,
  onUpdateOffer,
  calculateTotalNet,
  calculateTotalGross,
  onShowPreview,
}: SummaryStepV2Props) => {
  const { t } = useTranslation();
  const [templates, setTemplates] = useState<OfferTemplate[]>([]);
  const [conditionsOpen, setConditionsOpen] = useState(true);
  const [services, setServices] = useState<ServiceState[]>([]);
  const [loading, setLoading] = useState(true);
  const [productDrawerOpen, setProductDrawerOpen] = useState<string | null>(null); // scopeId
  const [editingPrice, setEditingPrice] = useState<{ scopeId: string; productId: string; value: string } | null>(null);

  // Load scope data and products for selected scopes
  useEffect(() => {
    const fetchData = async () => {
      if (offer.selectedScopeIds.length === 0) {
        setServices([]);
        setLoading(false);
        return;
      }

      setLoading(true);

      // Fetch scopes with default conditions
      const { data: scopesData } = await supabase
        .from('offer_scopes')
        .select('id, name, short_name, is_extras_scope, default_warranty, default_payment_terms, default_notes, default_service_info')
        .in('id', offer.selectedScopeIds)
        .order('sort_order');

      if (!scopesData) {
        setLoading(false);
        return;
      }

      // Fetch products for each scope
      const { data: scopeProductsData } = await supabase
        .from('offer_scope_products')
        .select(`
          id,
          scope_id,
          product_id,
          variant_name,
          is_default,
          sort_order,
          product:products_library(id, name, default_price)
        `)
        .in('scope_id', offer.selectedScopeIds)
        .order('sort_order');

      // Build services state
      const newServices: ServiceState[] = scopesData.map(scope => {
        const scopeProducts = (scopeProductsData || [])
          .filter(p => p.scope_id === scope.id)
          .map(p => ({
            id: p.id,
            product_id: p.product_id,
            variant_name: p.variant_name,
            is_default: p.is_default,
            product: p.product as { id: string; name: string; default_price: number } | null
          }));

        // Initialize with default products
        const defaultProducts = scopeProducts
          .filter(p => p.is_default && p.product)
          .map(p => ({
            id: crypto.randomUUID(),
            scopeProductId: p.id,
            productId: p.product_id,
            variantName: p.variant_name,
            productName: p.product!.name,
            price: p.product!.default_price,
            isDefault: p.is_default
          }));

        const totalPrice = defaultProducts.reduce((sum, p) => sum + p.price, 0);

        return {
          scopeId: scope.id,
          name: scope.name,
          shortName: scope.short_name,
          isExtrasScope: scope.is_extras_scope,
          availableProducts: scopeProducts,
          selectedProducts: defaultProducts,
          totalPrice
        };
      });

      setServices(newServices);

      // Combine default conditions from all scopes with headers
      // Only populate if the offer fields are empty (first load)
      const combineWithHeaders = (
        field: 'default_warranty' | 'default_payment_terms' | 'default_notes' | 'default_service_info'
      ): string => {
        const parts: string[] = [];
        scopesData.forEach(scope => {
          const value = scope[field];
          if (value && value.trim()) {
            if (scopesData.length > 1) {
              parts.push(`${scope.name}:\n${value}`);
            } else {
              parts.push(value);
            }
          }
        });
        return parts.join('\n\n');
      };

      // Only set defaults if fields are empty
      const updates: Partial<OfferState> = {};
      if (!offer.warranty) {
        const combined = combineWithHeaders('default_warranty');
        if (combined) updates.warranty = combined;
      }
      if (!offer.paymentTerms) {
        const combined = combineWithHeaders('default_payment_terms');
        if (combined) updates.paymentTerms = combined;
      }
      if (!offer.notes) {
        const combined = combineWithHeaders('default_notes');
        if (combined) updates.notes = combined;
      }
      if (!offer.serviceInfo) {
        const combined = combineWithHeaders('default_service_info');
        if (combined) updates.serviceInfo = combined;
      }
      
      if (Object.keys(updates).length > 0) {
        onUpdateOffer(updates);
      }

      // Fetch templates
      const { data: templatesData } = await supabase
        .from('text_blocks_library')
        .select('*')
        .eq('active', true)
        .eq('block_type', 'offer_template')
        .or(`instance_id.eq.${instanceId},source.eq.global`)
        .order('sort_order');
      
      if (templatesData) {
        setTemplates(templatesData.map(t => ({
          id: t.id,
          name: t.name,
          payment_terms: t.content.split('|||')[0] || null,
          notes: t.content.split('|||')[1] || null,
        })));
      }

      setLoading(false);
    };

    fetchData();
  }, [instanceId, offer.selectedScopeIds]);

  // Add product to service
  const addProduct = (scopeId: string, scopeProduct: ScopeProduct) => {
    if (!scopeProduct.product) return;

    setServices(prev => prev.map(service => {
      if (service.scopeId !== scopeId) return service;

      const newProduct: SelectedProduct = {
        id: crypto.randomUUID(),
        scopeProductId: scopeProduct.id,
        productId: scopeProduct.product_id,
        variantName: scopeProduct.variant_name,
        productName: scopeProduct.product!.name,
        price: scopeProduct.product!.default_price,
        isDefault: scopeProduct.is_default
      };

      const newSelectedProducts = [...service.selectedProducts, newProduct];
      const totalPrice = newSelectedProducts.reduce((sum, p) => sum + p.price, 0);

      return {
        ...service,
        selectedProducts: newSelectedProducts,
        totalPrice
      };
    }));
  };

  // Remove product from service
  const removeProduct = (scopeId: string, productId: string) => {
    setServices(prev => prev.map(service => {
      if (service.scopeId !== scopeId) return service;

      const newSelectedProducts = service.selectedProducts.filter(p => p.id !== productId);
      const totalPrice = newSelectedProducts.reduce((sum, p) => sum + p.price, 0);

      return {
        ...service,
        selectedProducts: newSelectedProducts,
        totalPrice
      };
    }));
  };

  // Update product price
  const updateProductPrice = (scopeId: string, productId: string, newPrice: number) => {
    setServices(prev => prev.map(service => {
      if (service.scopeId !== scopeId) return service;

      const newSelectedProducts = service.selectedProducts.map(p => 
        p.id === productId ? { ...p, price: newPrice } : p
      );
      const totalPrice = newSelectedProducts.reduce((sum, p) => sum + p.price, 0);

      return {
        ...service,
        selectedProducts: newSelectedProducts,
        totalPrice
      };
    }));
  };

  // Get available products that are not yet added
  const getAvailableProducts = (service: ServiceState) => {
    const addedProductIds = new Set(service.selectedProducts.map(p => p.scopeProductId));
    return service.availableProducts.filter(p => !addedProductIds.has(p.id));
  };

  const formatPrice = (value: number) => {
    return new Intl.NumberFormat('pl-PL', {
      style: 'currency',
      currency: 'PLN',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(Math.round(value));
  };

  const handleApplyTemplate = (template: OfferTemplate) => {
    onUpdateOffer({
      paymentTerms: template.payment_terms || offer.paymentTerms,
      notes: template.notes || offer.notes,
    });
  };

  // Calculate totals from services
  const totalNet = useMemo(() => {
    return services.reduce((sum, s) => sum + s.totalPrice, 0);
  }, [services]);

  const totalGross = useMemo(() => {
    return totalNet * (1 + offer.vatRate / 100);
  }, [totalNet, offer.vatRate]);

  const vatAmount = totalGross - totalNet;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Customer & Vehicle Summary */}
      <Card>
        <CardContent className="pt-6 space-y-6">
          {/* Customer Section */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 font-semibold">
              <User className="w-4 h-4 text-primary" />
              Klient
            </div>
            <div className="text-sm space-y-1 pl-6">
              <p className="font-medium">{offer.customerData.name || '—'}</p>
              <p className="text-muted-foreground">{offer.customerData.email || '—'}</p>
              {offer.customerData.phone && (
                <p className="text-muted-foreground">{offer.customerData.phone}</p>
              )}
            </div>
          </div>
          
          {/* Company Section */}
          {offer.customerData.company && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 font-semibold">
                <Building2 className="w-4 h-4 text-primary" />
                Firma
              </div>
              <div className="text-sm space-y-1 pl-6">
                <p className="font-medium">{offer.customerData.company}</p>
                {offer.customerData.nip && (
                  <p className="text-muted-foreground">NIP: {offer.customerData.nip}</p>
                )}
              </div>
            </div>
          )}

          {/* Vehicle Section */}
          {offer.vehicleData.brandModel && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 font-semibold">
                <Car className="w-4 h-4 text-primary" />
                Pojazd
              </div>
              <div className="text-sm space-y-1 pl-6">
                <p className="font-medium">{offer.vehicleData.brandModel}</p>
                {(offer.vehicleData.paintColor || offer.vehicleData.paintType) && (
                  <p className="text-muted-foreground">
                    {offer.vehicleData.paintColor}
                    {offer.vehicleData.paintColor && offer.vehicleData.paintType && ' • '}
                    {offer.vehicleData.paintType && getPaintTypeLabel(offer.vehicleData.paintType)}
                  </p>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Services */}
      {services.map((service) => (
        <Card key={service.scopeId} className="p-5">
          {/* Service header */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-primary" />
              <h3 className="font-bold text-lg">{service.name}</h3>
              {service.isExtrasScope && (
                <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded">
                  Dodatki
                </span>
              )}
            </div>
            {service.isExtrasScope && (
              <div className="text-right">
                <p className="font-semibold text-lg">{formatPrice(service.totalPrice)}</p>
                <p className="text-xs text-muted-foreground">netto</p>
              </div>
            )}
          </div>
          
          {/* Selected Products */}
          <div className="space-y-2">
            {service.selectedProducts.map((product) => (
              <div
                key={product.id}
                className="flex items-center justify-between py-2 px-3 bg-muted/30 rounded-lg group"
              >
                <div className="flex-1">
                  {product.variantName && (
                    <p className="text-xs text-muted-foreground font-medium uppercase">
                      {product.variantName}
                    </p>
                  )}
                  <p className="font-medium">{product.productName}</p>
                </div>
                <div className="flex items-center gap-2">
                  {editingPrice?.scopeId === service.scopeId && editingPrice?.productId === product.id ? (
                    <div className="flex items-center gap-1">
                      <Input
                        type="number"
                        value={editingPrice.value}
                        onChange={(e) => setEditingPrice({ ...editingPrice, value: e.target.value })}
                        className="w-24 h-8 text-right"
                        autoFocus
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            updateProductPrice(service.scopeId, product.id, parseFloat(editingPrice.value) || 0);
                            setEditingPrice(null);
                          }
                          if (e.key === 'Escape') setEditingPrice(null);
                        }}
                        onBlur={() => {
                          updateProductPrice(service.scopeId, product.id, parseFloat(editingPrice.value) || 0);
                          setEditingPrice(null);
                        }}
                      />
                      <span className="text-xs text-muted-foreground">zł</span>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setEditingPrice({ 
                        scopeId: service.scopeId, 
                        productId: product.id, 
                        value: String(product.price) 
                      })}
                      className="font-semibold hover:bg-muted rounded px-2 py-1 transition-colors"
                      title="Kliknij aby edytować"
                    >
                      {formatPrice(product.price)}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => removeProduct(service.scopeId, product.id)}
                    className="p-1 text-muted-foreground hover:text-destructive transition-colors opacity-0 group-hover:opacity-100"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Add Product Button */}
          {getAvailableProducts(service).length > 0 && (
            <div className="mt-3">
              <Button
                type="button"
                variant="outline"
                className="w-full bg-white"
                onClick={() => setProductDrawerOpen(service.scopeId)}
              >
                <Plus className="w-4 h-4 mr-2" />
                Dodaj produkt
              </Button>
            </div>
          )}

          {/* Product Selection Drawer */}
          <ScopeProductSelectionDrawer
            open={productDrawerOpen === service.scopeId}
            onClose={() => setProductDrawerOpen(null)}
            availableProducts={service.availableProducts
              .filter(p => p.product)
              .map(p => ({
                id: p.id,
                productId: p.product_id,
                productName: p.product?.name || '',
                variantName: p.variant_name,
                price: p.product?.default_price || 0
              }))}
            alreadySelectedIds={service.selectedProducts.map(p => p.scopeProductId)}
            onConfirm={(products) => {
              products.forEach(product => {
                const scopeProduct = service.availableProducts.find(p => p.id === product.id);
                if (scopeProduct) {
                  addProduct(service.scopeId, scopeProduct);
                }
              });
            }}
          />
        </Card>
      ))}

      {/* Totals */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-2 mb-4 font-semibold">
            <Calculator className="w-4 h-4 text-primary" />
            Podsumowanie
          </div>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span>Suma netto</span>
              <span className="font-semibold">{formatPrice(totalNet)}</span>
            </div>
            <div className="flex justify-between text-muted-foreground">
              <span>VAT ({offer.vatRate}%)</span>
              <span>{formatPrice(vatAmount)}</span>
            </div>
            <Separator />
            <div className="flex justify-between text-lg font-bold">
              <span>Suma brutto</span>
              <span className="text-primary">{formatPrice(totalGross)}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Additional Conditions */}
      <Collapsible open={conditionsOpen} onOpenChange={setConditionsOpen}>
        <Card>
          <CollapsibleTrigger className="w-full p-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 font-semibold">
                <FileText className="w-4 h-4 text-primary" />
                Dodatkowe warunki
              </div>
              <ChevronDown className={cn(
                "w-4 h-4 text-muted-foreground transition-transform",
                conditionsOpen && "rotate-180"
              )} />
            </div>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="pt-0 space-y-4">
              {/* Templates */}
              {templates.length > 0 && (
                <div className="space-y-2">
                  <Label>Załaduj szablon</Label>
                  <Select onValueChange={(id) => {
                    const template = templates.find(t => t.id === id);
                    if (template) handleApplyTemplate(template);
                  }}>
                    <SelectTrigger className="bg-white">
                      <SelectValue placeholder="Wybierz szablon..." />
                    </SelectTrigger>
                    <SelectContent className="bg-white">
                      {templates.map(template => (
                        <SelectItem key={template.id} value={template.id}>
                          {template.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Valid until */}
              <div className="space-y-2">
                <Label htmlFor="validUntil">Oferta ważna do</Label>
                <Input
                  id="validUntil"
                  type="date"
                  value={offer.validUntil || ''}
                  onChange={(e) => onUpdateOffer({ validUntil: e.target.value })}
                  className="bg-white"
                />
              </div>

              {/* Warranty */}
              <div className="space-y-2">
                <Label htmlFor="warranty">Gwarancja</Label>
                <Textarea
                  id="warranty"
                  value={offer.warranty || ''}
                  onChange={(e) => onUpdateOffer({ warranty: e.target.value })}
                  placeholder="Warunki gwarancji..."
                  rows={3}
                  className="bg-white"
                />
              </div>

              {/* Payment terms */}
              <div className="space-y-2">
                <Label htmlFor="paymentTerms">Warunki płatności</Label>
                <Textarea
                  id="paymentTerms"
                  value={offer.paymentTerms || ''}
                  onChange={(e) => onUpdateOffer({ paymentTerms: e.target.value })}
                  placeholder="Np. 50% zaliczki, reszta przy odbiorze..."
                  rows={3}
                  className="bg-white"
                />
              </div>

              {/* Service Info */}
              <div className="space-y-2">
                <Label htmlFor="serviceInfo">Informacje o serwisie</Label>
                <Textarea
                  id="serviceInfo"
                  value={offer.serviceInfo || ''}
                  onChange={(e) => onUpdateOffer({ serviceInfo: e.target.value })}
                  placeholder="Czas realizacji, sposób przygotowania..."
                  rows={3}
                  className="bg-white"
                />
              </div>

              {/* Notes */}
              <div className="space-y-2">
                <Label htmlFor="notes">Uwagi</Label>
                <Textarea
                  id="notes"
                  value={offer.notes || ''}
                  onChange={(e) => onUpdateOffer({ notes: e.target.value })}
                  placeholder="Dodatkowe uwagi do oferty..."
                  rows={3}
                  className="bg-white"
                />
              </div>
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>
    </div>
  );
};
