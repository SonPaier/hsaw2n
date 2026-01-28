import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { Loader2, Plus, Trash2, ExternalLink, Copy, Check, GripVertical } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import EmbedLeadFormPreview from './EmbedLeadFormPreview';

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
}

interface Service {
  id: string;
  name: string;
  short_name: string | null;
  default_price: number | null;
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
  const [config, setConfig] = useState<WidgetConfig>({
    visible_templates: [],
    extras: [],
  });
  const [instanceSlug, setInstanceSlug] = useState<string>('');
  const [copied, setCopied] = useState(false);

  // Fetch data
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        // Fetch instance with widget_config
        const { data: instance } = await supabase
          .from('instances')
          .select('slug, widget_config')
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

        if (templatesData) {
          setTemplates(templatesData);
        }

        // Fetch services for extras selection
        const { data: servicesData } = await supabase
          .from('unified_services')
          .select('id, name, short_name, default_price')
          .eq('instance_id', instanceId)
          .eq('service_type', 'both')
          .eq('active', true)
          .is('deleted_at', null)
          .neq('visibility', 'only_reservations')
          .order('name');

        if (servicesData) {
          setServices(servicesData);
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

  // Get available services (not already added as extras)
  const availableServices = services.filter(
    s => !config.extras.some(e => e.service_id === s.id)
  );

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

            {availableServices.length > 0 && (
              <div className="pt-2">
                <select
                  className="w-full h-9 px-3 border rounded-md text-sm bg-background"
                  value=""
                  onChange={(e) => {
                    if (e.target.value) {
                      handleAddExtra(e.target.value);
                    }
                  }}
                >
                  <option value="">+ Dodaj usługę...</option>
                  {availableServices.map(service => (
                    <option key={service.id} value={service.id}>
                      {service.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </div>

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
      <div className="border rounded-lg bg-slate-100 overflow-hidden">
        <div className="p-2 bg-slate-200 border-b">
          <p className="text-xs text-center text-muted-foreground">Podgląd widgetu</p>
        </div>
        <ScrollArea className="h-[600px]">
          <EmbedLeadFormPreview 
            templates={templates.filter(t => config.visible_templates.includes(t.id))}
            extras={config.extras.map(e => ({
              id: e.service_id,
              name: e.custom_label || getServiceName(e.service_id),
            }))}
          />
        </ScrollArea>
      </div>
    </div>
  );
}
