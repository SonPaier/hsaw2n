import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Helmet } from 'react-helmet-async';
import { 
  FileText, 
  Check, 
  X, 
  Download, 
  User, 
  Building2, 
  Car, 
  Calendar,
  Clock,
  Loader2,
  AlertCircle,
  Save,
  Sparkles,
  Shield,
  Award,
  Star,
  Users,
  Heart,
  Pencil,
  Facebook,
  Instagram,
  Phone
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { pl } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { DEFAULT_BRANDING, OfferBranding, getContrastTextColor } from '@/lib/colorUtils';

interface OfferScopeRef {
  id: string;
  name: string;
  is_extras_scope?: boolean;
}

interface OfferOption {
  id: string;
  name: string;
  description?: string;
  is_selected: boolean;
  subtotal_net: number;
  sort_order?: number;
  scope_id?: string | null;
  is_upsell?: boolean;
  scope?: OfferScopeRef | null;
  offer_option_items: {
    id: string;
    custom_name: string;
    custom_description?: string;
    quantity: number;
    unit_price: number;
    unit: string;
    discount_percent: number;
    is_optional: boolean;
    products_library?: {
      description?: string;
    } | null;
  }[];
}

interface SelectedState {
  selectedVariants: Record<string, string>;
  selectedUpsells: Record<string, boolean>;
  selectedOptionalItems: Record<string, boolean>;
  // Track which scope (non-extras) is selected - only one allowed
  selectedScopeId?: string | null;
  // Track which item is selected within multi-item options (key: option_id, value: item_id)
  selectedItemInOption?: Record<string, string>;
}

interface Offer {
  id: string;
  offer_number: string;
  instance_id: string;
  customer_data: {
    name?: string;
    email?: string;
    phone?: string;
    company?: string;
    nip?: string;
    address?: string;
  };
  vehicle_data?: {
    brand?: string;
    model?: string;
    brandModel?: string;
    plate?: string;
    vin?: string;
    year?: number;
  };
  status: string;
  total_net: number;
  total_gross: number;
  vat_rate: number;
  notes?: string;
  payment_terms?: string;
  valid_until?: string;
  hide_unit_prices: boolean;
  created_at: string;
  approved_at?: string | null;
  selected_state?: SelectedState | null;
  offer_options: OfferOption[];
  instances: {
    name: string;
    logo_url?: string;
    phone?: string;
    email?: string;
    address?: string;
    website?: string;
    social_facebook?: string;
    social_instagram?: string;
    offer_branding_enabled?: boolean;
    offer_bg_color?: string;
    offer_header_bg_color?: string;
    offer_header_text_color?: string;
    offer_section_bg_color?: string;
    offer_section_text_color?: string;
    offer_primary_color?: string;
  };
}

const getStatusLabels = (t: (key: string) => string): Record<string, string> => ({
  draft: t('offers.statusDraft'),
  sent: t('offers.statusSent'),
  viewed: t('offers.statusViewed'),
  accepted: t('offers.statusAccepted'),
  rejected: t('offers.statusRejected'),
  expired: t('offers.statusExpired'),
});

// Helper to render description - supports HTML or plain text with line breaks
const renderDescription = (text: string) => {
  // Check if text contains HTML tags
  const hasHtmlTags = /<[^>]+>/.test(text);
  
  if (hasHtmlTags) {
    // Render as HTML (for formatted content)
    return (
      <div 
        className="text-sm text-foreground/70 mt-1 prose prose-sm max-w-none prose-p:my-1 prose-ul:my-1 prose-li:my-0"
        dangerouslySetInnerHTML={{ __html: text }}
      />
    );
  } else {
    // Plain text - preserve line breaks and whitespace
    return (
      <p className="text-sm text-foreground/70 mt-1 whitespace-pre-line">{text}</p>
    );
  }
};

const PublicOfferView = () => {
  const { t } = useTranslation();
  const { token } = useParams<{ token: string }>();
  const { user, hasRole, hasInstanceRole } = useAuth();
  const [offer, setOffer] = useState<Offer | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [responding, setResponding] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [showRejectionForm, setShowRejectionForm] = useState(false);
  const [savingState, setSavingState] = useState(false);
  // Edit mode for accepted offers
  const [isEditMode, setIsEditMode] = useState(false);
  
  // Track selected variant per scope (key: scope_id, value: option_id)
  const [selectedVariants, setSelectedVariants] = useState<Record<string, string>>({});
  // Track selected optional items (key: item_id, value: boolean) - includes extras + opcje dodatkowe
  const [selectedOptionalItems, setSelectedOptionalItems] = useState<Record<string, boolean>>({});
  // Track which non-extras scope is selected (only one allowed)
  const [selectedScopeId, setSelectedScopeId] = useState<string | null>(null);
  // Track which item is selected within multi-item options (key: option_id, value: item_id)
  const [selectedItemInOption, setSelectedItemInOption] = useState<Record<string, string>>({});

  useEffect(() => {
    const fetchOffer = async () => {
      if (!token) {
        setError(t('publicOffer.invalidLink'));
        setLoading(false);
        return;
      }

      try {
        const { data, error } = await supabase
          .from('offers')
          .select(`
            *,
            offer_options (
              *,
              scope:offer_scopes (
                id,
                name,
                is_extras_scope
              ),
              offer_option_items (
                *,
                products_library (
                  description
                )
              )
            ),
            instances (
              name,
              logo_url,
              phone,
              email,
              address,
              website,
              social_facebook,
              social_instagram,
              offer_branding_enabled,
              offer_bg_color,
              offer_header_bg_color,
              offer_header_text_color,
              offer_section_bg_color,
              offer_section_text_color,
              offer_primary_color
            )
          `)
          .eq('public_token', token)
          .single();

        if (error) throw error;
        if (!data) {
          setError(t('publicOffer.notFound'));
          return;
        }

        const fetchedOffer = data as unknown as Offer;
        setOffer(fetchedOffer);

        // Check if there's a saved selected_state to restore
        const savedState = fetchedOffer.selected_state;
        
        if (savedState) {
          const restoredVariants = savedState.selectedVariants || {};
          const restoredUpsells = savedState.selectedUpsells || {};
          const restoredOptionalItems = savedState.selectedOptionalItems || {};
          const restoredItemInOption = savedState.selectedItemInOption || {};

          // Backward compatibility: old offers stored upsells as whole-option selection.
          // Now each upsell item is independent, so mark all items of selected upsells as selected.
          const mergedOptionalItems: Record<string, boolean> = { ...restoredOptionalItems };
          fetchedOffer.offer_options.forEach((opt) => {
            if (opt.is_upsell && restoredUpsells[opt.id]) {
              opt.offer_option_items?.forEach((item) => {
                mergedOptionalItems[item.id] = true;
              });
            }
          });

          // Backward compatibility: initialize selectedItemInOption for multi-item options if not saved
          const mergedItemInOption: Record<string, string> = { ...restoredItemInOption };
          fetchedOffer.offer_options.forEach((opt) => {
            if (!opt.is_upsell && !opt.scope?.is_extras_scope) {
              const nonOptionalItems = opt.offer_option_items?.filter(i => !i.is_optional) || [];
              if (nonOptionalItems.length > 1 && !mergedItemInOption[opt.id]) {
                // Default to first item
                mergedItemInOption[opt.id] = nonOptionalItems[0].id;
              }
            }
          });

          setSelectedVariants(restoredVariants);
          setSelectedOptionalItems(mergedOptionalItems);
          setSelectedScopeId(savedState.selectedScopeId ?? null);
          setSelectedItemInOption(mergedItemInOption);
        } else {
          // Initialize selected variants - first non-upsell variant per scope
          const initialVariants: Record<string, string> = {};
          const initialItemInOption: Record<string, string> = {};
          const selectedOptions = fetchedOffer.offer_options.filter(opt => opt.is_selected);
          
          // Group by scope and select first non-upsell variant for each scope
          const scopeGroups = selectedOptions.reduce((acc, opt) => {
            const key = opt.scope_id ?? '__ungrouped__';
            if (!acc[key]) acc[key] = [];
            acc[key].push(opt);
            return acc;
          }, {} as Record<string, OfferOption[]>);
          
          // Find first non-extras scope to set as default selected
          let firstNonExtrasScope: string | null = null;
          
          Object.entries(scopeGroups).forEach(([scopeId, options]) => {
            // Check if this is an extras scope
            const isExtrasScope = options.some(o => o.scope?.is_extras_scope);
            
            // Only consider non-upsell options as variants
            const variants = options.filter(o => !o.is_upsell).sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
            if (variants.length > 0) {
              initialVariants[scopeId] = variants[0].id;
              // Set first non-extras scope as the selected one
              if (!isExtrasScope && !firstNonExtrasScope) {
                firstNonExtrasScope = scopeId;
              }
              // For each variant, if it has multiple non-optional items, select the first one
              variants.forEach(variant => {
                const nonOptionalItems = variant.offer_option_items.filter(item => !item.is_optional);
                if (nonOptionalItems.length > 1) {
                  initialItemInOption[variant.id] = nonOptionalItems[0].id;
                }
              });
            }
          });
          setSelectedVariants(initialVariants);
          setSelectedScopeId(firstNonExtrasScope);
          setSelectedItemInOption(initialItemInOption);
        }

        // Mark as viewed if not already
        if (data.status === 'sent') {
          await supabase
            .from('offers')
            .update({ status: 'viewed', viewed_at: new Date().toISOString() })
            .eq('id', data.id);
        }
      } catch (err) {
        console.error('Error fetching offer:', err);
        setError(t('publicOffer.loadError'));
      } finally {
        setLoading(false);
      }
    };

    fetchOffer();
  }, [token]);

  // Confirm selection - saves state, changes status to accepted, creates notification
  const handleConfirmSelection = async () => {
    if (!offer) return;
    setResponding(true);
    try {
      const derivedUpsells: Record<string, boolean> = {};
      offer.offer_options.forEach((opt) => {
        if (opt.is_upsell) {
          const anySelected = opt.offer_option_items?.some((i) => !!selectedOptionalItems[i.id]);
          if (anySelected) derivedUpsells[opt.id] = true;
        }
      });

      const stateToSave: SelectedState = {
        selectedVariants,
        selectedUpsells: derivedUpsells,
        selectedOptionalItems,
        selectedScopeId,
        selectedItemInOption,
      };
      
      const { error } = await supabase
        .from('offers')
        .update({ 
          status: 'accepted', 
          responded_at: new Date().toISOString(),
          approved_at: new Date().toISOString(),
          selected_state: JSON.parse(JSON.stringify(stateToSave)),
          // Update totals based on selection
          total_net: dynamicTotals.net,
          total_gross: dynamicTotals.gross,
        })
        .eq('id', offer.id);

      if (error) throw error;
      
      // Create notification for offer acceptance
      await supabase
        .from('notifications')
        .insert({
          instance_id: offer.instance_id,
          type: 'offer_approved',
          title: t('publicOffer.notificationAcceptedTitle', { number: offer.offer_number }),
          description: t('publicOffer.notificationAcceptedDesc', { name: offer.customer_data?.name || t('customers.customer'), price: formatPrice(dynamicTotals.gross) }),
          entity_type: 'offer',
          entity_id: offer.id,
        });
      
      setOffer({ 
        ...offer, 
        status: 'accepted', 
        selected_state: stateToSave,
        approved_at: new Date().toISOString(),
        total_net: dynamicTotals.net,
        total_gross: dynamicTotals.gross,
      });
      setIsEditMode(false);
      toast.success(t('publicOffer.offerApproved'));
    } catch (err) {
      toast.error(t('publicOffer.approvalError'));
    } finally {
      setResponding(false);
    }
  };

  const handleAccept = async () => {
    // Use handleConfirmSelection for the confirm flow
    await handleConfirmSelection();
  };

  const handleReject = async () => {
    if (!offer) return;
    setResponding(true);
    try {
      const { error } = await supabase
        .from('offers')
        .update({ 
          status: 'rejected', 
          responded_at: new Date().toISOString(),
          notes: rejectionReason ? `${offer.notes || ''}\n\n${t('publicOffer.rejectionReason')}: ${rejectionReason}` : offer.notes
        })
        .eq('id', offer.id);

      if (error) throw error;
      setOffer({ ...offer, status: 'rejected' });
      setShowRejectionForm(false);
      toast.success(t('publicOffer.offerRejected'));
    } catch (err) {
      toast.error(t('publicOffer.rejectionError'));
    } finally {
      setResponding(false);
    }
  };

  const formatPrice = (value: number) => {
    return new Intl.NumberFormat('pl-PL', {
      style: 'currency',
      currency: 'PLN',
    }).format(value);
  };

  // Calculate dynamic total based on selected scope, variant, upsells, optional items, and extras
  const calculateDynamicTotal = () => {
    if (!offer) return { net: 0, gross: 0 };
    
    let totalNet = 0;
    
    // Identify extras scope options (their items are tracked via selectedOptionalItems)
    const extrasScopeOptionIds = new Set<string>();
    const extrasScopeIds = new Set<string>();
    offer.offer_options.forEach(opt => {
      if (opt.scope?.is_extras_scope) {
        extrasScopeOptionIds.add(opt.id);
        if (opt.scope_id) extrasScopeIds.add(opt.scope_id);
      }
    });
    
    // Only count the selected scope's variant (non-extras scopes)
    if (selectedScopeId && selectedVariants[selectedScopeId]) {
      const optionId = selectedVariants[selectedScopeId];
      const option = offer.offer_options.find(o => o.id === optionId);
      if (option && !extrasScopeOptionIds.has(option.id)) {
        // Check if this option has multiple non-optional items (single-select mode)
        const nonOptionalItems = option.offer_option_items.filter(i => !i.is_optional);
        const hasMultipleNonOptional = nonOptionalItems.length > 1;
        const selectedItemId = selectedItemInOption[option.id];
        
        // Calculate option total from items
        option.offer_option_items.forEach(item => {
          if (item.is_optional) {
            // Optional items use toggle selection
            if (selectedOptionalItems[item.id]) {
              const itemTotal = item.quantity * item.unit_price * (1 - item.discount_percent / 100);
              totalNet += itemTotal;
            }
          } else {
            // Non-optional items: if multiple, only count selected one
            if (hasMultipleNonOptional) {
              if (item.id === selectedItemId) {
                const itemTotal = item.quantity * item.unit_price * (1 - item.discount_percent / 100);
                totalNet += itemTotal;
              }
            } else {
              // Single non-optional item - always count
              const itemTotal = item.quantity * item.unit_price * (1 - item.discount_percent / 100);
              totalNet += itemTotal;
            }
          }
        });
      }
    }
    
    // Add selected upsell items (Opcje dodatkowe) - każda pozycja jest niezależna
    offer.offer_options.forEach((option) => {
      if (option.is_upsell && option.scope_id === selectedScopeId && !extrasScopeOptionIds.has(option.id)) {
        option.offer_option_items.forEach((item) => {
          if (selectedOptionalItems[item.id]) {
            const itemTotal = item.quantity * item.unit_price * (1 - item.discount_percent / 100);
            totalNet += itemTotal;
          }
        });
      }
    });
    
    // Add selected items from extras scope (each item is individually selectable)
    offer.offer_options.forEach(option => {
      if (extrasScopeOptionIds.has(option.id)) {
        option.offer_option_items.forEach(item => {
          if (selectedOptionalItems[item.id]) {
            const itemTotal = item.quantity * item.unit_price * (1 - item.discount_percent / 100);
            totalNet += itemTotal;
          }
        });
      }
    });
    
    const totalGross = totalNet * (1 + offer.vat_rate / 100);
    return { net: totalNet, gross: totalGross };
  };

  const dynamicTotals = calculateDynamicTotal();

  // Handle selecting a scope (and its variant) - only one non-extras scope can be selected
  const handleSelectScope = (scopeId: string, optionId: string) => {
    setSelectedScopeId(scopeId);
    setSelectedVariants((prev) => ({ ...prev, [scopeId]: optionId }));

    // Keep only optional-item selections that belong to this scope or extras scopes
    setSelectedOptionalItems((prev) => {
      if (!offer) return prev;

      const allowed = new Set<string>();
      offer.offer_options.forEach((opt) => {
        if (opt.scope?.is_extras_scope || opt.scope_id === scopeId) {
          opt.offer_option_items.forEach((item) => allowed.add(item.id));
        }
      });

      const next: Record<string, boolean> = {};
      Object.entries(prev).forEach(([itemId, selected]) => {
        if (selected && allowed.has(itemId)) next[itemId] = true;
      });

      return next;
    });
  };

  const handleSelectVariant = (scopeId: string, optionId: string) => {
    // When selecting a variant, also set this scope as the selected one
    handleSelectScope(scopeId, optionId);
  };

  const handleToggleOptionalItem = (itemId: string) => {
    setSelectedOptionalItems(prev => ({ ...prev, [itemId]: !prev[itemId] }));
  };

  // Handle selecting a specific item within an option (for multi-item options with single-select)
  const handleSelectItemInOption = (optionId: string, itemId: string) => {
    setSelectedItemInOption(prev => ({ ...prev, [optionId]: itemId }));
  };


  // Check if user is admin for this offer's instance
  const isAdmin = user && offer && (
    hasRole('super_admin') || hasInstanceRole('admin', offer.instance_id)
  );

  const handleSaveState = async () => {
    if (!offer || !isAdmin) return;
    setSavingState(true);
    try {
      const derivedUpsells: Record<string, boolean> = {};
      offer.offer_options.forEach((opt) => {
        if (opt.is_upsell) {
          const anySelected = opt.offer_option_items?.some((i) => !!selectedOptionalItems[i.id]);
          if (anySelected) derivedUpsells[opt.id] = true;
        }
      });

      const stateToSave: SelectedState = {
        selectedVariants,
        selectedUpsells: derivedUpsells,
        selectedOptionalItems,
        selectedScopeId,
        selectedItemInOption,
      };
      
      const { error } = await supabase
        .from('offers')
        .update({ selected_state: JSON.parse(JSON.stringify(stateToSave)) })
        .eq('id', offer.id);
      
      if (error) throw error;
      
      // Create notification for offer modification (only if not admin saving their own state)
      // Note: This is for admin state save, don't create notification
      
      setOffer({ ...offer, selected_state: stateToSave });
      toast.success(t('publicOffer.selectionSaved'));
    } catch (err) {
      console.error('Error saving state:', err);
      toast.error(t('publicOffer.saveError'));
    } finally {
      setSavingState(false);
    }
  };

  // Handle when customer modifies selection (non-admin)
  const handleCustomerSaveSelection = async () => {
    if (!offer || isAdmin) return;
    setSavingState(true);
    try {
      const derivedUpsells: Record<string, boolean> = {};
      offer.offer_options.forEach((opt) => {
        if (opt.is_upsell) {
          const anySelected = opt.offer_option_items?.some((i) => !!selectedOptionalItems[i.id]);
          if (anySelected) derivedUpsells[opt.id] = true;
        }
      });

      const stateToSave: SelectedState = {
        selectedVariants,
        selectedUpsells: derivedUpsells,
        selectedOptionalItems,
        selectedScopeId,
        selectedItemInOption,
      };
      
      const { error } = await supabase
        .from('offers')
        .update({ selected_state: JSON.parse(JSON.stringify(stateToSave)) })
        .eq('id', offer.id);
      
      if (error) throw error;
      
      // Create notification for customer modifying offer selection
      await supabase
        .from('notifications')
        .insert({
          instance_id: offer.instance_id,
          type: 'offer_modified',
          title: t('publicOffer.notificationModifiedTitle', { number: offer.offer_number }),
          description: t('publicOffer.notificationModifiedDesc', { name: offer.customer_data?.name || t('customers.customer') }),
          entity_type: 'offer',
          entity_id: offer.id,
        });
      
      setOffer({ ...offer, selected_state: stateToSave });
      toast.success(t('publicOffer.yourSelectionSaved'));
    } catch (err) {
      console.error('Error saving state:', err);
      toast.error(t('publicOffer.saveError'));
    } finally {
      setSavingState(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !offer) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center">
            <AlertCircle className="w-12 h-12 mx-auto text-destructive mb-4" />
            <h2 className="text-xl font-semibold mb-2">{t('common.error')}</h2>
            <p className="text-muted-foreground">{error || t('publicOffer.notFound')}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const instance = offer.instances;
  const isExpired = offer.valid_until && new Date(offer.valid_until) < new Date();
  // Don't allow responding if already accepted (approved_at is set)
  const canRespond = ['draft', 'sent', 'viewed'].includes(offer.status) && !isExpired && !offer.approved_at;
  const isAccepted = offer.status === 'accepted' || !!offer.approved_at;
  // Interactions disabled when accepted and not in edit mode
  const interactionsDisabled = isAccepted && !isEditMode;

  // Branding colors
  const brandingEnabled = instance?.offer_branding_enabled ?? false;
  const branding: OfferBranding = {
    offer_branding_enabled: brandingEnabled,
    offer_bg_color: brandingEnabled ? (instance?.offer_bg_color ?? DEFAULT_BRANDING.offer_bg_color) : DEFAULT_BRANDING.offer_bg_color,
    offer_header_bg_color: brandingEnabled ? (instance?.offer_header_bg_color ?? DEFAULT_BRANDING.offer_header_bg_color) : DEFAULT_BRANDING.offer_header_bg_color,
    offer_header_text_color: brandingEnabled ? (instance?.offer_header_text_color ?? DEFAULT_BRANDING.offer_header_text_color) : DEFAULT_BRANDING.offer_header_text_color,
    offer_section_bg_color: brandingEnabled ? (instance?.offer_section_bg_color ?? DEFAULT_BRANDING.offer_section_bg_color) : DEFAULT_BRANDING.offer_section_bg_color,
    offer_section_text_color: brandingEnabled ? (instance?.offer_section_text_color ?? DEFAULT_BRANDING.offer_section_text_color) : DEFAULT_BRANDING.offer_section_text_color,
    offer_primary_color: brandingEnabled ? (instance?.offer_primary_color ?? DEFAULT_BRANDING.offer_primary_color) : DEFAULT_BRANDING.offer_primary_color,
  };
  
  // Computed colors for primary buttons
  const primaryButtonTextColor = getContrastTextColor(branding.offer_primary_color);

  const selectedOptions = offer.offer_options
    .filter((opt) => opt.is_selected)
    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));

  const scopeSections = Object.values(
    selectedOptions.reduce(
      (acc, opt) => {
        const inferredNameFromTitle = opt.name.includes(' - ')
          ? opt.name.split(' - ')[0]
          : null;
        const key = opt.scope_id ?? inferredNameFromTitle ?? '__ungrouped__';

        const inferredScopeName = opt.scope_id
          ? opt.scope?.name ?? inferredNameFromTitle ?? 'Usługa'
          : inferredNameFromTitle ?? 'Pozostałe';
        
        const isExtrasScope = opt.scope?.is_extras_scope ?? false;

        if (!acc[key]) {
          acc[key] = {
            key,
            scopeName: inferredScopeName,
            sortKey: opt.sort_order ?? 0,
            isExtrasScope,
            options: [] as OfferOption[],
          };
        }
        acc[key].options.push(opt);
        return acc;
      },
      {} as Record<
        string,
        { key: string; scopeName: string; sortKey: number; isExtrasScope: boolean; options: OfferOption[] }
      >
    )
  ).sort((a, b) => a.sortKey - b.sortKey);

  return (
    <>
      <Helmet>
        <title>Oferta {offer.offer_number} – {instance?.name || 'Firma'}</title>
        <meta
          name="description"
          content={`Oferta ${offer.offer_number} od ${instance?.name || 'firmy'}: usługi, pozycje i podsumowanie kosztów.`}
        />
        {typeof window !== 'undefined' && (
          <link rel="canonical" href={window.location.href} />
        )}
      </Helmet>
      
      <div 
        className="min-h-screen"
        style={{ backgroundColor: branding.offer_bg_color }}
      >
        {/* Header */}
        <header 
          className="border-b"
          style={{ backgroundColor: branding.offer_header_bg_color }}
        >
          <div className="max-w-4xl mx-auto px-4 py-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                {instance?.logo_url ? (
                  <img
                    src={instance.logo_url}
                    alt={`Logo ${instance.name}`}
                    className="h-12 object-contain"
                  />
                ) : (
                  <div 
                    className="w-12 h-12 rounded-lg flex items-center justify-center"
                    style={{ backgroundColor: `${branding.offer_primary_color}20` }}
                  >
                    <FileText className="w-6 h-6" style={{ color: branding.offer_primary_color }} />
                  </div>
                )}
                <div>
                  <h1 
                    className="font-bold text-lg"
                    style={{ color: branding.offer_header_text_color }}
                  >
                    <span className="sr-only">Oferta </span>
                    {instance?.name}
                  </h1>
                  <p 
                    className="text-sm opacity-70"
                    style={{ color: branding.offer_header_text_color }}
                  >
                    Oferta nr {offer.offer_number}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {isAdmin && (
                  <Button
                    variant="default"
                    size="sm"
                    onClick={handleSaveState}
                    disabled={savingState}
                    className="gap-1"
                    style={{ 
                      backgroundColor: branding.offer_primary_color,
                      color: primaryButtonTextColor,
                    }}
                  >
                    {savingState ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Save className="w-4 h-4" />
                    )}
                    {t('publicOffer.save')}
                  </Button>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={async () => {
                    try {
                      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-offer-pdf`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ token }),
                      });
                      const html = await response.text();
                      const blob = new Blob([html], { type: 'text/html' });
                      const url = URL.createObjectURL(blob);
                      const link = document.createElement('a');
                      link.href = url;
                      link.download = `Oferta_${offer.offer_number}.html`;
                      document.body.appendChild(link);
                      link.click();
                      document.body.removeChild(link);
                      URL.revokeObjectURL(url);
                    } catch (err) {
                      toast.error(t('publicOffer.downloadError'));
                    }
                  }}
                  className="gap-1"
                >
                  <Download className="w-4 h-4" />
                  {t('publicOffer.downloadPdf')}
                </Button>
                <Badge 
                  className={cn(
                    offer.status === 'accepted' && 'bg-green-500/20 text-green-600',
                    offer.status === 'rejected' && 'bg-red-500/20 text-red-600',
                    offer.status === 'viewed' && 'bg-amber-500/20 text-amber-600',
                    offer.status === 'sent' && 'bg-blue-500/20 text-blue-600',
                  )}
                >
                  {getStatusLabels(t)[offer.status] || offer.status}
                </Badge>
              </div>
            </div>
          </div>
        </header>

        <main className="max-w-4xl mx-auto px-4 py-8 space-y-6">
          {/* Validity warning */}
          {isExpired && (
            <Card className="border-destructive bg-destructive/10">
              <CardContent className="py-4 flex items-center gap-3">
                <AlertCircle className="w-5 h-5 text-destructive" />
                <p className="text-destructive font-medium">{t('publicOffer.offerExpired')}</p>
              </CardContent>
            </Card>
          )}

          {/* About Us Section */}
          <Card 
            className="border"
            style={{ 
              backgroundColor: branding.offer_section_bg_color,
              borderColor: `${branding.offer_primary_color}33`,
            }}
          >
            <CardContent className="pt-6">
              <div className="text-center mb-6">
                <h2 
                  className="text-xl font-bold mb-2"
                  style={{ color: branding.offer_section_text_color }}
                >
                  {t('publicOffer.whyTrustUs')}
                </h2>
                <p 
                  className="text-sm max-w-2xl mx-auto opacity-70"
                  style={{ color: branding.offer_section_text_color }}
                >
                  {t('publicOffer.trustDescription')}
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {[
                  { icon: Sparkles, title: t('publicOffer.methodBryt'), desc: t('publicOffer.methodBrytDesc') },
                  { icon: Award, title: t('publicOffer.premiumProducts'), desc: t('publicOffer.premiumProductsDesc') },
                  { icon: Shield, title: t('publicOffer.oemPrecision'), desc: t('publicOffer.oemPrecisionDesc') },
                  { icon: Car, title: t('publicOffer.fullProtection'), desc: t('publicOffer.fullProtectionDesc') },
                  { icon: Star, title: t('publicOffer.reviews'), desc: t('publicOffer.reviewsDesc') },
                  { icon: Heart, title: t('publicOffer.individualApproach'), desc: t('publicOffer.individualApproachDesc') },
                ].map((item, idx) => (
                  <div 
                    key={idx}
                    className="rounded-lg p-4 border shadow-sm"
                    style={{ 
                      backgroundColor: branding.offer_section_bg_color,
                      borderColor: `${branding.offer_primary_color}1a`,
                    }}
                  >
                    <div className="flex items-center gap-3 mb-2">
                      <div 
                        className="w-10 h-10 rounded-full flex items-center justify-center"
                        style={{ backgroundColor: `${branding.offer_primary_color}1a` }}
                      >
                        <item.icon className="w-5 h-5" style={{ color: branding.offer_primary_color }} />
                      </div>
                      <h3 
                        className="font-semibold text-sm"
                        style={{ color: branding.offer_section_text_color }}
                      >
                        {item.title}
                      </h3>
                    </div>
                    <p 
                      className="text-xs opacity-70"
                      style={{ color: branding.offer_section_text_color }}
                    >
                      {item.desc}
                    </p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Customer & Vehicle Info */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card 
              className="border"
              style={{ 
                backgroundColor: branding.offer_section_bg_color,
                borderColor: `${branding.offer_primary_color}33`,
              }}
            >
              <CardHeader className="pb-3">
                <CardTitle 
                  className="flex items-center gap-2 text-base"
                  style={{ color: branding.offer_section_text_color }}
                >
                  <User className="w-4 h-4" />
                  {t('publicOffer.forClient')}
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm space-y-1">
                <p className="font-medium" style={{ color: branding.offer_section_text_color }}>
                  {offer.customer_data?.name}
                </p>
                {offer.customer_data?.company && (
                  <p 
                    className="flex items-center gap-1 opacity-70"
                    style={{ color: branding.offer_section_text_color }}
                  >
                    <Building2 className="w-3 h-3" />
                    {offer.customer_data.company}
                  </p>
                )}
                {offer.customer_data?.nip && (
                  <p className="opacity-70" style={{ color: branding.offer_section_text_color }}>
                    NIP: {offer.customer_data.nip}
                  </p>
                )}
                {offer.customer_data?.email && (
                  <p className="opacity-70" style={{ color: branding.offer_section_text_color }}>
                    {offer.customer_data.email}
                  </p>
                )}
              </CardContent>
            </Card>

            {(offer.vehicle_data?.brand || offer.vehicle_data?.brandModel) && (
              <Card 
                className="border"
                style={{ 
                  backgroundColor: branding.offer_section_bg_color,
                  borderColor: `${branding.offer_primary_color}33`,
                }}
              >
                <CardHeader className="pb-3">
                  <CardTitle 
                    className="flex items-center gap-2 text-base"
                    style={{ color: branding.offer_section_text_color }}
                  >
                    <Car className="w-4 h-4" />
                    {t('publicOffer.vehicle')}
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-sm space-y-1">
                  <p className="font-medium" style={{ color: branding.offer_section_text_color }}>
                    {offer.vehicle_data.brandModel || `${offer.vehicle_data.brand || ''} ${offer.vehicle_data.model || ''}`.trim()}
                  </p>
                  {offer.vehicle_data.plate && (
                    <p className="opacity-70" style={{ color: branding.offer_section_text_color }}>
                      {offer.vehicle_data.plate}
                    </p>
                  )}
                </CardContent>
              </Card>
            )}
          </div>

          {/* Usługi (scope) */}
          {scopeSections.length === 0 ? (
            <Card>
              <CardContent className="pt-6 text-sm text-muted-foreground">
                {t('publicOffer.noPositions')}
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-8">
              {scopeSections.map((section) => {
                // For extras scope, flatten all items from all options as individually selectable
                if (section.isExtrasScope) {
                  // Collect all items from all options in this extras scope
                  const allItems = section.options.flatMap(option => 
                    option.offer_option_items.map(item => ({
                      ...item,
                      optionId: option.id,
                      optionDescription: option.description
                    }))
                  );

                  return (
                    <section key={section.key} className="space-y-3">
                      <div className="flex items-center gap-2">
                        <h2 
                          className="text-base font-semibold"
                          style={{ color: branding.offer_section_text_color }}
                        >
                          {section.scopeName}
                        </h2>
                        <Badge variant="secondary" className="text-xs">{t('publicOffer.extras')}</Badge>
                      </div>

                      {allItems.map((item) => {
                        const isItemSelected = selectedOptionalItems[item.id];
                        const itemTotal = item.quantity * item.unit_price * (1 - item.discount_percent / 100);
                        
                        return (
                          <Card 
                            key={item.id}
                            className={cn(
                              "transition-all border",
                              isItemSelected && "ring-2",
                              !isItemSelected && "opacity-70"
                            )}
                            style={{
                              backgroundColor: branding.offer_section_bg_color,
                              borderColor: isItemSelected ? branding.offer_primary_color : `${branding.offer_primary_color}33`,
                              ...(isItemSelected ? { '--tw-ring-color': branding.offer_primary_color } as React.CSSProperties : {}),
                            }}
                          >
                            <CardContent className="py-4">
                              <div className="flex items-center justify-between">
                                <div className="flex-1">
                                  <p 
                                    className="font-medium"
                                    style={{ color: branding.offer_section_text_color }}
                                  >
                                    {item.custom_name}
                                  </p>
                                  {item.custom_description && renderDescription(item.custom_description)}
                                  {!offer.hide_unit_prices && (
                                    <p 
                                      className="text-sm mt-1 opacity-70"
                                      style={{ color: branding.offer_section_text_color }}
                                    >
                                      {item.quantity} {item.unit} × {formatPrice(item.unit_price)}
                                      {item.discount_percent > 0 && ` (-${item.discount_percent}%)`}
                                    </p>
                                  )}
                                </div>
                                <div className="flex items-center gap-3">
                                  {!offer.hide_unit_prices && (
                                    <span 
                                      className="font-medium"
                                      style={{ color: branding.offer_section_text_color }}
                                    >
                                      {formatPrice(itemTotal)}
                                    </span>
                                  )}
                                  <Button
                                    variant={isItemSelected ? "default" : "outline"}
                                    size="sm"
                                    onClick={() => handleToggleOptionalItem(item.id)}
                                    disabled={interactionsDisabled}
                                    className="shrink-0"
                                    style={isItemSelected ? { 
                                      backgroundColor: branding.offer_primary_color, 
                                      color: primaryButtonTextColor 
                                    } : {}}
                                  >
                                    {isItemSelected ? (
                                      <>
                                        <Check className="w-4 h-4 mr-1" />
                                        Dodane
                                      </>
                                    ) : (
                                      'Dodaj'
                                    )}
                                  </Button>
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        );
                      })}
                    </section>
                  );
                }

                // Regular scope - variants + upsells
                const variants = section.options.filter(o => !o.is_upsell);
                const upsells = section.options.filter(o => o.is_upsell);
                const hasMultipleVariants = variants.length > 1;
                const selectedOptionId = selectedVariants[section.key];
                // Check if this scope is the selected one (for single-scope selection)
                const isScopeSelected = selectedScopeId === section.key;
                
                return (
                  <section key={section.key} className="space-y-3">
                    <h2 
                      className="text-base font-semibold flex items-center gap-2"
                      style={{ color: branding.offer_section_text_color }}
                    >
                      {section.scopeName}
                      {isScopeSelected && (
                        <Badge 
                          variant="default" 
                          className="text-xs"
                          style={{ backgroundColor: branding.offer_primary_color, color: primaryButtonTextColor }}
                        >
                          Wybrana
                        </Badge>
                      )}
                    </h2>

                    {/* Render variants */}
                    {variants.map((option) => {
                      const isSelected = selectedOptionId === option.id;
                      const variantName = option.name.includes(' - ') 
                        ? option.name.split(' - ').slice(1).join(' - ')
                        : option.name;
                      
                      return (
                        <article key={option.id}>
                          <Card 
                            className={cn(
                              "transition-all border",
                              hasMultipleVariants && isSelected && isScopeSelected && "ring-2",
                            )}
                            style={{
                              backgroundColor: branding.offer_section_bg_color,
                              borderColor: hasMultipleVariants && isSelected && isScopeSelected 
                                ? branding.offer_primary_color 
                                : `${branding.offer_primary_color}33`,
                              ...(hasMultipleVariants && isSelected && isScopeSelected 
                                ? { '--tw-ring-color': branding.offer_primary_color } as React.CSSProperties 
                                : {}),
                            }}
                          >
                            <CardHeader className="pb-3">
                              <div className="flex items-center justify-between">
                                <div>
                                  <CardTitle 
                                    className="text-lg font-semibold"
                                    style={{ color: branding.offer_section_text_color }}
                                  >
                                    {variantName}
                                  </CardTitle>
                                  {option.description && (
                                    <p 
                                      className="text-sm opacity-70"
                                      style={{ color: branding.offer_section_text_color }}
                                    >
                                      {option.description}
                                    </p>
                                  )}
                                </div>
                                {hasMultipleVariants && (
                                  <Button
                                    variant={isSelected && isScopeSelected ? "default" : "outline"}
                                    size="sm"
                                    onClick={() => handleSelectVariant(section.key, option.id)}
                                    disabled={interactionsDisabled}
                                    className="shrink-0"
                                    style={isSelected && isScopeSelected ? { 
                                      backgroundColor: branding.offer_primary_color, 
                                      color: primaryButtonTextColor 
                                    } : {}}
                                  >
                                    {isSelected && isScopeSelected ? (
                                      <>
                                        <Check className="w-4 h-4 mr-1" />
                                        Wybrany
                                      </>
                                    ) : (
                                      'Wybierz'
                                    )}
                                  </Button>
                                )}
                                {/* Show select button for single variant too, to select this scope */}
                                {!hasMultipleVariants && !isScopeSelected && (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleSelectVariant(section.key, option.id)}
                                    disabled={interactionsDisabled}
                                    className="shrink-0"
                                  >
                                    Wybierz usługę
                                  </Button>
                                )}
                                {!hasMultipleVariants && isScopeSelected && (
                                  <Badge 
                                    variant="default" 
                                    className="text-xs"
                                    style={{ backgroundColor: branding.offer_primary_color, color: primaryButtonTextColor }}
                                  >
                                    Wybrana
                                  </Badge>
                                )}
                              </div>
                            </CardHeader>
                            <CardContent>
                              {(() => {
                                // Check if option has multiple non-optional items (single-select mode)
                                const nonOptionalItems = option.offer_option_items.filter(i => !i.is_optional);
                                const hasMultipleNonOptional = nonOptionalItems.length > 1;
                                const selectedItemId = selectedItemInOption[option.id];
                                
                                return (
                                  <>
                                    {/* Show items - with single-select for multiple non-optional items */}
                                    <div className="space-y-2">
                                      {option.offer_option_items.map((item) => {
                                        const isOptionalSelected = selectedOptionalItems[item.id];
                                        const isItemSelected = item.id === selectedItemId;
                                        const isNonOptionalInMulti = !item.is_optional && hasMultipleNonOptional;
                                        const itemTotal = item.quantity * item.unit_price * (1 - item.discount_percent / 100);
                                        
                                        return (
                                          <div
                                            key={item.id}
                                            className={cn(
                                              "flex items-center justify-between py-2 px-3 rounded-md transition-all",
                                              item.is_optional && !isOptionalSelected && "text-muted-foreground",
                                              isNonOptionalInMulti && isItemSelected && "bg-primary/5 ring-1 ring-primary/20",
                                              isNonOptionalInMulti && !isItemSelected && "opacity-60"
                                            )}
                                          >
                                            <div className="flex-1">
                                              <div className="flex items-center gap-2">
                                                <span className="font-medium">{item.custom_name}</span>
                                                {item.is_optional && !isOptionalSelected && (
                                                  <Badge variant="outline" className="text-xs">
                                                    opcjonalne
                                                  </Badge>
                                                )}
                                              </div>
                                              {(item.custom_description || item.products_library?.description) && 
                                                renderDescription(item.custom_description || item.products_library?.description || '')
                                              }
                                              {/* Show price for each item when there are multiple non-optional */}
                                              {!offer.hide_unit_prices && isNonOptionalInMulti && (
                                                <p className="text-sm text-muted-foreground mt-1">
                                                  {formatPrice(itemTotal)}
                                                </p>
                                              )}
                                            </div>
                                            {/* Single-select button for non-optional items when >1 */}
                                            {isNonOptionalInMulti && (
                                              <Button
                                                variant={isItemSelected ? "default" : "outline"}
                                                size="sm"
                                                onClick={() => handleSelectItemInOption(option.id, item.id)}
                                                disabled={interactionsDisabled}
                                                className="shrink-0"
                                              >
                                                {isItemSelected ? (
                                                  <>
                                                    <Check className="w-4 h-4 mr-1" />
                                                    Wybrany
                                                  </>
                                                ) : (
                                                  'Wybierz'
                                                )}
                                              </Button>
                                            )}
                                            {/* Toggle button for optional items */}
                                            {item.is_optional && (
                                              <Button
                                                variant={isOptionalSelected ? "default" : "outline"}
                                                size="sm"
                                                onClick={() => handleToggleOptionalItem(item.id)}
                                                disabled={interactionsDisabled}
                                              >
                                                {isOptionalSelected ? (
                                                  <>
                                                    <Check className="w-4 h-4 mr-1" />
                                                    Dodane
                                                  </>
                                                ) : (
                                                  'Dodaj'
                                                )}
                                              </Button>
                                            )}
                                          </div>
                                        );
                                      })}
                                    </div>
                                    {(() => {
                                      // Calculate price based on selection for multi-item options
                                      let displayTotal = option.subtotal_net;
                                      let originalTotal = option.offer_option_items.reduce((sum, item) => {
                                        return sum + (item.quantity * item.unit_price);
                                      }, 0);
                                      
                                      if (hasMultipleNonOptional && selectedItemId) {
                                        const selectedItem = option.offer_option_items.find(i => i.id === selectedItemId);
                                        if (selectedItem) {
                                          displayTotal = selectedItem.quantity * selectedItem.unit_price * (1 - selectedItem.discount_percent / 100);
                                          originalTotal = selectedItem.quantity * selectedItem.unit_price;
                                        }
                                      }
                                      
                                      const hasDiscount = option.offer_option_items.some(item => item.discount_percent > 0);
                                      const discountPercent = originalTotal > 0 ? Math.round((1 - displayTotal / originalTotal) * 100) : 0;
                                      
                                      return (
                                        <div className="flex justify-end pt-4 font-medium items-center">
                                          <div className="flex items-center gap-2">
                                            {hasDiscount && originalTotal > displayTotal && discountPercent > 0 && (
                                              <>
                                                <span className="text-muted-foreground line-through text-sm">
                                                  {formatPrice(originalTotal)}
                                                </span>
                                                <Badge variant="secondary" className="text-xs">
                                                  -{discountPercent}%
                                                </Badge>
                                              </>
                                            )}
                                            <span className={hasDiscount && discountPercent > 0 ? "text-primary" : ""}>
                                              {formatPrice(displayTotal)}
                                            </span>
                                          </div>
                                        </div>
                                      );
                                    })()}
                                  </>
                                );
                              })()}
                            </CardContent>
                          </Card>
                        </article>
                      );
                    })}

                    {/* Opcje dodatkowe - pozycje niezależne (multi-select) */}
                    {upsells.length > 0 && (
                      <div className="space-y-3">
                        <div className="flex items-center gap-2 pt-2">
                          <h3 className="text-sm font-semibold text-foreground">Opcje dodatkowe</h3>
                        </div>

                        {upsells.flatMap((option) => {
                          const groupName = option.name.includes(' - ')
                            ? option.name.split(' - ').slice(1).join(' - ')
                            : option.name;

                          return option.offer_option_items.map((item) => {
                            const isItemSelected = selectedOptionalItems[item.id];
                            const itemTotal = item.quantity * item.unit_price * (1 - item.discount_percent / 100);

                            return (
                              <article key={item.id}>
                                <Card
                                  className={cn(
                                    "transition-all border",
                                    isItemSelected && "ring-2",
                                    !isItemSelected && "opacity-70"
                                  )}
                                  style={{
                                    backgroundColor: branding.offer_section_bg_color,
                                    borderColor: isItemSelected ? branding.offer_primary_color : `${branding.offer_primary_color}33`,
                                    ...(isItemSelected ? { '--tw-ring-color': branding.offer_primary_color } as React.CSSProperties : {}),
                                  }}
                                >
                                  <CardContent className="py-4">
                                    <div className="flex items-center justify-between gap-4">
                                      <div className="flex-1">
                                        <div className="flex items-center gap-2">
                                          <p 
                                            className="font-medium"
                                            style={{ color: branding.offer_section_text_color }}
                                          >
                                            {item.custom_name}
                                          </p>
                                          <Badge variant="secondary" className="text-xs">{groupName}</Badge>
                                        </div>

                                        {(item.custom_description || item.products_library?.description) &&
                                          renderDescription(item.custom_description || item.products_library?.description || '')}

                                        {!offer.hide_unit_prices && (
                                          <p 
                                            className="text-sm mt-1 opacity-70"
                                            style={{ color: branding.offer_section_text_color }}
                                          >
                                            {item.quantity} {item.unit} × {formatPrice(item.unit_price)}
                                            {item.discount_percent > 0 && ` (-${item.discount_percent}%)`}
                                          </p>
                                        )}
                                      </div>

                                      <div className="flex items-center gap-3">
                                        {!offer.hide_unit_prices && (
                                          <span 
                                            className="font-medium"
                                            style={{ color: branding.offer_section_text_color }}
                                          >
                                            {formatPrice(itemTotal)}
                                          </span>
                                        )}
                                        <Button
                                          variant={isItemSelected ? "default" : "outline"}
                                          size="sm"
                                          onClick={() => handleToggleOptionalItem(item.id)}
                                          disabled={interactionsDisabled}
                                          className="shrink-0"
                                          style={isItemSelected ? { 
                                            backgroundColor: branding.offer_primary_color, 
                                            color: primaryButtonTextColor 
                                          } : {}}
                                        >
                                          {isItemSelected ? (
                                            <>
                                              <Check className="w-4 h-4 mr-1" />
                                              Dodane
                                            </>
                                          ) : (
                                            'Dodaj'
                                          )}
                                        </Button>
                                      </div>
                                    </div>
                                  </CardContent>
                                </Card>
                              </article>
                            );
                          });
                        })}
                      </div>
                    )}
                  </section>
                );
              })}
            </div>
          )}

          {/* Totals - Dynamic */}
          <Card 
            className="sticky bottom-4 shadow-lg border"
            style={{ 
              backgroundColor: branding.offer_section_bg_color,
              borderColor: `${branding.offer_primary_color}33`,
            }}
          >
            <CardContent className="pt-6 space-y-3">
              <div className="flex justify-between">
                <span className="opacity-70" style={{ color: branding.offer_section_text_color }}>
                  {t('publicOffer.netSum')}
                </span>
                <span style={{ color: branding.offer_section_text_color }}>
                  {formatPrice(dynamicTotals.net)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="opacity-70" style={{ color: branding.offer_section_text_color }}>
                  VAT ({offer.vat_rate}%)
                </span>
                <span style={{ color: branding.offer_section_text_color }}>
                  {formatPrice(dynamicTotals.gross - dynamicTotals.net)}
                </span>
              </div>
              <Separator />
              <div className="flex justify-between text-lg font-bold">
                <span style={{ color: branding.offer_section_text_color }}>
                  {t('publicOffer.grossTotal')}
                </span>
                <span style={{ color: branding.offer_primary_color }}>{formatPrice(dynamicTotals.gross)}</span>
              </div>
            </CardContent>
          </Card>

          {/* Notes & Terms */}
          {(offer.notes || offer.payment_terms || offer.valid_until) && (
            <Card 
              className="border"
              style={{ 
                backgroundColor: branding.offer_section_bg_color,
                borderColor: `${branding.offer_primary_color}33`,
              }}
            >
              <CardContent className="pt-6 space-y-3 text-sm">
                {offer.valid_until && (
                  <div className="flex items-center gap-2" style={{ color: branding.offer_section_text_color }}>
                    <Calendar className="w-4 h-4 opacity-70" />
                    <span>
                      {t('publicOffer.offerValidUntil')}: <strong>{format(new Date(offer.valid_until), 'd MMMM yyyy', { locale: pl })}</strong>
                    </span>
                  </div>
                )}
                {offer.payment_terms && (
                  <div className="flex items-center gap-2" style={{ color: branding.offer_section_text_color }}>
                    <Clock className="w-4 h-4 opacity-70" />
                    <span>{t('publicOffer.paymentTerms')}: {offer.payment_terms}</span>
                  </div>
                )}
                {offer.notes && (
                  <div 
                    className="pt-2 whitespace-pre-wrap opacity-70"
                    style={{ color: branding.offer_section_text_color }}
                  >
                    {offer.notes}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Actions - for non-accepted offers */}
          {canRespond && (
            <Card 
              className="border"
              style={{ 
                backgroundColor: branding.offer_section_bg_color,
                borderColor: `${branding.offer_primary_color}33`,
              }}
            >
              <CardContent className="pt-6">
                <div className="flex justify-center">
                  <Button 
                    className="gap-2" 
                    size="lg"
                    onClick={handleConfirmSelection}
                    disabled={responding || !selectedScopeId}
                    style={{ 
                      backgroundColor: branding.offer_primary_color, 
                      color: primaryButtonTextColor 
                    }}
                  >
                    {responding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-5 h-5" />}
                    {t('publicOffer.confirmSelection')}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Accepted offer - show edit/confirm buttons */}
          {isAccepted && (
            <Card className="border-green-500/50 bg-green-500/10">
              <CardContent className="py-6">
                <div className="text-center mb-4">
                  <Check className="w-12 h-12 mx-auto text-green-600 mb-3" />
                  <h3 className="text-lg font-semibold text-green-700">{t('publicOffer.offerAccepted')}</h3>
                  <p className="text-muted-foreground">
                    {isEditMode 
                      ? 'Możesz teraz zmienić swoje wybory i zatwierdzić ponownie.' 
                      : (
                        <>
                          Dziękujemy! Skontaktujemy się z Tobą wkrótce
                          {instance?.phone && (
                            <>
                              {' '}lub zadzwoń do nas:{' '}
                              <a 
                                href={`tel:${instance.phone}`} 
                                className="font-medium hover:underline"
                                style={{ color: branding.offer_primary_color }}
                              >
                                {instance.phone}
                              </a>
                            </>
                          )}
                        </>
                      )}
                  </p>
                </div>
                
                <div className="flex flex-col sm:flex-row gap-3 justify-center">
                  {isEditMode ? (
                    <>
                      <Button 
                        variant="outline" 
                        onClick={() => setIsEditMode(false)}
                        disabled={responding}
                        className="gap-2"
                      >
                        <X className="w-4 h-4" />
                        {t('publicOffer.cancelEdit')}
                      </Button>
                      <Button 
                        onClick={handleConfirmSelection}
                        disabled={responding || !selectedScopeId}
                        className="gap-2"
                      >
                        {responding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                        {t('publicOffer.saveChanges')}
                      </Button>
                    </>
                  ) : (
                    <Button 
                      variant="outline" 
                      onClick={() => setIsEditMode(true)}
                      className="gap-2"
                    >
                      <Pencil className="w-4 h-4" />
                      {t('publicOffer.editSelection')}
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Social media links */}
          {(instance?.social_facebook || instance?.social_instagram) && (
            <Card>
              <CardContent className="py-6">
                <div className="text-center">
                  <p className="text-muted-foreground mb-4">
                    Zobacz nasze realizacje i obserwuj nas w social media
                  </p>
                  <div className="flex justify-center gap-4">
                    {instance?.social_facebook && (
                      <a 
                        href={instance.social_facebook} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 px-4 py-2 bg-[#1877F2] text-white rounded-lg hover:bg-[#1877F2]/90 transition-colors"
                      >
                        <Facebook className="w-5 h-5" />
                        <span>Facebook</span>
                      </a>
                    )}
                    {instance?.social_instagram && (
                      <a 
                        href={instance.social_instagram} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-[#833AB4] via-[#FD1D1D] to-[#F77737] text-white rounded-lg hover:opacity-90 transition-opacity"
                      >
                        <Instagram className="w-5 h-5" />
                        <span>Instagram</span>
                      </a>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {offer.status === 'rejected' && (
            <Card className="border-red-500/50 bg-red-500/10">
              <CardContent className="py-6 text-center">
                <X className="w-12 h-12 mx-auto text-red-600 mb-3" />
                <h3 className="text-lg font-semibold text-red-700">Oferta odrzucona</h3>
              </CardContent>
            </Card>
          )}

          {/* Footer */}
          <footer className="text-center text-sm text-muted-foreground pt-8 pb-4">
            <p>{instance?.name}</p>
            {instance?.address && <p>{instance.address}</p>}
            {instance?.phone && <p>Tel: {instance.phone}</p>}
            {instance?.email && <p>Email: {instance.email}</p>}
          </footer>
        </main>
      </div>
    </>
  );
};

export default PublicOfferView;
