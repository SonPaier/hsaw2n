import { useState, useEffect, forwardRef, useImperativeHandle } from 'react';
import { useTranslation } from 'react-i18next';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Loader2, RotateCcw, AlertTriangle, Check } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { 
  DEFAULT_BRANDING, 
  OfferBranding, 
  getContrastRatio, 
  hasGoodContrast,
  getContrastTextColor 
} from '@/lib/colorUtils';
import { OfferBrandingPreview } from './OfferBrandingPreview';

interface OfferBrandingSettingsProps {
  instanceId: string;
  onChange?: () => void;
}

export interface OfferBrandingSettingsRef {
  saveAll: () => Promise<boolean>;
}

interface ColorFieldProps {
  label: string;
  description?: string;
  value: string;
  onChange: (value: string) => void;
  contrastWith?: string;
  disabled?: boolean;
  showAutoContrast?: boolean;
}

function ColorField({ 
  label, 
  description, 
  value, 
  onChange, 
  contrastWith, 
  disabled,
  showAutoContrast 
}: ColorFieldProps) {
  const { t } = useTranslation();
  const contrastRatio = contrastWith ? getContrastRatio(value, contrastWith) : null;
  const isGoodContrast = contrastWith ? hasGoodContrast(value, contrastWith) : true;
  
  const handleAutoContrast = () => {
    if (contrastWith) {
      onChange(getContrastTextColor(contrastWith));
    }
  };
  
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label className="font-medium">{label}</Label>
        {contrastRatio !== null && (
          <Badge 
            variant={isGoodContrast ? 'secondary' : 'destructive'}
            className="text-xs"
          >
            {isGoodContrast ? (
              <Check className="w-3 h-3 mr-1" />
            ) : (
              <AlertTriangle className="w-3 h-3 mr-1" />
            )}
            {contrastRatio.toFixed(1)}:1
          </Badge>
        )}
      </div>
      {description && (
        <p className="text-xs text-muted-foreground">{description}</p>
      )}
      <div className="flex items-center gap-2">
        <div className="relative">
          <input
            type="color"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            disabled={disabled}
            className="w-10 h-10 rounded-lg border cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
          />
        </div>
        <Input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          className="w-28 font-mono text-sm uppercase"
          maxLength={7}
        />
        {showAutoContrast && contrastWith && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleAutoContrast}
            disabled={disabled}
            className="text-xs"
          >
            {t('offerSettings.autoContrast')}
          </Button>
        )}
      </div>
      {!isGoodContrast && (
        <p className="text-xs text-destructive flex items-center gap-1">
          <AlertTriangle className="w-3 h-3" />
          {t('offerSettings.contrastWarning')}
        </p>
      )}
    </div>
  );
}

export const OfferBrandingSettings = forwardRef<OfferBrandingSettingsRef, OfferBrandingSettingsProps>(
  ({ instanceId, onChange }, ref) => {
    const { t } = useTranslation();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [branding, setBranding] = useState<OfferBranding>({
      offer_branding_enabled: false,
      ...DEFAULT_BRANDING,
    });

    useEffect(() => {
      const fetchBranding = async () => {
        if (!instanceId) return;
        setLoading(true);
        
        const { data, error } = await supabase
          .from('instances')
          .select(`
            offer_branding_enabled,
            offer_bg_color,
            offer_header_bg_color,
            offer_header_text_color,
            offer_section_bg_color,
            offer_section_text_color,
            offer_primary_color
          `)
          .eq('id', instanceId)
          .single();
        
        if (data && !error) {
          setBranding({
            offer_branding_enabled: data.offer_branding_enabled ?? false,
            offer_bg_color: data.offer_bg_color ?? DEFAULT_BRANDING.offer_bg_color,
            offer_header_bg_color: data.offer_header_bg_color ?? DEFAULT_BRANDING.offer_header_bg_color,
            offer_header_text_color: data.offer_header_text_color ?? DEFAULT_BRANDING.offer_header_text_color,
            offer_section_bg_color: data.offer_section_bg_color ?? DEFAULT_BRANDING.offer_section_bg_color,
            offer_section_text_color: data.offer_section_text_color ?? DEFAULT_BRANDING.offer_section_text_color,
            offer_primary_color: data.offer_primary_color ?? DEFAULT_BRANDING.offer_primary_color,
          });
        }
        setLoading(false);
      };

      fetchBranding();
    }, [instanceId]);

    const updateBranding = (key: keyof OfferBranding, value: string | boolean) => {
      setBranding((prev) => ({ ...prev, [key]: value }));
      onChange?.();
    };

    const resetToDefaults = () => {
      setBranding({
        offer_branding_enabled: branding.offer_branding_enabled,
        ...DEFAULT_BRANDING,
      });
      onChange?.();
    };

    const saveAll = async (): Promise<boolean> => {
      setSaving(true);
      try {
        const { error } = await supabase
          .from('instances')
          .update({
            offer_branding_enabled: branding.offer_branding_enabled,
            offer_bg_color: branding.offer_bg_color,
            offer_header_bg_color: branding.offer_header_bg_color,
            offer_header_text_color: branding.offer_header_text_color,
            offer_section_bg_color: branding.offer_section_bg_color,
            offer_section_text_color: branding.offer_section_text_color,
            offer_primary_color: branding.offer_primary_color,
          })
          .eq('id', instanceId);

        if (error) throw error;
        return true;
      } catch (error) {
        console.error('Error saving branding:', error);
        toast.error(t('offerSettings.saveError'));
        return false;
      } finally {
        setSaving(false);
      }
    };

    useImperativeHandle(ref, () => ({ saveAll }));

    if (loading) {
      return (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      );
    }

    const colorsDisabled = !branding.offer_branding_enabled || saving;

    return (
      <div className="space-y-6">
        {/* Enable branding switch */}
        <div className="flex items-center justify-between p-4 rounded-lg border bg-muted/30">
          <div className="space-y-1">
            <Label htmlFor="enable-branding" className="font-medium">
              {t('offerSettings.enableBranding')}
            </Label>
            <p className="text-sm text-muted-foreground">
              {branding.offer_branding_enabled 
                ? t('offerSettings.brandingEnabled')
                : t('offerSettings.brandingDisabled')}
            </p>
          </div>
          <Switch
            id="enable-branding"
            checked={branding.offer_branding_enabled}
            onCheckedChange={(checked) => updateBranding('offer_branding_enabled', checked)}
            disabled={saving}
          />
        </div>

        <div className="grid lg:grid-cols-2 gap-6">
          {/* Color settings */}
          <div className="space-y-6">
            <ColorField
              label={t('offerSettings.backgroundColor')}
              description={t('offerSettings.backgroundColorDesc')}
              value={branding.offer_bg_color}
              onChange={(v) => updateBranding('offer_bg_color', v)}
              disabled={colorsDisabled}
            />

            <div className="space-y-4 p-4 rounded-lg border bg-muted/10">
              <h4 className="font-medium text-sm">{t('offerSettings.headerSection')}</h4>
              <ColorField
                label={t('offerSettings.headerColor')}
                value={branding.offer_header_bg_color}
                onChange={(v) => updateBranding('offer_header_bg_color', v)}
                disabled={colorsDisabled}
              />
              <ColorField
                label={t('offerSettings.headerTextColor')}
                value={branding.offer_header_text_color}
                onChange={(v) => updateBranding('offer_header_text_color', v)}
                contrastWith={branding.offer_header_bg_color}
                showAutoContrast
                disabled={colorsDisabled}
              />
            </div>

            <div className="space-y-4 p-4 rounded-lg border bg-muted/10">
              <h4 className="font-medium text-sm">{t('offerSettings.sectionsCards')}</h4>
              <ColorField
                label={t('offerSettings.sectionColor')}
                value={branding.offer_section_bg_color}
                onChange={(v) => updateBranding('offer_section_bg_color', v)}
                disabled={colorsDisabled}
              />
              <ColorField
                label={t('offerSettings.sectionTextColor')}
                value={branding.offer_section_text_color}
                onChange={(v) => updateBranding('offer_section_text_color', v)}
                contrastWith={branding.offer_section_bg_color}
                showAutoContrast
                disabled={colorsDisabled}
              />
            </div>

            <ColorField
              label={t('offerSettings.primaryColor')}
              description={t('offerSettings.primaryColorDesc')}
              value={branding.offer_primary_color}
              onChange={(v) => updateBranding('offer_primary_color', v)}
              disabled={colorsDisabled}
            />

            <Button
              variant="outline"
              size="sm"
              onClick={resetToDefaults}
              disabled={colorsDisabled}
              className="gap-2"
            >
              <RotateCcw className="w-4 h-4" />
              {t('offerSettings.resetDefaults')}
            </Button>
          </div>

          {/* Live preview */}
          <div className="space-y-3">
            <h4 className="font-medium text-sm">{t('offerSettings.previewTitle')}</h4>
            <OfferBrandingPreview
              bgColor={branding.offer_branding_enabled ? branding.offer_bg_color : DEFAULT_BRANDING.offer_bg_color}
              headerBgColor={branding.offer_branding_enabled ? branding.offer_header_bg_color : DEFAULT_BRANDING.offer_header_bg_color}
              headerTextColor={branding.offer_branding_enabled ? branding.offer_header_text_color : DEFAULT_BRANDING.offer_header_text_color}
              sectionBgColor={branding.offer_branding_enabled ? branding.offer_section_bg_color : DEFAULT_BRANDING.offer_section_bg_color}
              sectionTextColor={branding.offer_branding_enabled ? branding.offer_section_text_color : DEFAULT_BRANDING.offer_section_text_color}
              primaryColor={branding.offer_branding_enabled ? branding.offer_primary_color : DEFAULT_BRANDING.offer_primary_color}
            />
            {!branding.offer_branding_enabled && (
              <p className="text-xs text-muted-foreground text-center">
                {t('offerSettings.previewDefaultColors')}
              </p>
            )}
          </div>
        </div>
      </div>
    );
  }
);

OfferBrandingSettings.displayName = 'OfferBrandingSettings';
