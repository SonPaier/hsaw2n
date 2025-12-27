import { useState, useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
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
}

export interface VehicleData {
  brandModel?: string;
  plate?: string;
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
}

export interface OfferState {
  id?: string;
  instanceId: string;
  customerData: CustomerData;
  vehicleData: VehicleData;
  options: OfferOption[];
  additions: OfferItem[];
  notes?: string;
  paymentTerms?: string;
  validUntil?: string;
  vatRate: number;
  status: 'draft' | 'sent' | 'viewed' | 'accepted' | 'rejected' | 'expired';
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
};

const defaultVehicleData: VehicleData = {
  brandModel: '',
  plate: '',
};

export const useOffer = (instanceId: string) => {
  const [offer, setOffer] = useState<OfferState>({
    instanceId,
    customerData: defaultCustomerData,
    vehicleData: defaultVehicleData,
    options: [],
    additions: [],
    vatRate: 23,
    status: 'draft',
  });
  
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Initialize with one default option
  useEffect(() => {
    if (offer.options.length === 0 && !offer.id) {
      setOffer(prev => ({
        ...prev,
        options: [{
          id: crypto.randomUUID(),
          name: 'Opcja 1',
          description: '',
          items: [],
          isSelected: true,
          sortOrder: 0,
        }],
      }));
    }
  }, []);

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
  const saveOffer = useCallback(async () => {
    setSaving(true);
    try {
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

      // Save main offer - cast to Json for Supabase
      const offerData: {
        instance_id: string;
        customer_data: Json;
        vehicle_data: Json;
        notes?: string;
        payment_terms?: string;
        valid_until?: string;
        vat_rate: number;
        total_net: number;
        total_gross: number;
        status: string;
        offer_number?: string;
      } = {
        instance_id: instanceId,
        customer_data: offer.customerData as unknown as Json,
        vehicle_data: offer.vehicleData as unknown as Json,
        notes: offer.notes,
        payment_terms: offer.paymentTerms,
        valid_until: offer.validUntil,
        vat_rate: offer.vatRate,
        total_net: totalNet,
        total_gross: totalGross,
        status: offer.status,
        ...(offerNumber && { offer_number: offerNumber }),
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
      if (offer.id) {
        await supabase.from('offer_options').delete().eq('offer_id', offer.id);
      }

      // Insert options
      for (const option of offer.options) {
        const optionData = {
          offer_id: offerId,
          name: option.name,
          description: option.description,
          is_selected: option.isSelected,
          sort_order: option.sortOrder,
          subtotal_net: calculateOptionTotal(option),
        };

        const { data: optionResult, error: optionError } = await supabase
          .from('offer_options')
          .insert(optionData)
          .select('id')
          .single();

        if (optionError) throw optionError;

        // Insert items
        if (option.items.length > 0) {
          const itemsData = option.items.map((item, idx) => ({
            option_id: optionResult.id,
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
          }));

          const { error: itemsError } = await supabase
            .from('offer_option_items')
            .insert(itemsData);

          if (itemsError) throw itemsError;
        }
      }

      // Insert additions as a special option
      if (offer.additions.length > 0) {
        const additionsOptionData = {
          offer_id: offerId,
          name: 'Dodatki',
          description: '',
          is_selected: true,
          sort_order: offer.options.length,
          subtotal_net: calculateAdditionsTotal(),
        };

        const { data: additionsOption, error: additionsOptionError } = await supabase
          .from('offer_options')
          .insert(additionsOptionData)
          .select('id')
          .single();

        if (additionsOptionError) throw additionsOptionError;

        const additionsItemsData = offer.additions.map((item, idx) => ({
          option_id: additionsOption.id,
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
        }));

        const { error: additionsItemsError } = await supabase
          .from('offer_option_items')
          .insert(additionsItemsData);

        if (additionsItemsError) throw additionsItemsError;
      }

      toast.success('Oferta została zapisana');
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
  const loadOffer = useCallback(async (offerId: string) => {
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
      const additionsOption = allOptions.find((opt: any) => opt.name === 'Dodatki');
      const regularOptions = allOptions.filter((opt: any) => opt.name !== 'Dodatki');

      const options: OfferOption[] = regularOptions.map((opt: any) => ({
        id: opt.id,
        name: opt.name,
        description: opt.description,
        isSelected: opt.is_selected,
        sortOrder: opt.sort_order,
        items: (opt.offer_option_items || [])
          .sort((a: any, b: any) => a.sort_order - b.sort_order)
          .map((item: any) => ({
            id: item.id,
            productId: item.product_id,
            customName: item.custom_name,
            customDescription: item.custom_description,
            quantity: Number(item.quantity),
            unitPrice: Number(item.unit_price),
            unit: item.unit,
            discountPercent: Number(item.discount_percent),
            isOptional: item.is_optional,
            isCustom: item.is_custom,
          })),
      }));

      const additions: OfferItem[] = additionsOption 
        ? (additionsOption.offer_option_items || [])
            .sort((a: any, b: any) => a.sort_order - b.sort_order)
            .map((item: any) => ({
              id: item.id,
              productId: item.product_id,
              customName: item.custom_name,
              customDescription: item.custom_description,
              quantity: Number(item.quantity),
              unitPrice: Number(item.unit_price),
              unit: item.unit,
              discountPercent: Number(item.discount_percent),
              isOptional: item.is_optional,
              isCustom: item.is_custom,
            }))
        : [];

      // Handle legacy vehicle data format
      const vehicleDataRaw = offerData.vehicle_data as any || defaultVehicleData;
      const vehicleData: VehicleData = {
        brandModel: vehicleDataRaw.brandModel || 
          [vehicleDataRaw.brand, vehicleDataRaw.model].filter(Boolean).join(' ') || '',
        plate: vehicleDataRaw.plate || '',
      };

      setOffer({
        id: offerData.id,
        instanceId: offerData.instance_id,
        customerData: (offerData.customer_data || defaultCustomerData) as unknown as CustomerData,
        vehicleData,
        options,
        additions,
        notes: offerData.notes,
        paymentTerms: offerData.payment_terms,
        validUntil: offerData.valid_until,
        vatRate: Number(offerData.vat_rate),
        status: offerData.status as OfferState['status'],
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
      options: [{
        id: crypto.randomUUID(),
        name: 'Opcja 1',
        description: '',
        items: [],
        isSelected: true,
        sortOrder: 0,
      }],
      additions: [],
      vatRate: 23,
      status: 'draft',
    });
  }, [instanceId]);

  return {
    offer,
    loading,
    saving,
    updateCustomerData,
    updateVehicleData,
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
