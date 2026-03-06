import { useState, useRef } from 'react';
import { Camera, X, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { compressImage, shouldSkipCompression, getFileExtension, getContentType } from '@/lib/imageUtils';
import { PhotoFullscreenDialog } from '@/components/protocols/PhotoFullscreenDialog';
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

interface UploadProgress {
  current: number;
  total: number;
}

export interface PhotoUploaderProps {
  photos: string[];
  onPhotosChange: (photos: string[]) => void;
  onPhotoUploaded?: (url: string) => void;
  maxPhotos?: number;
  disabled?: boolean;
  bucketName?: string;
  filePrefix?: string;
  /** Called when user annotates a photo in fullscreen. Return the new URL. */
  onAnnotate?: (oldUrl: string, newUrl: string) => void;
}

export const PhotoUploader = ({
  photos,
  onPhotosChange,
  onPhotoUploaded,
  maxPhotos = 50,
  disabled = false,
  bucketName = 'protocol-photos',
  filePrefix = 'protokol-szkoda',
  onAnnotate,
}: PhotoUploaderProps) => {
  const [uploadProgress, setUploadProgress] = useState<UploadProgress | null>(null);
  const [fullscreenPhoto, setFullscreenPhoto] = useState<string | null>(null);
  const [deleteConfirmIndex, setDeleteConfirmIndex] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cancelRef = useRef(false);

  const uploading = uploadProgress !== null;
  const percent = uploadProgress
    ? Math.round((uploadProgress.current / uploadProgress.total) * 100)
    : 0;

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const remainingSlots = maxPhotos - photos.length;
    if (remainingSlots <= 0) {
      toast.error(`Maksymalna liczba zdjęć: ${maxPhotos}`);
      return;
    }

    const filesToUpload = Array.from(files).slice(0, remainingSlots);
    cancelRef.current = false;
    setUploadProgress({ current: 0, total: filesToUpload.length });

    try {
      const uploadedUrls: string[] = [];

      for (const file of filesToUpload) {
        if (cancelRef.current) break;

        const skipCompress = shouldSkipCompression(file);
        const blob = skipCompress ? file : await compressImage(file, 1200, 0.8);
        const ext = getFileExtension(file);
        const contentType = getContentType(file);
        const fileName = `${filePrefix}-${format(new Date(), 'yyyyMMdd-HHmmss')}-${Math.random().toString(36).substring(2, 7)}${ext}`;

        if (cancelRef.current) break;

        const { error: uploadError } = await supabase.storage
          .from(bucketName)
          .upload(fileName, blob, { contentType, cacheControl: '3600' });

        if (uploadError) throw uploadError;

        const { data: urlData } = supabase.storage
          .from(bucketName)
          .getPublicUrl(fileName);

        uploadedUrls.push(urlData.publicUrl);
        onPhotoUploaded?.(urlData.publicUrl);

        setUploadProgress(prev =>
          prev ? { ...prev, current: prev.current + 1 } : null
        );
      }

      if (uploadedUrls.length > 0) {
        const newPhotos = [...photos, ...uploadedUrls];
        onPhotosChange(newPhotos);
      }

      if (cancelRef.current && uploadedUrls.length > 0) {
        toast.info(`Przesłano ${uploadedUrls.length} z ${filesToUpload.length} zdjęć`);
      } else if (uploadedUrls.length > 0) {
        toast.success(`Dodano ${uploadedUrls.length} zdjęć`);
      }
    } catch (error) {
      console.error('Error uploading photos:', error);
      toast.error('Błąd podczas przesyłania zdjęć');
    } finally {
      setUploadProgress(null);
      cancelRef.current = false;
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleCancelUpload = (e: React.MouseEvent) => {
    e.stopPropagation();
    cancelRef.current = true;
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
        await supabase.storage.from(bucketName).remove([fileName]);
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
        onChange={handleFileSelect}
        className="hidden"
      />
      <div className="grid grid-cols-4 gap-2">
        {/* Add photo / progress tile */}
        {!disabled && photos.length < maxPhotos && (
          <button
            type="button"
            disabled={uploading}
            onClick={() => !uploading && fileInputRef.current?.click()}
            className={cn(
              'aspect-square rounded-lg border-2 border-dashed border-muted-foreground/30 flex flex-col items-center justify-center gap-2 bg-background transition-colors relative overflow-hidden',
              !uploading && 'hover:border-muted-foreground/50 cursor-pointer',
              uploading && 'cursor-default'
            )}
          >
            {uploading ? (
              <>
                {/* Progress background fill */}
                <div
                  className="absolute inset-0 bg-primary/10 transition-all duration-300"
                  style={{ height: `${percent}%`, bottom: 0, top: 'auto' }}
                />
                <span className="relative text-[22px] font-bold text-foreground">
                  {percent}%
                </span>
                <button
                  type="button"
                  onClick={handleCancelUpload}
                  className="relative bg-destructive text-destructive-foreground rounded-full p-1 hover:bg-destructive/90 transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              </>
            ) : (
              <>
                <Camera className="h-14 w-14 text-muted-foreground" />
                <span className="text-xs font-medium leading-tight text-center text-muted-foreground">
                  Dodaj zdjęcie
                </span>
              </>
            )}
          </button>
        )}
        {/* Photo thumbnails */}
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
            {!disabled && (
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
            )}
          </div>
        ))}
      </div>

      <PhotoFullscreenDialog
        open={!!fullscreenPhoto}
        onOpenChange={(open) => {
          if (!open) setFullscreenPhoto(null);
        }}
        photoUrl={fullscreenPhoto}
        allPhotos={photos}
        initialIndex={fullscreenPhoto ? photos.indexOf(fullscreenPhoto) : 0}
        onAnnotate={
          onAnnotate
            ? async (newUrl) => {
                const oldUrl = fullscreenPhoto;
                if (!oldUrl) return;
                onAnnotate(oldUrl, newUrl);
                setFullscreenPhoto(newUrl);
              }
            : undefined
        }
      />

      <AlertDialog
        open={deleteConfirmIndex !== null}
        onOpenChange={(open) => !open && setDeleteConfirmIndex(null)}
      >
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
              onClick={() => {
                if (deleteConfirmIndex !== null) {
                  handleRemovePhoto(deleteConfirmIndex);
                  setDeleteConfirmIndex(null);
                }
              }}
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
