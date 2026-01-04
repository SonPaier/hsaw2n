import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { X, Share, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface IOSInstallPromptProps {
  open?: boolean;
  onClose?: () => void;
  instanceName?: string;
  instanceLogo?: string | null;
}

const IOSInstallPrompt = ({ 
  open: controlledOpen, 
  onClose, 
  instanceName,
  instanceLogo 
}: IOSInstallPromptProps) => {
  const { t } = useTranslation();
  const [internalOpen, setInternalOpen] = useState(false);
  
  // Use controlled state if provided, otherwise internal state
  const isControlled = controlledOpen !== undefined;
  const showPrompt = isControlled ? controlledOpen : internalOpen;

  // Only auto-show for uncontrolled mode (legacy behavior removed - no auto-show anymore)
  // This component is now only shown when explicitly opened via props

  const handleClose = () => {
    if (isControlled && onClose) {
      onClose();
    } else {
      setInternalOpen(false);
      localStorage.setItem('ios-install-prompt-dismissed', 'true');
    }
  };

  const handleLater = () => {
    if (isControlled && onClose) {
      onClose();
    } else {
      setInternalOpen(false);
    }
  };

  const displayName = instanceName || 'aplikację';
  const logoUrl = instanceLogo || '/pwa-192x192.png';

  return (
    <Dialog open={showPrompt} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="max-w-md mx-4 p-0 gap-0 rounded-2xl">
        {/* Header */}
        <DialogHeader className="p-4 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center overflow-hidden">
              <img 
                src={logoUrl} 
                alt={displayName} 
                className="w-10 h-10 rounded-lg object-contain"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = '/pwa-192x192.png';
                }}
              />
            </div>
            <div>
              <DialogTitle className="font-semibold text-foreground">
                {t('pwa.installTitle', { name: displayName })}
              </DialogTitle>
              <p className="text-sm text-muted-foreground">{t('pwa.installSubtitle')}</p>
            </div>
          </div>
        </DialogHeader>
        
        {/* Instructions */}
        <div className="p-4 space-y-4">
          <p className="text-sm text-muted-foreground text-center">
            {t('pwa.installDescription')}
          </p>
          
          <div className="space-y-3">
            <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-xl">
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-medium">
                1
              </div>
              <div className="flex items-center gap-2 text-sm">
                <span>{t('pwa.step1Click')}</span>
                <Share className="h-5 w-5 text-primary" />
                <span className="font-medium">{t('pwa.step1Share')}</span>
              </div>
            </div>
            
            <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-xl">
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-medium">
                2
              </div>
              <div className="flex items-center gap-2 text-sm">
                <span>{t('pwa.step2Select')}</span>
                <Plus className="h-5 w-5 text-primary" />
                <span className="font-medium">{t('pwa.step2AddHome')}</span>
              </div>
            </div>
          </div>
        </div>
        
        {/* Actions */}
        <div className="flex gap-2 p-4 border-t border-border">
          <Button variant="outline" className="flex-1" onClick={handleLater}>
            {t('pwa.later')}
          </Button>
          <Button variant="default" className="flex-1" onClick={handleClose}>
            {t('pwa.understand')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default IOSInstallPrompt;
