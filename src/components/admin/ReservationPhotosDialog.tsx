import { useState, useRef } from 'react';
import { Camera, X, Loader2, ImagePlus } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { compressImage } from '@/lib/imageUtils';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
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
import { PhotoFullscreenDialog } from '@/components/protocols/PhotoFullscreenDialog';
import { cn } from '@/lib/utils';

interface ReservationPhotosDialogProps {
  open: boolean;
  onClose: () => void;
  reservationId: string;
  currentPhotos: string[];
  onPhotosUpdated: (photos: string[]) => void;
  maxPhotos?: number;
}

const ReservationPhotosDialog = ({
  open,
  onClose,
  reservationId,
  currentPhotos,
  onPhotosUpdated,
  maxPhotos = 8,
}: ReservationPhotosDialogProps) => {
  const [photos, setPhotos] = useState<string[]>(currentPhotos);
  const [uploading, setUploading] = useState(false);
  const [fullscreenPhoto, setFullscreenPhoto] = useState<string | null>(null);
  const [deleteConfirmIndex, setDeleteConfirmIndex] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const remainingSlots = maxPhotos - photos.length;
    if (remainingSlots <= 0) {
      toast.error(`Maksymalna liczba zdjęć: ${maxPhotos}`);
      return;
    }

    const filesToUpload = Array.from(files).slice(0, remainingSlots);
    setUploading(true);

    try {
      const uploadedUrls: string[] = [];

      for (const file of filesToUpload) {
        const compressed = await compressImage(file, 1200, 0.8);
        const fileName = `reservation-${reservationId}-${Date.now()}-${Math.random().toString(36).substring(7)}.jpg`;

        const { error: uploadError } = await supabase.storage
          .from('reservation-photos')
          .upload(fileName, compressed, {
            contentType: 'image/jpeg',
            cacheControl: '3600',
          });

        if (uploadError) throw uploadError;

        const { data: urlData } = supabase.storage
          .from('reservation-photos')
          .getPublicUrl(fileName);

        uploadedUrls.push(urlData.publicUrl);
      }

      const newPhotos = [...photos, ...uploadedUrls];
      setPhotos(newPhotos);

      const { error: updateError } = await supabase
        .from('reservations')
        .update({ photo_urls: newPhotos })
        .eq('id', reservationId);

      if (updateError) throw updateError;

      onPhotosUpdated(newPhotos);
      toast.success(`Dodano ${uploadedUrls.length} zdjęć`);
    } catch (error) {
      console.error('Error uploading photos:', error);
      toast.error('Błąd podczas przesyłania zdjęć');
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleRemovePhoto = async (index: number) => {
    const photoUrl = photos[index];
    const newPhotos = photos.filter((_, i) => i !== index);

    try {
      const { error: updateError } = await supabase
        .from('reservations')
        .update({ photo_urls: newPhotos.length > 0 ? newPhotos : null })
        .eq('id', reservationId);

      if (updateError) throw updateError;

      setPhotos(newPhotos);
      onPhotosUpdated(newPhotos);

      const urlParts = photoUrl.split('/');
      const fileName = urlParts[urlParts.length - 1];
      if (fileName) {
        await supabase.storage.from('reservation-photos').remove([fileName]);
      }

      toast.success('Zdjęcie usunięte');
    } catch (error) {
      console.error('Error removing photo:', error);
      toast.error('Błąd podczas usuwania zdjęcia');
    } finally {
      setDeleteConfirmIndex(null);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onClose}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Zdjęcia rezerwacji</DialogTitle>
            <DialogDescription>
              Możesz dodać maksymalnie {maxPhotos} zdjęć do tej rezerwacji ({photos.length}/{maxPhotos})
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {photos.length > 0 && (
              <div className="grid grid-cols-4 gap-2">
                {photos.map((url, index) => (
                  <div key={index} className="relative aspect-square group cursor-pointer" onClick={() => setFullscreenPhoto(url)}>
                    <img
                      src={url}
                      alt={`Zdjęcie ${index + 1}`}
                      className="w-full h-full object-cover rounded-lg"
                    />
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeleteConfirmIndex(index);
                      }}
                      className="absolute top-1 right-1 bg-destructive text-destructive-foreground rounded-full p-1"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {photos.length < maxPhotos && (
              <>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  capture="environment"
                  onChange={handleFileSelect}
                  className="hidden"
                />
                <Button
                  type="button"
                  variant="outline"
                  className={cn('w-full border-dashed', uploading && 'opacity-50')}
                  disabled={uploading}
                  onClick={() => fileInputRef.current?.click()}
                >
                  {uploading ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : photos.length > 0 ? (
                    <ImagePlus className="h-4 w-4 mr-2" />
                  ) : (
                    <Camera className="h-4 w-4 mr-2" />
                  )}
                  {uploading ? 'Przesyłanie...' : 'Zrób zdjęcie lub wybierz z galerii'}
                </Button>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <PhotoFullscreenDialog
        open={!!fullscreenPhoto}
        onOpenChange={(open) => !open && setFullscreenPhoto(null)}
        photoUrl={fullscreenPhoto}
      />

      <AlertDialog open={deleteConfirmIndex !== null} onOpenChange={(open) => !open && setDeleteConfirmIndex(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Usuń zdjęcie</AlertDialogTitle>
            <AlertDialogDescription>
              Czy na pewno chcesz usunąć to zdjęcie? Tej operacji nie można cofnąć.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Anuluj</AlertDialogCancel>
            <AlertDialogAction 
              onClick={() => deleteConfirmIndex !== null && handleRemovePhoto(deleteConfirmIndex)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Usuń
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default ReservationPhotosDialog;
