import { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Tabs, TabsContent } from '@/components/ui/tabs';
import { AdminTabsList, AdminTabsTrigger } from '@/components/admin/AdminTabsList';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { OfferScopesSettings, OfferScopesSettingsRef } from './OfferScopesSettings';
import { OfferVariantsSettings, OfferVariantsSettingsRef } from './OfferVariantsSettings';
import { OfferScopeProductsSettings, OfferScopeProductsSettingsRef } from './OfferScopeProductsSettings';
import { OfferBrandingSettings, OfferBrandingSettingsRef } from './OfferBrandingSettings';
import { Layers, Tag, Package, Settings, Save, Loader2, FileText, Palette, Mail } from 'lucide-react';
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
  
  // New default fields
  const [defaultPaymentTerms, setDefaultPaymentTerms] = useState('');
  const [defaultNotes, setDefaultNotes] = useState('');
  const [defaultWarranty, setDefaultWarranty] = useState('');
  const [defaultServiceInfo, setDefaultServiceInfo] = useState('');
  const [emailTemplate, setEmailTemplate] = useState('');

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
        .select('show_unit_prices_in_offer, slug, offer_default_payment_terms, offer_default_notes, offer_default_warranty, offer_default_service_info, offer_email_template')
        .eq('id', instanceId)
        .single();
      
      if (data) {
        setShowUnitPrices(data.show_unit_prices_in_offer === true);
        // Set default prefix from slug if not set
        if (data.slug) {
          setNumberPrefix(data.slug.toUpperCase().slice(0, 3));
        }
        setDefaultPaymentTerms(data.offer_default_payment_terms || '');
        setDefaultNotes(data.offer_default_notes || '');
        setDefaultWarranty(data.offer_default_warranty || '');
        setDefaultServiceInfo(data.offer_default_service_info || '');
        setEmailTemplate(data.offer_email_template || '');
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
        .update({ 
          show_unit_prices_in_offer: showUnitPrices,
          offer_default_payment_terms: defaultPaymentTerms || null,
          offer_default_notes: defaultNotes || null,
          offer_default_warranty: defaultWarranty || null,
          offer_default_service_info: defaultServiceInfo || null,
          offer_email_template: emailTemplate || null,
        })
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
          <AdminTabsList columns={5}>
            <AdminTabsTrigger value="general">
              <FileText className="h-4 w-4" />
              {t('offerSettings.general')}
            </AdminTabsTrigger>
            <AdminTabsTrigger value="scopes">
              <Layers className="h-4 w-4" />
              {t('offerSettings.services')}
            </AdminTabsTrigger>
            <AdminTabsTrigger value="variants">
              <Tag className="h-4 w-4" />
              {t('offerSettings.variantsTab')}
            </AdminTabsTrigger>
            <AdminTabsTrigger value="products">
              <Package className="h-4 w-4" />
              {t('offerSettings.productsTab')}
            </AdminTabsTrigger>
            <AdminTabsTrigger value="branding">
              <Palette className="h-4 w-4" />
              {t('offerSettings.brandingTab')}
            </AdminTabsTrigger>
          </AdminTabsList>

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

                {/* Default values section */}
                <div className="space-y-4 p-4 rounded-lg border border-border bg-muted/30">
                  <h4 className="font-medium">{t('offerSettings.defaultValues')}</h4>
                  <p className="text-sm text-muted-foreground">{t('offerSettings.defaultValuesDescription')}</p>
                  
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label>{t('offerSettings.defaultPaymentTerms')}</Label>
                      <Textarea
                        value={defaultPaymentTerms}
                        onChange={(e) => { setDefaultPaymentTerms(e.target.value); handleChange(); }}
                        rows={5}
                        disabled={saving}
                        placeholder={t('offerSettings.defaultPaymentTermsPlaceholder')}
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <Label>{t('offerSettings.defaultWarranty')}</Label>
                      <Textarea
                        value={defaultWarranty}
                        onChange={(e) => { setDefaultWarranty(e.target.value); handleChange(); }}
                        rows={5}
                        disabled={saving}
                        placeholder={t('offerSettings.defaultWarrantyPlaceholder')}
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <Label>{t('offerSettings.defaultNotes')}</Label>
                      <Textarea
                        value={defaultNotes}
                        onChange={(e) => { setDefaultNotes(e.target.value); handleChange(); }}
                        rows={5}
                        disabled={saving}
                        placeholder={t('offerSettings.defaultNotesPlaceholder')}
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <Label>{t('offerSettings.defaultServiceInfo')}</Label>
                      <Textarea
                        value={defaultServiceInfo}
                        onChange={(e) => { setDefaultServiceInfo(e.target.value); handleChange(); }}
                        rows={5}
                        disabled={saving}
                        placeholder={t('offerSettings.defaultServiceInfoPlaceholder')}
                      />
                    </div>
                  </div>
                </div>

                {/* Email template section */}
                <div className="space-y-4 p-4 rounded-lg border border-border bg-muted/30">
                  <div className="flex items-center gap-2">
                    <Mail className="h-4 w-4" />
                    <h4 className="font-medium">{t('offerSettings.emailTemplate')}</h4>
                  </div>
                  <p className="text-sm text-muted-foreground">{t('offerSettings.emailTemplateDescription')}</p>
                  
                  <div className="space-y-2">
                    <Textarea
                      value={emailTemplate}
                      onChange={(e) => { setEmailTemplate(e.target.value); handleChange(); }}
                      rows={8}
                      disabled={saving}
                      placeholder={t('offerSettings.emailTemplatePlaceholder')}
                    />
                    <p className="text-xs text-muted-foreground">{t('offerSettings.emailTemplateHint')}</p>
                  </div>
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
