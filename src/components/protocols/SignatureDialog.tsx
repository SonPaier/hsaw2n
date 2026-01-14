import { useRef, useEffect, useState } from 'react';
import SignatureCanvas from 'react-signature-canvas';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { X, Eraser, Check } from 'lucide-react';

interface SignatureDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (signatureDataUrl: string) => void;
  initialSignature?: string | null;
}

export const SignatureDialog = ({
  open,
  onOpenChange,
  onSave,
  initialSignature,
}: SignatureDialogProps) => {
  const sigCanvas = useRef<SignatureCanvas | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [canvasSize, setCanvasSize] = useState({ width: 400, height: 200 });

  // Resize canvas to fit container
  useEffect(() => {
    if (open && containerRef.current) {
      const updateSize = () => {
        if (containerRef.current) {
          const rect = containerRef.current.getBoundingClientRect();
          setCanvasSize({
            width: rect.width - 32, // padding
            height: Math.min(rect.height - 120, 300), // leave space for buttons
          });
        }
      };

      // Small delay to ensure dialog is rendered
      setTimeout(updateSize, 100);
      window.addEventListener('resize', updateSize);
      return () => window.removeEventListener('resize', updateSize);
    }
  }, [open]);

  // Load initial signature if exists
  useEffect(() => {
    if (open && initialSignature && sigCanvas.current) {
      setTimeout(() => {
        if (sigCanvas.current) {
          sigCanvas.current.fromDataURL(initialSignature);
        }
      }, 150);
    }
  }, [open, initialSignature, canvasSize]);

  const handleClear = () => {
    sigCanvas.current?.clear();
  };

  const handleSave = () => {
    if (sigCanvas.current) {
      if (sigCanvas.current.isEmpty()) {
        onOpenChange(false);
        return;
      }
      const dataUrl = sigCanvas.current.toDataURL('image/png');
      onSave(dataUrl);
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent 
        className="max-w-full w-full h-full max-h-full m-0 p-0 rounded-none flex flex-col"
        style={{ width: '100vw', height: '100vh' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b bg-background">
          <h2 className="text-lg font-semibold">Podpis klienta</h2>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onOpenChange(false)}
          >
            <X className="h-5 w-5" />
          </Button>
        </div>

        {/* Canvas container */}
        <div 
          ref={containerRef}
          className="flex-1 flex items-center justify-center p-4 bg-muted/30"
        >
          <div className="bg-white rounded-lg border-2 border-dashed border-muted-foreground/30 p-4">
            <SignatureCanvas
              ref={sigCanvas}
              canvasProps={{
                width: canvasSize.width,
                height: canvasSize.height,
                className: 'signature-canvas rounded',
                style: { 
                  touchAction: 'none',
                  backgroundColor: 'white',
                },
              }}
              penColor="black"
              minWidth={1}
              maxWidth={3}
            />
            <p className="text-center text-sm text-muted-foreground mt-2">
              Podpisz palcem lub myszką
            </p>
          </div>
        </div>

        {/* Footer with buttons */}
        <div className="flex items-center justify-between p-4 border-t bg-background gap-4">
          <Button
            variant="outline"
            onClick={handleClear}
            className="flex-1"
          >
            <Eraser className="h-4 w-4 mr-2" />
            Wyczyść
          </Button>
          <Button
            onClick={handleSave}
            className="flex-1"
          >
            <Check className="h-4 w-4 mr-2" />
            Zapisz
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
