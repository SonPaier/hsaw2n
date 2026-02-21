import { useState, useEffect } from 'react';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerFooter } from '@/components/ui/drawer';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Camera, Loader2, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format } from 'date-fns';
import type { VehicleView, DamagePoint } from './VehicleDiagram';

import { VoiceNoteInput } from './VoiceNoteInput';
import { PhotoFullscreenDialog } from './PhotoFullscreenDialog';

interface DamagePointDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  point: {
    view: VehicleView;
    x_percent: number;
    y_percent: number;
  } | DamagePoint | null;
  onSave: (data: {
    damage_type: string;
    custom_note: string;
    photo_url: string | null;
    photo_urls: string[];
  }) => void;
  onDelete?: () => void;
  isEditing?: boolean;
  offerNumber?: string;
  onPhotoUploaded?: (url: string) => void;
}

// Compress image before upload - max 1200px, 75% quality (~100-200KB)
const compressImage = (file: File, maxSize = 1200, quality = 0.75): Promise<Blob> => {
  return new Promise((resolve, reject) => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      reject(new Error('Could not get canvas context'));
      return;
    }
    
    const img = new Image();
    
    img.onload = () => {
      let { width, height } = img;
      
      // Scale to max 1200px on longest edge
      if (width > height && width > maxSize) {
        height = (height / width) * maxSize;
        width = maxSize;
      } else if (height > maxSize) {
        width = (width / height) * maxSize;
        height = maxSize;
      }
      
      canvas.width = width;
      canvas.height = height;
      ctx.drawImage(img, 0, 0, width, height);
      
      canvas.toBlob(
        (blob) => {
          if (blob) {
            resolve(blob);
          } else {
            reject(new Error('Failed to compress image'));
          }
        },
        'image/jpeg',
        quality
      );
      
      URL.revokeObjectURL(img.src);
    };
    
    img.onerror = () => {
      URL.revokeObjectURL(img.src);
      reject(new Error('Failed to load image'));
    };
    
    img.src = URL.createObjectURL(file);
  });
};

export const DamagePointDrawer = ({
  open,
  onOpenChange,
  point,
  onSave,
  onDelete,
  isEditing = false,
  offerNumber,
  onPhotoUploaded,
}: DamagePointDrawerProps) => {
  const existingPoint = point && 'id' in point ? point : null;
  
  const [customNote, setCustomNote] = useState('');
  const [photoUrls, setPhotoUrls] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [fullscreenPhoto, setFullscreenPhoto] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      if (existingPoint) {
        setCustomNote(existingPoint.custom_note || '');
        const urls: string[] = [];
        if (existingPoint.photo_urls && existingPoint.photo_urls.length > 0) {
          urls.push(...existingPoint.photo_urls);
        } else if (existingPoint.photo_url) {
          urls.push(existingPoint.photo_url);
        }
        setPhotoUrls(urls);
      } else {
        setCustomNote('');
        setPhotoUrls([]);
      }
    }
  }, [open, existingPoint?.id]);

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);
    try {
      const uploadedUrls: string[] = [];
      
      for (const file of Array.from(files)) {
        // Compress image before upload
        const compressedBlob = await compressImage(file);
        
        const fileName = `protokol-szkoda-${format(new Date(), 'yyyyMMdd-HHmmss')}.jpg`;

        const { data, error } = await supabase.storage
          .from('protocol-photos')
          .upload(fileName, compressedBlob, {
            contentType: 'image/jpeg'
          });

        if (error) throw error;

        const { data: urlData } = supabase.storage
          .from('protocol-photos')
          .getPublicUrl(data.path);

        uploadedUrls.push(urlData.publicUrl);
        
        // Notify parent about uploaded photo for orphan tracking
        onPhotoUploaded?.(urlData.publicUrl);
      }

      setPhotoUrls(prev => [...prev, ...uploadedUrls]);
      toast.success(`Dodano ${uploadedUrls.length} zdjęć`);
    } catch (error) {
      console.error('Upload error:', error);
      toast.error('Błąd podczas przesyłania zdjęcia');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const handleRemovePhoto = (index: number) => {
    setPhotoUrls(prev => prev.filter((_, i) => i !== index));
  };

  const handleVoiceTranscript = (text: string) => {
    setCustomNote(prev => prev ? `${prev} ${text}` : text);
  };

  const handleSave = () => {
    onSave({
      damage_type: 'damage', // Default type, not used visually
      custom_note: customNote,
      photo_url: photoUrls[0] || null,
      photo_urls: photoUrls,
    });
    // Don't clear state here - let useEffect on `open` handle it on next open
    // Clearing here causes a brief thumbnail flicker before drawer animates closed
  };

  const handleClose = () => {
    setCustomNote('');
    setPhotoUrls([]);
    onOpenChange(false);
  };

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="h-[95vh] max-h-[95vh] mx-auto max-w-[768px]">
        <DrawerHeader className="flex items-center justify-between pb-2">
          <DrawerTitle>
            {isEditing ? 'Edytuj uszkodzenie' : 'Dodaj uszkodzenie'}
          </DrawerTitle>
          <Button variant="ghost" size="icon" onClick={handleClose}>
            <X className="h-4 w-4" />
          </Button>
        </DrawerHeader>

        <div className="px-4 space-y-4 pb-4 overflow-y-auto">
          {/* Photos grid */}
          <div className="space-y-2">
            <Label>Zdjęcia</Label>
            <div className="grid grid-cols-4 gap-2">
              {/* Add photo tile */}
              <label className="aspect-square rounded-lg border-2 border-dashed border-muted-foreground/30 flex flex-col items-center justify-center gap-1 text-muted-foreground hover:border-muted-foreground/50 transition-colors cursor-pointer">
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  multiple
                  className="hidden"
                  onChange={handlePhotoUpload}
                  disabled={uploading}
                />
                {uploading ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <>
                    <Camera className="h-5 w-5" />
                    <span className="text-[10px] leading-tight text-center">Dodaj zdjęcie</span>
                  </>
                )}
              </label>
              {/* Photo thumbnails */}
              {photoUrls.map((url, index) => (
                <div key={index} className="relative aspect-square group cursor-pointer" onClick={() => setFullscreenPhoto(url)}>
                  <img
                    src={url}
                    alt={`Zdjęcie ${index + 1}`}
                    className="w-full h-full object-cover rounded-lg"
                  />
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); handleRemovePhoto(index); }}
                    className="absolute top-1 right-1 bg-destructive text-destructive-foreground rounded-full p-1"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Note with voice input */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Notatka</Label>
              <VoiceNoteInput onTranscript={handleVoiceTranscript} />
            </div>
            <Textarea
              value={customNote}
              onChange={(e) => setCustomNote(e.target.value)}
              placeholder="Opis uszkodzenia..."
              rows={4}
              className="resize-none"
            />
          </div>
        </div>

        <DrawerFooter className="flex-row gap-2 pt-2">
          <Button variant="outline" onClick={handleClose} className="flex-1 bg-white">
            Anuluj
          </Button>
          {isEditing && onDelete && (
            <Button variant="outline" onClick={onDelete} className="flex-1 bg-white text-destructive hover:text-destructive hover:bg-destructive/10">
              Usuń
            </Button>
          )}
          <Button onClick={handleSave} className="flex-1">
            {isEditing ? 'Zapisz' : 'Dodaj'}
          </Button>
        </DrawerFooter>
      </DrawerContent>

      <PhotoFullscreenDialog
        open={!!fullscreenPhoto}
        onOpenChange={(open) => !open && setFullscreenPhoto(null)}
        photoUrl={fullscreenPhoto}
        onAnnotate={(newUrl) => {
          const oldUrl = fullscreenPhoto;
          if (!oldUrl) return;
          setPhotoUrls(prev => prev.map(u => u === oldUrl ? newUrl : u));
          setFullscreenPhoto(newUrl);
        }}
      />
    </Drawer>
  );
};
