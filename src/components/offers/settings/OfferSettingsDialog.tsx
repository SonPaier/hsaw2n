import { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { OfferScopesSettings, OfferScopesSettingsRef } from './OfferScopesSettings';
import { OfferVariantsSettings, OfferVariantsSettingsRef } from './OfferVariantsSettings';
import { OfferScopeProductsSettings, OfferScopeProductsSettingsRef } from './OfferScopeProductsSettings';
import { OfferBrandingSettings, OfferBrandingSettingsRef } from './OfferBrandingSettings';
import { Layers, Tag, Package, Settings, Save, Loader2, FileText, Palette } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

interface OfferSettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  instanceId: string;
}

export function OfferSettingsDialog({ open, onOpenChange, instanceId }: OfferSettingsDialogProps) {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState('general');
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  
  // General settings state
  const [showUnitPrices, setShowUnitPrices] = useState(false);
  const [numberPrefix, setNumberPrefix] = useState('');
  const [numberFormat, setNumberFormat] = useState('PREFIX/YYYY/MMDD/NNN');
  const [loadingSettings, setLoadingSettings] = useState(true);

  const scopesRef = useRef<OfferScopesSettingsRef>(null);
  const variantsRef = useRef<OfferVariantsSettingsRef>(null);
  const productsRef = useRef<OfferScopeProductsSettingsRef>(null);
  const brandingRef = useRef<OfferBrandingSettingsRef>(null);

  // Fetch settings on open
  useEffect(() => {
    const fetchSettings = async () => {
      if (!open || !instanceId) return;
      setLoadingSettings(true);
      
      const { data } = await supabase
        .from('instances')
        .select('show_unit_prices_in_offer, slug')
        .eq('id', instanceId)
        .single();
      
      if (data) {
        setShowUnitPrices(data.show_unit_prices_in_offer === true);
        // Set default prefix from slug if not set
        if (data.slug) {
          setNumberPrefix(data.slug.toUpperCase().slice(0, 3));
        }
      }
      setLoadingSettings(false);
    };

    fetchSettings();
  }, [open, instanceId]);

  const handleToggleUnitPrices = (checked: boolean) => {
    setShowUnitPrices(checked);
    setHasChanges(true);
  };

  const handlePrefixChange = (value: string) => {
    setNumberPrefix(value.toUpperCase());
    setHasChanges(true);
  };

  const handleFormatChange = (value: string) => {
    setNumberFormat(value);
    setHasChanges(true);
  };

  const handleSaveAll = async () => {
    setSaving(true);
    try {
      // Save general settings
      const { error: settingsError } = await supabase
        .from('instances')
        .update({ show_unit_prices_in_offer: showUnitPrices })
        .eq('id', instanceId);

      if (settingsError) throw settingsError;

      // Save other tabs
      const results = await Promise.all([
        scopesRef.current?.saveAll(),
        variantsRef.current?.saveAll(),
        productsRef.current?.saveAll(),
        brandingRef.current?.saveAll(),
      ]);

      const allSuccessful = results.every(r => r !== false);
      if (allSuccessful) {
        toast.success(t('offerSettings.saveSuccess'));
        setHasChanges(false);
      }
    } catch (error) {
      console.error('Error saving:', error);
      toast.error(t('offerSettings.saveError'));
    } finally {
      setSaving(false);
    }
  };

  const handleChange = () => {
    setHasChanges(true);
  };

  const handleClose = (open: boolean) => {
    if (!open && hasChanges) {
      if (confirm(t('offerSettings.unsavedChanges'))) {
        setHasChanges(false);
        onOpenChange(false);
      }
    } else {
      onOpenChange(open);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            {t('offerSettings.title')}
          </DialogTitle>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-4">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="general" className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              {t('offerSettings.general')}
            </TabsTrigger>
            <TabsTrigger value="scopes" className="flex items-center gap-2">
              <Layers className="h-4 w-4" />
              {t('offerSettings.services')}
            </TabsTrigger>
            <TabsTrigger value="variants" className="flex items-center gap-2">
              <Tag className="h-4 w-4" />
              {t('offerSettings.variantsTab')}
            </TabsTrigger>
            <TabsTrigger value="products" className="flex items-center gap-2">
              <Package className="h-4 w-4" />
              {t('offerSettings.productsTab')}
            </TabsTrigger>
            <TabsTrigger value="branding" className="flex items-center gap-2">
              <Palette className="h-4 w-4" />
              {t('offerSettings.brandingTab')}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="general" className="mt-6">
            {loadingSettings ? (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Loader2 className="w-4 h-4 animate-spin" />
                {t('common.loading')}
              </div>
            ) : (
              <div className="space-y-6">
                {/* Numbering settings */}
                <div className="space-y-4 p-4 rounded-lg border border-border bg-muted/30">
                  <h4 className="font-medium">{t('offers.numberingSettings')}</h4>
                  <p className="text-sm text-muted-foreground">{t('offers.settingsDescription')}</p>
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>{t('offers.numberPrefix')}</Label>
                      <Input
                        value={numberPrefix}
                        onChange={e => handlePrefixChange(e.target.value)}
                        placeholder="ABC"
                        maxLength={5}
                        disabled={saving}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>{t('offers.numberFormat')}</Label>
                      <Select value={numberFormat} onValueChange={handleFormatChange} disabled={saving}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="PREFIX/YYYY/MMDD/NNN">PREFIX/YYYY/MMDD/NNN</SelectItem>
                          <SelectItem value="PREFIX/YYYY/NNN">PREFIX/YYYY/NNN</SelectItem>
                          <SelectItem value="PREFIX/NNN">PREFIX/NNN</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>

                {/* Unit prices toggle */}
                <div className="flex items-center justify-between p-4 rounded-lg border border-border bg-muted/30">
                  <div className="space-y-1">
                    <Label htmlFor="show-unit-prices" className="font-medium">
                      {t('offerSettings.showUnitPrices')}
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      {showUnitPrices 
                        ? t('offerSettings.showUnitPricesEnabled')
                        : t('offerSettings.showUnitPricesDisabled')}
                    </p>
                  </div>
                  <Switch
                    id="show-unit-prices"
                    checked={showUnitPrices}
                    onCheckedChange={handleToggleUnitPrices}
                    disabled={saving}
                  />
                </div>
              </div>
            )}
          </TabsContent>

          <TabsContent value="scopes" className="mt-6">
            <OfferScopesSettings ref={scopesRef} instanceId={instanceId} onChange={handleChange} />
          </TabsContent>

          <TabsContent value="variants" className="mt-6">
            <OfferVariantsSettings ref={variantsRef} instanceId={instanceId} onChange={handleChange} />
          </TabsContent>

          <TabsContent value="products" className="mt-6">
            <OfferScopeProductsSettings ref={productsRef} instanceId={instanceId} onChange={handleChange} />
          </TabsContent>

          <TabsContent value="branding" className="mt-6">
            <OfferBrandingSettings ref={brandingRef} instanceId={instanceId} onChange={handleChange} />
          </TabsContent>
        </Tabs>

        <DialogFooter className="mt-6">
          <Button variant="outline" onClick={() => handleClose(false)}>
            {t('common.cancel')}
          </Button>
          <Button onClick={handleSaveAll} disabled={saving}>
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                {t('common.saving')}
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                {t('common.save')}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
