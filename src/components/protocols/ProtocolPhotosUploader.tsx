import { supabase } from '@/integrations/supabase/client';
import { PhotoUploader } from '@/components/ui/photo-uploader';

interface ProtocolPhotosUploaderProps {
  photos: string[];
  onPhotosChange: (photos: string[]) => void;
  onPhotoUploaded?: (url: string) => void;
  maxPhotos?: number;
  label?: string;
  disabled?: boolean;
  protocolId?: string | null;
  bucketName?: string;
  filePrefix?: string;
}

export const ProtocolPhotosUploader = ({
  photos,
  onPhotosChange,
  onPhotoUploaded,
  maxPhotos = 20,
  disabled = false,
  protocolId,
  bucketName = 'protocol-photos',
  filePrefix = 'protokol-szkoda',
}: ProtocolPhotosUploaderProps) => {
  const handleAnnotate = async (oldUrl: string, newUrl: string) => {
    const newPhotos = photos.map(u => (u === oldUrl ? newUrl : u));
    onPhotosChange(newPhotos);

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
  };

  return (
    <PhotoUploader
      photos={photos}
      onPhotosChange={onPhotosChange}
      onPhotoUploaded={onPhotoUploaded}
      maxPhotos={maxPhotos}
      disabled={disabled}
      bucketName={bucketName}
      filePrefix={filePrefix}
      onAnnotate={handleAnnotate}
    />
  );
};
