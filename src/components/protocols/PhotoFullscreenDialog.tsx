import { X } from 'lucide-react';
import * as DialogPrimitive from '@radix-ui/react-dialog';

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
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-[9998] bg-black/95" onClick={() => onOpenChange(false)} />
        <DialogPrimitive.Content
          className="fixed inset-0 z-[9999] flex items-center justify-center p-4 outline-none"
          onClick={() => onOpenChange(false)}
        >
          {/* Close button - fixed position, always visible, high z-index */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onOpenChange(false);
            }}
            className="fixed top-4 right-4 z-[10000] flex items-center justify-center h-12 w-12 rounded-full bg-white text-black shadow-2xl border-2 border-gray-300 hover:bg-gray-100 active:bg-gray-200"
            aria-label="Zamknij"
          >
            <X className="h-7 w-7" />
          </button>

          {/* Fullscreen image */}
          <img
            src={photoUrl}
            alt="Zdjęcie uszkodzenia"
            className="max-w-full max-h-full object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
};
