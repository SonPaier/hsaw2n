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
import { ServiceFormDialog, ServiceData } from '@/components/admin/ServiceFormDialog';
import { CustomerData, VehicleData, OfferState, OfferItem, OfferOption, DefaultSelectedState } from '@/hooks/useOffer';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';

interface ScopeData {
  id: string;
  name: string;
  short_name: string | null;
  is_extras_scope: boolean;
}

interface ProductPricing {
  id: string;
  name: string;
  short_name: string | null;
  default_price: number | null;
  price_from: number | null;
  price_small: number | null;
  price_medium: number | null;
  price_large: number | null;
  category: string | null;
  metadata?: { trwalosc_produktu_w_mesiacach?: number } | null;
}

interface ScopeProduct {
  id: string;
  product_id: string;
  variant_name: string | null;
  is_default: boolean;
  product: ProductPricing | null;
  durabilityMonths?: number | null; // from metadata.trwalosc_produktu_w_mesiacach
}

// Get the lowest available price for display (price_from -> min(S/M/L) -> default_price)
const getLowestPrice = (p: ProductPricing | null): number => {
  if (!p) return 0;
  if (p.price_from != null) return p.price_from;
  
  const sizes = [p.price_small, p.price_medium, p.price_large].filter(
    (v): v is number => v != null
  );
  if (sizes.length > 0) return Math.min(...sizes);
  
  return p.default_price ?? 0;
};

interface ServiceState {
  scopeId: string;
  name: string;
  shortName: string | null;
  isExtrasScope: boolean;
  availableProducts: ScopeProduct[];
  selectedProducts: SelectedProduct[];
  suggestedProducts: SelectedProduct[]; // For extras: suggested (not preselected)
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
  const [suggestedDrawerOpen, setSuggestedDrawerOpen] = useState<string | null>(null); // for suggested extras
  const [editingPrice, setEditingPrice] = useState<{ scopeId: string; productId: string; value: string; isSuggested?: boolean } | null>(null);
  const [editingProduct, setEditingProduct] = useState<ServiceData | null>(null);
  const [productCategories, setProductCategories] = useState<{ id: string; name: string }[]>([]);
  const [categoryOrder, setCategoryOrder] = useState<Record<string, number>>({});

  // Load scope data and products for selected scopes + always include extras scopes
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);

      // First, fetch all extras scopes for this instance (always shown)
      // Only use unified templates (has_unified_services = true)
      const { data: extrasScopes } = await supabase
        .from('offer_scopes')
        .select('id')
        .eq('instance_id', instanceId)
        .eq('active', true)
        .eq('is_extras_scope', true)
        .eq('has_unified_services', true);

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

      // Fetch products for non-extras scopes (regular offer_scope_products)
      const nonExtrasScopeIds = scopesData.filter(s => !s.is_extras_scope).map(s => s.id);
      const { data: scopeProductsData } = await supabase
        .from('offer_scope_products')
        .select(`
          id,
          scope_id,
          product_id,
          variant_name,
          is_default,
          sort_order,
          product:unified_services!product_id(id, name, short_name, default_price, price_from, price_small, price_medium, price_large, category_id, metadata)
        `)
        .in('scope_id', nonExtrasScopeIds.length > 0 ? nonExtrasScopeIds : ['__none__'])
        .order('sort_order');

      // For extras scopes - fetch products with service_type='both' (unified model)
      // This ensures new products are automatically available without manual sync
      // Also filter out visibility='only_reservations' as those should not appear in offer drawers
      const { data: allProductsData } = await supabase
        .from('unified_services')
        .select('id, name, short_name, default_price, price_from, price_small, price_medium, price_large, category_id, service_type, visibility, metadata')
        .eq('instance_id', instanceId)
        .eq('service_type', 'both')
        .eq('active', true)
        .order('name');
      
      // Filter out services with visibility='only_reservations' (they shouldn't appear in offers)
      const filteredProductsData = (allProductsData || []).filter(p => {
        const vis = (p as any).visibility || 'everywhere';
        return vis !== 'only_reservations';
      });

      // Fetch categories with category_type='both' (unified model)
      const { data: categoryData } = await supabase
        .from('unified_categories')
        .select('id, name, sort_order')
        .eq('instance_id', instanceId)
        .eq('category_type', 'both')
        .eq('active', true);

      // Build category ID -> name map for resolving UUIDs
      const categoryIdToNameMap: Record<string, string> = {};
      const categoryOrderMap: Record<string, number> = {};
      if (categoryData) {
        categoryData.forEach(cat => {
          categoryIdToNameMap[cat.id] = cat.name;
          categoryOrderMap[cat.name] = cat.sort_order ?? 999;
        });
      }
      setCategoryOrder(categoryOrderMap);

      // Build services state
      const newServices: ServiceState[] = scopesData.map(scope => {
        // For extras scopes: use ALL products from unified_services (dynamic, always up-to-date)
        // For regular scopes: use configured offer_scope_products
        let scopeProducts: ScopeProduct[];
        
        if (scope.is_extras_scope) {
          // All products available as extras - no need to manually add them to offer_scope_products
          scopeProducts = filteredProductsData.map(product => ({
            id: `extras-${product.id}`, // Virtual ID since not from offer_scope_products
            product_id: product.id,
            variant_name: null,
            is_default: false, // Extras are never default - admin/customer selects
            product: {
              id: product.id,
              name: product.name,
              short_name: product.short_name,
              default_price: product.default_price,
              price_from: product.price_from,
              price_small: product.price_small,
              price_medium: product.price_medium,
              price_large: product.price_large,
              category: product.category_id ? categoryIdToNameMap[product.category_id] || null : null,
              metadata: (product as any).metadata || null
            },
            durabilityMonths: (product as any).metadata?.trwalosc_produktu_w_mesiacach || null
          }));
        } else {
          scopeProducts = (scopeProductsData || [])
            .filter(p => p.scope_id === scope.id)
            .map(p => {
              const prod = (p as any).product;
              return {
                id: p.id,
                product_id: p.product_id,
                variant_name: p.variant_name,
                is_default: p.is_default,
                product: prod ? {
                  id: prod.id,
                  name: prod.name,
                  short_name: prod.short_name,
                  default_price: prod.default_price,
                  price_from: prod.price_from,
                  price_small: prod.price_small,
                  price_medium: prod.price_medium,
                  price_large: prod.price_large,
                  category: prod.category_id ? categoryIdToNameMap[prod.category_id] || null : null,
                  metadata: prod.metadata || null
                } : null,
                durabilityMonths: prod?.metadata?.trwalosc_produktu_w_mesiacach || null
              };
            });
        }

        // Check if we have saved options for this scope - restore them
        const existingOption = offer.options.find(opt => opt.scopeId === scope.id);

        // Helper: convert scope product to SelectedProduct
        const toSelectedProduct = (p: ScopeProduct, isPreselected: boolean): SelectedProduct => ({
          // IMPORTANT: must be unique per offer item (cannot reuse offer_scope_products.id)
          id: crypto.randomUUID(),
          scopeProductId: p.id,
          productId: p.product_id,
          variantName: p.variant_name,
          productName: p.product!.name,
          productShortName: p.product!.short_name,
          price: getLowestPrice(p.product),
          isDefault: p.is_default,
          isPreselected,
        });

        // Helper: build defaults (only is_default products)
        const buildDefaultSelected = (): SelectedProduct[] => {
          const defaults = scopeProducts.filter(p => p.is_default && p.product);
          return defaults.map((p, idx) => toSelectedProduct(
            p,
            // For non-extras: auto-preselect first item only
            // For extras: all default products are preselected
            scope.is_extras_scope ? true : idx === 0
          ));
        };

        // Helper: build suggested (only NOT is_default products, for extras)
        const buildSuggested = (): SelectedProduct[] => {
          return scopeProducts
            .filter(p => !p.is_default && p.product)
            .map(p => toSelectedProduct(p, false));
        };

        let selectedProducts: SelectedProduct[] = [];
        let suggestedProducts: SelectedProduct[] = [];

        // Get customer selections from saved state (when customer accepted offer)
        const customerSelectedOptionalItems = offer.defaultSelectedState?.selectedOptionalItems || {};

        // CRITICAL: Check if this is a persisted offer loaded from database.
        // offer.id exists only after saveOffer() or loadOffer() from DB.
        // We IGNORE offer.options pre-populated by generateOptionsFromScopes because
        // that function includes ALL scope products, not just is_default ones.
        const isPersistedOffer = Boolean(offer.id);
        
        // For persisted offers, restore from database items
        // For new offers, use ONLY is_default products from template
        if (isPersistedOffer && existingOption && existingOption.items.length > 0) {
          // Restore from saved offer - use all saved items
          const allRestored = existingOption.items.map(item => {
            // Find matching scope product - parse name from customName (format: "VARIANT\nProductName" or just "ProductName")
            const nameParts = (item.customName || '').split('\n');
            const productNameFromItem = nameParts.length > 1 ? nameParts[nameParts.length - 1] : item.customName;
            const variantFromItem = nameParts.length > 1 ? nameParts[0] : null;

            const matchingProduct = scopeProducts.find(sp =>
              sp.product_id === item.productId ||
              (sp.product?.name === productNameFromItem && sp.variant_name === variantFromItem)
            );

            // Check if customer selected this item (from selectedOptionalItems)
            const wasSelectedByCustomer = customerSelectedOptionalItems[item.id] === true;
            
            return {
              id: item.id,
              scopeProductId: matchingProduct?.id || '',
              productId: item.productId || matchingProduct?.product_id || '',
              variantName: variantFromItem || matchingProduct?.variant_name || null,
              productName: productNameFromItem || matchingProduct?.product?.name || '',
              productShortName: matchingProduct?.product?.short_name || null,
              price: item.unitPrice,
              isDefault: matchingProduct?.is_default || false,
              // Item is preselected if: was admin preselected (!isOptional) OR customer selected it
              isPreselected: !item.isOptional || wasSelectedByCustomer,
            };
          }).filter(p => p.productId);

          // Split into selected (preselected) and suggested (not preselected) for extras
          if (scope.is_extras_scope) {
            selectedProducts = allRestored.filter(p => p.isPreselected);
            suggestedProducts = allRestored.filter(p => !p.isPreselected);
          } else {
            selectedProducts = allRestored;
          }
        } else {
          // NEW OFFER: use ONLY is_default products from the scope template
          // This ignores whatever generateOptionsFromScopes put in offer.options
          selectedProducts = buildDefaultSelected();
          
          // For NEW offers from widget: auto-add widget-selected extras
          if (scope.is_extras_scope && offer.widgetSelectedExtras?.length) {
            const widgetExtrasProducts = scopeProducts.filter(
              p => offer.widgetSelectedExtras?.includes(p.product_id) && p.product
            );
            const widgetPreselected = widgetExtrasProducts.map(p => toSelectedProduct(p, true));
            // Add to selectedProducts (avoid duplicates)
            const existingIds = new Set(selectedProducts.map(sp => sp.productId));
            widgetPreselected.forEach(wp => {
              if (!existingIds.has(wp.productId)) {
                selectedProducts.push(wp);
              }
            });
          }
          
          // For NEW offers from widget with duration selection: auto-preselect matching products
          if (!scope.is_extras_scope && offer.widgetDurationSelections) {
            const selectedDuration = offer.widgetDurationSelections[scope.id];
            
            if (selectedDuration !== undefined && selectedDuration !== null) {
              // Filter products matching the selected duration
              const durationMatchingProducts = scopeProducts.filter(
                p => p.durabilityMonths === selectedDuration && p.product
              );
              
              if (durationMatchingProducts.length > 0) {
                // Replace default selection with duration-matched product(s)
                selectedProducts = durationMatchingProducts.map(p => toSelectedProduct(p, true));
              }
            }
          }
          
          // For extras scopes: start with empty suggested list (admin adds manually)
          // suggestedProducts remains empty []
        }

        const totalPrice = selectedProducts.reduce((sum, p) => sum + p.price, 0);

        return {
          scopeId: scope.id,
          name: scope.name,
          shortName: scope.short_name,
          isExtrasScope: scope.is_extras_scope,
          availableProducts: scopeProducts,
          selectedProducts,
          suggestedProducts,
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
    // Note: offer.id is included to re-run when switching between new/persisted offers
    // offer.options is NOT included to avoid infinite loops (we update it via syncToOfferState)
  }, [instanceId, offer.selectedScopeIds, offer.id]);

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
        price: getLowestPrice(scopeProduct.product),
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

  // Remove product from service (selected)
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

  // Remove product from suggested
  const removeSuggestedProduct = (scopeId: string, productId: string) => {
    setServices(prev => prev.map(service => {
      if (service.scopeId !== scopeId) return service;

      return {
        ...service,
        suggestedProducts: service.suggestedProducts.filter(p => p.id !== productId)
      };
    }));
  };

  // Update product price
  const updateProductPrice = (scopeId: string, productId: string, newPrice: number, isSuggested: boolean = false) => {
    setServices(prev => prev.map(service => {
      if (service.scopeId !== scopeId) return service;

      if (isSuggested) {
        const newSuggestedProducts = service.suggestedProducts.map(p => 
          p.id === productId ? { ...p, price: newPrice } : p
        );
        return { ...service, suggestedProducts: newSuggestedProducts };
      }

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

  // Calculate textarea rows based on content
  const getTextareaRows = (value: string | undefined | null, minRows: number = 3): number => {
    if (!value) return minRows;
    const lineCount = value.split('\n').length;
    return Math.max(lineCount + 1, minRows);
  };

  // Get available products that are not yet added (to either selected or suggested)
  const getAvailableProducts = (service: ServiceState) => {
    const addedProductIds = new Set([
      ...service.selectedProducts.map(p => p.scopeProductId),
      ...service.suggestedProducts.map(p => p.scopeProductId)
    ]);
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

  // Open product edit dialog
  const openProductEdit = async (productId: string) => {
    const { data } = await supabase
      .from('unified_services')
      .select('id, name, short_name, description, price_from, price_small, price_medium, price_large, prices_are_net, duration_minutes, duration_small, duration_medium, duration_large, category_id, service_type, visibility, reminder_template_id')
      .eq('id', productId)
      .single();
    
    if (data) {
      // Map unified_services fields to ServiceData format
      setEditingProduct({
        id: data.id,
        name: data.name,
        short_name: data.short_name,
        description: data.description,
        price_from: data.price_from,
        price_small: data.price_small,
        price_medium: data.price_medium,
        price_large: data.price_large,
        prices_are_net: data.prices_are_net ?? true,
        duration_minutes: data.duration_minutes,
        duration_small: data.duration_small,
        duration_medium: data.duration_medium,
        duration_large: data.duration_large,
        category_id: data.category_id,
        service_type: (data.service_type as 'both' | 'reservation' | 'offer') ?? 'both',
        visibility: (data.visibility as 'everywhere' | 'only_reservations' | 'only_offers') ?? 'everywhere',
        reminder_template_id: data.reminder_template_id,
      });
      // Also fetch categories
      const { data: categories } = await supabase
        .from('unified_categories')
        .select('id, name')
        .eq('instance_id', instanceId)
        .eq('category_type', 'both')
        .eq('active', true);
      
      setProductCategories(categories || []);
    }
  };

  // Refresh product data after edit
  const refreshProductData = async () => {
    // Trigger a refetch of services by toggling a dep
    const { data: scopeProductsData } = await supabase
      .from('offer_scope_products')
      .select(`
        id,
        scope_id,
        product_id,
        variant_name,
        is_default,
        sort_order,
        product:unified_services!product_id(id, name, short_name, default_price, price_from, price_small, price_medium, price_large)
      `)
      .in('scope_id', services.map(s => s.scopeId))
      .order('sort_order');

    // Update services with fresh product data
    setServices(prev => prev.map(service => {
      const updatedProducts = service.selectedProducts.map(sp => {
        const freshData = (scopeProductsData || []).find(p => p.id === sp.scopeProductId);
        const product = (freshData as any)?.product;
        if (product) {
          return {
            ...sp,
            productName: product.name,
            productShortName: product.short_name,
            price: getLowestPrice(product),
          };
        }
        return sp;
      });

      const updatedSuggested = service.suggestedProducts.map(sp => {
        const freshData = (scopeProductsData || []).find(p => p.id === sp.scopeProductId);
        const product = (freshData as any)?.product;
        if (product) {
          return {
            ...sp,
            productName: product.name,
            productShortName: product.short_name,
            price: getLowestPrice(product),
          };
        }
        return sp;
      });

      return {
        ...service,
        selectedProducts: updatedProducts,
        suggestedProducts: updatedSuggested,
        totalPrice: updatedProducts.reduce((sum, p) => sum + p.price, 0),
      };
    }));
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
    
    // Generate stable option IDs based on scopeId (use same ID for each scope)
    // This ensures consistency between save and load
    const optionIdMap = new Map<string, string>();
    services.forEach(service => {
      // Check if we already have an option with this scopeId in current offer
      const existingOption = offer.options.find(o => o.scopeId === service.scopeId);
      optionIdMap.set(service.scopeId, existingOption?.id || crypto.randomUUID());
    });
    
    // Convert services to offer options format
    // Include both selected (preselected) and suggested (not preselected) products
    const newOptions: OfferOption[] = services.map((service, idx) => {
      const allProducts = [
        ...service.selectedProducts.map(p => ({ ...p, isPreselected: true })),
        ...service.suggestedProducts.map(p => ({ ...p, isPreselected: false }))
      ];
      
      const optionId = optionIdMap.get(service.scopeId)!;
      
      return {
        id: optionId, // Use stable generated ID
        name: service.name,
        description: '',
        items: allProducts.map(p => ({
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
      };
    });
    
    // Build defaultSelectedState for public view
    // For extras scope: selectedOptionalItems maps itemId -> true for preselected items (from selectedProducts)
    // For regular scopes: selectedItemInOption maps optionId -> itemId for first item
    const selectedOptionalItems: Record<string, boolean> = {};
    const selectedItemInOption: Record<string, string> = {};
    
    services.forEach(service => {
      const optionId = optionIdMap.get(service.scopeId)!;
      
      if (service.isExtrasScope) {
        // For extras: mark all products in selectedProducts (these are preselected)
        service.selectedProducts.forEach(p => {
          selectedOptionalItems[p.id] = true;
        });
      } else {
        // For regular services: set the first item as selected
        // Use optionId (not scopeId) as key - this matches how PublicOfferCustomerView reads it
        const firstItem = service.selectedProducts[0];
        if (firstItem) {
          selectedItemInOption[optionId] = firstItem.id;
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
        <CardContent className="pt-4 pb-4 space-y-3">
          {/* Customer Section */}
          <div className="space-y-1">
            <div className="flex items-center gap-2 font-semibold">
              <User className="w-4 h-4 text-primary" />
              Klient
            </div>
            <div className="text-sm space-y-0.5 pl-6">
              <p className="font-medium">{offer.customerData.name || '—'}</p>
              <p className="text-muted-foreground">{offer.customerData.email || '—'}</p>
              {offer.customerData.phone && (
                <p className="text-muted-foreground">{offer.customerData.phone}</p>
              )}
            </div>
          </div>
          
          {/* Company Section */}
          {offer.customerData.company && (
            <div className="space-y-1">
              <div className="flex items-center gap-2 font-semibold">
                <Building2 className="w-4 h-4 text-primary" />
                Firma
              </div>
              <div className="text-sm space-y-0.5 pl-6">
                <p className="font-medium">{offer.customerData.company}</p>
                {offer.customerData.nip && (
                  <p className="text-muted-foreground">NIP: {offer.customerData.nip}</p>
                )}
              </div>
            </div>
          )}

          {/* Vehicle Section */}
          {offer.vehicleData.brandModel && (
            <div className="space-y-1">
              <div className="flex items-center gap-2 font-semibold">
                <Car className="w-4 h-4 text-primary" />
                Pojazd
              </div>
              <div className="text-sm space-y-0.5 pl-6">
                <p className="font-medium">{offer.vehicleData.brandModel}</p>
              {(offer.vehicleData.paintColor || offer.vehicleData.paintType) && (
                  <div className="flex flex-wrap gap-2 mt-1">
                    {offer.vehicleData.paintColor && (
                      <span className="px-4 py-1 bg-slate-600 text-white rounded-full text-sm font-medium">
                        {offer.vehicleData.paintColor}
                      </span>
                    )}
                    {offer.vehicleData.paintType && (
                      <span className="px-4 py-1 bg-slate-600 text-white rounded-full text-sm font-medium">
                        {offer.vehicleData.paintType === 'gloss' ? 'Połysk' : offer.vehicleData.paintType === 'matte' ? 'Mat' : getPaintTypeLabel(offer.vehicleData.paintType)}
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Services */}
      {services.filter(s => !s.isExtrasScope).map((service) => (
        <Card key={service.scopeId} className="p-5">
          {/* Service header */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-primary" />
              <h3 className="font-bold text-lg">{service.name}</h3>
            </div>
          </div>
          
          {/* Selected Products - no checkbox */}
          <div className="space-y-2">
            {service.selectedProducts.map((product) => (
              <div
                key={product.id}
                className="flex items-center justify-between py-2 px-3 bg-muted/15 rounded-lg"
              >
                <div className="flex-1">
                  {product.variantName && (
                    <p className="text-xs text-muted-foreground font-medium uppercase">
                      {product.variantName}
                    </p>
                  )}
                  <button
                    type="button"
                    onClick={() => openProductEdit(product.productId)}
                    className="font-medium text-sm text-left hover:text-primary hover:underline transition-colors"
                  >
                    {product.productShortName || product.productName}
                  </button>
                </div>
                <div className="flex items-center gap-2">
                  {editingPrice?.scopeId === service.scopeId && editingPrice?.productId === product.id && !editingPrice?.isSuggested ? (
                    <div className="flex items-center gap-1">
                      <Input
                        type="number"
                        value={editingPrice.value}
                        onChange={(e) => setEditingPrice({ ...editingPrice, value: e.target.value })}
                        className="w-24 h-8 text-right"
                        autoFocus
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            updateProductPrice(service.scopeId, product.id, parseFloat(editingPrice.value) || 0, false);
                            setEditingPrice(null);
                          }
                          if (e.key === 'Escape') setEditingPrice(null);
                        }}
                        onBlur={() => {
                          updateProductPrice(service.scopeId, product.id, parseFloat(editingPrice.value) || 0, false);
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
                        value: String(product.price),
                        isSuggested: false
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
                    title="Usuń usługę"
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
                Dodaj usługę
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
                price: getLowestPrice(p.product),
                category: p.product?.category || null
              }))}
            alreadySelectedIds={service.selectedProducts.map(p => p.scopeProductId)}
            categoryOrder={categoryOrder}
            onConfirm={(products) => {
              setServices(prev => prev.map(s => {
                if (s.scopeId !== service.scopeId) return s;
                
                const newSelectedIds = new Set(products.map(p => p.id));
                
                const kept = s.selectedProducts.filter(p => newSelectedIds.has(p.scopeProductId));
                const keptIds = new Set(kept.map(p => p.scopeProductId));
                
                const added: SelectedProduct[] = products
                  .filter(p => !keptIds.has(p.id))
                  .map((p, idx) => {
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
                      // For non-extras: first item is preselected
                      isPreselected: kept.length === 0 && idx === 0,
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

      {/* Extras Sections */}
      {services.filter(s => s.isExtrasScope).map((service) => (
        <div key={service.scopeId} className="space-y-4">
          {/* Selected Extras - "Dodatki wybrane przez klienta" */}
          <Card className="p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-primary" />
                <h3 className="font-bold text-lg">Dodatki wybrane przez klienta</h3>
              </div>
              <div className="text-right">
                <p className="font-semibold text-lg">{formatPrice(service.totalPrice)}</p>
                <p className="text-xs text-muted-foreground">netto</p>
              </div>
            </div>
            
            <div className="space-y-2">
              {service.selectedProducts.map((product) => (
                <div
                  key={product.id}
                  className="flex items-center justify-between py-2 px-3 bg-muted/15 rounded-lg"
                >
                  <div className="flex-1">
                    {product.variantName && (
                      <p className="text-xs text-muted-foreground font-medium uppercase">
                        {product.variantName}
                      </p>
                    )}
                    <button
                      type="button"
                      onClick={() => openProductEdit(product.productId)}
                      className="font-medium text-sm text-left hover:text-primary hover:underline transition-colors"
                    >
                      {product.productShortName || product.productName}
                    </button>
                  </div>
                  <div className="flex items-center gap-2">
                    {editingPrice?.scopeId === service.scopeId && editingPrice?.productId === product.id && !editingPrice?.isSuggested ? (
                      <div className="flex items-center gap-1">
                        <Input
                          type="number"
                          value={editingPrice.value}
                          onChange={(e) => setEditingPrice({ ...editingPrice, value: e.target.value })}
                          className="w-24 h-8 text-right"
                          autoFocus
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              updateProductPrice(service.scopeId, product.id, parseFloat(editingPrice.value) || 0, false);
                              setEditingPrice(null);
                            }
                            if (e.key === 'Escape') setEditingPrice(null);
                          }}
                          onBlur={() => {
                            updateProductPrice(service.scopeId, product.id, parseFloat(editingPrice.value) || 0, false);
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
                          value: String(product.price),
                          isSuggested: false
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
                      title="Usuń usługę"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {getAvailableProducts(service).length > 0 && (
              <div className="mt-3">
                <Button
                  type="button"
                  variant="outline"
                  className="w-full bg-white"
                  onClick={() => setProductDrawerOpen(service.scopeId)}
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Dodaj usługę
                </Button>
              </div>
            )}

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
                  price: getLowestPrice(p.product),
                  category: p.product?.category || null
                }))}
              alreadySelectedIds={service.selectedProducts.map(p => p.scopeProductId)}
              disabledIds={service.suggestedProducts.map(p => p.scopeProductId)}
              categoryOrder={categoryOrder}
              onConfirm={(products) => {
                setServices(prev => prev.map(s => {
                  if (s.scopeId !== service.scopeId) return s;
                  
                  const newSelectedIds = new Set(products.map(p => p.id));
                  
                  const kept = s.selectedProducts.filter(p => newSelectedIds.has(p.scopeProductId));
                  const keptIds = new Set(kept.map(p => p.scopeProductId));
                  
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
                        isPreselected: true, // Selected extras are always preselected
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

          {/* Suggested Extras - "Dodatki sugerowane dla zapytania" */}
          <Card className="p-5">
            <div className="flex items-center gap-2 mb-4">
              <FileText className="w-5 h-5 text-muted-foreground" />
              <h3 className="font-bold text-lg text-muted-foreground">Dodatki sugerowane dla zapytania</h3>
            </div>
            
            <div className="space-y-2">
              {service.suggestedProducts.map((product) => (
                <div
                  key={product.id}
                  className="flex items-center justify-between py-2 px-3 bg-muted/15 rounded-lg"
                >
                  <div className="flex-1">
                    {product.variantName && (
                      <p className="text-xs text-muted-foreground font-medium uppercase">
                        {product.variantName}
                      </p>
                    )}
                    <button
                      type="button"
                      onClick={() => openProductEdit(product.productId)}
                      className="font-medium text-sm text-left hover:text-primary hover:underline transition-colors"
                    >
                      {product.productShortName || product.productName}
                    </button>
                  </div>
                  <div className="flex items-center gap-2">
                    {editingPrice?.scopeId === service.scopeId && editingPrice?.productId === product.id && editingPrice?.isSuggested ? (
                      <div className="flex items-center gap-1">
                        <Input
                          type="number"
                          value={editingPrice.value}
                          onChange={(e) => setEditingPrice({ ...editingPrice, value: e.target.value })}
                          className="w-24 h-8 text-right"
                          autoFocus
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              updateProductPrice(service.scopeId, product.id, parseFloat(editingPrice.value) || 0, true);
                              setEditingPrice(null);
                            }
                            if (e.key === 'Escape') setEditingPrice(null);
                          }}
                          onBlur={() => {
                            updateProductPrice(service.scopeId, product.id, parseFloat(editingPrice.value) || 0, true);
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
                          value: String(product.price),
                          isSuggested: true
                        })}
                        className="font-semibold hover:bg-muted rounded px-2 py-1 transition-colors"
                        title="Kliknij aby edytować"
                      >
                        {formatPrice(product.price)}
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => removeSuggestedProduct(service.scopeId, product.id)}
                      className="p-1 text-destructive hover:text-destructive/80 transition-colors"
                      title="Usuń produkt"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {getAvailableProducts(service).length > 0 && (
              <div className="mt-3">
                <Button
                  type="button"
                  variant="outline"
                  className="w-full bg-white"
                  onClick={() => setSuggestedDrawerOpen(service.scopeId)}
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Dodaj rekomendowaną usługę
                </Button>
              </div>
            )}

            <ScopeProductSelectionDrawer
              open={suggestedDrawerOpen === service.scopeId}
              onClose={() => setSuggestedDrawerOpen(null)}
              availableProducts={service.availableProducts
                .filter(p => p.product)
                .map(p => ({
                  id: p.id,
                  productId: p.product_id,
                  productName: p.product?.name || '',
                  productShortName: p.product?.short_name || null,
                  variantName: p.variant_name,
                  price: getLowestPrice(p.product),
                  category: p.product?.category || null
                }))}
              alreadySelectedIds={service.suggestedProducts.map(p => p.scopeProductId)}
              disabledIds={service.selectedProducts.map(p => p.scopeProductId)}
              categoryOrder={categoryOrder}
              onConfirm={(products) => {
                setServices(prev => prev.map(s => {
                  if (s.scopeId !== service.scopeId) return s;
                  
                  const newSelectedIds = new Set(products.map(p => p.id));
                  
                  const kept = s.suggestedProducts.filter(p => newSelectedIds.has(p.scopeProductId));
                  const keptIds = new Set(kept.map(p => p.scopeProductId));
                  
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
                        isPreselected: false, // Suggested extras are NOT preselected
                      };
                    });
                  
                  return {
                    ...s,
                    suggestedProducts: [...kept, ...added],
                  };
                }));
              }}
            />
          </Card>
        </div>
      ))}

      {/* Totals - hidden, pricing shown only in preview */}

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

      {/* Product Edit Dialog */}
      <ServiceFormDialog
        open={!!editingProduct}
        onOpenChange={(open) => !open && setEditingProduct(null)}
        instanceId={instanceId}
        categories={productCategories}
        service={editingProduct}
        onSaved={() => {
          refreshProductData();
          setEditingProduct(null);
        }}
      />
    </div>
  );
};
