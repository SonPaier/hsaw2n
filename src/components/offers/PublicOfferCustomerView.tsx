import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { 
  FileText, 
  Check, 
  User, 
  Building2, 
  Car, 
  Calendar,
  Clock,
  Loader2,
  Sparkles,
  Shield,
  Award,
  Star,
  Heart,
  Pencil,
  Facebook,
  Instagram,
  X,
  Save,
  Phone,
  MapPin,
  Mail,
  Globe,
  ExternalLink,
  Copy,
  CreditCard
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { pl } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { DEFAULT_BRANDING, OfferBranding, getContrastTextColor } from '@/lib/colorUtils';

interface OfferScopeRef {
  id: string;
  name: string;
  is_extras_scope?: boolean;
}

interface OfferOptionItem {
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
  offer_option_items: OfferOptionItem[];
}

interface SelectedState {
  selectedVariants: Record<string, string>;
  selectedUpsells: Record<string, boolean>;
  selectedOptionalItems: Record<string, boolean>;
  selectedScopeId?: string | null;
  selectedItemInOption?: Record<string, string>;
}

interface Instance {
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
  offer_scope_header_text_color?: string;
  offer_portfolio_url?: string;
  offer_google_reviews_url?: string;
  contact_person?: string;
  offer_bank_company_name?: string;
  offer_bank_account_number?: string;
  offer_bank_name?: string;
}

export interface PublicOfferData {
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
  instances: Instance;
}

interface PublicOfferCustomerViewProps {
  offer: PublicOfferData;
  mode: 'public' | 'overlayPreview';
  embedded?: boolean;
  isAdmin?: boolean;
  onSaveState?: () => Promise<void>;
  savingState?: boolean;
}

// Helper to render description - supports HTML or plain text with line breaks
const renderDescription = (text: string) => {
  const hasHtmlTags = /<[^>]+>/.test(text);
  
  if (hasHtmlTags) {
    return (
      <div 
        className="text-sm text-foreground/70 mt-1 prose prose-sm max-w-none prose-p:my-1 prose-ul:my-1 prose-li:my-0"
        dangerouslySetInnerHTML={{ __html: text }}
      />
    );
  } else {
    return (
      <p className="text-sm text-foreground/70 mt-1 whitespace-pre-line">{text}</p>
    );
  }
};

export const PublicOfferCustomerView = ({
  offer,
  mode,
  embedded = false,
  isAdmin = false,
  onSaveState,
  savingState = false,
}: PublicOfferCustomerViewProps) => {
  const { t } = useTranslation();
  const [responding, setResponding] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  
  // Track selected variant per scope (key: scope_id, value: option_id)
  const [selectedVariants, setSelectedVariants] = useState<Record<string, string>>({});
  // Track selected optional items (key: item_id, value: boolean)
  const [selectedOptionalItems, setSelectedOptionalItems] = useState<Record<string, boolean>>({});
  // Track which non-extras scope is selected (only one allowed)
  const [selectedScopeId, setSelectedScopeId] = useState<string | null>(null);
  // Track which item is selected within multi-item options (key: option_id, value: item_id)
  const [selectedItemInOption, setSelectedItemInOption] = useState<Record<string, string>>({});

  // Initialize state from offer.selected_state or defaults
  useEffect(() => {
    const savedState = offer.selected_state;
    
    if (savedState) {
      const restoredVariants = savedState.selectedVariants || {};
      const restoredUpsells = savedState.selectedUpsells || {};
      const restoredOptionalItems = savedState.selectedOptionalItems || {};
      const restoredItemInOption = savedState.selectedItemInOption || {};

      // Backward compatibility: old offers stored upsells as whole-option selection.
      const mergedOptionalItems: Record<string, boolean> = { ...restoredOptionalItems };
      offer.offer_options.forEach((opt) => {
        if (opt.is_upsell && restoredUpsells[opt.id]) {
          opt.offer_option_items?.forEach((item) => {
            mergedOptionalItems[item.id] = true;
          });
        }
      });

      // Backward compatibility: initialize selectedItemInOption for multi-item options if not saved
      const mergedItemInOption: Record<string, string> = { ...restoredItemInOption };
      offer.offer_options.forEach((opt) => {
        if (!opt.is_upsell && !opt.scope?.is_extras_scope) {
          const nonOptionalItems = opt.offer_option_items?.filter(i => !i.is_optional) || [];
          if (nonOptionalItems.length > 1 && !mergedItemInOption[opt.id]) {
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
      const selectedOptions = offer.offer_options.filter(opt => opt.is_selected);
      
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
        const isExtrasScope = options.some(o => o.scope?.is_extras_scope);
        const variants = options.filter(o => !o.is_upsell).sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
        if (variants.length > 0) {
          initialVariants[scopeId] = variants[0].id;
          if (!isExtrasScope && !firstNonExtrasScope) {
            firstNonExtrasScope = scopeId;
          }
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
  }, [offer]);

  const formatPrice = (value: number) => {
    return new Intl.NumberFormat('pl-PL', {
      style: 'currency',
      currency: 'PLN',
    }).format(value);
  };

  // Calculate dynamic total based on selected scope, variant, upsells, optional items, and extras
  const calculateDynamicTotal = () => {
    let totalNet = 0;
    
    // Identify extras scope options
    const extrasScopeOptionIds = new Set<string>();
    offer.offer_options.forEach(opt => {
      if (opt.scope?.is_extras_scope) {
        extrasScopeOptionIds.add(opt.id);
      }
    });
    
    // Only count the selected scope's variant (non-extras scopes)
    if (selectedScopeId && selectedVariants[selectedScopeId]) {
      const optionId = selectedVariants[selectedScopeId];
      const option = offer.offer_options.find(o => o.id === optionId);
      if (option && !extrasScopeOptionIds.has(option.id)) {
        const nonOptionalItems = option.offer_option_items.filter(i => !i.is_optional);
        const hasMultipleNonOptional = nonOptionalItems.length > 1;
        const selectedItemId = selectedItemInOption[option.id];
        
        option.offer_option_items.forEach(item => {
          if (item.is_optional) {
            if (selectedOptionalItems[item.id]) {
              const itemTotal = item.quantity * item.unit_price * (1 - item.discount_percent / 100);
              totalNet += itemTotal;
            }
          } else {
            if (hasMultipleNonOptional) {
              if (item.id === selectedItemId) {
                const itemTotal = item.quantity * item.unit_price * (1 - item.discount_percent / 100);
                totalNet += itemTotal;
              }
            } else {
              const itemTotal = item.quantity * item.unit_price * (1 - item.discount_percent / 100);
              totalNet += itemTotal;
            }
          }
        });
      }
    }
    
    // Add selected upsell items
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
    
    // Add selected items from extras scope
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

  // Handle selecting a scope (and its variant)
  const handleSelectScope = (scopeId: string, optionId: string) => {
    setSelectedScopeId(scopeId);
    setSelectedVariants((prev) => ({ ...prev, [scopeId]: optionId }));

    // Keep only optional-item selections that belong to this scope or extras scopes
    setSelectedOptionalItems((prev) => {
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
    handleSelectScope(scopeId, optionId);
  };

  const handleToggleOptionalItem = (itemId: string) => {
    setSelectedOptionalItems(prev => ({ ...prev, [itemId]: !prev[itemId] }));
  };

  const handleSelectItemInOption = (optionId: string, itemId: string) => {
    setSelectedItemInOption(prev => ({ ...prev, [optionId]: itemId }));
  };

  // Confirm selection - only for public mode
  const handleConfirmSelection = async () => {
    if (mode === 'overlayPreview') return;
    
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
          total_net: dynamicTotals.net,
          total_gross: dynamicTotals.gross,
        })
        .eq('id', offer.id);

      if (error) throw error;
      
      // Create notification
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
      
      setIsEditMode(false);
      toast.success(t('publicOffer.offerApproved'));
      // Reload page to show updated state
      window.location.reload();
    } catch (err) {
      toast.error(t('publicOffer.approvalError'));
    } finally {
      setResponding(false);
    }
  };

  const instance = offer.instances;
  const isExpired = offer.valid_until && new Date(offer.valid_until) < new Date();
  const canRespond = mode === 'public' && ['draft', 'sent', 'viewed'].includes(offer.status) && !isExpired && !offer.approved_at;
  const isAccepted = offer.status === 'accepted' || !!offer.approved_at;
  // In overlay mode, always allow interactions. In public mode, disabled when accepted and not editing
  const interactionsDisabled = mode === 'public' && isAccepted && !isEditMode;

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
    offer_scope_header_text_color: brandingEnabled ? (instance?.offer_scope_header_text_color ?? DEFAULT_BRANDING.offer_scope_header_text_color) : DEFAULT_BRANDING.offer_scope_header_text_color,
  };
  
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
    <div 
      className={embedded ? "min-h-full" : "min-h-screen"}
      style={{ backgroundColor: branding.offer_bg_color }}
    >
      {/* Header */}
      <header 
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
            {/* Only show admin save button in public mode */}
            {mode === 'public' && isAdmin && onSaveState && (
              <Button
                variant="default"
                size="sm"
                onClick={onSaveState}
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
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8 space-y-6">
        {/* Validity warning - only in public mode */}
        {mode === 'public' && isExpired && (
          <Card className="border-destructive bg-destructive/10">
            <CardContent className="py-4 flex items-center gap-3">
              <Clock className="w-5 h-5 text-destructive" />
              <p className="text-destructive font-medium">{t('publicOffer.offerExpired')}</p>
            </CardContent>
          </Card>
        )}

        {/* Contact Cards: Company (left) + Customer (right) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* LEFT - Company Contact / Expert Number */}
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
                <Phone className="w-4 h-4" />
                {t('publicOffer.expertNumber')}
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm space-y-2">
              {instance?.contact_person && (
                <p className="font-medium" style={{ color: branding.offer_section_text_color }}>
                  {instance.contact_person}
                </p>
              )}
              {instance?.phone && (
                <a 
                  href={`tel:${instance.phone}`}
                  className="flex items-center gap-2 hover:underline font-medium"
                  style={{ color: branding.offer_primary_color }}
                >
                  <Phone className="w-3 h-3" />
                  {instance.phone}
                </a>
              )}
              {instance?.address && (
                <p 
                  className="flex items-center gap-2 opacity-70"
                  style={{ color: branding.offer_section_text_color }}
                >
                  <MapPin className="w-3 h-3 shrink-0" />
                  {instance.address}
                </p>
              )}
              {instance?.email && (
                <a 
                  href={`mailto:${instance.email}`}
                  className="flex items-center gap-2 opacity-70 hover:underline"
                  style={{ color: branding.offer_section_text_color }}
                >
                  <Mail className="w-3 h-3" />
                  {instance.email}
                </a>
              )}
              {instance?.website && (
                <a 
                  href={instance.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 opacity-70 hover:underline"
                  style={{ color: branding.offer_section_text_color }}
                >
                  <Globe className="w-3 h-3" />
                  {instance.website}
                </a>
              )}
            </CardContent>
          </Card>

          {/* RIGHT - Customer */}
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
                <a 
                  href={`mailto:${offer.customer_data.email}`}
                  className="block opacity-70 hover:underline"
                  style={{ color: branding.offer_section_text_color }}
                >
                  {offer.customer_data.email}
                </a>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Vehicle - separate full-width card */}
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

        {/* Why Trust Us Section - moved below vehicle */}
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

        {/* Service Sections */}
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
                        style={{ color: branding.offer_scope_header_text_color }}
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
              const isScopeSelected = selectedScopeId === section.key;
              
              return (
                <section key={section.key} className="space-y-3">
                  <h2 
                    className="text-base font-semibold flex items-center gap-2"
                    style={{ color: branding.offer_scope_header_text_color }}
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
                              const nonOptionalItems = option.offer_option_items.filter(i => !i.is_optional);
                              const hasMultipleNonOptional = nonOptionalItems.length > 1;
                              const selectedItemId = selectedItemInOption[option.id];
                              
                              return (
                                <>
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
                                            {!offer.hide_unit_prices && isNonOptionalInMulti && (
                                              <p className="text-sm text-muted-foreground mt-1">
                                                {formatPrice(itemTotal)}
                                              </p>
                                            )}
                                          </div>
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

                                  {/* Variant subtotal */}
                                  {!offer.hide_unit_prices && (
                                    <div 
                                      className="mt-4 pt-3 border-t flex justify-between"
                                      style={{ borderColor: `${branding.offer_primary_color}20` }}
                                    >
                                      <span 
                                        className="font-medium"
                                        style={{ color: branding.offer_section_text_color }}
                                      >
                                        Razem
                                      </span>
                                      <span 
                                        className="font-bold"
                                        style={{ color: branding.offer_primary_color }}
                                      >
                                        {formatPrice((() => {
                                          let variantTotal = 0;
                                          option.offer_option_items.forEach(item => {
                                            if (item.is_optional) {
                                              if (selectedOptionalItems[item.id]) {
                                                variantTotal += item.quantity * item.unit_price * (1 - item.discount_percent / 100);
                                              }
                                            } else {
                                              if (hasMultipleNonOptional) {
                                                if (item.id === selectedItemId) {
                                                  variantTotal += item.quantity * item.unit_price * (1 - item.discount_percent / 100);
                                                }
                                              } else {
                                                variantTotal += item.quantity * item.unit_price * (1 - item.discount_percent / 100);
                                              }
                                            }
                                          });
                                          return variantTotal;
                                        })())}
                                      </span>
                                    </div>
                                  )}
                                </>
                              );
                            })()}
                          </CardContent>
                        </Card>
                      </article>
                    );
                  })}

                  {/* Upsells */}
                  {upsells.length > 0 && (
                    <div className="space-y-3 mt-4">
                      <h3 
                        className="text-sm font-medium flex items-center gap-2"
                        style={{ color: branding.offer_scope_header_text_color }}
                      >
                        <Sparkles className="w-4 h-4" style={{ color: branding.offer_primary_color }} />
                        Opcje dodatkowe
                      </h3>
                      {upsells.map((upsell) => (
                        <Card 
                          key={upsell.id}
                          className="border"
                          style={{
                            backgroundColor: branding.offer_section_bg_color,
                            borderColor: `${branding.offer_primary_color}33`,
                          }}
                        >
                          <CardContent className="py-4 space-y-2">
                            {upsell.description && (
                              <p 
                                className="text-sm opacity-70 mb-2"
                                style={{ color: branding.offer_section_text_color }}
                              >
                                {upsell.description}
                              </p>
                            )}
                            {upsell.offer_option_items.map((item) => {
                              const isItemSelected = selectedOptionalItems[item.id];
                              const itemTotal = item.quantity * item.unit_price * (1 - item.discount_percent / 100);
                              
                              return (
                                <div 
                                  key={item.id}
                                  className={cn(
                                    "py-2 px-3 rounded-md transition-all space-y-1",
                                    isItemSelected && "bg-primary/5"
                                  )}
                                >
                                  {/* Row 1: Product name */}
                                  <p 
                                    className="font-medium"
                                    style={{ color: branding.offer_section_text_color }}
                                  >
                                    {item.custom_name}
                                  </p>
                                  {/* Row 2: Description */}
                                  {item.custom_description && (
                                    <div className="text-sm opacity-70">
                                      {renderDescription(item.custom_description)}
                                    </div>
                                  )}
                                  {/* Row 3: Price + Button aligned right */}
                                  <div className="flex items-center justify-end gap-3 pt-1">
                                    {!offer.hide_unit_prices && (
                                      <span 
                                        className="font-medium text-sm"
                                        style={{ color: branding.offer_section_text_color }}
                                      >
                                        +{formatPrice(itemTotal)}
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
                              );
                            })}
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}
                </section>
              );
            })}
          </div>
        )}

        {/* Sticky Totals Card */}
        <Card 
          className="border sticky bottom-4 shadow-lg z-10"
          style={{ 
            backgroundColor: branding.offer_section_bg_color,
            borderColor: branding.offer_primary_color,
          }}
        >
          <CardContent className="py-3 md:py-4">
            {/* Mobile: Netto + VAT in one line */}
            <div className="flex items-center justify-between gap-2 text-xs md:hidden mb-1" style={{ color: branding.offer_section_text_color }}>
              <span>{t('publicOffer.netTotal')}: <span className="font-medium">{formatPrice(dynamicTotals.net)}</span></span>
              <span>VAT ({offer.vat_rate}%): <span className="font-medium">{formatPrice(dynamicTotals.gross - dynamicTotals.net)}</span></span>
            </div>
            {/* Desktop: Separate lines */}
            <div className="hidden md:block space-y-1">
              <div className="flex justify-between text-xs" style={{ color: branding.offer_section_text_color }}>
                <span>{t('publicOffer.netTotal')}</span>
                <span className="font-medium">{formatPrice(dynamicTotals.net)}</span>
              </div>
              <div className="flex justify-between text-xs" style={{ color: branding.offer_section_text_color }}>
                <span>VAT ({offer.vat_rate}%)</span>
                <span className="font-medium">{formatPrice(dynamicTotals.gross - dynamicTotals.net)}</span>
              </div>
            </div>
            <Separator className="my-1.5 md:my-2" />
            <div className="flex justify-between text-xl md:text-base font-bold">
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

        {/* Actions - only in public mode */}
        {mode === 'public' && (
          <>
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

            {isAccepted && (
              <Card className="border-green-300 bg-white">
                <CardContent className="py-6">
                  <div className="text-center mb-4">
                    <Check className="w-12 h-12 mx-auto text-green-600 mb-3" />
                    <h3 className="text-lg font-semibold text-black">{t('publicOffer.offerAccepted')}</h3>
                    <p className="text-black/70">
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

            {offer.status === 'rejected' && (
              <Card className="border-red-500/50 bg-red-500/10">
                <CardContent className="py-6 text-center">
                  <X className="w-12 h-12 mx-auto text-red-600 mb-3" />
                  <h3 className="text-lg font-semibold text-red-700">Oferta odrzucona</h3>
                </CardContent>
              </Card>
            )}
          </>
        )}

        {/* Bank Transfer Details */}
        {(instance?.offer_bank_account_number || instance?.offer_bank_company_name) && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <CreditCard className="w-5 h-5" />
                Dane do przelewu
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {/* Company name with copy */}
              <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-muted-foreground">Nazwa firmy</p>
                  <p className="font-medium truncate">
                    {instance.offer_bank_company_name || instance.name}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => {
                    navigator.clipboard.writeText(instance.offer_bank_company_name || instance.name || '');
                    toast.success('Nazwa firmy skopiowana do schowka');
                  }}
                  className="flex-shrink-0 ml-2"
                >
                  <Copy className="w-4 h-4" />
                </Button>
              </div>
              
              {/* Bank name + account number with copy */}
              {instance.offer_bank_account_number && (
                <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-muted-foreground">Numer konta</p>
                    <p className="font-medium">
                      {instance.offer_bank_name && (
                        <span className="text-muted-foreground mr-2">
                          {instance.offer_bank_name}
                        </span>
                      )}
                      <span className="font-mono">{instance.offer_bank_account_number}</span>
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => {
                      navigator.clipboard.writeText(instance.offer_bank_account_number || '');
                      toast.success('Numer konta skopiowany do schowka');
                    }}
                    className="flex-shrink-0 ml-2"
                  >
                    <Copy className="w-4 h-4" />
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Social media links + Google Reviews */}
        {(instance?.social_facebook || instance?.social_instagram || instance?.offer_portfolio_url || instance?.offer_google_reviews_url) && (
          <Card>
            <CardContent className="py-6">
              <div className="text-center">
                <p className="text-muted-foreground mb-4">
                  Zobacz nasze realizacje i obserwuj nas w social media
                </p>
                <div className="flex flex-wrap justify-center gap-4">
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
                  {instance?.offer_google_reviews_url && (
                    <a 
                      href={instance.offer_google_reviews_url} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 px-4 py-2 bg-white text-gray-700 border rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      <Star className="w-5 h-5 text-yellow-500" />
                      <span>Opinie Google</span>
                    </a>
                  )}
                </div>
                {instance?.offer_portfolio_url && (
                  <div className="mt-4">
                    <Button
                      asChild
                      className="gap-2"
                    >
                      <a 
                        href={instance.offer_portfolio_url} 
                        target="_blank" 
                        rel="noopener noreferrer"
                      >
                        <ExternalLink className="w-4 h-4" />
                        Realizacje
                      </a>
                    </Button>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Footer */}
        <footer className="text-center text-sm text-muted-foreground pt-8 pb-4">
          <p>{instance?.name}</p>
          {instance?.address && <p>{instance.address}</p>}
          {instance?.phone && (
            <p>
              Tel: <a href={`tel:${instance.phone}`} className="hover:underline">{instance.phone}</a>
            </p>
          )}
          {instance?.email && (
            <p>
              Email: <a href={`mailto:${instance.email}`} className="hover:underline">{instance.email}</a>
            </p>
          )}
        </footer>
      </main>
    </div>
  );
};
