import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Check, Loader2, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { CarSearchAutocomplete, CarSearchValue } from '@/components/ui/car-search-autocomplete';
import { CarModelsProvider } from '@/contexts/CarModelsContext';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';

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
  selectedTemplates: string[];
  budget: string;
  notes: string;
  gdprAccepted: boolean;
}

function EmbedLeadFormContent() {
  const { t } = useTranslation();
  const [config, setConfig] = useState<EmbedConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [formData, setFormData] = useState<FormData>({
    name: '',
    email: '',
    phone: '',
    vehicleModel: '',
    vehicleModelId: null,
    carSize: '',
    mileage: '',
    selectedTemplates: [],
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
    if (!formData.phone.trim()) {
      errors.phone = t('embed.validation.phoneRequired');
    }
    if (!formData.vehicleModel.trim()) {
      errors.vehicle = t('embed.validation.vehicleRequired');
    }
    if (formData.selectedTemplates.length === 0) {
      errors.templates = t('embed.validation.packageRequired');
    }
    if (!formData.gdprAccepted) {
      errors.gdpr = t('embed.gdprRequired');
    }

    setValidationErrors(errors);
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
          },
          offer_details: {
            template_ids: formData.selectedTemplates,
            budget_suggestion: formData.budget ? parseFloat(formData.budget) : null,
            additional_notes: formData.notes,
          },
        },
      });

      if (error) throw error;
      setSubmitted(true);
    } catch (err) {
      console.error('Error submitting lead:', err);
      setError(t('embed.errorGeneric'));
    } finally {
      setSubmitting(false);
    }
  };

  const toggleTemplate = (templateId: string) => {
    setFormData(prev => ({
      ...prev,
      selectedTemplates: prev.selectedTemplates.includes(templateId)
        ? prev.selectedTemplates.filter(id => id !== templateId)
        : [...prev.selectedTemplates, templateId],
    }));
    // Clear validation error when user selects a template
    if (validationErrors.templates) {
      setValidationErrors(prev => ({ ...prev, templates: '' }));
    }
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
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#f8fafc' }}>
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error && !config) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4" style={{ backgroundColor: '#f8fafc' }}>
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

        <form onSubmit={handleSubmit} className="space-y-6">
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
                onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
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
                onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
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
                return (
                  <button
                    key={template.id}
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
                        <p className="font-medium">{template.name}</p>
                        {template.description && (
                          <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
                            {template.description}
                          </p>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
            {validationErrors.templates && (
              <p className="text-sm text-destructive">{validationErrors.templates}</p>
            )}
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

          {/* Error display */}
          {error && (
            <div className="bg-destructive/10 text-destructive p-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          {/* Submit Button */}
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
