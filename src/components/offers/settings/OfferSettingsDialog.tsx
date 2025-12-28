import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { OfferScopesSettings } from './OfferScopesSettings';
import { OfferVariantsSettings } from './OfferVariantsSettings';
import { OfferScopeProductsSettings } from './OfferScopeProductsSettings';
import { Layers, Tag, Package, Settings } from 'lucide-react';

interface OfferSettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  instanceId: string;
}

export function OfferSettingsDialog({ open, onOpenChange, instanceId }: OfferSettingsDialogProps) {
  const [activeTab, setActiveTab] = useState('scopes');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Ustawienia ofert
          </DialogTitle>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-4">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="scopes" className="flex items-center gap-2">
              <Layers className="h-4 w-4" />
              Zakresy
            </TabsTrigger>
            <TabsTrigger value="variants" className="flex items-center gap-2">
              <Tag className="h-4 w-4" />
              Warianty
            </TabsTrigger>
            <TabsTrigger value="products" className="flex items-center gap-2">
              <Package className="h-4 w-4" />
              Produkty
            </TabsTrigger>
          </TabsList>

          <TabsContent value="scopes" className="mt-6">
            <OfferScopesSettings instanceId={instanceId} />
          </TabsContent>

          <TabsContent value="variants" className="mt-6">
            <OfferVariantsSettings instanceId={instanceId} />
          </TabsContent>

          <TabsContent value="products" className="mt-6">
            <OfferScopeProductsSettings instanceId={instanceId} />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
