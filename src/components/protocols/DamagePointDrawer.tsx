import { useState, useEffect } from 'react';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerFooter } from '@/components/ui/drawer';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Camera, Loader2, X, ChevronLeft, ChevronRight } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { VehicleView, DamagePoint } from './VehicleDiagram';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';

const DAMAGE_TYPES = [
  { value: 'scratch', label: 'Rysa', color: 'bg-yellow-500' },
  { value: 'dent', label: 'Wgniecenie', color: 'bg-orange-500' },
  { value: 'damage', label: 'Uszkodzenie', color: 'bg-red-500' },
  { value: 'chip', label: 'Odprysek', color: 'bg-blue-500' },
  { value: 'custom', label: 'Inne', color: 'bg-purple-500' },
];

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
}

export const DamagePointDrawer = ({
  open,
  onOpenChange,
  point,
  onSave,
  onDelete,
  isEditing = false,
  offerNumber,
}: DamagePointDrawerProps) => {
  const existingPoint = point && 'id' in point ? point : null;
  
  const [damageType, setDamageType] = useState('scratch');
  const [customNote, setCustomNote] = useState('');
  const [photoUrls, setPhotoUrls] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);

  // Initialize state when point changes
  useEffect(() => {
    if (existingPoint) {
      setDamageType(existingPoint.damage_type || 'scratch');
      setCustomNote(existingPoint.custom_note || '');
      // Support both old single photo and new multiple photos
      const urls: string[] = [];
      if (existingPoint.photo_urls && existingPoint.photo_urls.length > 0) {
        urls.push(...existingPoint.photo_urls);
      } else if (existingPoint.photo_url) {
        urls.push(existingPoint.photo_url);
      }
      setPhotoUrls(urls);
    } else {
      setDamageType('scratch');
      setCustomNote('');
      setPhotoUrls([]);
    }
  }, [existingPoint, open]);

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);
    try {
      const uploadedUrls: string[] = [];
      
      for (const file of Array.from(files)) {
        const timestamp = Date.now();
        const ext = file.name.split('.').pop();
        const fileName = offerNumber 
          ? `${offerNumber}_${timestamp}_${Math.random().toString(36).slice(2, 8)}.${ext}`
          : `protocol_${timestamp}_${Math.random().toString(36).slice(2, 8)}.${ext}`;

        const { data, error } = await supabase.storage
          .from('protocol-photos')
          .upload(fileName, file);

        if (error) throw error;

        const { data: urlData } = supabase.storage
          .from('protocol-photos')
          .getPublicUrl(data.path);

        uploadedUrls.push(urlData.publicUrl);
      }

      setPhotoUrls(prev => [...prev, ...uploadedUrls]);
      toast.success(`Dodano ${uploadedUrls.length} zdjęć`);
    } catch (error) {
      console.error('Upload error:', error);
      toast.error('Błąd podczas przesyłania zdjęcia');
    } finally {
      setUploading(false);
      // Reset input
      e.target.value = '';
    }
  };

  const handleRemovePhoto = (index: number) => {
    setPhotoUrls(prev => prev.filter((_, i) => i !== index));
  };

  const handleSave = () => {
    onSave({
      damage_type: damageType,
      custom_note: customNote,
      photo_url: photoUrls[0] || null, // Keep backward compatibility
      photo_urls: photoUrls,
    });
    // Reset form
    setDamageType('scratch');
    setCustomNote('');
    setPhotoUrls([]);
  };

  const handleClose = () => {
    setDamageType('scratch');
    setCustomNote('');
    setPhotoUrls([]);
    onOpenChange(false);
  };

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[90vh]">
        <DrawerHeader className="flex items-center justify-between pb-2">
          <DrawerTitle>
            {isEditing ? 'Edytuj uszkodzenie' : 'Dodaj uszkodzenie'}
          </DrawerTitle>
          <Button variant="ghost" size="icon" onClick={handleClose}>
            <X className="h-4 w-4" />
          </Button>
        </DrawerHeader>

        <div className="px-4 space-y-4 pb-4 overflow-y-auto">
          {/* Row 1: Damage type (left) + Note (right) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Damage type selection */}
            <div className="space-y-2">
              <Label>Typ uszkodzenia</Label>
              <RadioGroup value={damageType} onValueChange={setDamageType}>
                <div className="flex flex-col gap-1.5">
                  {DAMAGE_TYPES.map((type) => (
                    <label
                      key={type.value}
                      className={`flex items-center gap-2 p-2 border rounded-lg cursor-pointer transition-all bg-white ${
                        damageType === type.value 
                          ? 'border-primary ring-1 ring-primary' 
                          : 'hover:bg-muted/30'
                      }`}
                    >
                      <RadioGroupItem value={type.value} />
                      <span className={`w-3 h-3 rounded-full ${type.color}`} />
                      <span className="text-sm font-medium">{type.label}</span>
                    </label>
                  ))}
                </div>
              </RadioGroup>
            </div>

            {/* Custom note */}
            <div className="space-y-2">
              <Label>Notatka (opcjonalna)</Label>
              <Input
                value={customNote}
                onChange={(e) => setCustomNote(e.target.value)}
                placeholder="Dodatkowy opis uszkodzenia..."
              />
            </div>
          </div>

          {/* Row 2: Photos */}
          <div className="space-y-2">
            <Label>Zdjęcia</Label>
            
            {/* Photo carousel */}
            {photoUrls.length > 0 && (
              <ScrollArea className="w-full whitespace-nowrap rounded-lg">
                <div className="flex gap-2 pb-2">
                  {photoUrls.map((url, index) => (
                    <div 
                      key={index} 
                      className="relative shrink-0 w-[calc(20%-8px)] min-w-[80px] aspect-square"
                    >
                      <img 
                        src={url} 
                        alt={`Zdjęcie ${index + 1}`} 
                        className="w-full h-full object-cover rounded-lg border"
                      />
                      <Button
                        variant="destructive"
                        size="icon"
                        className="absolute -top-2 -right-2 h-6 w-6"
                        onClick={() => handleRemovePhoto(index)}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                </div>
                <ScrollBar orientation="horizontal" />
              </ScrollArea>
            )}

            {/* Add photo button */}
            <label className="flex flex-col items-center justify-center w-full h-20 border-2 border-dashed rounded-lg cursor-pointer bg-white hover:bg-muted/30 transition-colors">
              <input
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={handlePhotoUpload}
                disabled={uploading}
              />
              {uploading ? (
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              ) : (
                <>
                  <Camera className="h-6 w-6 text-muted-foreground mb-1" />
                  <span className="text-sm text-muted-foreground">
                    Kliknij, aby dodać zdjęcie
                  </span>
                </>
              )}
            </label>
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
