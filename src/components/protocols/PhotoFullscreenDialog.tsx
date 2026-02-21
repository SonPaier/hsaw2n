import { useState, useCallback, useEffect } from 'react';
import { X, Pencil, ChevronLeft, ChevronRight } from 'lucide-react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { PhotoAnnotationDialog } from './PhotoAnnotationDialog';

interface PhotoFullscreenDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  photoUrl: string | null;
  onAnnotate?: (newUrl: string) => void;
  /** Optional array of all photos for carousel navigation */
  allPhotos?: string[];
  /** Initial index when using allPhotos */
  initialIndex?: number;
}

export const PhotoFullscreenDialog = ({
  open,
  onOpenChange,
  photoUrl,
  onAnnotate,
  allPhotos,
  initialIndex = 0,
}: PhotoFullscreenDialogProps) => {
  const [annotationOpen, setAnnotationOpen] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(initialIndex);

  const photos = allPhotos && allPhotos.length > 0 ? allPhotos : photoUrl ? [photoUrl] : [];
  const hasMultiple = photos.length > 1;

  // Sync index when dialog opens or initialIndex changes
  useEffect(() => {
    if (open) {
      setCurrentIndex(initialIndex);
    }
  }, [open, initialIndex]);

  const currentPhoto = photos[currentIndex] || null;

  const goNext = useCallback((e?: React.MouseEvent) => {
    e?.stopPropagation();
    setCurrentIndex(prev => (prev + 1) % photos.length);
  }, [photos.length]);

  const goPrev = useCallback((e?: React.MouseEvent) => {
    e?.stopPropagation();
    setCurrentIndex(prev => (prev - 1 + photos.length) % photos.length);
  }, [photos.length]);

  // Keyboard navigation
  useEffect(() => {
    if (!open || annotationOpen || !hasMultiple) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') goNext();
      if (e.key === 'ArrowLeft') goPrev();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, annotationOpen, hasMultiple, goNext, goPrev]);

  if (!currentPhoto) return null;

  const handleAnnotateSave = (newUrl: string) => {
    setAnnotationOpen(false);
    onAnnotate?.(newUrl);
    onOpenChange(false);
  };

  return (
    <>
      <DialogPrimitive.Root open={open} onOpenChange={(v) => {
        if (!v && annotationOpen) return;
        onOpenChange(v);
      }}>
        <DialogPrimitive.Portal>
          <DialogPrimitive.Overlay className="fixed inset-0 z-[9998] bg-black/95" onClick={() => {
            if (!annotationOpen) onOpenChange(false);
          }} />
          <DialogPrimitive.Content
            className="fixed inset-0 z-[9999] flex items-center justify-center p-4 outline-none"
            onClick={() => {
              if (!annotationOpen) onOpenChange(false);
            }}
          >
            {/* Top buttons */}
            {!annotationOpen && (
              <div className="fixed top-4 right-4 z-[10000] flex gap-2">
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
            )}

            {/* Left arrow */}
            {hasMultiple && !annotationOpen && (
              <button
                type="button"
                onClick={goPrev}
                className="fixed left-3 top-1/2 -translate-y-1/2 z-[10000] flex items-center justify-center h-12 w-12 rounded-full bg-white/80 text-black shadow-xl hover:bg-white active:bg-gray-200 transition-colors"
                aria-label="Poprzednie zdjęcie"
              >
                <ChevronLeft className="h-7 w-7" />
              </button>
            )}

            {/* Right arrow */}
            {hasMultiple && !annotationOpen && (
              <button
                type="button"
                onClick={goNext}
                className="fixed right-3 top-1/2 -translate-y-1/2 z-[10000] flex items-center justify-center h-12 w-12 rounded-full bg-white/80 text-black shadow-xl hover:bg-white active:bg-gray-200 transition-colors"
                aria-label="Następne zdjęcie"
              >
                <ChevronRight className="h-7 w-7" />
              </button>
            )}

            {/* Counter */}
            {hasMultiple && !annotationOpen && (
              <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[10000] bg-black/60 text-white px-4 py-1.5 rounded-full text-sm font-medium">
                {currentIndex + 1} / {photos.length}
              </div>
            )}

            {/* Fullscreen image */}
            <img
              src={currentPhoto}
              alt="Zdjęcie uszkodzenia"
              className="max-w-full max-h-full object-contain"
              onClick={(e) => e.stopPropagation()}
            />
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>

      {onAnnotate && (
        <PhotoAnnotationDialog
          open={annotationOpen}
          onOpenChange={setAnnotationOpen}
          photoUrl={currentPhoto}
          onSave={handleAnnotateSave}
        />
      )}
    </>
  );
};
