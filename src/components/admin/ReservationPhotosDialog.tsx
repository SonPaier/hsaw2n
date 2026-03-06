import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { PhotoUploader } from '@/components/ui/photo-uploader';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';

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

  const handlePhotosChange = async (newPhotos: string[]) => {
    setPhotos(newPhotos);

    try {
      const { error } = await supabase
        .from('reservations')
        .update({ photo_urls: newPhotos.length > 0 ? newPhotos : null })
        .eq('id', reservationId);

      if (error) throw error;
      onPhotosUpdated(newPhotos);
    } catch (error) {
      console.error('Error updating reservation photos:', error);
      toast.error('Błąd podczas aktualizacji zdjęć');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Zdjęcia rezerwacji</DialogTitle>
          <DialogDescription>
            Możesz dodać maksymalnie {maxPhotos} zdjęć do tej rezerwacji ({photos.length}/{maxPhotos})
          </DialogDescription>
        </DialogHeader>

        <PhotoUploader
          photos={photos}
          onPhotosChange={handlePhotosChange}
          maxPhotos={maxPhotos}
          bucketName="reservation-photos"
          filePrefix={`reservation-${reservationId}`}
        />
      </DialogContent>
    </Dialog>
  );
};

export default ReservationPhotosDialog;
