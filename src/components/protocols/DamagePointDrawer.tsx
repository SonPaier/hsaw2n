import { useState, useEffect } from 'react';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerFooter } from '@/components/ui/drawer';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { X } from 'lucide-react';
import type { VehicleView, DamagePoint } from './VehicleDiagram';
import { VoiceNoteInput } from './VoiceNoteInput';
import { PhotoUploader } from '@/components/ui/photo-uploader';

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

  const handleVoiceTranscript = (text: string) => {
    setCustomNote(prev => prev ? `${prev} ${text}` : text);
  };

  const handleSave = () => {
    onSave({
      damage_type: 'damage',
      custom_note: customNote,
      photo_url: photoUrls[0] || null,
      photo_urls: photoUrls,
    });
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
          {/* Photos */}
          <div className="space-y-2">
            <Label>Zdjęcia</Label>
            <PhotoUploader
              photos={photoUrls}
              onPhotosChange={setPhotoUrls}
              onPhotoUploaded={onPhotoUploaded}
              bucketName="protocol-photos"
              filePrefix="protokol-szkoda"
              onAnnotate={(oldUrl, newUrl) => {
                setPhotoUrls(prev => prev.map(u => u === oldUrl ? newUrl : u));
              }}
            />
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
    </Drawer>
  );
};
