import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Camera, X, Loader2, ImagePlus } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { PhotoFullscreenDialog } from './PhotoFullscreenDialog';
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

interface ProtocolPhotosUploaderProps {
  photos: string[];
  onPhotosChange: (photos: string[]) => void;
  onPhotoUploaded?: (url: string) => void;
  maxPhotos?: number;
  label?: string;
  disabled?: boolean;
  protocolId?: string | null;
}

const compressImage = async (file: File, maxWidth = 1200, quality = 0.8): Promise<Blob> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      let width = img.width;
      let height = img.height;

      if (width > maxWidth) {
        height = (height * maxWidth) / width;
        width = maxWidth;
      }

      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Could not get canvas context'));
        return;
      }

      ctx.drawImage(img, 0, 0, width, height);
      canvas.toBlob(
        (blob) => {
          if (blob) {
            resolve(blob);
          } else {
            reject(new Error('Could not compress image'));
          }
        },
        'image/jpeg',
        quality
      );
    };
    img.onerror = () => reject(new Error('Could not load image'));
    img.src = URL.createObjectURL(file);
  });
};

export const ProtocolPhotosUploader = ({
  photos,
  onPhotosChange,
  onPhotoUploaded,
  maxPhotos = 20,
  label = 'Zrób zdjęcie lub wybierz z galerii',
  disabled = false,
  protocolId,
}: ProtocolPhotosUploaderProps) => {
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
        const compressed = await compressImage(file);
        const fileName = `protokol-szkoda-${format(new Date(), 'yyyyMMdd-HHmmss')}.jpg`;

        const { error: uploadError } = await supabase.storage
          .from('protocol-photos')
          .upload(fileName, compressed, {
            contentType: 'image/jpeg',
            cacheControl: '3600',
          });

        if (uploadError) throw uploadError;

        const { data: urlData } = supabase.storage
          .from('protocol-photos')
          .getPublicUrl(fileName);

        uploadedUrls.push(urlData.publicUrl);
        onPhotoUploaded?.(urlData.publicUrl);
      }

      onPhotosChange([...photos, ...uploadedUrls]);
      toast.success(`Dodano ${uploadedUrls.length} zdjęć`);
    } catch (error) {
      console.error('Error uploading photos:', error);
      toast.error('Błąd podczas przesyłania zdjęć');
    } finally {
      setUploading(false);
      // Reset input so the same file can be selected again
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleRemovePhoto = async (index: number) => {
    const photoUrl = photos[index];
    const newPhotos = photos.filter((_, i) => i !== index);
    onPhotosChange(newPhotos);

    // Try to delete from storage
    try {
      const urlParts = photoUrl.split('/');
      const fileName = urlParts[urlParts.length - 1];
      if (fileName) {
        await supabase.storage.from('protocol-photos').remove([fileName]);
      }
    } catch (error) {
      console.error('Error deleting photo from storage:', error);
    }
  };

  return (
    <div>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        capture="environment"
        onChange={handleFileSelect}
        className="hidden"
      />
      <div className="grid grid-cols-4 gap-2">
        {/* Add photo tile */}
        {!disabled && photos.length < maxPhotos && (
          <button
            type="button"
            disabled={uploading}
            onClick={() => fileInputRef.current?.click()}
            className={cn(
              "aspect-square rounded-lg border-2 border-dashed border-muted-foreground/30 flex flex-col items-center justify-center gap-2 bg-background hover:border-muted-foreground/50 transition-colors",
              uploading && "opacity-50"
            )}
          >
            {uploading ? (
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            ) : (
              <>
                <Camera className="h-14 w-14 text-muted-foreground" />
                <span className="text-xs font-medium leading-tight text-center text-muted-foreground">Dodaj zdjęcie</span>
              </>
            )}
          </button>
        )}
        {/* Photo thumbnails */}
        {photos.map((url, index) => (
          <div key={index} className="relative aspect-square group cursor-pointer" onClick={() => setFullscreenPhoto(url)}>
            <img
              src={url}
              alt={`Zdjęcie ${index + 1}`}
              className="w-full h-full object-cover rounded-lg"
            />
            {!disabled && (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); setDeleteConfirmIndex(index); }}
                className="absolute top-1 right-1 bg-destructive text-destructive-foreground rounded-full p-1"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </div>
        ))}
      </div>
      <PhotoFullscreenDialog
        open={!!fullscreenPhoto}
        onOpenChange={(open) => { if (!open) setFullscreenPhoto(null); }}
        photoUrl={fullscreenPhoto}
        allPhotos={photos}
        initialIndex={fullscreenPhoto ? photos.indexOf(fullscreenPhoto) : 0}
        onAnnotate={async (newUrl) => {
          const oldUrl = fullscreenPhoto;
          if (!oldUrl) return;
          const newPhotos = photos.map(u => u === oldUrl ? newUrl : u);
          onPhotosChange(newPhotos);
          setFullscreenPhoto(newUrl);
          // Auto-persist to database
          if (protocolId) {
            try {
              await supabase
                .from('vehicle_protocols')
                .update({ photo_urls: newPhotos })
                .eq('id', protocolId);
            } catch (err) {
              console.error('Error auto-saving annotation:', err);
            }
          }
        }}
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
              onClick={() => { if (deleteConfirmIndex !== null) { handleRemovePhoto(deleteConfirmIndex); setDeleteConfirmIndex(null); } }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Usuń
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
