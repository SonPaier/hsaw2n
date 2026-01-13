import { useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { ArrowLeft, Package } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { OfferProductSelectionDrawer } from './OfferProductSelectionDrawer';

interface OfferServiceEditViewProps {
  instanceId: string;
  scopeId?: string; // undefined = create mode
  onBack: () => void;
}

export function OfferServiceEditView({ instanceId, scopeId, onBack }: OfferServiceEditViewProps) {
  const { t } = useTranslation();
  const isEditMode = !!scopeId;
  
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([]);
  const [isProductDrawerOpen, setIsProductDrawerOpen] = useState(false);

  const handleProductConfirm = (productIds: string[]) => {
    setSelectedProductIds(productIds);
  };

  return (
    <>
      <Helmet>
        <title>{isEditMode ? 'Edytuj usługę' : 'Nowa usługa'} - {t('common.adminPanel')}</title>
      </Helmet>
      <div className="max-w-4xl mx-auto">
        <div className="mb-6">
          <Button variant="ghost" onClick={onBack} className="gap-2">
            <ArrowLeft className="w-4 h-4" />
            Wróć
          </Button>
        </div>

        <h1 className="text-2xl font-bold mb-6">
          {isEditMode ? 'Edytuj usługę' : 'Nowa usługa'}
        </h1>

        <div className="space-y-6">
          {/* Nazwa usługi */}
          <div className="space-y-2">
            <Label htmlFor="name">Nazwa usługi</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="PPF Full Front"
              className="bg-white"
            />
          </div>

          {/* Opis */}
          <div className="space-y-2">
            <Label htmlFor="description">Opis</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Opis usługi..."
              rows={12}
              className="bg-white resize-none"
            />
          </div>

          {/* Wybierz produkty */}
          <div className="space-y-3">
            <Label>Wybierz produkty</Label>
            <Button 
              variant="outline" 
              onClick={() => setIsProductDrawerOpen(true)}
              className="gap-2"
            >
              <Package className="w-4 h-4" />
              Wybierz produkty
              {selectedProductIds.length > 0 && (
                <Badge variant="secondary" className="ml-2">
                  {selectedProductIds.length}
                </Badge>
              )}
            </Button>
            
            {selectedProductIds.length > 0 && (
              <p className="text-sm text-muted-foreground">
                Wybrano {selectedProductIds.length} produktów
              </p>
            )}
          </div>

          {isEditMode && (
            <p className="text-sm text-muted-foreground">ID: {scopeId}</p>
          )}
        </div>
      </div>

      <OfferProductSelectionDrawer
        open={isProductDrawerOpen}
        onClose={() => setIsProductDrawerOpen(false)}
        instanceId={instanceId}
        selectedProductIds={selectedProductIds}
        onConfirm={handleProductConfirm}
      />
    </>
  );
}
