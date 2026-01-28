import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Check, Loader2, CheckCircle2, ChevronDown, ChevronUp, Calendar } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { CarSearchAutocomplete, CarSearchValue } from '@/components/ui/car-search-autocomplete';
import { CarModelsProvider } from '@/contexts/CarModelsContext';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { pl } from 'date-fns/locale';

interface EmbedConfig {
  branding: {
    bg_color: string;
    primary_color: string;
    logo_url: string | null;
  };
  instance_info: {
    name: string;
    short_name: string | null;
    address: string | null;
    nip: string | null;
    contact_person: string | null;
    phone: string | null;
  };
  templates: {
    id: string;
    name: string;
    short_name: string | null;
    description: string | null;
    price_from: number | null;
    available_durations: number[];
  }[];
  extras: {
    id: string;
    name: string;
  }[];
}

interface FormData {
  name: string;
  email: string;
  phone: string;
  vehicleModel: string;
  vehicleModelId: string | null;
  carSize: string;
  mileage: string;
  paintColor: string;
  paintFinish: 'gloss' | 'matte' | null;
  plannedDate: Date | null;
  selectedTemplates: string[];
  selectedExtras: string[];
  durationSelections: Record<string, number | null>;
  budget: string;
  notes: string;
  gdprAccepted: boolean;
}

// Helper to format duration in Polish
const formatDuration = (months: number): string => {
  const years = months / 12;
  if (years === 1) return '1 rok';
  if (years < 5) return `${years} lata`;
  return `${years} lat`;
};

function EmbedLeadFormContent() {
  const { t } = useTranslation();
  const formRef = useRef<HTMLFormElement>(null);
  const [config, setConfig] = useState<EmbedConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedDescriptions, setExpandedDescriptions] = useState<Set<string>>(new Set());
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  
  const [formData, setFormData] = useState<FormData>({
    name: '',
    email: '',
    phone: '',
    vehicleModel: '',
    vehicleModelId: null,
    carSize: '',
    mileage: '',
    paintColor: '',
    paintFinish: null,
    plannedDate: null,
    selectedTemplates: [],
    selectedExtras: [],
    durationSelections: {},
    budget: '',
    notes: '',
    gdprAccepted: false,
  });

  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  // Get instance slug from hostname
  const getInstanceSlug = () => {
    const hostname = window.location.hostname;
    if (hostname.endsWith('.n2wash.com')) {
      return hostname.replace('.n2wash.com', '').replace('.admin', '');
    }
    // Dev mode - use armcar as default
    return 'armcar';
  };

  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const slug = getInstanceSlug();
        const { data, error } = await supabase.functions.invoke('get-embed-config', {
          headers: { 'x-instance-slug': slug },
        });

        if (error) throw error;
        setConfig(data);
      } catch (err) {
        console.error('Error fetching embed config:', err);
        setError(t('embed.errorGeneric'));
      } finally {
        setLoading(false);
      }
    };

    fetchConfig();
  }, [t]);

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};

    if (!formData.name.trim()) {
      errors.name = t('embed.validation.nameRequired');
    }
    
    if (!formData.email.trim()) {
      errors.email = t('embed.validation.emailRequired');
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      errors.email = t('embed.validation.emailInvalid');
    }
    
    // Phone validation - minimum 9 digits
    const phoneDigits = formData.phone.replace(/\D/g, '');
    if (!formData.phone.trim()) {
      errors.phone = t('embed.validation.phoneRequired');
    } else if (phoneDigits.length < 9) {
      errors.phone = 'Numer telefonu musi mieć minimum 9 cyfr';
    }
    
    if (!formData.vehicleModel.trim()) {
      errors.vehicle = t('embed.validation.vehicleRequired');
    }
    
    if (!formData.paintColor.trim()) {
      errors.paintColor = 'Kolor lakieru jest wymagany';
    }
    
    if (!formData.paintFinish) {
      errors.paintFinish = 'Wybierz rodzaj lakieru';
    }
    
    if (formData.selectedTemplates.length === 0) {
      errors.templates = t('embed.validation.packageRequired');
    }
    
    if (!formData.gdprAccepted) {
      errors.gdpr = t('embed.gdprRequired');
    }

    setValidationErrors(errors);
    
    // Scroll to top if there are errors
    if (Object.keys(errors).length > 0) {
      formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) return;

    setSubmitting(true);
    setError(null);

    try {
      const slug = getInstanceSlug();
      const { error } = await supabase.functions.invoke('submit-lead', {
        headers: { 'x-instance-slug': slug },
        body: {
          customer_data: {
            name: formData.name,
            email: formData.email,
            phone: formData.phone,
            gdpr_accepted: formData.gdprAccepted,
          },
          vehicle_data: {
            model_id: formData.vehicleModelId,
            custom_model_name: formData.vehicleModel,
            car_size: formData.carSize,
            mileage: formData.mileage,
            paint_color: formData.paintColor,
            paint_finish: formData.paintFinish,
          },
          offer_details: {
            template_ids: formData.selectedTemplates,
            extra_service_ids: formData.selectedExtras,
            duration_selections: formData.durationSelections,
            budget_suggestion: formData.budget ? parseFloat(formData.budget) : null,
            additional_notes: formData.notes,
            planned_date: formData.plannedDate ? format(formData.plannedDate, 'yyyy-MM-dd') : null,
          },
        },
      });

      if (error) throw error;
      setSubmitted(true);
    } catch (err) {
      console.error('Error submitting lead:', err);
      setError(t('embed.errorGeneric'));
      // Scroll to top on error
      formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } finally {
      setSubmitting(false);
    }
  };

  const toggleTemplate = (templateId: string) => {
    setFormData(prev => {
      const isCurrentlySelected = prev.selectedTemplates.includes(templateId);
      const newSelectedTemplates = isCurrentlySelected
        ? prev.selectedTemplates.filter(id => id !== templateId)
        : [...prev.selectedTemplates, templateId];
      
      // Clear duration selection if template is deselected
      const newDurationSelections = { ...prev.durationSelections };
      if (isCurrentlySelected) {
        delete newDurationSelections[templateId];
      }
      
      return {
        ...prev,
        selectedTemplates: newSelectedTemplates,
        durationSelections: newDurationSelections,
      };
    });
    if (validationErrors.templates) {
      setValidationErrors(prev => ({ ...prev, templates: '' }));
    }
  };

  const setDurationSelection = (templateId: string, duration: number | null) => {
    setFormData(prev => ({
      ...prev,
      durationSelections: {
        ...prev.durationSelections,
        [templateId]: duration,
      },
    }));
  };

  const toggleExtra = (extraId: string) => {
    setFormData(prev => ({
      ...prev,
      selectedExtras: prev.selectedExtras.includes(extraId)
        ? prev.selectedExtras.filter(id => id !== extraId)
        : [...prev.selectedExtras, extraId],
    }));
  };

  const toggleDescription = (templateId: string) => {
    setExpandedDescriptions(prev => {
      const next = new Set(prev);
      if (next.has(templateId)) {
        next.delete(templateId);
      } else {
        next.add(templateId);
      }
      return next;
    });
  };

  const handleCarSelect = (value: CarSearchValue) => {
    if (!value) {
      setFormData(prev => ({
        ...prev,
        vehicleModel: '',
        vehicleModelId: null,
        carSize: '',
      }));
    } else if ('type' in value && value.type === 'custom') {
      setFormData(prev => ({
        ...prev,
        vehicleModel: value.label,
        vehicleModelId: null,
      }));
    } else if ('id' in value) {
      setFormData(prev => ({
        ...prev,
        vehicleModel: value.label,
        vehicleModelId: value.id,
        carSize: value.size,
      }));
    }
    if (validationErrors.vehicle) {
      setValidationErrors(prev => ({ ...prev, vehicle: '' }));
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error && !config) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-slate-50">
        <div className="text-center">
          <p className="text-destructive">{error}</p>
        </div>
      </div>
    );
  }

  if (submitted) {
    return (
      <div 
        className="min-h-screen flex items-center justify-center p-4"
        style={{ backgroundColor: config?.branding.bg_color || '#f8fafc' }}
      >
        <div className="text-center space-y-4">
          <CheckCircle2 
            className="w-16 h-16 mx-auto" 
            style={{ color: config?.branding.primary_color || '#2563eb' }}
          />
          <h2 className="text-2xl font-bold">{t('embed.successTitle')}</h2>
          <p className="text-muted-foreground">{t('embed.successMessage')}</p>
        </div>
      </div>
    );
  }

  const primaryColor = config?.branding.primary_color || '#2563eb';

  return (
    <div 
      className="min-h-screen p-4 md:p-6"
      style={{ backgroundColor: config?.branding.bg_color || '#f8fafc' }}
    >
      <div className="max-w-lg mx-auto">
        {/* Header */}
        <div className="text-center mb-6">
          {config?.branding.logo_url && (
            <img 
              src={config.branding.logo_url} 
              alt={config.instance_info.name}
              className="h-12 mx-auto mb-4 object-contain"
            />
          )}
          <h1 className="text-2xl font-bold">{t('embed.title')}</h1>
          <p className="text-muted-foreground mt-1">{t('embed.subtitle')}</p>
        </div>

        {/* Error display at top */}
        {error && (
          <div className="bg-destructive/10 text-destructive p-3 rounded-lg text-sm mb-4">
            {error}
          </div>
        )}

        <form ref={formRef} onSubmit={handleSubmit} className="space-y-6">
          {/* Customer Data Section */}
          <div className="bg-white rounded-lg p-4 shadow-sm space-y-4">
            <h2 className="font-semibold text-lg">{t('embed.customerSection')}</h2>
            
            <div className="space-y-2">
              <Label htmlFor="name">{t('common.name')} *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                placeholder="Jan Kowalski"
                className={validationErrors.name ? 'border-destructive' : ''}
              />
              {validationErrors.name && (
                <p className="text-sm text-destructive">{validationErrors.name}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">{t('common.email')} *</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => {
                  setFormData(prev => ({ ...prev, email: e.target.value }));
                  if (validationErrors.email) {
                    setValidationErrors(prev => ({ ...prev, email: '' }));
                  }
                }}
                placeholder="jan@example.com"
                className={validationErrors.email ? 'border-destructive' : ''}
              />
              {validationErrors.email && (
                <p className="text-sm text-destructive">{validationErrors.email}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone">{t('common.phone')} *</Label>
              <Input
                id="phone"
                type="tel"
                value={formData.phone}
                onChange={(e) => {
                  setFormData(prev => ({ ...prev, phone: e.target.value }));
                  if (validationErrors.phone) {
                    setValidationErrors(prev => ({ ...prev, phone: '' }));
                  }
                }}
                placeholder="+48 123 456 789"
                className={validationErrors.phone ? 'border-destructive' : ''}
              />
              {validationErrors.phone && (
                <p className="text-sm text-destructive">{validationErrors.phone}</p>
              )}
            </div>
          </div>

          {/* Vehicle Section */}
          <div className="bg-white rounded-lg p-4 shadow-sm space-y-4">
            <h2 className="font-semibold text-lg">{t('embed.vehicleSection')}</h2>
            
            <div className="space-y-2">
              <Label>{t('reservations.carModel')} *</Label>
              <CarSearchAutocomplete
                value={formData.vehicleModel}
                onChange={handleCarSelect}
                error={!!validationErrors.vehicle}
              />
              {validationErrors.vehicle && (
                <p className="text-sm text-destructive">{validationErrors.vehicle}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="paintColor">Kolor lakieru *</Label>
              <Input
                id="paintColor"
                value={formData.paintColor}
                onChange={(e) => {
                  setFormData(prev => ({ ...prev, paintColor: e.target.value }));
                  if (validationErrors.paintColor) {
                    setValidationErrors(prev => ({ ...prev, paintColor: '' }));
                  }
                }}
                placeholder="np. Czarny metalik, Biały perłowy"
                className={validationErrors.paintColor ? 'border-destructive' : ''}
              />
              {validationErrors.paintColor && (
                <p className="text-sm text-destructive">{validationErrors.paintColor}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label>Rodzaj lakieru *</Label>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant={formData.paintFinish === 'gloss' ? 'default' : 'outline'}
                  className="flex-1"
                  style={formData.paintFinish === 'gloss' ? { backgroundColor: primaryColor } : {}}
                  onClick={() => {
                    setFormData(prev => ({ ...prev, paintFinish: 'gloss' }));
                    if (validationErrors.paintFinish) {
                      setValidationErrors(prev => ({ ...prev, paintFinish: '' }));
                    }
                  }}
                >
                  Połysk
                </Button>
                <Button
                  type="button"
                  variant={formData.paintFinish === 'matte' ? 'default' : 'outline'}
                  className="flex-1"
                  style={formData.paintFinish === 'matte' ? { backgroundColor: primaryColor } : {}}
                  onClick={() => {
                    setFormData(prev => ({ ...prev, paintFinish: 'matte' }));
                    if (validationErrors.paintFinish) {
                      setValidationErrors(prev => ({ ...prev, paintFinish: '' }));
                    }
                  }}
                >
                  Mat
                </Button>
              </div>
              {validationErrors.paintFinish && (
                <p className="text-sm text-destructive">{validationErrors.paintFinish}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="mileage">{t('embed.mileageLabel')}</Label>
              <Input
                id="mileage"
                type="number"
                value={formData.mileage}
                onChange={(e) => setFormData(prev => ({ ...prev, mileage: e.target.value }))}
                placeholder={t('embed.mileagePlaceholder')}
              />
            </div>
          </div>

          {/* Templates Section */}
          <div className="bg-white rounded-lg p-4 shadow-sm space-y-4">
            <div>
              <h2 className="font-semibold text-lg">{t('embed.packagesSection')}</h2>
              <p className="text-sm text-muted-foreground">{t('embed.packagesHint')}</p>
            </div>
            
            <div className="grid gap-3">
              {config?.templates.map((template) => {
                const isSelected = formData.selectedTemplates.includes(template.id);
                const isExpanded = expandedDescriptions.has(template.id);
                return (
                  <div key={template.id} className="space-y-2">
                    <button
                      type="button"
                      onClick={() => toggleTemplate(template.id)}
                      className={cn(
                        "w-full text-left p-4 rounded-lg border-2 transition-all",
                        isSelected 
                          ? "border-primary bg-primary/5" 
                          : "border-border hover:border-primary/50"
                      )}
                      style={isSelected ? { borderColor: primaryColor, backgroundColor: `${primaryColor}10` } : {}}
                    >
                      <div className="flex items-start gap-3">
                        <div 
                          className={cn(
                            "w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 mt-0.5",
                            isSelected ? "border-primary bg-primary" : "border-muted-foreground"
                          )}
                          style={isSelected ? { borderColor: primaryColor, backgroundColor: primaryColor } : {}}
                        >
                          {isSelected && <Check className="w-3 h-3 text-white" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <p className="font-medium">{template.name}</p>
                            {template.price_from && (
                              <span className="text-sm font-medium whitespace-nowrap" style={{ color: primaryColor }}>
                                od {template.price_from} zł
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </button>
                    
                    {/* Duration selection - only show if template is selected and has durations */}
                    {isSelected && template.available_durations && template.available_durations.length > 0 && (
                      <div className="ml-8 p-3 bg-muted/30 rounded-lg space-y-2">
                        <p className="text-sm font-medium">Pakiet powłoki:</p>
                        <div className="grid gap-1.5">
                          {template.available_durations.map((months) => (
                            <label
                              key={months}
                              className={cn(
                                "flex items-center gap-2 p-2 rounded-md cursor-pointer transition-colors",
                                formData.durationSelections[template.id] === months
                                  ? "bg-primary/10"
                                  : "hover:bg-muted/50"
                              )}
                              style={formData.durationSelections[template.id] === months ? { backgroundColor: `${primaryColor}15` } : {}}
                            >
                              <div
                                className={cn(
                                  "w-4 h-4 rounded-full border-2 flex items-center justify-center",
                                  formData.durationSelections[template.id] === months
                                    ? "border-primary"
                                    : "border-muted-foreground"
                                )}
                                style={formData.durationSelections[template.id] === months ? { borderColor: primaryColor } : {}}
                              >
                                {formData.durationSelections[template.id] === months && (
                                  <div
                                    className="w-2 h-2 rounded-full bg-primary"
                                    style={{ backgroundColor: primaryColor }}
                                  />
                                )}
                              </div>
                              <span className="text-sm">{formatDuration(months)}</span>
                              <input
                                type="radio"
                                name={`duration-${template.id}`}
                                value={months}
                                checked={formData.durationSelections[template.id] === months}
                                onChange={() => setDurationSelection(template.id, months)}
                                className="sr-only"
                              />
                            </label>
                          ))}
                          {/* "Nie wiem" option */}
                          <label
                            className={cn(
                              "flex items-center gap-2 p-2 rounded-md cursor-pointer transition-colors",
                              formData.durationSelections[template.id] === null && template.id in formData.durationSelections
                                ? "bg-primary/10"
                                : "hover:bg-muted/50"
                            )}
                            style={formData.durationSelections[template.id] === null && template.id in formData.durationSelections ? { backgroundColor: `${primaryColor}15` } : {}}
                          >
                            <div
                              className={cn(
                                "w-4 h-4 rounded-full border-2 flex items-center justify-center",
                                formData.durationSelections[template.id] === null && template.id in formData.durationSelections
                                  ? "border-primary"
                                  : "border-muted-foreground"
                              )}
                              style={formData.durationSelections[template.id] === null && template.id in formData.durationSelections ? { borderColor: primaryColor } : {}}
                            >
                              {formData.durationSelections[template.id] === null && template.id in formData.durationSelections && (
                                <div
                                  className="w-2 h-2 rounded-full bg-primary"
                                  style={{ backgroundColor: primaryColor }}
                                />
                              )}
                            </div>
                            <span className="text-sm">Nie wiem, proszę o propozycję</span>
                            <input
                              type="radio"
                              name={`duration-${template.id}`}
                              value="null"
                              checked={formData.durationSelections[template.id] === null && template.id in formData.durationSelections}
                              onChange={() => setDurationSelection(template.id, null)}
                              className="sr-only"
                            />
                          </label>
                        </div>
                      </div>
                    )}
                    
                    {template.description && (
                      <div className="mt-1 ml-8">
                        <button
                          type="button"
                          onClick={() => toggleDescription(template.id)}
                          className="text-sm hover:underline flex items-center gap-1"
                          style={{ color: primaryColor }}
                        >
                          Czytaj więcej...
                          {isExpanded ? (
                            <ChevronUp className="w-3 h-3" />
                          ) : (
                            <ChevronDown className="w-3 h-3" />
                          )}
                        </button>
                        {isExpanded && (
                          <p className="text-sm text-muted-foreground mt-1 whitespace-pre-wrap">
                            {template.description}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            {validationErrors.templates && (
              <p className="text-sm text-destructive">{validationErrors.templates}</p>
            )}
          </div>

          {/* Extras Section */}
          {config?.extras && config.extras.length > 0 && (
            <div className="bg-white rounded-lg p-4 shadow-sm space-y-4">
              <div>
                <h2 className="font-semibold text-lg">Dodatki</h2>
                <p className="text-sm text-muted-foreground">Opcjonalne usługi dodatkowe</p>
              </div>
              
              <div className="grid gap-2">
                {config.extras.map((extra) => {
                  const isSelected = formData.selectedExtras.includes(extra.id);
                  return (
                    <button
                      key={extra.id}
                      type="button"
                      onClick={() => toggleExtra(extra.id)}
                      className={cn(
                        "w-full text-left p-3 rounded-lg border transition-all flex items-center gap-3",
                        isSelected 
                          ? "border-primary bg-primary/5" 
                          : "border-border hover:border-primary/50"
                      )}
                      style={isSelected ? { borderColor: primaryColor, backgroundColor: `${primaryColor}10` } : {}}
                    >
                      <div 
                        className={cn(
                          "w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0",
                          isSelected ? "border-primary bg-primary" : "border-muted-foreground"
                        )}
                        style={isSelected ? { borderColor: primaryColor, backgroundColor: primaryColor } : {}}
                      >
                        {isSelected && <Check className="w-3 h-3 text-white" />}
                      </div>
                      <span className="font-medium">{extra.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Planned Date Section */}
          <div className="bg-white rounded-lg p-4 shadow-sm space-y-4">
            <div>
              <h2 className="font-semibold text-lg">Planowany termin realizacji</h2>
              <p className="text-sm text-muted-foreground">Kiedy chciałbyś zrealizować usługę?</p>
            </div>
            
            <Popover open={datePickerOpen} onOpenChange={setDatePickerOpen}>
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !formData.plannedDate && "text-muted-foreground"
                  )}
                >
                  <Calendar className="mr-2 h-4 w-4" />
                  {formData.plannedDate ? (
                    format(formData.plannedDate, 'd MMMM yyyy', { locale: pl })
                  ) : (
                    'Wybierz datę (opcjonalne)'
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <CalendarComponent
                  mode="single"
                  selected={formData.plannedDate || undefined}
                  onSelect={(date) => {
                    setFormData(prev => ({ ...prev, plannedDate: date || null }));
                    setDatePickerOpen(false);
                  }}
                  disabled={(date) => date < new Date()}
                  initialFocus
                  className="p-3 pointer-events-auto"
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* Budget Section */}
          <div className="bg-white rounded-lg p-4 shadow-sm space-y-4">
            <div>
              <h2 className="font-semibold text-lg">{t('embed.budgetSection')}</h2>
              <p className="text-sm text-muted-foreground">{t('embed.budgetHint')}</p>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="budget">{t('embed.budgetLabel')}</Label>
              <Input
                id="budget"
                type="number"
                value={formData.budget}
                onChange={(e) => setFormData(prev => ({ ...prev, budget: e.target.value }))}
                placeholder={t('embed.budgetPlaceholder')}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">{t('embed.notesLabel')}</Label>
              <Textarea
                id="notes"
                value={formData.notes}
                onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                placeholder={t('embed.notesPlaceholder')}
                rows={3}
              />
            </div>
          </div>

          {/* GDPR Section */}
          <div className="bg-white rounded-lg p-4 shadow-sm">
            <div className="flex items-start gap-3">
              <Checkbox
                id="gdpr"
                checked={formData.gdprAccepted}
                onCheckedChange={(checked) => {
                  setFormData(prev => ({ ...prev, gdprAccepted: !!checked }));
                  if (validationErrors.gdpr) {
                    setValidationErrors(prev => ({ ...prev, gdpr: '' }));
                  }
                }}
                className="mt-1"
              />
              <Label 
                htmlFor="gdpr" 
                className="text-sm text-muted-foreground font-normal cursor-pointer"
              >
                {t('embed.gdprLabel', {
                  companyName: config?.instance_info.name || '',
                  nip: config?.instance_info.nip || '',
                })}
              </Label>
            </div>
            {validationErrors.gdpr && (
              <p className="text-sm text-destructive mt-2">{validationErrors.gdpr}</p>
            )}
          </div>

          {/* Submit Button - always enabled */}
          <Button
            type="submit"
            className="w-full h-12 text-base"
            disabled={submitting}
            style={{ backgroundColor: primaryColor }}
          >
            {submitting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                {t('embed.submitting')}
              </>
            ) : (
              t('embed.submit')
            )}
          </Button>
        </form>
      </div>
    </div>
  );
}

// Wrap with CarModelsProvider
export default function EmbedLeadForm() {
  return (
    <CarModelsProvider>
      <EmbedLeadFormContent />
    </CarModelsProvider>
  );
}
