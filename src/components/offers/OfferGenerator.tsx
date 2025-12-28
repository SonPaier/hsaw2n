import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { 
  ChevronLeft, 
  ChevronRight, 
  Save, 
  Send, 
  User, 
  Layers,
  Package, 
  FileCheck,
  Loader2,
  Download
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useOffer } from '@/hooks/useOffer';
import { CustomerDataStep } from './CustomerDataStep';
import { ScopesStep } from './ScopesStep';
import { OptionsStep } from './OptionsStep';
import { SummaryStep } from './SummaryStep';
import { toast } from 'sonner';

interface OfferGeneratorProps {
  instanceId: string;
  offerId?: string;
  duplicateFromId?: string;
  onClose?: () => void;
  onSaved?: (offerId: string) => void;
}

const steps = [
  { id: 1, label: 'Dane klienta', icon: User },
  { id: 2, label: 'Zakres', icon: Layers },
  { id: 3, label: 'Opcje i produkty', icon: Package },
  { id: 4, label: 'Podsumowanie', icon: FileCheck },
];

export const OfferGenerator = ({
  instanceId,
  offerId,
  duplicateFromId,
  onClose,
  onSaved,
}: OfferGeneratorProps) => {
  const [currentStep, setCurrentStep] = useState(1);
  
  const {
    offer,
    loading,
    saving,
    updateCustomerData,
    updateVehicleData,
    updateSelectedScopes,
    addOption,
    updateOption,
    removeOption,
    duplicateOption,
    addItemToOption,
    updateItemInOption,
    removeItemFromOption,
    addAddition,
    updateAddition,
    removeAddition,
    updateOffer,
    calculateOptionTotal,
    calculateAdditionsTotal,
    calculateTotalNet,
    calculateTotalGross,
    saveOffer,
    loadOffer,
  } = useOffer(instanceId);

  // Load existing offer if editing or duplicating
  useEffect(() => {
    const loadId = offerId || duplicateFromId;
    if (loadId) {
      loadOffer(loadId).then(() => {
        // If duplicating, reset the ID so it creates a new offer
        if (duplicateFromId) {
          updateOffer({ id: undefined, status: 'draft' });
        }
      });
    }
  }, [offerId, duplicateFromId]);

  const handleNext = () => {
    if (currentStep < 4) {
      setCurrentStep(prev => prev + 1);
    }
  };

  const handlePrev = () => {
    if (currentStep > 1) {
      setCurrentStep(prev => prev - 1);
    }
  };

  const handleSave = async () => {
    try {
      const savedId = await saveOffer();
      if (savedId) {
        onSaved?.(savedId);
      }
    } catch (error) {
      // Error already handled in hook
    }
  };

  const handleSend = async () => {
    try {
      await saveOffer();
      updateOffer({ status: 'sent' });
      toast.success('Oferta została zapisana i gotowa do wysłania');
    } catch (error) {
      // Error already handled in hook
    }
  };

  const handleDownloadPdf = async () => {
    if (!offer.id) {
      toast.error('Najpierw zapisz ofertę');
      return;
    }
    
    try {
      const { data, error } = await supabase.functions.invoke('generate-offer-pdf', {
        body: { offerId: offer.id },
      });
      
      if (error) throw error;
      
      // Open in new window for print-to-PDF
      const printWindow = window.open('', '_blank');
      if (printWindow) {
        printWindow.document.write(data);
        printWindow.document.close();
      } else {
        // Fallback - download as HTML
        const blob = new Blob([data], { type: 'text/html' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `Oferta_${offer.id}.html`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        toast.info('Otwórz plik i użyj Drukuj → Zapisz jako PDF');
      }
    } catch (error) {
      console.error('Error generating PDF:', error);
      toast.error('Błąd podczas generowania PDF');
    }
  };

  const validateStep = (step: number): boolean => {
    switch (step) {
      case 1:
        return !!(offer.customerData.name && offer.customerData.email && offer.vehicleData.brandModel);
      case 2:
        return offer.selectedScopeIds.length > 0;
      case 3:
        return offer.options.length > 0 && 
          offer.options.some(opt => opt.items.length > 0);
      case 4:
        return true;
      default:
        return false;
    }
  };

  const canProceed = validateStep(currentStep);

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Steps Header */}
      <div className="flex items-center justify-center gap-2">
        {steps.map((step, index) => {
          const Icon = step.icon;
          const isActive = currentStep === step.id;
          const isCompleted = currentStep > step.id;
          
          return (
            <div key={step.id} className="flex items-center">
              {index > 0 && (
                <div className={cn(
                  "w-8 md:w-16 h-0.5 mx-2",
                  isCompleted ? "bg-primary" : "bg-border"
                )} />
              )}
              <button
                onClick={() => setCurrentStep(step.id)}
                className={cn(
                  "flex items-center gap-2 px-3 py-2 rounded-lg transition-colors",
                  isActive && "bg-primary text-primary-foreground",
                  isCompleted && !isActive && "bg-primary/10 text-primary",
                  !isActive && !isCompleted && "text-muted-foreground hover:bg-muted"
                )}
              >
                <Icon className="w-4 h-4" />
                <span className="hidden md:inline text-sm font-medium">{step.label}</span>
              </button>
            </div>
          );
        })}
      </div>

      {/* Step Content */}
      <Card className="p-6">
        {currentStep === 1 && (
          <CustomerDataStep
            customerData={offer.customerData}
            vehicleData={offer.vehicleData}
            onCustomerChange={updateCustomerData}
            onVehicleChange={updateVehicleData}
          />
        )}

        {currentStep === 2 && (
          <ScopesStep
            instanceId={instanceId}
            selectedScopeIds={offer.selectedScopeIds}
            onScopesChange={updateSelectedScopes}
          />
        )}
        
        {currentStep === 3 && (
          <OptionsStep
            instanceId={instanceId}
            options={offer.options}
            onAddOption={addOption}
            onUpdateOption={updateOption}
            onRemoveOption={removeOption}
            onDuplicateOption={duplicateOption}
            onAddItem={addItemToOption}
            onUpdateItem={updateItemInOption}
            onRemoveItem={removeItemFromOption}
            calculateOptionTotal={calculateOptionTotal}
          />
        )}
        
        {currentStep === 4 && (
          <SummaryStep
            instanceId={instanceId}
            offer={offer}
            onUpdateOffer={updateOffer}
            onUpdateOption={updateOption}
            calculateOptionTotal={calculateOptionTotal}
            calculateTotalNet={calculateTotalNet}
            calculateTotalGross={calculateTotalGross}
            additions={offer.additions}
            onAddAddition={addAddition}
            onUpdateAddition={updateAddition}
            onRemoveAddition={removeAddition}
            calculateAdditionsTotal={calculateAdditionsTotal}
          />
        )}
      </Card>

      {/* Navigation */}
      <div className="flex items-center justify-between">
        <div>
          {currentStep > 1 ? (
            <Button
              variant="outline"
              onClick={handlePrev}
              className="gap-2"
            >
              <ChevronLeft className="w-4 h-4" />
              Wstecz
            </Button>
          ) : onClose ? (
            <Button
              variant="outline"
              onClick={onClose}
            >
              Anuluj
            </Button>
          ) : null}
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={handleSave}
            disabled={saving}
            className="gap-2"
          >
            {saving ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            Zapisz
          </Button>

          {currentStep < 4 ? (
            <Button
              onClick={handleNext}
              disabled={!canProceed}
              className="gap-2"
            >
              Dalej
              <ChevronRight className="w-4 h-4" />
            </Button>
          ) : (
            <>
              {offer.id && (
                <Button
                  variant="outline"
                  onClick={handleDownloadPdf}
                  className="gap-2"
                >
                  <Download className="w-4 h-4" />
                  Pobierz PDF
                </Button>
              )}
              <Button
                onClick={handleSend}
                disabled={saving || !canProceed}
                className="gap-2"
              >
                {saving ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
                Wyślij ofertę
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
