import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
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
  Download,
  Eye
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useOffer } from '@/hooks/useOffer';
import { CustomerDataStep } from './CustomerDataStep';
import { ScopesStep } from './ScopesStep';
import { OptionsStep } from './OptionsStep';
import { SummaryStep } from './SummaryStep';
import { OfferPreviewDialog } from './OfferPreviewDialog';
import { SendOfferEmailDialog } from '@/components/admin/SendOfferEmailDialog';
import { toast } from 'sonner';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface OfferGeneratorProps {
  instanceId: string;
  offerId?: string;
  duplicateFromId?: string;
  onClose?: () => void;
  onSaved?: (offerId: string) => void;
}

// Steps defined inside component for i18n

export const OfferGenerator = ({
  instanceId,
  offerId,
  duplicateFromId,
  onClose,
  onSaved,
}: OfferGeneratorProps) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(1);
  const [instanceShowUnitPrices, setInstanceShowUnitPrices] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [showExitDialog, setShowExitDialog] = useState(false);
  const [pendingClose, setPendingClose] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [showEmailDialog, setShowEmailDialog] = useState(false);
  const [savedOfferForEmail, setSavedOfferForEmail] = useState<{
    id: string;
    offer_number: string;
    public_token: string;
    customer_data: { name?: string; email?: string };
  } | null>(null);
  const [instanceData, setInstanceData] = useState<{
    name?: string;
    email?: string;
    phone?: string;
    address?: string;
    website?: string;
    contact_person?: string;
    slug?: string;
    offer_email_template?: string;
  } | null>(null);

  const steps = [
    { id: 1, label: t('offers.steps.customerData'), icon: User },
    { id: 2, label: t('offers.steps.scope'), icon: Layers },
    { id: 3, label: t('offers.steps.optionsProducts'), icon: Package },
    { id: 4, label: t('offers.steps.summary'), icon: FileCheck },
  ];
  
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

  // Fetch instance settings for unit prices visibility and email dialog
  useEffect(() => {
    const fetchInstanceSettings = async () => {
      const { data } = await supabase
        .from('instances')
        .select('show_unit_prices_in_offer, name, email, phone, address, website, contact_person, slug, offer_email_template')
        .eq('id', instanceId)
        .single();
      
      if (data) {
        setInstanceShowUnitPrices(data.show_unit_prices_in_offer === true);
        setInstanceData({
          name: data.name,
          email: data.email,
          phone: data.phone,
          address: data.address,
          website: data.website,
          contact_person: data.contact_person,
          slug: data.slug,
          offer_email_template: data.offer_email_template,
        });
      }
    };
    fetchInstanceSettings();
  }, [instanceId]);

  // Load existing offer if editing or duplicating, or load defaults for new offers
  useEffect(() => {
    const loadId = offerId || duplicateFromId;
    if (loadId) {
      loadOffer(loadId).then(() => {
        // If duplicating, reset the ID so it creates a new offer
        if (duplicateFromId) {
          updateOffer({ id: undefined, status: 'draft' });
        }
      });
    } else if (instanceData) {
      // For new offers, load default values from instance settings
      const loadDefaults = async () => {
        const { data } = await supabase
          .from('instances')
          .select('offer_default_payment_terms, offer_default_notes, offer_default_warranty, offer_default_service_info')
          .eq('id', instanceId)
          .single();
        
        if (data) {
          updateOffer({
            paymentTerms: data.offer_default_payment_terms || '',
            notes: data.offer_default_notes || '',
            warranty: data.offer_default_warranty || '',
            serviceInfo: data.offer_default_service_info || '',
          });
        }
      };
      loadDefaults();
    }
  }, [offerId, duplicateFromId, instanceData]);

  // Track changes for new offers
  useEffect(() => {
    if (!offerId && !duplicateFromId) {
      // Check if any data has been entered
      const hasData = Boolean(offer.customerData.name) || 
        Boolean(offer.customerData.email) || 
        Boolean(offer.vehicleData.brandModel) ||
        offer.selectedScopeIds.length > 0 ||
        offer.options.length > 0;
      setHasUnsavedChanges(hasData);
    } else {
      // For existing offers, always track changes
      setHasUnsavedChanges(true);
    }
  }, [offer, offerId, duplicateFromId]);

  // Handle browser beforeunload
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = '';
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasUnsavedChanges]);

  const handleClose = useCallback(() => {
    if (hasUnsavedChanges) {
      setShowExitDialog(true);
      setPendingClose(true);
    } else {
      onClose?.();
    }
  }, [hasUnsavedChanges, onClose]);

  const handleConfirmExit = async (saveBeforeExit: boolean) => {
    if (saveBeforeExit) {
      try {
        const savedId = await saveOffer();
        if (savedId) {
          onSaved?.(savedId);
          toast.success(t('offers.savedAndClosed'));
        }
      } catch (error) {
        // Error already handled in hook
        return;
      }
    }
    setShowExitDialog(false);
    setHasUnsavedChanges(false);
    if (pendingClose) {
      onClose?.();
    }
  };

  const handleCancelExit = () => {
    setShowExitDialog(false);
    setPendingClose(false);
  };

  const handleNext = async () => {
    if (currentStep < 4) {
      // Auto-save when moving to next step (silent - no toast)
      try {
        await saveOffer(true);
      } catch (error) {
        // Continue even if save fails - user can manually save
        console.error('Auto-save failed:', error);
      }
      setCurrentStep(prev => prev + 1);
    }
  };

  const handlePrev = async () => {
    if (currentStep > 1) {
      // Auto-save when moving to previous step (silent - no toast)
      try {
        await saveOffer(true);
      } catch (error) {
        console.error('Auto-save failed:', error);
      }
      setCurrentStep(prev => prev - 1);
    }
  };

  const handleSave = async () => {
    try {
      const savedId = await saveOffer();
      if (savedId) {
        // Don't close the generator, just notify about save
        // onSaved is only called when explicitly closing
      }
    } catch (error) {
      // Error already handled in hook
    }
  };

  const handleSend = async () => {
    try {
      const savedId = await saveOffer();
      if (savedId) {
        // Fetch the saved offer to get public_token
        const { data: savedOffer } = await supabase
          .from('offers')
          .select('id, offer_number, public_token, customer_data')
          .eq('id', savedId)
          .single();
        
        if (savedOffer) {
          const customerData = savedOffer.customer_data as { name?: string; email?: string } | null;
          if (!customerData?.email) {
            toast.error(t('offers.noCustomerEmail'));
            return;
          }
          setSavedOfferForEmail({
            id: savedOffer.id,
            offer_number: savedOffer.offer_number,
            public_token: savedOffer.public_token,
            customer_data: savedOffer.customer_data as { name?: string; email?: string },
          });
          setShowEmailDialog(true);
        }
      }
    } catch (error) {
      // Error already handled in hook
    }
  };

  const handleSendFromPreview = async () => {
    try {
      const savedId = await saveOffer();
      if (savedId) {
        // Update status to sent
        await supabase
          .from('offers')
          .update({ status: 'sent', sent_at: new Date().toISOString() })
          .eq('id', savedId);
        
        toast.success(t('offers.savedReadyToSend'));
        setShowPreview(false);
        setHasUnsavedChanges(false);
        onClose?.();
      }
    } catch (error) {
      // Error already handled in hook
    }
  };

  const handleShowPreview = () => {
    setShowPreview(true);
  };

  const handleDownloadPdf = async () => {
    if (!offer.id) {
      toast.error(t('offers.saveFirst'));
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
        toast.info(t('offers.openFilePrintPdf'));
      }
    } catch (error) {
      console.error('Error generating PDF:', error);
      toast.error(t('offers.pdfError'));
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
      {currentStep === 1 && (
        <Card className="p-6">
          <CustomerDataStep
            customerData={offer.customerData}
            vehicleData={offer.vehicleData}
            onCustomerChange={updateCustomerData}
            onVehicleChange={updateVehicleData}
          />
        </Card>
      )}

      {currentStep === 2 && (
        <Card className="p-6">
          <ScopesStep
            instanceId={instanceId}
            selectedScopeIds={offer.selectedScopeIds}
            onScopesChange={updateSelectedScopes}
          />
        </Card>
      )}
      
      {currentStep === 3 && (
        <OptionsStep
          instanceId={instanceId}
          options={offer.options}
          selectedScopeIds={offer.selectedScopeIds}
          showUnitPrices={instanceShowUnitPrices}
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
          showUnitPrices={instanceShowUnitPrices}
          onUpdateOffer={updateOffer}
          onUpdateOption={updateOption}
          calculateOptionTotal={calculateOptionTotal}
          calculateTotalNet={calculateTotalNet}
          calculateTotalGross={calculateTotalGross}
          onShowPreview={handleShowPreview}
        />
      )}

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
              {t('common.back')}
            </Button>
          ) : onClose ? (
            <Button
              variant="outline"
              onClick={handleClose}
            >
              {t('common.cancel')}
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
            {t('common.save')}
          </Button>

          {/* Preview button - show on step 3 and 4 */}
          {currentStep >= 3 && (
            <Button
              variant="outline"
              onClick={handleShowPreview}
              className="gap-2"
            >
              <Eye className="w-4 h-4" />
              {t('offers.preview')}
            </Button>
          )}

          {currentStep < 4 ? (
            <Button
              onClick={handleNext}
              disabled={!canProceed}
              className="gap-2"
            >
              {t('common.next')}
              <ChevronRight className="w-4 h-4" />
            </Button>
          ) : (
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
              {t('offers.sendOffer')}
            </Button>
          )}
        </div>
      </div>

      {/* Exit Confirmation Dialog */}
      <AlertDialog open={showExitDialog} onOpenChange={setShowExitDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('offers.unsavedChangesTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('offers.unsavedChangesDescription')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleCancelExit}>
              {t('common.cancel')}
            </AlertDialogCancel>
            <AlertDialogAction onClick={() => handleConfirmExit(false)}>
              {t('offers.exitWithoutSaving')}
            </AlertDialogAction>
            <AlertDialogAction onClick={() => handleConfirmExit(true)}>
              {t('offers.saveAndExit')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Preview Dialog */}
      <OfferPreviewDialog
        open={showPreview}
        onClose={() => setShowPreview(false)}
        onSendAndClose={handleSendFromPreview}
        offer={offer}
        instanceId={instanceId}
        calculateTotalNet={calculateTotalNet}
        calculateTotalGross={calculateTotalGross}
      />

      {/* Email Dialog */}
      {savedOfferForEmail && (
        <SendOfferEmailDialog
          open={showEmailDialog}
          onOpenChange={setShowEmailDialog}
          offer={savedOfferForEmail}
          instanceData={instanceData}
          onSent={() => {
            setShowEmailDialog(false);
            setSavedOfferForEmail(null);
            setHasUnsavedChanges(false);
            onSaved?.(savedOfferForEmail.id);
          }}
        />
      )}
    </div>
  );
};
