import { useRef, useEffect, useState } from 'react';
import SignatureCanvas from 'react-signature-canvas';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { X } from 'lucide-react';

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
  const [canvasSize, setCanvasSize] = useState({ width: 400, height: 300 });

  // Resize canvas to fit container
  useEffect(() => {
    if (open && containerRef.current) {
      const updateSize = () => {
        if (containerRef.current) {
          const rect = containerRef.current.getBoundingClientRect();
          setCanvasSize({
            width: rect.width,
            height: rect.height,
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
        className="max-w-full w-full h-full max-h-full m-0 p-0 rounded-none flex flex-col [&>button]:hidden"
        style={{ width: '100vw', height: '100dvh' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b bg-white shrink-0">
          <h2 className="text-lg font-semibold">Podpis klienta</h2>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onOpenChange(false)}
            className="h-9 w-9"
          >
            <X className="h-5 w-5" />
          </Button>
        </div>

        {/* Canvas container - takes all available space */}
        <div 
          ref={containerRef}
          className="flex-1 bg-muted/40 overflow-hidden"
        >
          <SignatureCanvas
            ref={sigCanvas}
            canvasProps={{
              width: canvasSize.width,
              height: canvasSize.height,
              className: 'signature-canvas w-full h-full',
              style: { 
                touchAction: 'none',
                backgroundColor: '#f5f5f5',
                display: 'block',
              },
            }}
            penColor="black"
            minWidth={1.5}
            maxWidth={3.5}
          />
        </div>

        {/* Footer with buttons */}
        <div className="flex items-center justify-between px-4 py-3 border-t bg-white shrink-0 gap-3">
          <Button
            variant="outline"
            onClick={handleClear}
            size="sm"
            className="bg-white"
          >
            Wyczyść
          </Button>
          <Button
            onClick={handleSave}
            size="sm"
          >
            Zapisz
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
