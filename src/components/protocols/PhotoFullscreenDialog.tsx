import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { X } from 'lucide-react';

interface PhotoFullscreenDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  photoUrl: string | null;
}

export const PhotoFullscreenDialog = ({
  open,
  onOpenChange,
  photoUrl,
}: PhotoFullscreenDialogProps) => {
  if (!photoUrl) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent 
        className="max-w-full w-full h-full max-h-full p-0 bg-black/95 border-none [&>button]:hidden"
        onClick={() => onOpenChange(false)}
      >
        {/* Close button */}
        <Button
          variant="ghost"
          size="icon"
          className="absolute top-4 right-4 z-50 text-white hover:bg-white/20"
          onClick={(e) => {
            e.stopPropagation();
            onOpenChange(false);
          }}
        >
          <X className="h-6 w-6" />
        </Button>

        {/* Fullscreen image */}
        <div className="w-full h-full flex items-center justify-center p-4">
          <img
            src={photoUrl}
            alt="Zdjęcie uszkodzenia"
            className="max-w-full max-h-full object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
};
