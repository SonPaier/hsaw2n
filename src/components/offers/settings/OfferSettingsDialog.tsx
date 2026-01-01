import { useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { OfferScopesSettings, OfferScopesSettingsRef } from './OfferScopesSettings';
import { OfferVariantsSettings, OfferVariantsSettingsRef } from './OfferVariantsSettings';
import { OfferScopeProductsSettings, OfferScopeProductsSettingsRef } from './OfferScopeProductsSettings';
import { Layers, Tag, Package, Settings, Save, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface OfferSettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  instanceId: string;
}

export function OfferSettingsDialog({ open, onOpenChange, instanceId }: OfferSettingsDialogProps) {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState('scopes');
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  const scopesRef = useRef<OfferScopesSettingsRef>(null);
  const variantsRef = useRef<OfferVariantsSettingsRef>(null);
  const productsRef = useRef<OfferScopeProductsSettingsRef>(null);

  const handleSaveAll = async () => {
    setSaving(true);
    try {
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
          <TabsList className="grid w-full grid-cols-3">
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
