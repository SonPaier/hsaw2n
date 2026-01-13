import { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Tabs, TabsContent } from '@/components/ui/tabs';
import { AdminTabsList, AdminTabsTrigger } from '@/components/admin/AdminTabsList';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { OfferBrandingSettings, OfferBrandingSettingsRef } from './OfferBrandingSettings';
import { Settings, Save, Loader2, FileText, Palette } from 'lucide-react';
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
  
  // General settings state - only default payment terms
  const [defaultPaymentTerms, setDefaultPaymentTerms] = useState('');
  const [loadingSettings, setLoadingSettings] = useState(true);

  const brandingRef = useRef<OfferBrandingSettingsRef>(null);

  // Fetch settings on open
  useEffect(() => {
    const fetchSettings = async () => {
      if (!open || !instanceId) return;
      setLoadingSettings(true);
      
      const { data } = await supabase
        .from('instances')
        .select('offer_default_payment_terms')
        .eq('id', instanceId)
        .single();
      
      if (data) {
        setDefaultPaymentTerms(data.offer_default_payment_terms || '');
      }
      setLoadingSettings(false);
    };

    fetchSettings();
  }, [open, instanceId]);

  const handleSaveAll = async () => {
    setSaving(true);
    try {
      // Save general settings
      const { error: settingsError } = await supabase
        .from('instances')
        .update({ 
          offer_default_payment_terms: defaultPaymentTerms || null,
        })
        .eq('id', instanceId);

      if (settingsError) throw settingsError;

      // Save branding
      const brandingResult = await brandingRef.current?.saveAll();

      if (brandingResult !== false) {
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
          <AdminTabsList columns={2}>
            <AdminTabsTrigger value="general">
              <FileText className="h-4 w-4" />
              {t('offerSettings.general')}
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
                {/* Default payment terms */}
                <div className="space-y-4 p-4 rounded-lg border border-border bg-muted/30">
                  <h4 className="font-medium">{t('offerSettings.defaultValues')}</h4>
                  <p className="text-sm text-muted-foreground">
                    Te ustawienia będą dziedziczone przez każdą nowo utworzoną usługę.
                  </p>
                  
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
                </div>
              </div>
            )}
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
