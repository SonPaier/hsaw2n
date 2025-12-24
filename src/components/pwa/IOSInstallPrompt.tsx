import { useState, useEffect } from 'react';
import { X, Share, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';

const IOSInstallPrompt = () => {
  const [showPrompt, setShowPrompt] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    // Check if it's iOS
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    
    // Check if already installed (standalone mode)
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || 
                         (window.navigator as any).standalone === true;
    
    // Check if user has dismissed the prompt before
    const hasBeenDismissed = localStorage.getItem('ios-install-prompt-dismissed');
    
    if (isIOS && !isStandalone && !hasBeenDismissed) {
      // Show prompt after a short delay
      const timer = setTimeout(() => {
        setShowPrompt(true);
      }, 2000);
      
      return () => clearTimeout(timer);
    }
  }, []);

  const handleDismiss = () => {
    setDismissed(true);
    setShowPrompt(false);
    localStorage.setItem('ios-install-prompt-dismissed', 'true');
  };

  const handleRemindLater = () => {
    setShowPrompt(false);
    // Will show again on next visit
  };

  if (!showPrompt || dismissed) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 backdrop-blur-sm animate-in fade-in duration-300">
      <div className="w-full max-w-md mx-4 mb-4 bg-card border border-border rounded-2xl shadow-2xl animate-in slide-in-from-bottom duration-300">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
              <img src="/pwa-192x192.png" alt="ArmCar" className="w-10 h-10 rounded-lg" />
            </div>
            <div>
              <h3 className="font-semibold text-foreground">Zainstaluj ArmCar</h3>
              <p className="text-sm text-muted-foreground">Dodaj do ekranu głównego</p>
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={handleDismiss} className="rounded-full">
            <X className="h-5 w-5" />
          </Button>
        </div>
        
        {/* Instructions */}
        <div className="p-4 space-y-4">
          <p className="text-sm text-muted-foreground text-center">
            Zainstaluj aplikację dla szybszego dostępu do rezerwacji
          </p>
          
          <div className="space-y-3">
            <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-xl">
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-medium">
                1
              </div>
              <div className="flex items-center gap-2 text-sm">
                <span>Kliknij</span>
                <Share className="h-5 w-5 text-primary" />
                <span className="font-medium">Udostępnij</span>
              </div>
            </div>
            
            <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-xl">
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-medium">
                2
              </div>
              <div className="flex items-center gap-2 text-sm">
                <span>Wybierz</span>
                <Plus className="h-5 w-5 text-primary" />
                <span className="font-medium">Dodaj do ekranu początkowego</span>
              </div>
            </div>
          </div>
        </div>
        
        {/* Actions */}
        <div className="flex gap-2 p-4 border-t border-border">
          <Button variant="outline" className="flex-1" onClick={handleRemindLater}>
            Później
          </Button>
          <Button variant="default" className="flex-1" onClick={handleDismiss}>
            Rozumiem
          </Button>
        </div>
      </div>
    </div>
  );
};

export default IOSInstallPrompt;
