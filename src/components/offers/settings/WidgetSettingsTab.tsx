import { useState, useEffect, useRef, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { Loader2, Plus, Trash2, ExternalLink, Copy, Check, GripVertical, ChevronDown } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import EmbedLeadFormPreview from './EmbedLeadFormPreview';
import { ScopeProductSelectionDrawer } from '../services/ScopeProductSelectionDrawer';

interface WidgetConfig {
  visible_templates: string[];
  extras: {
    service_id: string;
    custom_label: string | null;
  }[];
}

interface Template {
  id: string;
  name: string;
  short_name: string | null;
  description: string | null;
  price_from: number | null;
  available_durations?: number[];
}

interface Service {
  id: string;
  name: string;
  short_name: string | null;
  default_price: number | null;
  category_id: string | null;
}

interface Category {
  id: string;
  name: string;
  sort_order: number | null;
}

interface WidgetSettingsTabProps {
  instanceId: string;
  onChange: () => void;
}

export function WidgetSettingsTab({ instanceId, onChange }: WidgetSettingsTabProps) {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [extrasDrawerOpen, setExtrasDrawerOpen] = useState(false);
  const [config, setConfig] = useState<WidgetConfig>({
    visible_templates: [],
    extras: [],
  });
  const [instanceSlug, setInstanceSlug] = useState<string>('');
  const [copied, setCopied] = useState(false);
  const [branding, setBranding] = useState<{
    bgColor: string;
    sectionBgColor: string;
    sectionTextColor: string;
    primaryColor: string;
  } | null>(null);

  // Fetch data
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        // Fetch instance with widget_config and branding colors
        const { data: instance } = await supabase
          .from('instances')
          .select('slug, widget_config, offer_branding_enabled, offer_bg_color, offer_section_bg_color, offer_section_text_color, offer_primary_color')
          .eq('id', instanceId)
          .single();

        if (instance) {
          setInstanceSlug(instance.slug);
          if (instance.widget_config && typeof instance.widget_config === 'object') {
            const parsed = instance.widget_config as unknown as WidgetConfig;
            setConfig({
              visible_templates: parsed.visible_templates || [],
              extras: parsed.extras || [],
            });
          }
          
          // Set branding if enabled
          if (instance.offer_branding_enabled) {
            setBranding({
              bgColor: instance.offer_bg_color || '#f8fafc',
              sectionBgColor: instance.offer_section_bg_color || '#ffffff',
              sectionTextColor: instance.offer_section_text_color || '#1e293b',
              primaryColor: instance.offer_primary_color || '#2563eb',
            });
          } else {
            setBranding(null);
          }
        }

        // Fetch templates (offer_scopes with unified services)
        const { data: templatesData } = await supabase
          .from('offer_scopes')
          .select('id, name, short_name, description, price_from')
          .eq('instance_id', instanceId)
          .eq('active', true)
          .eq('is_extras_scope', false)
          .eq('has_unified_services', true)
          .order('sort_order');

        let templatesWithDurations: Template[] = templatesData || [];

        // Fetch available durations for each template from products metadata
        if (templatesData && templatesData.length > 0) {
          const templateIds = templatesData.map(t => t.id);
          
          // Fetch scope products
          const { data: scopeProducts } = await supabase
            .from('offer_scope_products')
            .select('scope_id, product_id')
            .in('scope_id', templateIds);

          if (scopeProducts && scopeProducts.length > 0) {
            const productIds = [...new Set(scopeProducts.map(sp => sp.product_id))];
            
            // Fetch product metadata
            const { data: products } = await supabase
              .from('unified_services')
              .select('id, metadata')
              .in('id', productIds)
              .eq('active', true)
              .is('deleted_at', null);

            if (products) {
              // Build product_id -> durability map
              const productDurability: Record<string, number | null> = {};
              for (const p of products) {
                const meta = p.metadata as { trwalosc_produktu_w_mesiacach?: number } | null;
                productDurability[p.id] = meta?.trwalosc_produktu_w_mesiacach || null;
              }

              // Build scope -> durations map
              const templateDurations: Record<string, number[]> = {};
              for (const sp of scopeProducts) {
                const durability = productDurability[sp.product_id];
                if (durability && durability > 0) {
                  if (!templateDurations[sp.scope_id]) {
                    templateDurations[sp.scope_id] = [];
                  }
                  if (!templateDurations[sp.scope_id].includes(durability)) {
                    templateDurations[sp.scope_id].push(durability);
                  }
                }
              }

              // Sort durations
              for (const scopeId of Object.keys(templateDurations)) {
                templateDurations[scopeId].sort((a, b) => a - b);
              }

              // Merge durations into templates
              templatesWithDurations = templatesData.map(t => ({
                ...t,
                available_durations: templateDurations[t.id] || [],
              }));
            }
          }
        }

        setTemplates(templatesWithDurations);

        // Fetch services for extras selection
        const { data: servicesData } = await supabase
          .from('unified_services')
          .select('id, name, short_name, default_price, category_id')
          .eq('instance_id', instanceId)
          .eq('service_type', 'both')
          .eq('active', true)
          .is('deleted_at', null)
          .neq('visibility', 'only_reservations')
          .order('name');

        if (servicesData) {
          setServices(servicesData);
        }

        // Fetch categories for drawer
        const { data: categoriesData } = await supabase
          .from('unified_categories')
          .select('id, name, sort_order')
          .eq('instance_id', instanceId)
          .eq('category_type', 'both')
          .eq('active', true);

        if (categoriesData) {
          setCategories(categoriesData);
        }
      } catch (error) {
        console.error('Error fetching widget config:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [instanceId]);

  const handleTemplateToggle = (templateId: string, checked: boolean) => {
    setConfig(prev => ({
      ...prev,
      visible_templates: checked
        ? [...prev.visible_templates, templateId]
        : prev.visible_templates.filter(id => id !== templateId),
    }));
    onChange();
  };

  const handlePriceFromChange = async (templateId: string, value: string) => {
    const numValue = value ? parseFloat(value) : null;
    
    // Update local state
    setTemplates(prev => prev.map(t => 
      t.id === templateId ? { ...t, price_from: numValue } : t
    ));

    // Save to database
    await supabase
      .from('offer_scopes')
      .update({ price_from: numValue })
      .eq('id', templateId);
    
    onChange();
  };

  const handleAddExtra = (serviceId: string) => {
    if (config.extras.some(e => e.service_id === serviceId)) return;
    
    setConfig(prev => ({
      ...prev,
      extras: [...prev.extras, { service_id: serviceId, custom_label: null }],
    }));
    onChange();
  };

  const handleRemoveExtra = (serviceId: string) => {
    setConfig(prev => ({
      ...prev,
      extras: prev.extras.filter(e => e.service_id !== serviceId),
    }));
    onChange();
  };

  const handleExtraLabelChange = (serviceId: string, label: string) => {
    setConfig(prev => ({
      ...prev,
      extras: prev.extras.map(e => 
        e.service_id === serviceId ? { ...e, custom_label: label || null } : e
      ),
    }));
    onChange();
  };

  const getServiceName = (serviceId: string): string => {
    return services.find(s => s.id === serviceId)?.name || 'Nieznana usługa';
  };

  // Build products for drawer (use service ID as the main ID)
  const drawerProducts = useMemo(() => {
    // Build category name map
    const categoryNameMap: Record<string, string> = {};
    categories.forEach(c => {
      categoryNameMap[c.id] = c.name;
    });

    return services.map(s => ({
      id: s.id,
      productId: s.id,
      productName: s.name,
      productShortName: s.short_name,
      variantName: null,
      price: s.default_price ?? 0,
      category: s.category_id ? categoryNameMap[s.category_id] || null : null,
    }));
  }, [services, categories]);

  // Build category order map
  const categoryOrder = useMemo(() => {
    const order: Record<string, number> = {};
    categories.forEach(c => {
      order[c.name] = c.sort_order ?? 999;
    });
    return order;
  }, [categories]);

  // Handle extras selection from drawer
  const handleExtrasSelected = (products: { id: string; productId: string; productName: string }[]) => {
    // Keep existing custom labels where possible
    const existingLabels = new Map(config.extras.map(e => [e.service_id, e.custom_label]));
    
    const newExtras = products.map(p => ({
      service_id: p.id,
      custom_label: existingLabels.get(p.id) || null,
    }));
    
    setConfig(prev => ({ ...prev, extras: newExtras }));
    onChange();
  };

  // Get already selected service IDs for drawer
  const selectedExtrasIds = config.extras.map(e => e.service_id);

  const embedUrl = `https://${instanceSlug}.n2wash.com/embed`;
  const iframeCode = `<iframe 
  src="${embedUrl}" 
  width="100%" 
  height="900" 
  frameborder="0"
  style="border: none; border-radius: 8px;"
></iframe>`;

  const handleCopyCode = () => {
    navigator.clipboard.writeText(iframeCode);
    setCopied(true);
    toast.success('Kod skopiowany');
    setTimeout(() => setCopied(false), 2000);
  };

  // Save config to instance
  const saveConfig = async () => {
    try {
      // Convert to JSON-compatible format
      const jsonConfig = JSON.parse(JSON.stringify(config));
      await supabase
        .from('instances')
        .update({ widget_config: jsonConfig })
        .eq('id', instanceId);
    } catch (error) {
      console.error('Error saving widget config:', error);
    }
  };

  // Auto-save config when it changes
  useEffect(() => {
    if (!loading) {
      saveConfig();
    }
  }, [config]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Left side - Configuration */}
      <div className="space-y-6">
        {/* Templates visibility and pricing */}
        <div className="space-y-4">
          <div>
            <h3 className="font-medium">Szablony w widgecie</h3>
            <p className="text-sm text-muted-foreground">
              Wybierz które szablony będą widoczne i ustaw ceny "od"
            </p>
          </div>

          <div className="space-y-3">
            {templates.map(template => {
              const isVisible = config.visible_templates.includes(template.id);
              return (
                <div 
                  key={template.id}
                  className="flex items-center gap-3 p-3 rounded-lg border bg-card"
                >
                  <Checkbox
                    checked={isVisible}
                    onCheckedChange={(checked) => handleTemplateToggle(template.id, !!checked)}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{template.name}</p>
                    {template.short_name && (
                      <p className="text-xs text-muted-foreground">{template.short_name}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Label className="text-sm text-muted-foreground whitespace-nowrap">od</Label>
                    <Input
                      type="number"
                      value={template.price_from ?? ''}
                      onChange={(e) => handlePriceFromChange(template.id, e.target.value)}
                      placeholder="—"
                      className="w-24 h-8 text-right"
                    />
                    <span className="text-sm text-muted-foreground">zł</span>
                  </div>
                </div>
              );
            })}

            {templates.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">
                Brak aktywnych szablonów z usługami zunifikowanymi
              </p>
            )}
          </div>
        </div>

        <Separator />

        {/* Extras configuration */}
        <div className="space-y-4">
          <div>
            <h3 className="font-medium">Dodatki do wyboru</h3>
            <p className="text-sm text-muted-foreground">
              Dodaj usługi jako "dodatki" z opcjonalnymi własnymi nazwami
            </p>
          </div>

          <div className="space-y-2">
            {config.extras.map(extra => (
              <div 
                key={extra.service_id}
                className="flex items-center gap-2 p-3 rounded-lg border bg-card"
              >
                <GripVertical className="w-4 h-4 text-muted-foreground" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-muted-foreground truncate">
                    {getServiceName(extra.service_id)}
                  </p>
                  <Input
                    value={extra.custom_label || ''}
                    onChange={(e) => handleExtraLabelChange(extra.service_id, e.target.value)}
                    placeholder="Własna nazwa (opcjonalna)"
                    className="mt-1 h-8"
                  />
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-destructive hover:text-destructive"
                  onClick={() => handleRemoveExtra(extra.service_id)}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            ))}

            <Button
              variant="outline"
              onClick={() => setExtrasDrawerOpen(true)}
              className="w-full justify-start gap-2 h-11"
            >
              <Plus className="w-4 h-4" />
              Wybierz usługi...
            </Button>
          </div>
        </div>

        {/* Extras Selection Drawer */}
        <ScopeProductSelectionDrawer
          open={extrasDrawerOpen}
          onClose={() => setExtrasDrawerOpen(false)}
          availableProducts={drawerProducts}
          alreadySelectedIds={selectedExtrasIds}
          categoryOrder={categoryOrder}
          onConfirm={handleExtrasSelected}
        />

        <Separator />

        {/* Embed code */}
        <div className="space-y-4">
          <div>
            <h3 className="font-medium">Kod do osadzenia</h3>
            <p className="text-sm text-muted-foreground">
              Skopiuj kod iframe i wklej na swoją stronę
            </p>
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <code className="flex-1 bg-muted px-3 py-2 rounded-md text-xs font-mono break-all">
                {embedUrl}
              </code>
              <Button variant="outline" size="icon" onClick={() => window.open(embedUrl, '_blank')}>
                <ExternalLink className="w-4 h-4" />
              </Button>
            </div>

            <textarea
              value={iframeCode}
              readOnly
              className="w-full h-24 font-mono text-xs bg-muted p-3 rounded-md border resize-none"
            />
            
            <Button onClick={handleCopyCode} variant="outline" className="w-full">
              {copied ? (
                <>
                  <Check className="w-4 h-4 mr-2" />
                  Skopiowano
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4 mr-2" />
                  Kopiuj kod iframe
                </>
              )}
            </Button>
          </div>
        </div>
      </div>

      {/* Right side - Preview */}
      <div className="border rounded-lg bg-muted/50 overflow-hidden">
        <div className="p-2 bg-muted border-b">
          <p className="text-xs text-center text-muted-foreground">Podgląd widgetu</p>
        </div>
        <ScrollArea className="h-[600px]">
          <EmbedLeadFormPreview 
            templates={templates.filter(t => config.visible_templates.includes(t.id))}
            extras={config.extras.map(e => ({
              id: e.service_id,
              name: e.custom_label || getServiceName(e.service_id),
            }))}
            branding={branding || undefined}
          />
        </ScrollArea>
      </div>
    </div>
  );
}
