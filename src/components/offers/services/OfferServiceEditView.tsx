import { Helmet } from 'react-helmet-async';
import { ArrowLeft } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';

interface OfferServiceEditViewProps {
  instanceId: string;
  scopeId?: string; // undefined = create mode
  onBack: () => void;
}

export function OfferServiceEditView({ instanceId, scopeId, onBack }: OfferServiceEditViewProps) {
  const { t } = useTranslation();
  const isEditMode = !!scopeId;

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

        <div className="text-center py-12 text-muted-foreground border rounded-lg">
          <p>Formularz edycji usługi będzie tutaj...</p>
          {isEditMode && <p className="text-sm mt-2">ID: {scopeId}</p>}
        </div>
      </div>
    </>
  );
}
