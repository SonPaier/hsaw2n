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
  Trash2,
} from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { ScopeProductSelectionDrawer } from './services/ScopeProductSelectionDrawer';
import { CustomerData, VehicleData, OfferState, OfferItem, OfferOption, DefaultSelectedState } from '@/hooks/useOffer';
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
    short_name: string | null;
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
  productShortName: string | null;
  price: number;
  isDefault: boolean;
  isPreselected: boolean; // Admin can preselect for customer
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
  const [conditionsOpen, setConditionsOpen] = useState(true);
  const [services, setServices] = useState<ServiceState[]>([]);
  const [loading, setLoading] = useState(true);
  const [productDrawerOpen, setProductDrawerOpen] = useState<string | null>(null); // scopeId
  const [editingPrice, setEditingPrice] = useState<{ scopeId: string; productId: string; value: string } | null>(null);

  // Load scope data and products for selected scopes + always include extras scopes
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);

      // First, fetch all extras scopes for this instance (always shown)
      const { data: extrasScopes } = await supabase
        .from('offer_scopes')
        .select('id')
        .eq('instance_id', instanceId)
        .eq('active', true)
        .eq('is_extras_scope', true);

      const extrasScopeIds = (extrasScopes || []).map(s => s.id);
      
      // Combine selected scopes with extras scopes
      const allScopeIds = [...new Set([...offer.selectedScopeIds, ...extrasScopeIds])];

      if (allScopeIds.length === 0) {
        setServices([]);
        setLoading(false);
        return;
      }

      // Fetch scopes with default conditions
      const { data: scopesData } = await supabase
        .from('offer_scopes')
        .select('id, name, short_name, is_extras_scope, default_warranty, default_payment_terms, default_notes, default_service_info')
        .in('id', allScopeIds)
        .order('sort_order');

      if (!scopesData) {
        setLoading(false);
        return;
      }

      // Fetch products for all scopes (selected + extras)
      const { data: scopeProductsData } = await supabase
        .from('offer_scope_products')
        .select(`
          id,
          scope_id,
          product_id,
          variant_name,
          is_default,
          sort_order,
          product:products_library(id, name, short_name, default_price)
        `)
        .in('scope_id', allScopeIds)
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
            product: p.product as { id: string; name: string; short_name: string | null; default_price: number } | null
          }));

        // Check if we have saved options for this scope - restore them
        const existingOption = offer.options.find(opt => opt.scopeId === scope.id);

        let selectedProducts: SelectedProduct[];

        // Helper: build defaults
        const buildDefaultSelected = (): SelectedProduct[] => {
          return scopeProducts
            .filter(p => p.is_default && p.product)
            .map(p => ({
              id: p.id, // Use stable ID
              scopeProductId: p.id,
              productId: p.product_id,
              variantName: p.variant_name,
              productName: p.product!.name,
              productShortName: p.product!.short_name,
              price: p.product!.default_price,
              isDefault: p.is_default,
              isPreselected: false, // Admin must manually preselect
            }));
        };

        if (existingOption && existingOption.items.length > 0) {
          // If option.id !== scopeId, it's the older auto-generated "full catalog" structure.
          // For step 3 we want the old behavior: start only with defaults.
          const isLegacyAutoCatalog = existingOption.id !== scope.id;
          if (isLegacyAutoCatalog) {
            selectedProducts = buildDefaultSelected();
          } else {
            // Restore from saved option items (new step-3-driven structure)
            const restored = existingOption.items.map(item => {
              // Find matching scope product - parse name from customName (format: "VARIANT\nProductName" or just "ProductName")
              const nameParts = (item.customName || '').split('\n');
              const productNameFromItem = nameParts.length > 1 ? nameParts[nameParts.length - 1] : item.customName;
              const variantFromItem = nameParts.length > 1 ? nameParts[0] : null;

              const matchingProduct = scopeProducts.find(sp =>
                sp.product_id === item.productId ||
                (sp.product?.name === productNameFromItem && sp.variant_name === variantFromItem)
              );

              return {
                id: item.id,
                scopeProductId: matchingProduct?.id || '',
                productId: item.productId || matchingProduct?.product_id || '',
                variantName: variantFromItem || matchingProduct?.variant_name || null,
                productName: productNameFromItem || matchingProduct?.product?.name || '',
                productShortName: matchingProduct?.product?.short_name || null,
                price: item.unitPrice,
                isDefault: matchingProduct?.is_default || false,
                isPreselected: !item.isOptional, // Restore preselect state
              };
            }).filter(p => p.productId && p.scopeProductId);

            // Guard: some legacy/auto-generated offers may store ALL products as "selected".
            // In such case we fall back to defaults (behavior "jak wcześniej").
            const availableCount = scopeProducts.filter(p => p.product).length;
            const looksLikeFullCatalog = restored.length >= availableCount && availableCount > 0;

            selectedProducts = looksLikeFullCatalog ? buildDefaultSelected() : restored;
          }
        } else {
          // Initialize with default products
          selectedProducts = buildDefaultSelected();
        }

        const totalPrice = selectedProducts.reduce((sum, p) => sum + p.price, 0);

        return {
          scopeId: scope.id,
          name: scope.name,
          shortName: scope.short_name,
          isExtrasScope: scope.is_extras_scope,
          availableProducts: scopeProducts,
          selectedProducts,
          totalPrice
        };
      });

      // Sort services: extras scope always last
      const sortedServices = newServices.sort((a, b) => {
        if (a.isExtrasScope && !b.isExtrasScope) return 1;
        if (!a.isExtrasScope && b.isExtrasScope) return -1;
        return 0;
      });

      setServices(sortedServices);

      // Combine default conditions from all scopes with headers
      // If all scopes have the same value, use it only once without headers
      const combineWithHeaders = (
        field: 'default_warranty' | 'default_payment_terms' | 'default_notes' | 'default_service_info'
      ): string => {
        // Get all non-empty values
        const scopeValues = scopesData
          .map(scope => ({ name: scope.name, value: (scope[field] || '').trim() }))
          .filter(sv => sv.value);
        
        if (scopeValues.length === 0) return '';
        
        // Check if all values are the same
        const uniqueValues = new Set(scopeValues.map(sv => sv.value));
        
        if (uniqueValues.size === 1) {
          // All values are identical - use just the value without header
          return scopeValues[0].value;
        }
        
        // Values differ - include headers
        const parts: string[] = [];
        scopeValues.forEach(sv => {
          parts.push(`${sv.name}:\n${sv.value}`);
        });
        return parts.join('\n\n');
      };

      // Always update conditions based on selected scopes (regenerate on scope change)
      const updates: Partial<OfferState> = {
        warranty: combineWithHeaders('default_warranty'),
        paymentTerms: combineWithHeaders('default_payment_terms'),
        notes: combineWithHeaders('default_notes'),
        serviceInfo: combineWithHeaders('default_service_info'),
      };
      
      onUpdateOffer(updates);


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
        productShortName: scopeProduct.product!.short_name,
        price: scopeProduct.product!.default_price,
        isDefault: scopeProduct.is_default,
        isPreselected: false, // New products added manually are not preselected by default
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

  // Toggle product preselection
  const togglePreselect = (scopeId: string, productId: string) => {
    setServices(prev => prev.map(service => {
      if (service.scopeId !== scopeId) return service;

      const newSelectedProducts = service.selectedProducts.map(p => 
        p.id === productId ? { ...p, isPreselected: !p.isPreselected } : p
      );

      return {
        ...service,
        selectedProducts: newSelectedProducts,
      };
    }));
  };

  // Calculate textarea rows based on content
  const getTextareaRows = (value: string | undefined | null, minRows: number = 3): number => {
    if (!value) return minRows;
    const lineCount = value.split('\n').length;
    return Math.max(lineCount + 1, minRows);
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


  // Calculate totals from services - only count preselected items
  const totalNet = useMemo(() => {
    return services.reduce((sum, s) => {
      const preselectedTotal = s.selectedProducts
        .filter(p => p.isPreselected)
        .reduce((pSum, p) => pSum + p.price, 0);
      return sum + preselectedTotal;
    }, 0);
  }, [services]);

  const totalGross = useMemo(() => {
    return totalNet * (1 + offer.vatRate / 100);
  }, [totalNet, offer.vatRate]);

  const vatAmount = totalGross - totalNet;

  // Sync services to offer.options and defaultSelectedState whenever services change (but not on initial load)
  useEffect(() => {
    if (loading || services.length === 0) return;
    
    // Convert services to offer options format
    const newOptions: OfferOption[] = services.map((service, idx) => ({
      id: service.scopeId, // Use scopeId as option id for stability
      name: service.name,
      description: '',
      items: service.selectedProducts.map(p => ({
        id: p.id,
        productId: p.productId,
        customName: p.variantName 
          ? `${p.variantName}\n${p.productName}`
          : p.productName,
        customDescription: '',
        quantity: 1,
        unitPrice: p.price,
        unit: 'szt',
        discountPercent: 0,
        isOptional: !p.isPreselected, // isOptional = NOT preselected (for customer view)
        isCustom: false,
      })),
      isSelected: true,
      sortOrder: idx,
      scopeId: service.scopeId,
      isUpsell: service.isExtrasScope,
    }));
    
    // Build defaultSelectedState for public view
    // For extras scope: selectedOptionalItems maps itemId -> true for preselected items
    // For regular scopes: selectedItemInOption maps optionId -> itemId for preselected item
    const selectedOptionalItems: Record<string, boolean> = {};
    const selectedItemInOption: Record<string, string> = {};
    
    services.forEach(service => {
      if (service.isExtrasScope) {
        // For extras: mark all preselected items
        service.selectedProducts.forEach(p => {
          if (p.isPreselected) {
            selectedOptionalItems[p.id] = true;
          }
        });
      } else {
        // For regular services: set the first preselected item as selected
        const firstPreselected = service.selectedProducts.find(p => p.isPreselected);
        if (firstPreselected) {
          selectedItemInOption[service.scopeId] = firstPreselected.id;
        }
      }
    });
    
    // Find the first non-extras scope as selected scope
    const selectedScopeId = services.find(s => !s.isExtrasScope)?.scopeId || null;
    
    onUpdateOffer({ 
      options: newOptions,
      defaultSelectedState: {
        selectedScopeId,
        selectedVariants: {},
        selectedOptionalItems,
        selectedItemInOption,
      }
    });
  }, [services, loading]);

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
                className="flex items-center justify-between py-2 px-3 bg-muted/15 rounded-lg"
              >
                {/* Preselect checkbox */}
                <div className="flex items-center gap-3 flex-1">
                  <Checkbox
                    id={`preselect-${product.id}`}
                    checked={product.isPreselected}
                    onCheckedChange={() => togglePreselect(service.scopeId, product.id)}
                    title="Zaznacz dla klienta"
                  />
                  <div className="flex-1">
                    {product.variantName && (
                      <p className="text-xs text-muted-foreground font-medium uppercase">
                        {product.variantName}
                      </p>
                    )}
                    <p className="font-medium text-sm">{product.productShortName || product.productName}</p>
                  </div>
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
                    className="p-1 text-destructive hover:text-destructive/80 transition-colors"
                    title="Usuń produkt"
                  >
                    <Trash2 className="w-4 h-4" />
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
                productShortName: p.product?.short_name || null,
                variantName: p.variant_name,
                price: p.product?.default_price || 0
              }))}
            alreadySelectedIds={service.selectedProducts.map(p => p.scopeProductId)}
            onConfirm={(products) => {
              // Replace entire product list at once to avoid state race conditions
              setServices(prev => prev.map(s => {
                if (s.scopeId !== service.scopeId) return s;
                
                const newSelectedIds = new Set(products.map(p => p.id));
                
                // Keep existing products that are still selected (preserve their prices/preselect)
                const kept = s.selectedProducts.filter(p => newSelectedIds.has(p.scopeProductId));
                const keptIds = new Set(kept.map(p => p.scopeProductId));
                
                // Add new products
                const added: SelectedProduct[] = products
                  .filter(p => !keptIds.has(p.id))
                  .map(p => {
                    const scopeProduct = s.availableProducts.find(sp => sp.id === p.id);
                    return {
                      id: crypto.randomUUID(),
                      scopeProductId: p.id,
                      productId: p.productId,
                      variantName: p.variantName,
                      productName: p.productName,
                      productShortName: p.productShortName,
                      price: p.price,
                      isDefault: scopeProduct?.is_default || false,
                      isPreselected: false,
                    };
                  });
                
                const newSelectedProducts = [...kept, ...added];
                return {
                  ...s,
                  selectedProducts: newSelectedProducts,
                  totalPrice: newSelectedProducts.reduce((sum, p) => sum + p.price, 0),
                };
              }));
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
                  rows={getTextareaRows(offer.warranty)}
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
                  rows={getTextareaRows(offer.paymentTerms)}
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
                  rows={getTextareaRows(offer.serviceInfo)}
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
                  rows={getTextareaRows(offer.notes)}
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
