import { useState } from 'react';
import { X, Pencil } from 'lucide-react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { PhotoAnnotationDialog } from './PhotoAnnotationDialog';

interface PhotoFullscreenDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  photoUrl: string | null;
  onAnnotate?: (newUrl: string) => void;
}

export const PhotoFullscreenDialog = ({
  open,
  onOpenChange,
  photoUrl,
  onAnnotate,
}: PhotoFullscreenDialogProps) => {
  const [annotationOpen, setAnnotationOpen] = useState(false);

  if (!photoUrl) return null;

  const handleAnnotateSave = (newUrl: string) => {
    onAnnotate?.(newUrl);
    onOpenChange(false);
  };

  return (
    <>
      <DialogPrimitive.Root open={open && !annotationOpen} onOpenChange={onOpenChange}>
        <DialogPrimitive.Portal>
          <DialogPrimitive.Overlay className="fixed inset-0 z-[9998] bg-black/95" onClick={() => onOpenChange(false)} />
          <DialogPrimitive.Content
            className="fixed inset-0 z-[9999] flex items-center justify-center p-4 outline-none"
            onClick={() => onOpenChange(false)}
          >
            {/* Top buttons */}
            <div className="fixed top-4 right-4 z-[10000] flex gap-2">
              {/* Annotation button - only if onAnnotate is provided */}
              {onAnnotate && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setAnnotationOpen(true);
                  }}
                  className="flex items-center justify-center h-12 w-12 rounded-full bg-white text-black shadow-2xl border-2 border-gray-300 hover:bg-gray-100 active:bg-gray-200"
                  aria-label="Rysik"
                >
                  <Pencil className="h-6 w-6" />
                </button>
              )}
              {/* Close button */}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onOpenChange(false);
                }}
                className="flex items-center justify-center h-12 w-12 rounded-full bg-white text-black shadow-2xl border-2 border-gray-300 hover:bg-gray-100 active:bg-gray-200"
                aria-label="Zamknij"
              >
                <X className="h-7 w-7" />
              </button>
            </div>

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

      {/* Annotation dialog */}
      {onAnnotate && (
        <PhotoAnnotationDialog
          open={annotationOpen}
          onOpenChange={setAnnotationOpen}
          photoUrl={photoUrl}
          onSave={handleAnnotateSave}
        />
      )}
    </>
  );
};
