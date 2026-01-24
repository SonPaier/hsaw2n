import { useState, useCallback, useEffect } from 'react';
import { addMonths, format } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { normalizePhone } from '@/lib/phoneUtils';
import type { Json } from '@/integrations/supabase/types';

export interface CustomerData {
  name: string;
  email: string;
  phone: string;
  company?: string;
  nip?: string;
  companyAddress?: string;
  companyPostalCode?: string;
  companyCity?: string;
  notes?: string;
  inquiryContent?: string;
}

export interface VehicleData {
  brandModel?: string;
  plate?: string;
  paintColor?: string;
  paintType?: string;
}

export interface OfferItem {
  id: string;
  productId?: string;
  customName?: string;
  customDescription?: string;
  quantity: number;
  unitPrice: number;
  unit: string;
  discountPercent: number;
  isOptional: boolean;
  isCustom: boolean;
}

export interface OfferOption {
  id: string;
  name: string;
  description?: string;
  items: OfferItem[];
  isSelected: boolean;
  sortOrder: number;
  scopeId?: string;
  variantId?: string;
  isUpsell?: boolean;
}

export interface DefaultSelectedState {
  selectedScopeId?: string | null;
  selectedVariants: Record<string, string>; // scopeId → optionId
  selectedOptionalItems: Record<string, boolean>; // itemId → true
  selectedItemInOption: Record<string, string>; // optionId → itemId
}

export interface OfferState {
  id?: string;
  instanceId: string;
  customerData: CustomerData;
  vehicleData: VehicleData;
  selectedScopeIds: string[];
  options: OfferOption[];
  additions: OfferItem[];
  notes?: string;
  paymentTerms?: string;
  warranty?: string;
  serviceInfo?: string;
  validUntil?: string;
  vatRate: number;
  hideUnitPrices: boolean;
  status: 'draft' | 'sent' | 'viewed' | 'accepted' | 'rejected' | 'expired';
  defaultSelectedState?: DefaultSelectedState;
}

const defaultCustomerData: CustomerData = {
  name: '',
  email: '',
  phone: '',
  company: '',
  nip: '',
  companyAddress: '',
  companyPostalCode: '',
  companyCity: '',
  notes: '',
  inquiryContent: '',
};

const defaultVehicleData: VehicleData = {
  brandModel: '',
  plate: '',
  paintColor: '',
  paintType: '',
};

export const useOffer = (instanceId: string) => {
  // Default valid until: 1 month from now
  const defaultValidUntil = format(addMonths(new Date(), 1), 'yyyy-MM-dd');

  const [offer, setOffer] = useState<OfferState>({
    instanceId,
    customerData: defaultCustomerData,
    vehicleData: defaultVehicleData,
    selectedScopeIds: [],
    options: [],
    additions: [],
    vatRate: 23,
    hideUnitPrices: false,
    status: 'draft',
    validUntil: defaultValidUntil,
    paymentTerms: '',
    warranty: '',
    serviceInfo: '',
    notes: '',
    defaultSelectedState: undefined,
  });
  
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Generate options from selected scopes (simplified - no variants)
  const generateOptionsFromScopes = useCallback(async (scopeIds: string[]) => {
    if (scopeIds.length === 0) {
      setOffer(prev => ({ ...prev, options: [] }));
      return;
    }

    try {
      // Fetch selected scopes
      const { data: scopes, error: scopesError } = await supabase
        .from('offer_scopes')
        .select('*')
        .in('id', scopeIds)
        .eq('active', true)
        .order('sort_order');

      if (scopesError) throw scopesError;

      // Fetch scope products (new simplified structure)
      const { data: scopeProducts, error: productsError } = await supabase
        .from('offer_scope_products')
        .select(`
          id,
          scope_id,
          product_id,
          variant_name,
          is_default,
          sort_order,
          product:unified_services!product_id(id, name, default_price, price_from, price_small, price_medium, price_large, unit, description)
        `)
        .in('scope_id', scopeIds)
        .order('sort_order');

      if (productsError) throw productsError;

      // Generate one option per scope containing all its products
      const newOptions: OfferOption[] = [];
      let sortOrder = 0;

      // Sort scopes: extras last
      const sortedScopes = [...(scopes || [])].sort((a, b) => {
        if (a.is_extras_scope && !b.is_extras_scope) return 1;
        if (!a.is_extras_scope && b.is_extras_scope) return -1;
        return (a.sort_order || 0) - (b.sort_order || 0);
      });

      for (const scope of sortedScopes) {
        // Get products for this scope
        const products = (scopeProducts || [])
          .filter(p => p.scope_id === scope.id)
          .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));

        const items: OfferItem[] = products.map(p => {
          const product = (p as any).product;
          // Helper: get lowest available price (price_from -> min(S/M/L) -> default_price)
          const getLowestPrice = (): number => {
            if (!product) return 0;
            if (product.price_from != null) return product.price_from;
            const sizes = [product.price_small, product.price_medium, product.price_large].filter(
              (v: number | null): v is number => v != null
            );
            if (sizes.length > 0) return Math.min(...sizes);
            return product.default_price ?? 0;
          };
          return {
            id: crypto.randomUUID(),
            productId: p.product_id || undefined,
            customName: p.variant_name 
              ? `${p.variant_name}\n${product?.name || ''}` 
              : (product?.name || ''),
            customDescription: '', // Description comes from unified_services via FK
            quantity: 1,
            unitPrice: getLowestPrice(),
            unit: product?.unit || 'szt',
            discountPercent: 0,
            isOptional: !p.is_default, // Non-default items are optional
            isCustom: !p.product_id,
          };
        });

        newOptions.push({
          id: crypto.randomUUID(),
          name: scope.name,
          description: scope.description || '',
          items,
          isSelected: true,
          sortOrder,
          scopeId: scope.id,
          variantId: undefined,
          isUpsell: scope.is_extras_scope || false,
        });
        sortOrder++;
      }

      setOffer(prev => ({ ...prev, options: newOptions }));
    } catch (error) {
      console.error('Error generating options from scopes:', error);
    }
  }, [instanceId]);

  // Customer data handlers
  const updateCustomerData = useCallback((data: Partial<CustomerData>) => {
    setOffer(prev => ({
      ...prev,
      customerData: { ...prev.customerData, ...data },
    }));
  }, []);

  // Vehicle data handlers
  const updateVehicleData = useCallback((data: Partial<VehicleData>) => {
    setOffer(prev => ({
      ...prev,
      vehicleData: { ...prev.vehicleData, ...data },
    }));
  }, []);

  // Scope handlers
  const updateSelectedScopes = useCallback((scopeIds: string[]) => {
    // First update the scope IDs in state
    setOffer(prev => {
      // Only update if actually changed to prevent loops
      if (JSON.stringify(prev.selectedScopeIds) === JSON.stringify(scopeIds)) {
        return prev;
      }
      return {
        ...prev,
        selectedScopeIds: scopeIds,
      };
    });
    // Generate options based on selected scopes (don't await - let it run async)
    generateOptionsFromScopes(scopeIds);
  }, [generateOptionsFromScopes]);

  // Option handlers
  const addOption = useCallback((option: Omit<OfferOption, 'id' | 'sortOrder'>) => {
    const newOption: OfferOption = {
      ...option,
      id: crypto.randomUUID(),
      sortOrder: offer.options.length,
    };
    setOffer(prev => ({
      ...prev,
      options: [...prev.options, newOption],
    }));
    return newOption.id;
  }, [offer.options.length]);

  const updateOption = useCallback((optionId: string, data: Partial<OfferOption>) => {
    setOffer(prev => ({
      ...prev,
      options: prev.options.map(opt => 
        opt.id === optionId ? { ...opt, ...data } : opt
      ),
    }));
  }, []);

  const removeOption = useCallback((optionId: string) => {
    setOffer(prev => ({
      ...prev,
      options: prev.options
        .filter(opt => opt.id !== optionId)
        .map((opt, idx) => ({ ...opt, sortOrder: idx })),
    }));
  }, []);

  const duplicateOption = useCallback((optionId: string) => {
    const option = offer.options.find(o => o.id === optionId);
    if (!option) return;
    
    const newOption: OfferOption = {
      ...option,
      id: crypto.randomUUID(),
      name: `${option.name} (kopia)`,
      sortOrder: offer.options.length,
      items: option.items.map(item => ({
        ...item,
        id: crypto.randomUUID(),
      })),
    };
    setOffer(prev => ({
      ...prev,
      options: [...prev.options, newOption],
    }));
  }, [offer.options]);

  // Item handlers
  const addItemToOption = useCallback((optionId: string, item: Omit<OfferItem, 'id'>) => {
    const newItem: OfferItem = {
      ...item,
      id: crypto.randomUUID(),
    };
    setOffer(prev => ({
      ...prev,
      options: prev.options.map(opt => 
        opt.id === optionId 
          ? { ...opt, items: [...opt.items, newItem] }
          : opt
      ),
    }));
    return newItem.id;
  }, []);

  const updateItemInOption = useCallback((optionId: string, itemId: string, data: Partial<OfferItem>) => {
    setOffer(prev => ({
      ...prev,
      options: prev.options.map(opt => 
        opt.id === optionId 
          ? { 
              ...opt, 
              items: opt.items.map(item => 
                item.id === itemId ? { ...item, ...data } : item
              ) 
            }
          : opt
      ),
    }));
  }, []);

  const removeItemFromOption = useCallback((optionId: string, itemId: string) => {
    setOffer(prev => ({
      ...prev,
      options: prev.options.map(opt => 
        opt.id === optionId 
          ? { ...opt, items: opt.items.filter(item => item.id !== itemId) }
          : opt
      ),
    }));
  }, []);

  // Additions handlers
  const addAddition = useCallback((item: Omit<OfferItem, 'id'>) => {
    const newItem: OfferItem = {
      ...item,
      id: crypto.randomUUID(),
    };
    setOffer(prev => ({
      ...prev,
      additions: [...prev.additions, newItem],
    }));
    return newItem.id;
  }, []);

  const updateAddition = useCallback((itemId: string, data: Partial<OfferItem>) => {
    setOffer(prev => ({
      ...prev,
      additions: prev.additions.map(item => 
        item.id === itemId ? { ...item, ...data } : item
      ),
    }));
  }, []);

  const removeAddition = useCallback((itemId: string) => {
    setOffer(prev => ({
      ...prev,
      additions: prev.additions.filter(item => item.id !== itemId),
    }));
  }, []);

  // General update
  const updateOffer = useCallback((data: Partial<OfferState>) => {
    setOffer(prev => ({ ...prev, ...data }));
  }, []);

  // Calculations
  const calculateOptionTotal = useCallback((option: OfferOption) => {
    return option.items.reduce((sum, item) => {
      if (item.isOptional) return sum;
      const itemTotal = item.quantity * item.unitPrice * (1 - item.discountPercent / 100);
      return sum + itemTotal;
    }, 0);
  }, []);

  const calculateAdditionsTotal = useCallback(() => {
    return offer.additions.reduce((sum, item) => {
      if (item.isOptional) return sum;
      const itemTotal = item.quantity * item.unitPrice * (1 - item.discountPercent / 100);
      return sum + itemTotal;
    }, 0);
  }, [offer.additions]);

  const calculateTotalNet = useCallback(() => {
    const optionsTotal = offer.options
      .filter(opt => opt.isSelected)
      .reduce((sum, opt) => sum + calculateOptionTotal(opt), 0);
    return optionsTotal + calculateAdditionsTotal();
  }, [offer.options, calculateOptionTotal, calculateAdditionsTotal]);

  const calculateTotalGross = useCallback(() => {
    const net = calculateTotalNet();
    return net * (1 + offer.vatRate / 100);
  }, [calculateTotalNet, offer.vatRate]);

  // Save offer to database
  // silent: if true, don't show success toast (used for auto-save)
  const saveOffer = useCallback(async (silent = false) => {
    setSaving(true);
    try {
      // ===================== LOG A: BEFORE SAVE =====================
      const allOptionIds = offer.options.map(o => o.id);
      const allItemIds = offer.options.flatMap(o => o.items.map(i => i.id));
      const selectedVariantIds = Object.values(offer.defaultSelectedState?.selectedVariants || {});
      const selectedOptionalItemIds = Object.keys(offer.defaultSelectedState?.selectedOptionalItems || {});
      const selectedItemInOptionIds = Object.values(offer.defaultSelectedState?.selectedItemInOption || {});
      
      const missingVariants = selectedVariantIds.filter(id => !allOptionIds.includes(id));
      const missingOptionalItems = selectedOptionalItemIds.filter(id => !allItemIds.includes(id));
      const missingItemInOption = selectedItemInOptionIds.filter(id => !allItemIds.includes(id));
      
      console.group('📝 [SAVE] Offer Selection State BEFORE save');
      console.log('offer.id:', offer.id);
      console.log('defaultSelectedState:', JSON.stringify(offer.defaultSelectedState, null, 2));
      console.log('options (id, scopeId, isUpsell):', offer.options.map(o => ({ id: o.id, scopeId: o.scopeId, isUpsell: o.isUpsell })));
      console.log('all item IDs:', allItemIds);
      console.log('🔍 Consistency check:');
      console.log('  - Missing variant IDs in options:', missingVariants.length > 0 ? missingVariants : '✅ all found');
      console.log('  - Missing optional item IDs:', missingOptionalItems.length > 0 ? missingOptionalItems : '✅ all found');
      console.log('  - Missing itemInOption IDs:', missingItemInOption.length > 0 ? missingItemInOption : '✅ all found');
      console.groupEnd();
      // ===================== END LOG A =====================

      // Generate offer number if new
      let offerNumber = '';
      if (!offer.id) {
        const { data: numberData, error: numberError } = await supabase
          .rpc('generate_offer_number', { _instance_id: instanceId });
        
        if (numberError) throw numberError;
        offerNumber = numberData;
      }

      const totalNet = calculateTotalNet();
      const totalGross = calculateTotalGross();

      // Build selected_state from defaultSelectedState if present (for admin pre-selection)
      const selectedStateToSave = offer.defaultSelectedState ? {
        selectedScopeId: offer.defaultSelectedState.selectedScopeId,
        selectedVariants: offer.defaultSelectedState.selectedVariants,
        selectedOptionalItems: offer.defaultSelectedState.selectedOptionalItems,
        selectedItemInOption: offer.defaultSelectedState.selectedItemInOption,
        selectedUpsells: {}, // Legacy field, derive from selectedOptionalItems
        isDefault: true, // Marker that this is admin's pre-selection, not customer's choice
      } : null;

      // Save main offer - cast to Json for Supabase
      const offerData: {
        instance_id: string;
        customer_data: Json;
        vehicle_data: Json;
        notes?: string;
        payment_terms?: string;
        warranty?: string;
        service_info?: string;
        valid_until?: string;
        vat_rate: number;
        total_net: number;
        total_gross: number;
        status: string;
        hide_unit_prices: boolean;
        offer_number?: string;
        selected_state?: Json;
        has_unified_services?: boolean;
      } = {
        instance_id: instanceId,
        customer_data: offer.customerData as unknown as Json,
        vehicle_data: offer.vehicleData as unknown as Json,
        notes: offer.notes,
        payment_terms: offer.paymentTerms,
        warranty: offer.warranty,
        service_info: offer.serviceInfo,
        valid_until: offer.validUntil,
        vat_rate: offer.vatRate,
        total_net: totalNet,
        total_gross: totalGross,
        status: offer.status,
        hide_unit_prices: offer.hideUnitPrices,
        ...(offerNumber && { offer_number: offerNumber }),
        ...(selectedStateToSave && { selected_state: selectedStateToSave as unknown as Json }),
        // New offers use unified services (service_type='both')
        ...(!offer.id && { has_unified_services: true }),
      };

      let offerId = offer.id;

      if (offer.id) {
        // Update existing
        const { error } = await supabase
          .from('offers')
          .update(offerData)
          .eq('id', offer.id);
        
        if (error) throw error;
      } else {
        // Insert new - offer_number is required
        const insertData = { ...offerData, offer_number: offerNumber };
        const { data, error } = await supabase
          .from('offers')
          .insert(insertData)
          .select('id')
          .single();
        
        if (error) throw error;
        offerId = data.id;
        setOffer(prev => ({ ...prev, id: offerId }));
      }

      // Delete existing options and items (will re-insert)
      // Use offerId (not offer.id) to handle both new and existing offers consistently
      const { error: deleteError } = await supabase
        .from('offer_options')
        .delete()
        .eq('offer_id', offerId);
      
      if (deleteError) {
        console.error('Error deleting old options:', deleteError);
        // Continue anyway - the insert might still work if there were no options
      }

      // ===================== AUTO-REPAIR: Detect and fix stale IDs from duplication =====================
      // Check if any option IDs already exist in the database for a DIFFERENT offer
      const optionIdsToCheck = offer.options.map(o => o.id);
      const itemIdsToCheck = offer.options.flatMap(o => o.items.map(i => i.id));
      
      let optionIdMap: Record<string, string> = {};
      let itemIdMap: Record<string, string> = {};
      let needsIdRegeneration = false;
      
      if (optionIdsToCheck.length > 0) {
        const { data: existingOptions } = await supabase
          .from('offer_options')
          .select('id, offer_id')
          .in('id', optionIdsToCheck);
        
        // If any option ID exists for a DIFFERENT offer, we need to regenerate
        const conflictingOptions = (existingOptions || []).filter(o => o.offer_id !== offerId);
        if (conflictingOptions.length > 0) {
          needsIdRegeneration = true;
          console.warn('[AUTO-REPAIR] Detected conflicting option IDs from another offer:', conflictingOptions.map(o => o.id));
        }
      }
      
      // Prepare options and items with potentially regenerated IDs
      let processedOptions = offer.options;
      let processedAdditions = offer.additions;
      let processedDefaultSelectedState = offer.defaultSelectedState;
      
      if (needsIdRegeneration) {
        console.log('[AUTO-REPAIR] Regenerating all option and item IDs to prevent conflicts...');
        
        // Generate new IDs for all options and items
        processedOptions = offer.options.map(option => {
          const newOptionId = crypto.randomUUID();
          optionIdMap[option.id] = newOptionId;
          
          return {
            ...option,
            id: newOptionId,
            items: option.items.map(item => {
              const newItemId = crypto.randomUUID();
              itemIdMap[item.id] = newItemId;
              return { ...item, id: newItemId };
            }),
          };
        });
        
        // Regenerate additions IDs
        processedAdditions = offer.additions.map(item => {
          const newItemId = crypto.randomUUID();
          itemIdMap[item.id] = newItemId;
          return { ...item, id: newItemId };
        });
        
        // Update defaultSelectedState with new IDs
        if (offer.defaultSelectedState) {
          const { selectedVariants, selectedOptionalItems, selectedItemInOption } = offer.defaultSelectedState;
          
          const newSelectedVariants: Record<string, string> = {};
          for (const [scopeId, oldOptionId] of Object.entries(selectedVariants || {})) {
            newSelectedVariants[scopeId] = optionIdMap[oldOptionId] || oldOptionId;
          }
          
          const newSelectedOptionalItems: Record<string, boolean> = {};
          for (const [oldItemId, value] of Object.entries(selectedOptionalItems || {})) {
            const newItemId = itemIdMap[oldItemId] || oldItemId;
            newSelectedOptionalItems[newItemId] = value;
          }
          
          const newSelectedItemInOption: Record<string, string> = {};
          for (const [oldOptionId, oldItemId] of Object.entries(selectedItemInOption || {})) {
            const newOptionId = optionIdMap[oldOptionId] || oldOptionId;
            const newItemId = itemIdMap[oldItemId] || oldItemId;
            newSelectedItemInOption[newOptionId] = newItemId;
          }
          
          processedDefaultSelectedState = {
            ...offer.defaultSelectedState,
            selectedVariants: newSelectedVariants,
            selectedOptionalItems: newSelectedOptionalItems,
            selectedItemInOption: newSelectedItemInOption,
          };
        }
        
        // Update local state with regenerated IDs
        setOffer(prev => ({
          ...prev,
          options: processedOptions,
          additions: processedAdditions,
          defaultSelectedState: processedDefaultSelectedState,
        }));
        
        console.log('[AUTO-REPAIR] Regenerated', Object.keys(optionIdMap).length, 'option IDs and', Object.keys(itemIdMap).length, 'item IDs');
      }
      // ===================== END AUTO-REPAIR =====================

      // Prepare all options for bulk insert
      const allOptionsData = processedOptions.map((option, idx) => ({
        id: option.id,
        offer_id: offerId,
        name: option.name,
        description: option.description,
        is_selected: option.isSelected,
        sort_order: option.sortOrder,
        subtotal_net: calculateOptionTotal(option),
        scope_id: option.scopeId || null,
        variant_id: option.variantId || null,
        is_upsell: option.isUpsell || false,
      }));

      // Add additions as a special option if present (generate new ID for additions)
      const additionsId = processedAdditions.length > 0 ? crypto.randomUUID() : null;
      if (processedAdditions.length > 0 && additionsId) {
        allOptionsData.push({
          id: additionsId,
          offer_id: offerId,
          name: 'Dodatki',
          description: '',
          is_selected: true,
          sort_order: processedOptions.length,
          subtotal_net: calculateAdditionsTotal(),
          scope_id: null,
          variant_id: null,
          is_upsell: false,
        });
      }

      // Bulk insert all options at once
      if (allOptionsData.length > 0) {
        const { error: optionsError } = await supabase
          .from('offer_options')
          .insert(allOptionsData);

        if (optionsError) throw optionsError;

        // FIX: Insert items WITH their existing IDs to prevent selected_state mismatch
        const allItemsData: Array<{
          id: string;
          option_id: string;
          product_id: string | null;
          custom_name: string | undefined;
          custom_description: string | undefined;
          quantity: number;
          unit_price: number;
          unit: string;
          discount_percent: number;
          is_optional: boolean;
          is_custom: boolean;
          sort_order: number;
        }> = [];

        // Add items from regular options - use processedOptions with potentially regenerated IDs
        processedOptions.forEach((option) => {
          if (option.items.length > 0) {
            option.items.forEach((item, itemIdx) => {
              allItemsData.push({
                id: item.id,
                option_id: option.id,
                product_id: item.productId || null,
                custom_name: item.customName,
                custom_description: item.customDescription,
                quantity: item.quantity,
                unit_price: item.unitPrice,
                unit: item.unit,
                discount_percent: item.discountPercent,
                is_optional: item.isOptional,
                is_custom: item.isCustom,
                sort_order: itemIdx,
              });
            });
          }
        });

        // Add items from additions (if present)
        if (processedAdditions.length > 0 && additionsId) {
          processedAdditions.forEach((item, idx) => {
            allItemsData.push({
              id: item.id,
              option_id: additionsId,
              product_id: item.productId || null,
              custom_name: item.customName,
              custom_description: item.customDescription,
              quantity: item.quantity,
              unit_price: item.unitPrice,
              unit: item.unit,
              discount_percent: item.discountPercent,
              is_optional: item.isOptional,
              is_custom: item.isCustom,
              sort_order: idx,
            });
          });
        }

        // Bulk insert all items at once
        if (allItemsData.length > 0) {
          const { error: itemsError } = await supabase
            .from('offer_option_items')
            .insert(allItemsData);

          if (itemsError) throw itemsError;
        }
      }

      // Save customer to customers table (source: 'oferty')
      try {
        if (offer.customerData.name || offer.customerData.company) {
          const fullAddress = offer.customerData.companyAddress 
            ? `${offer.customerData.companyAddress}${offer.customerData.companyPostalCode ? ', ' + offer.customerData.companyPostalCode : ''}${offer.customerData.companyCity ? ' ' + offer.customerData.companyCity : ''}`
            : null;

          // Try to find existing customer by phone within this instance and source
          let existingCustomerId: string | null = null;
          
          if (offer.customerData.phone) {
            const { data: existingByPhone } = await supabase
              .from('customers')
              .select('id')
              .eq('instance_id', instanceId)
              .eq('source', 'oferty')
              .eq('phone', offer.customerData.phone)
              .maybeSingle();
            
            if (existingByPhone) {
              existingCustomerId = existingByPhone.id;
            }
          }

          // If not found by phone, try by email
          if (!existingCustomerId && offer.customerData.email) {
            const { data: existingByEmail } = await supabase
              .from('customers')
              .select('id')
              .eq('instance_id', instanceId)
              .eq('source', 'oferty')
              .eq('email', offer.customerData.email)
              .maybeSingle();
            
            if (existingByEmail) {
              existingCustomerId = existingByEmail.id;
            }
          }

          if (existingCustomerId) {
            // Update existing customer
            await supabase
              .from('customers')
              .update({
                name: offer.customerData.name || offer.customerData.company || 'Nieznany',
                email: offer.customerData.email || null,
                phone: offer.customerData.phone?.trim() ? normalizePhone(offer.customerData.phone) : null,
                company: offer.customerData.company || null,
                nip: offer.customerData.nip || null,
                address: fullAddress,
                updated_at: new Date().toISOString(),
              })
              .eq('id', existingCustomerId);
            console.log('Updated offer customer:', existingCustomerId);
          } else {
            // Insert new customer
            const { data: newCustomer, error: customerError } = await supabase
              .from('customers')
              .insert({
                instance_id: instanceId,
                name: offer.customerData.name || offer.customerData.company || 'Nieznany',
                phone: offer.customerData.phone?.trim() ? normalizePhone(offer.customerData.phone) : null,
                email: offer.customerData.email || null,
                company: offer.customerData.company || null,
                nip: offer.customerData.nip || null,
                address: fullAddress,
                source: 'oferty',
              })
              .select('id')
              .maybeSingle();
            
            if (customerError) {
              console.error('Error saving offer customer:', customerError);
            } else {
              console.log('Created new offer customer:', newCustomer?.id);
            }
          }
        }
      } catch (customerSaveError) {
        // Don't fail the whole offer save if customer save fails
        console.error('Error saving customer from offer:', customerSaveError);
      }

      if (!silent) {
        toast.success('Oferta została zapisana');
      }
      return offerId;
    } catch (error) {
      console.error('Error saving offer:', error);
      toast.error('Błąd podczas zapisywania oferty');
      throw error;
    } finally {
      setSaving(false);
    }
  }, [offer, instanceId, calculateTotalNet, calculateTotalGross, calculateOptionTotal, calculateAdditionsTotal]);

  // Load offer from database
  // isDuplicate: if true, regenerates all option/item IDs to prevent primary key conflicts
  const loadOffer = useCallback(async (offerId: string, isDuplicate = false) => {
    setLoading(true);
    try {
      const { data: offerData, error: offerError } = await supabase
        .from('offers')
        .select(`
          *,
          offer_options (
            *,
            offer_option_items (*)
          )
        `)
        .eq('id', offerId)
        .single();

      if (offerError) throw offerError;

      const allOptions = (offerData.offer_options || [])
        .sort((a: any, b: any) => a.sort_order - b.sort_order);
      
      // Separate additions from regular options
      // "Additions" option has name 'Dodatki' but NO scope_id - these are manually added items
      // Options with scope_id (even if named 'Dodatki') are service-based and should be loaded as regular options
      const additionsOption = allOptions.find((opt: any) => opt.name === 'Dodatki' && !opt.scope_id);
      const regularOptions = allOptions.filter((opt: any) => !(opt.name === 'Dodatki' && !opt.scope_id));

      // Build ID mappings for duplication
      const optionIdMap: Record<string, string> = {};
      const itemIdMap: Record<string, string> = {};

      let options: OfferOption[] = regularOptions.map((opt: any) => {
        const originalOptionId = opt.id;
        const newOptionId = isDuplicate ? crypto.randomUUID() : originalOptionId;
        
        if (isDuplicate) {
          optionIdMap[originalOptionId] = newOptionId;
        }
        
        return {
          id: newOptionId,
          name: opt.name,
          description: opt.description,
          isSelected: opt.is_selected,
          sortOrder: opt.sort_order,
          scopeId: opt.scope_id,
          variantId: opt.variant_id,
          isUpsell: opt.is_upsell,
          items: (opt.offer_option_items || [])
            .sort((a: any, b: any) => a.sort_order - b.sort_order)
            .map((item: any) => {
              const originalItemId = item.id;
              const newItemId = isDuplicate ? crypto.randomUUID() : originalItemId;
              
              if (isDuplicate) {
                itemIdMap[originalItemId] = newItemId;
              }
              
              return {
                id: newItemId,
                productId: item.product_id,
                customName: item.custom_name,
                customDescription: item.custom_description,
                quantity: Number(item.quantity),
                unitPrice: Number(item.unit_price),
                unit: item.unit,
                discountPercent: Number(item.discount_percent),
                isOptional: item.is_optional,
                isCustom: item.is_custom,
              };
            }),
        };
      });

      // Extract unique scope IDs from options
      const scopeIdsFromOptions = [...new Set(
        options
          .filter(opt => opt.scopeId)
          .map(opt => opt.scopeId as string)
      )];

      let additions: OfferItem[] = additionsOption 
        ? (additionsOption.offer_option_items || [])
            .sort((a: any, b: any) => a.sort_order - b.sort_order)
            .map((item: any) => {
              const originalItemId = item.id;
              const newItemId = isDuplicate ? crypto.randomUUID() : originalItemId;
              
              if (isDuplicate) {
                itemIdMap[originalItemId] = newItemId;
              }
              
              return {
                id: newItemId,
                productId: item.product_id,
                customName: item.custom_name,
                customDescription: item.custom_description,
                quantity: Number(item.quantity),
                unitPrice: Number(item.unit_price),
                unit: item.unit,
                discountPercent: Number(item.discount_percent),
                isOptional: item.is_optional,
                isCustom: item.is_custom,
              };
            })
        : [];

      // Handle legacy vehicle data format
      const vehicleDataRaw = offerData.vehicle_data as any || defaultVehicleData;
      const vehicleData: VehicleData = {
        brandModel: vehicleDataRaw.brandModel || 
          [vehicleDataRaw.brand, vehicleDataRaw.model].filter(Boolean).join(' ') || '',
        plate: vehicleDataRaw.plate || '',
      };

      // Parse defaultSelectedState from selected_state if it has isDefault marker
      const loadedOptionIds = options.map((o: any) => o.id);
      const loadedItemIds = options.flatMap((o: any) => o.items.map((i: any) => i.id));
      
      const rawSelectedState = offerData.selected_state as any;
      let defaultSelectedState: DefaultSelectedState | undefined;
      
      if (rawSelectedState?.isDefault) {
        if (isDuplicate) {
          // Remap IDs in selected state for duplication
          const { selectedVariants, selectedOptionalItems, selectedItemInOption } = rawSelectedState;
          
          // Map selectedVariants values (optionIds) to new IDs
          const newSelectedVariants: Record<string, string> = {};
          for (const [scopeId, oldOptionId] of Object.entries(selectedVariants || {})) {
            newSelectedVariants[scopeId] = optionIdMap[oldOptionId as string] || (oldOptionId as string);
          }
          
          // Map selectedOptionalItems keys (itemIds) to new IDs
          const newSelectedOptionalItems: Record<string, boolean> = {};
          for (const [oldItemId, value] of Object.entries(selectedOptionalItems || {})) {
            const newItemId = itemIdMap[oldItemId] || oldItemId;
            newSelectedOptionalItems[newItemId] = value as boolean;
          }
          
          // Map selectedItemInOption keys (optionIds) and values (itemIds) to new IDs
          const newSelectedItemInOption: Record<string, string> = {};
          for (const [oldOptionId, oldItemId] of Object.entries(selectedItemInOption || {})) {
            const newOptionId = optionIdMap[oldOptionId] || oldOptionId;
            const newItemIdVal = itemIdMap[oldItemId as string] || (oldItemId as string);
            newSelectedItemInOption[newOptionId] = newItemIdVal;
          }
          
          defaultSelectedState = {
            selectedScopeId: rawSelectedState.selectedScopeId ?? null,
            selectedVariants: newSelectedVariants,
            selectedOptionalItems: newSelectedOptionalItems,
            selectedItemInOption: newSelectedItemInOption,
          };
          
          console.log('[Duplicate] Regenerated IDs:', {
            optionIdMapCount: Object.keys(optionIdMap).length,
            itemIdMapCount: Object.keys(itemIdMap).length,
          });
        } else {
          defaultSelectedState = {
            selectedScopeId: rawSelectedState.selectedScopeId ?? null,
            selectedVariants: rawSelectedState.selectedVariants || {},
            selectedOptionalItems: rawSelectedState.selectedOptionalItems || {},
            selectedItemInOption: rawSelectedState.selectedItemInOption || {},
          };
        }
        
        // Consistency check (only log for non-duplicates to avoid noise)
        if (!isDuplicate) {
          const selectedVariantIds = Object.values(defaultSelectedState.selectedVariants);
          const selectedOptionalItemIds = Object.keys(defaultSelectedState.selectedOptionalItems);
          const selectedItemInOptionIds = Object.values(defaultSelectedState.selectedItemInOption);
          
          const missingVariants = selectedVariantIds.filter(id => !loadedOptionIds.includes(id));
          const missingOptionalItems = selectedOptionalItemIds.filter(id => !loadedItemIds.includes(id));
          const missingItemInOption = selectedItemInOptionIds.filter(id => !loadedItemIds.includes(id));
          
          console.group('📥 [LOAD] Offer Selection State AFTER load (entering step 3)');
          console.log('offer.id:', offerData.id);
          console.log('selected_state from DB:', JSON.stringify(rawSelectedState, null, 2));
          console.log('loaded option IDs:', loadedOptionIds);
          console.log('loaded item IDs:', loadedItemIds);
          console.log('🔍 Consistency check:');
          console.log('  - Missing variant IDs in loaded options:', missingVariants.length > 0 ? missingVariants : '✅ all found');
          console.log('  - Missing optional item IDs in loaded items:', missingOptionalItems.length > 0 ? missingOptionalItems : '✅ all found');
          console.log('  - Missing itemInOption IDs in loaded items:', missingItemInOption.length > 0 ? missingItemInOption : '✅ all found');
          console.groupEnd();
        }
      }

      setOffer({
        id: isDuplicate ? undefined : offerData.id, // Clear ID for duplicates
        instanceId: offerData.instance_id,
        customerData: (offerData.customer_data || defaultCustomerData) as unknown as CustomerData,
        vehicleData,
        selectedScopeIds: scopeIdsFromOptions,
        options,
        additions,
        notes: offerData.notes,
        paymentTerms: offerData.payment_terms,
        warranty: (offerData as any).warranty || '',
        serviceInfo: (offerData as any).service_info || '',
        validUntil: offerData.valid_until,
        vatRate: Number(offerData.vat_rate),
        hideUnitPrices: offerData.hide_unit_prices || false,
        status: isDuplicate ? 'draft' : offerData.status as OfferState['status'], // Reset status for duplicates
        defaultSelectedState,
      });
    } catch (error) {
      console.error('Error loading offer:', error);
      toast.error('Błąd podczas wczytywania oferty');
      throw error;
    } finally {
      setLoading(false);
    }
  }, []);

  // Reset offer
  const resetOffer = useCallback(() => {
    setOffer({
      instanceId,
      customerData: defaultCustomerData,
      vehicleData: defaultVehicleData,
      selectedScopeIds: [],
      options: [],
      additions: [],
      vatRate: 23,
      hideUnitPrices: false,
      status: 'draft',
    });
  }, [instanceId]);

  return {
    offer,
    loading,
    saving,
    updateCustomerData,
    updateVehicleData,
    updateSelectedScopes,
    generateOptionsFromScopes,
    addOption,
    updateOption,
    removeOption,
    duplicateOption,
    addItemToOption,
    updateItemInOption,
    removeItemFromOption,
    addAddition,
    updateAddition,
    removeAddition,
    updateOffer,
    calculateOptionTotal,
    calculateAdditionsTotal,
    calculateTotalNet,
    calculateTotalGross,
    saveOffer,
    loadOffer,
    resetOffer,
  };
};
