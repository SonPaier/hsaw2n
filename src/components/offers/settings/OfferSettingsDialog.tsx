import { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { OfferScopesSettings, OfferScopesSettingsRef } from './OfferScopesSettings';
import { OfferVariantsSettings, OfferVariantsSettingsRef } from './OfferVariantsSettings';
import { OfferScopeProductsSettings, OfferScopeProductsSettingsRef } from './OfferScopeProductsSettings';
import { Layers, Tag, Package, Settings, Save, Loader2, FileText } from 'lucide-react';
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
  const [loadingSettings, setLoadingSettings] = useState(true);

  const scopesRef = useRef<OfferScopesSettingsRef>(null);
  const variantsRef = useRef<OfferVariantsSettingsRef>(null);
  const productsRef = useRef<OfferScopeProductsSettingsRef>(null);

  // Fetch settings on open
  useEffect(() => {
    const fetchSettings = async () => {
      if (!open || !instanceId) return;
      setLoadingSettings(true);
      
      const { data } = await supabase
        .from('instances')
        .select('show_unit_prices_in_offer')
        .eq('id', instanceId)
        .single();
      
      if (data) {
        setShowUnitPrices(data.show_unit_prices_in_offer === true);
      }
      setLoadingSettings(false);
    };

    fetchSettings();
  }, [open, instanceId]);

  const handleToggleUnitPrices = async (checked: boolean) => {
    setShowUnitPrices(checked);
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
          <TabsList className="grid w-full grid-cols-4">
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
              {t('offerSettings.variants')}
            </TabsTrigger>
            <TabsTrigger value="products" className="flex items-center gap-2">
              <Package className="h-4 w-4" />
              {t('offerSettings.products')}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="general" className="mt-6">
            {loadingSettings ? (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Loader2 className="w-4 h-4 animate-spin" />
                {t('common.loading')}
              </div>
            ) : (
              <div className="space-y-4">
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
