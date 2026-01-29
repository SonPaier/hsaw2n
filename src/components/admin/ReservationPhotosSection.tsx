import { useState } from 'react';
import { ChevronDown, ChevronUp, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { PhotoFullscreenDialog } from '@/components/protocols/PhotoFullscreenDialog';

interface ReservationPhotosSectionProps {
  photos: string[];
  reservationId: string;
  onPhotosUpdated: (photos: string[]) => void;
  readOnly?: boolean;
}

const ReservationPhotosSection = ({
  photos,
  reservationId,
  onPhotosUpdated,
  readOnly = false,
}: ReservationPhotosSectionProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [fullscreenPhoto, setFullscreenPhoto] = useState<string | null>(null);

  if (!photos || photos.length === 0) return null;

  const handleRemovePhoto = async (index: number, e: React.MouseEvent) => {
    e.stopPropagation();
    const photoUrl = photos[index];
    const newPhotos = photos.filter((_, i) => i !== index);

    try {
      const { error: updateError } = await supabase
        .from('reservations')
        .update({ photo_urls: newPhotos.length > 0 ? newPhotos : null })
        .eq('id', reservationId);

      if (updateError) throw updateError;

      onPhotosUpdated(newPhotos);

      // Try to delete from storage
      const urlParts = photoUrl.split('/');
      const fileName = urlParts[urlParts.length - 1];
      if (fileName) {
        await supabase.storage.from('reservation-photos').remove([fileName]);
      }

      toast.success('Zdjęcie usunięte');
    } catch (error) {
      console.error('Error removing photo:', error);
      toast.error('Błąd podczas usuwania zdjęcia');
    }
  };

  return (
    <>
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger className="flex items-center gap-2 w-full py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
          {isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          Zobacz zdjęcia ({photos.length})
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="grid grid-cols-4 gap-2 pt-2">
            {photos.map((url, index) => (
              <div 
                key={index} 
                className="relative aspect-square group cursor-pointer"
                onClick={() => setFullscreenPhoto(url)}
              >
                <img
                  src={url}
                  alt={`Zdjęcie ${index + 1}`}
                  className="w-full h-full object-cover rounded-lg"
                />
                {!readOnly && (
                  <button
                    type="button"
                    onClick={(e) => handleRemovePhoto(index, e)}
                    className="absolute top-1 right-1 bg-destructive text-destructive-foreground rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </CollapsibleContent>
      </Collapsible>

      <PhotoFullscreenDialog
        open={!!fullscreenPhoto}
        onOpenChange={(open) => !open && setFullscreenPhoto(null)}
        photoUrl={fullscreenPhoto}
      />
    </>
  );
};

export default ReservationPhotosSection;
