import { useState } from 'react';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '@/components/ui/drawer';
import { Button } from '@/components/ui/button';
import { X } from 'lucide-react';
import type { DamagePoint } from './VehicleDiagram';
import { PhotoFullscreenDialog } from './PhotoFullscreenDialog';

const DAMAGE_TYPE_LABELS: Record<string, string> = {
  scratch: 'Rysa',
  dent: 'Wgniecenie',
  damage: 'Uszkodzenie',
  chip: 'Odprysk',
  custom: 'Inne',
};

interface DamageViewDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  point: DamagePoint | null;
}

export const DamageViewDrawer = ({
  open,
  onOpenChange,
  point,
}: DamageViewDrawerProps) => {
  const [fullscreenPhoto, setFullscreenPhoto] = useState<string | null>(null);

  if (!point) return null;

  // Get all photos (support both old single photo and new multiple photos)
  const photos: string[] = [];
  if (point.photo_urls && point.photo_urls.length > 0) {
    photos.push(...point.photo_urls.slice(0, 5)); // Max 5 photos
  } else if (point.photo_url) {
    photos.push(point.photo_url);
  }

  // Description: custom_note or damage type label
  const description = point.custom_note || (point.damage_type ? DAMAGE_TYPE_LABELS[point.damage_type] : 'Uszkodzenie');

  return (
    <>
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent className="min-h-[75vh] max-h-[90vh] mx-auto" style={{ maxWidth: '768px' }}>
          <DrawerHeader className="flex items-center justify-between pb-2">
            <DrawerTitle>Szczegóły uszkodzenia</DrawerTitle>
            <Button variant="ghost" size="icon" onClick={() => onOpenChange(false)}>
              <X className="h-4 w-4" />
            </Button>
          </DrawerHeader>

          <div className="px-4 space-y-4 overflow-y-auto" style={{ paddingBottom: '32px' }}>
            {/* Description */}
            <div className="space-y-1">
              <p className="text-base">{description}</p>
              {point.custom_note && point.damage_type && (
                <p className="text-sm text-muted-foreground">
                  Typ: {DAMAGE_TYPE_LABELS[point.damage_type] || point.damage_type}
                </p>
              )}
            </div>

            {/* Photos - stacked vertically on mobile */}
            {photos.length > 0 && (
              <div className="flex flex-col gap-3">
                {photos.map((url, index) => (
                  <div 
                    key={index}
                    className="w-full aspect-video relative cursor-pointer"
                    onClick={() => setFullscreenPhoto(url)}
                  >
                    <img
                      src={url}
                      alt={`Zdjęcie uszkodzenia ${index + 1}`}
                      className="w-full h-full object-cover rounded-lg border"
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
        </DrawerContent>
      </Drawer>

      {/* Fullscreen photo dialog */}
      <PhotoFullscreenDialog
        open={!!fullscreenPhoto}
        onOpenChange={(open) => !open && setFullscreenPhoto(null)}
        photoUrl={fullscreenPhoto}
      />
    </>
  );
};
