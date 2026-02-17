import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Camera, X, Loader2, ImagePlus } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { PhotoFullscreenDialog } from './PhotoFullscreenDialog';

interface ProtocolPhotosUploaderProps {
  photos: string[];
  onPhotosChange: (photos: string[]) => void;
  onPhotoUploaded?: (url: string) => void;
  maxPhotos?: number;
  label?: string;
  disabled?: boolean;
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
}: ProtocolPhotosUploaderProps) => {
  const [uploading, setUploading] = useState(false);
  const [fullscreenPhoto, setFullscreenPhoto] = useState<string | null>(null);
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
        const fileName = `protocol-${Date.now()}-${Math.random().toString(36).substring(7)}.jpg`;

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
    <div className="space-y-3">
      {/* Photo grid */}
      {photos.length > 0 && (
        <div className="grid grid-cols-4 gap-2">
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
                  onClick={(e) => { e.stopPropagation(); handleRemovePhoto(index); }}
                  className="absolute top-1 right-1 bg-destructive text-destructive-foreground rounded-full p-1"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Upload button */}
      {!disabled && photos.length < maxPhotos && (
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
            className={cn("w-full border-dashed", uploading && "opacity-50")}
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
            {uploading ? 'Przesyłanie...' : label}
          </Button>
        </>
      )}
      <PhotoFullscreenDialog
        open={!!fullscreenPhoto}
        onOpenChange={(open) => { if (!open) setFullscreenPhoto(null); }}
        photoUrl={fullscreenPhoto}
      />
    </div>
  );
};
