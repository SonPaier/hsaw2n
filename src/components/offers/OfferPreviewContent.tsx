import { useTranslation } from 'react-i18next';
import { 
  FileText, 
  User, 
  Building2, 
  Car, 
  Calendar,
  Sparkles,
  Shield,
  Award,
  Star,
  Heart,
  Phone,
  Facebook,
  Instagram,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { format } from 'date-fns';
import { pl } from 'date-fns/locale';
import { DEFAULT_BRANDING, OfferBranding, getContrastTextColor } from '@/lib/colorUtils';

interface OfferOption {
  id: string;
  name: string;
  description?: string;
  is_selected: boolean;
  subtotal_net: number;
  sort_order?: number;
  scope_id?: string | null;
  is_upsell?: boolean;
  scope?: { id: string; name: string; is_extras_scope?: boolean } | null;
  offer_option_items: {
    id: string;
    custom_name: string;
    custom_description?: string;
    quantity: number;
    unit_price: number;
    unit: string;
    discount_percent: number;
    is_optional: boolean;
    products_library?: { description?: string } | null;
  }[];
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
  offer_options: OfferOption[];
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
}

interface OfferPreviewContentProps {
  offer: Offer;
  instance: Instance;
  previewMode?: boolean;
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

export const OfferPreviewContent = ({
  offer,
  instance,
  previewMode = false,
}: OfferPreviewContentProps) => {
  const { t } = useTranslation();

  const formatPrice = (value: number) => {
    return new Intl.NumberFormat('pl-PL', {
      style: 'currency',
      currency: 'PLN',
    }).format(value);
  };

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

  const vatAmount = offer.total_gross - offer.total_net;

  return (
    <div 
      className="min-h-full"
      style={{ backgroundColor: branding.offer_bg_color }}
    >
      {/* Header */}
      <header 
        style={{ backgroundColor: branding.offer_header_bg_color }}
      >
        <div className="max-w-4xl mx-auto px-4 py-6">
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
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8 space-y-6">
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

        {/* Service Sections */}
        {scopeSections.map((section) => (
          <Card 
            key={section.key}
            className="border overflow-hidden"
            style={{ 
              backgroundColor: branding.offer_section_bg_color,
              borderColor: `${branding.offer_primary_color}33`,
            }}
          >
            <CardHeader 
              className="py-3"
              style={{ backgroundColor: branding.offer_primary_color }}
            >
              <CardTitle 
                className="text-base font-bold"
                style={{ color: branding.offer_scope_header_text_color }}
              >
                {section.scopeName}
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4 space-y-4">
              {section.options.map((option) => (
                <div key={option.id} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 
                        className="font-semibold"
                        style={{ color: branding.offer_section_text_color }}
                      >
                        {option.name}
                      </h4>
                      {option.description && renderDescription(option.description)}
                    </div>
                    <p 
                      className="font-semibold whitespace-nowrap"
                      style={{ color: branding.offer_primary_color }}
                    >
                      {formatPrice(option.subtotal_net)}
                    </p>
                  </div>
                  
                  {/* Items */}
                  {!offer.hide_unit_prices && option.offer_option_items.length > 0 && (
                    <div className="pl-4 space-y-1">
                      {option.offer_option_items.map((item) => {
                        const itemTotal = item.quantity * item.unit_price * (1 - item.discount_percent / 100);
                        return (
                          <div 
                            key={item.id}
                            className="flex items-center justify-between text-sm opacity-70"
                            style={{ color: branding.offer_section_text_color }}
                          >
                            <span>
                              {item.custom_name}
                              {item.is_optional && (
                                <span className="ml-2 text-xs opacity-60">(opcjonalne)</span>
                              )}
                            </span>
                            <span>{formatPrice(itemTotal)}</span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        ))}

        {/* Totals */}
        <Card 
          className="border"
          style={{ 
            backgroundColor: branding.offer_section_bg_color,
            borderColor: `${branding.offer_primary_color}33`,
          }}
        >
          <CardContent className="pt-6 space-y-3">
            <div className="flex justify-between text-sm" style={{ color: branding.offer_section_text_color }}>
              <span>{t('publicOffer.netTotal')}</span>
              <span className="font-medium">{formatPrice(offer.total_net)}</span>
            </div>
            <div className="flex justify-between text-sm" style={{ color: branding.offer_section_text_color }}>
              <span>VAT ({offer.vat_rate}%)</span>
              <span className="font-medium">{formatPrice(vatAmount)}</span>
            </div>
            <Separator />
            <div className="flex justify-between text-lg font-bold">
              <span style={{ color: branding.offer_section_text_color }}>{t('publicOffer.grossTotal')}</span>
              <span style={{ color: branding.offer_primary_color }}>{formatPrice(offer.total_gross)}</span>
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
            <CardContent className="pt-6 space-y-4 text-sm" style={{ color: branding.offer_section_text_color }}>
              {offer.valid_until && (
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4" />
                  <span>
                    {t('publicOffer.validUntil')}: {format(new Date(offer.valid_until), 'd MMMM yyyy', { locale: pl })}
                  </span>
                </div>
              )}
              {offer.payment_terms && (
                <div>
                  <p className="font-medium mb-1">{t('offers.paymentTerms')}</p>
                  <p className="opacity-70">{offer.payment_terms}</p>
                </div>
              )}
              {offer.notes && (
                <div>
                  <p className="font-medium mb-1">{t('offers.notes')}</p>
                  <p className="opacity-70 whitespace-pre-line">{offer.notes}</p>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Footer - Contact Info */}
        <div className="text-center space-y-4 py-8">
          <div 
            className="flex items-center justify-center gap-4"
            style={{ color: branding.offer_section_text_color }}
          >
            {instance?.phone && (
              <a 
                href={`tel:${instance.phone}`}
                className="flex items-center gap-2 hover:opacity-80 transition-opacity"
              >
                <Phone className="w-4 h-4" />
                {instance.phone}
              </a>
            )}
            {instance?.social_facebook && (
              <a 
                href={instance.social_facebook}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:opacity-80 transition-opacity"
              >
                <Facebook className="w-5 h-5" />
              </a>
            )}
            {instance?.social_instagram && (
              <a 
                href={instance.social_instagram}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:opacity-80 transition-opacity"
              >
                <Instagram className="w-5 h-5" />
              </a>
            )}
          </div>
          {instance?.address && (
            <p 
              className="text-sm opacity-70"
              style={{ color: branding.offer_section_text_color }}
            >
              {instance.address}
            </p>
          )}
        </div>
      </main>
    </div>
  );
};
