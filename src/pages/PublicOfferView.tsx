import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
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
  AlertCircle
} from 'lucide-react';
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

interface OfferScopeRef {
  id: string;
  name: string;
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
  }[];
}

interface Offer {
  id: string;
  offer_number: string;
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
  instances: {
    name: string;
    logo_url?: string;
    phone?: string;
    email?: string;
    address?: string;
    website?: string;
  };
}

const statusLabels: Record<string, string> = {
  draft: 'Szkic',
  sent: 'Wysłana',
  viewed: 'Obejrzana',
  accepted: 'Zaakceptowana',
  rejected: 'Odrzucona',
  expired: 'Wygasła',
};

const PublicOfferView = () => {
  const { token } = useParams<{ token: string }>();
  const [offer, setOffer] = useState<Offer | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [responding, setResponding] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [showRejectionForm, setShowRejectionForm] = useState(false);
  
  // Track selected variant per scope (key: scope_id, value: option_id)
  const [selectedVariants, setSelectedVariants] = useState<Record<string, string>>({});
  // Track selected optional items (key: item_id, value: boolean)
  const [selectedOptionalItems, setSelectedOptionalItems] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const fetchOffer = async () => {
      if (!token) {
        setError('Nieprawidłowy link do oferty');
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
                name
              ),
              offer_option_items (*)
            ),
            instances (
              name,
              logo_url,
              phone,
              email,
              address,
              website
            )
          `)
          .eq('public_token', token)
          .single();

        if (error) throw error;
        if (!data) {
          setError('Oferta nie została znaleziona');
          return;
        }

        const fetchedOffer = data as unknown as Offer;
        setOffer(fetchedOffer);

        // Initialize selected variants - first variant per scope
        const initialVariants: Record<string, string> = {};
        const selectedOptions = fetchedOffer.offer_options.filter(opt => opt.is_selected);
        
        // Group by scope and select first variant for each scope
        const scopeGroups = selectedOptions.reduce((acc, opt) => {
          const key = opt.scope_id ?? '__ungrouped__';
          if (!acc[key]) acc[key] = [];
          acc[key].push(opt);
          return acc;
        }, {} as Record<string, OfferOption[]>);
        
        Object.entries(scopeGroups).forEach(([scopeId, options]) => {
          const sortedOptions = options.sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
          if (sortedOptions.length > 0) {
            initialVariants[scopeId] = sortedOptions[0].id;
          }
        });
        setSelectedVariants(initialVariants);

        // Mark as viewed if not already
        if (data.status === 'sent') {
          await supabase
            .from('offers')
            .update({ status: 'viewed', viewed_at: new Date().toISOString() })
            .eq('id', data.id);
        }
      } catch (err) {
        console.error('Error fetching offer:', err);
        setError('Błąd podczas wczytywania oferty');
      } finally {
        setLoading(false);
      }
    };

    fetchOffer();
  }, [token]);

  const handleAccept = async () => {
    if (!offer) return;
    setResponding(true);
    try {
      const { error } = await supabase
        .from('offers')
        .update({ 
          status: 'accepted', 
          responded_at: new Date().toISOString() 
        })
        .eq('id', offer.id);

      if (error) throw error;
      setOffer({ ...offer, status: 'accepted' });
      toast.success('Oferta została zaakceptowana!');
    } catch (err) {
      toast.error('Błąd podczas akceptacji oferty');
    } finally {
      setResponding(false);
    }
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
          notes: rejectionReason ? `${offer.notes || ''}\n\nPowód odrzucenia: ${rejectionReason}` : offer.notes
        })
        .eq('id', offer.id);

      if (error) throw error;
      setOffer({ ...offer, status: 'rejected' });
      setShowRejectionForm(false);
      toast.success('Oferta została odrzucona');
    } catch (err) {
      toast.error('Błąd podczas odrzucania oferty');
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

  // Calculate dynamic total based on selected variants and optional items
  const calculateDynamicTotal = () => {
    if (!offer) return { net: 0, gross: 0 };
    
    let totalNet = 0;
    
    // Add selected variant totals
    Object.values(selectedVariants).forEach(optionId => {
      const option = offer.offer_options.find(o => o.id === optionId);
      if (option) {
        // Calculate option total from items (excluding optionals not selected)
        option.offer_option_items.forEach(item => {
          if (item.is_optional) {
            if (selectedOptionalItems[item.id]) {
              const itemTotal = item.quantity * item.unit_price * (1 - item.discount_percent / 100);
              totalNet += itemTotal;
            }
          } else {
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

  const handleSelectVariant = (scopeId: string, optionId: string) => {
    setSelectedVariants(prev => ({ ...prev, [scopeId]: optionId }));
  };

  const handleToggleOptionalItem = (itemId: string) => {
    setSelectedOptionalItems(prev => ({ ...prev, [itemId]: !prev[itemId] }));
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
            <h2 className="text-xl font-semibold mb-2">Błąd</h2>
            <p className="text-muted-foreground">{error || 'Oferta nie została znaleziona'}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const instance = offer.instances;
  const isExpired = offer.valid_until && new Date(offer.valid_until) < new Date();
  const canRespond = ['sent', 'viewed'].includes(offer.status) && !isExpired;

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
          ? opt.scope?.name ?? inferredNameFromTitle ?? 'Zakres'
          : inferredNameFromTitle ?? 'Pozostałe';

        if (!acc[key]) {
          acc[key] = {
            key,
            scopeName: inferredScopeName,
            sortKey: opt.sort_order ?? 0,
            options: [] as OfferOption[],
          };
        }
        acc[key].options.push(opt);
        return acc;
      },
      {} as Record<
        string,
        { key: string; scopeName: string; sortKey: number; options: OfferOption[] }
      >
    )
  ).sort((a, b) => a.sortKey - b.sortKey);

  return (
    <>
      <Helmet>
        <title>Oferta {offer.offer_number} – {instance?.name || 'Firma'}</title>
        <meta
          name="description"
          content={`Oferta ${offer.offer_number} od ${instance?.name || 'firmy'}: zakres prac, pozycje i podsumowanie kosztów.`}
        />
        {typeof window !== 'undefined' && (
          <link rel="canonical" href={window.location.href} />
        )}
      </Helmet>
      
      <div className="min-h-screen bg-muted/30">
        {/* Header */}
        <header className="bg-background border-b">
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
                  <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                    <FileText className="w-6 h-6 text-primary" />
                  </div>
                )}
                <div>
                  <h1 className="font-bold text-lg">
                    <span className="sr-only">Oferta </span>
                    {instance?.name}
                  </h1>
                  <p className="text-sm text-muted-foreground">Oferta nr {offer.offer_number}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
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
                      toast.error('Błąd podczas pobierania oferty');
                    }
                  }}
                  className="gap-1"
                >
                  <Download className="w-4 h-4" />
                  Pobierz PDF
                </Button>
                <Badge 
                  className={cn(
                    offer.status === 'accepted' && 'bg-green-500/20 text-green-600',
                    offer.status === 'rejected' && 'bg-red-500/20 text-red-600',
                    offer.status === 'viewed' && 'bg-amber-500/20 text-amber-600',
                    offer.status === 'sent' && 'bg-blue-500/20 text-blue-600',
                  )}
                >
                  {statusLabels[offer.status] || offer.status}
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
                <p className="text-destructive font-medium">Ta oferta wygasła</p>
              </CardContent>
            </Card>
          )}

          {/* Customer & Vehicle Info */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <User className="w-4 h-4" />
                  Dla
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm space-y-1">
                <p className="font-medium">{offer.customer_data?.name}</p>
                {offer.customer_data?.company && (
                  <p className="flex items-center gap-1 text-muted-foreground">
                    <Building2 className="w-3 h-3" />
                    {offer.customer_data.company}
                  </p>
                )}
                {offer.customer_data?.email && (
                  <p className="text-muted-foreground">{offer.customer_data.email}</p>
                )}
              </CardContent>
            </Card>

            {offer.vehicle_data?.brand && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Car className="w-4 h-4" />
                    Pojazd
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-sm space-y-1">
                  <p className="font-medium">
                    {offer.vehicle_data.brand} {offer.vehicle_data.model}
                  </p>
                  {offer.vehicle_data.plate && (
                    <p className="text-muted-foreground">{offer.vehicle_data.plate}</p>
                  )}
                </CardContent>
              </Card>
            )}
          </div>

          {/* Zakresy (scope) */}
          {scopeSections.length === 0 ? (
            <Card>
              <CardContent className="pt-6 text-sm text-muted-foreground">
                Brak wybranych pozycji w ofercie.
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-8">
              {scopeSections.map((section) => {
                const hasMultipleVariants = section.options.length > 1;
                const selectedOptionId = selectedVariants[section.key];
                
                return (
                  <section key={section.key} className="space-y-3">
                    <h2 className="text-base font-semibold">{section.scopeName}</h2>

                    {section.options.map((option) => {
                      const isSelected = selectedOptionId === option.id;
                      const variantName = option.name.includes(' - ') 
                        ? option.name.split(' - ').slice(1).join(' - ')
                        : option.name;
                      
                      return (
                        <article key={option.id}>
                          <Card className={cn(
                            "transition-all",
                            hasMultipleVariants && isSelected && "ring-2 ring-primary border-primary",
                            hasMultipleVariants && !isSelected && "opacity-60"
                          )}>
                            <CardHeader className="pb-3">
                              <div className="flex items-center justify-between">
                                <div>
                                  <CardTitle className="text-lg font-semibold">{variantName}</CardTitle>
                                  {option.description && (
                                    <p className="text-sm text-muted-foreground">{option.description}</p>
                                  )}
                                </div>
                                {hasMultipleVariants && (
                                  <Button
                                    variant={isSelected ? "default" : "outline"}
                                    size="sm"
                                    onClick={() => handleSelectVariant(section.key, option.id)}
                                    className="shrink-0"
                                  >
                                    {isSelected ? (
                                      <>
                                        <Check className="w-4 h-4 mr-1" />
                                        Wybrany
                                      </>
                                    ) : (
                                      'Wybierz'
                                    )}
                                  </Button>
                                )}
                              </div>
                            </CardHeader>
                            <CardContent>
                              {/* Show items only if unit prices are not hidden, or show just names */}
                              {offer.hide_unit_prices ? (
                                <div className="space-y-2">
                                  {option.offer_option_items.map((item) => {
                                    const isOptionalSelected = selectedOptionalItems[item.id];
                                    return (
                                      <div
                                        key={item.id}
                                        className={cn(
                                          "flex items-center justify-between py-1",
                                          item.is_optional && !isOptionalSelected && "text-muted-foreground"
                                        )}
                                      >
                                        <div className="flex items-center gap-2">
                                          <span>{item.custom_name}</span>
                                          {item.is_optional && !isOptionalSelected && (
                                            <Badge variant="outline" className="text-xs">
                                              opcjonalne
                                            </Badge>
                                          )}
                                        </div>
                                        {item.is_optional && (
                                          <Button
                                            variant={isOptionalSelected ? "default" : "outline"}
                                            size="sm"
                                            onClick={() => handleToggleOptionalItem(item.id)}
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
                              ) : (
                                <div className="space-y-2">
                                  {option.offer_option_items.map((item) => {
                                    const itemTotal =
                                      item.quantity *
                                      item.unit_price *
                                      (1 - item.discount_percent / 100);
                                    const isOptionalSelected = selectedOptionalItems[item.id];
                                    return (
                                      <div
                                        key={item.id}
                                        className={cn(
                                          "flex items-center justify-between py-2 border-b last:border-0",
                                          item.is_optional && !isOptionalSelected && "text-muted-foreground"
                                        )}
                                      >
                                        <div className="flex-1 flex items-center gap-2">
                                          <span>{item.custom_name}</span>
                                          {item.is_optional && !isOptionalSelected && (
                                            <Badge variant="outline" className="text-xs">
                                              opcjonalne
                                            </Badge>
                                          )}
                                        </div>
                                        <div className="flex items-center gap-4">
                                          <div className="text-right">
                                            <span className="text-sm text-muted-foreground mr-4">
                                              {item.quantity} {item.unit} × {formatPrice(item.unit_price)}
                                              {item.discount_percent > 0 &&
                                                ` (-${item.discount_percent}%)`}
                                            </span>
                                            <span className="font-medium">
                                              {formatPrice(itemTotal)}
                                            </span>
                                          </div>
                                          {item.is_optional && (
                                            <Button
                                              variant={isOptionalSelected ? "default" : "outline"}
                                              size="sm"
                                              onClick={() => handleToggleOptionalItem(item.id)}
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
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                              <div className="flex justify-between pt-4 font-medium">
                                <span>Razem opcja</span>
                                <span>{formatPrice(option.subtotal_net)}</span>
                              </div>
                            </CardContent>
                          </Card>
                        </article>
                      );
                    })}
                  </section>
                );
              })}
            </div>
          )}

          {/* Totals - Dynamic */}
          <Card className="sticky bottom-4 shadow-lg border-primary/20">
            <CardContent className="pt-6 space-y-3">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Suma netto</span>
                <span>{formatPrice(dynamicTotals.net)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">VAT ({offer.vat_rate}%)</span>
                <span>{formatPrice(dynamicTotals.gross - dynamicTotals.net)}</span>
              </div>
              <Separator />
              <div className="flex justify-between text-lg font-bold">
                <span>Razem brutto</span>
                <span className="text-primary">{formatPrice(dynamicTotals.gross)}</span>
              </div>
            </CardContent>
          </Card>

          {/* Notes & Terms */}
          {(offer.notes || offer.payment_terms || offer.valid_until) && (
            <Card>
              <CardContent className="pt-6 space-y-3 text-sm">
                {offer.valid_until && (
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-muted-foreground" />
                    <span>
                      Oferta ważna do: <strong>{format(new Date(offer.valid_until), 'd MMMM yyyy', { locale: pl })}</strong>
                    </span>
                  </div>
                )}
                {offer.payment_terms && (
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-muted-foreground" />
                    <span>Warunki płatności: {offer.payment_terms}</span>
                  </div>
                )}
                {offer.notes && (
                  <div className="pt-2 text-muted-foreground whitespace-pre-wrap">
                    {offer.notes}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Actions */}
          {canRespond && (
            <Card>
              <CardContent className="pt-6">
                {showRejectionForm ? (
                  <div className="space-y-4">
                    <h3 className="font-medium">Powód odrzucenia (opcjonalnie)</h3>
                    <Textarea
                      value={rejectionReason}
                      onChange={(e) => setRejectionReason(e.target.value)}
                      placeholder="Opisz dlaczego odrzucasz ofertę..."
                      rows={3}
                    />
                    <div className="flex gap-2">
                      <Button 
                        variant="outline" 
                        onClick={() => setShowRejectionForm(false)}
                        disabled={responding}
                      >
                        Anuluj
                      </Button>
                      <Button 
                        variant="destructive" 
                        onClick={handleReject}
                        disabled={responding}
                      >
                        {responding ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                        Potwierdź odrzucenie
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col sm:flex-row gap-3">
                    <Button 
                      className="flex-1 gap-2" 
                      size="lg"
                      onClick={handleAccept}
                      disabled={responding}
                    >
                      {responding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-5 h-5" />}
                      Akceptuję ofertę
                    </Button>
                    <Button 
                      variant="outline" 
                      className="flex-1 gap-2" 
                      size="lg"
                      onClick={() => setShowRejectionForm(true)}
                      disabled={responding}
                    >
                      <X className="w-5 h-5" />
                      Odrzuć ofertę
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Already responded */}
          {offer.status === 'accepted' && (
            <Card className="border-green-500/50 bg-green-500/10">
              <CardContent className="py-6 text-center">
                <Check className="w-12 h-12 mx-auto text-green-600 mb-3" />
                <h3 className="text-lg font-semibold text-green-700">Oferta zaakceptowana</h3>
                <p className="text-muted-foreground">Dziękujemy! Skontaktujemy się z Tobą wkrótce.</p>
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
