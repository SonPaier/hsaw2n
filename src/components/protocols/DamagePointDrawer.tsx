import { useState } from 'react';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerFooter } from '@/components/ui/drawer';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Camera, Loader2, Trash2, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { VehicleView, DamagePoint } from './VehicleDiagram';

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
  
  const [damageType, setDamageType] = useState(existingPoint?.damage_type || 'scratch');
  const [customNote, setCustomNote] = useState(existingPoint?.custom_note || '');
  const [photoUrl, setPhotoUrl] = useState<string | null>(existingPoint?.photo_url || null);
  const [uploading, setUploading] = useState(false);

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const timestamp = Date.now();
      const ext = file.name.split('.').pop();
      const fileName = offerNumber 
        ? `${offerNumber}_${timestamp}.${ext}`
        : `protocol_${timestamp}.${ext}`;

      const { data, error } = await supabase.storage
        .from('protocol-photos')
        .upload(fileName, file);

      if (error) throw error;

      const { data: urlData } = supabase.storage
        .from('protocol-photos')
        .getPublicUrl(data.path);

      setPhotoUrl(urlData.publicUrl);
      toast.success('Zdjęcie dodane');
    } catch (error) {
      console.error('Upload error:', error);
      toast.error('Błąd podczas przesyłania zdjęcia');
    } finally {
      setUploading(false);
    }
  };

  const handleSave = () => {
    onSave({
      damage_type: damageType,
      custom_note: customNote,
      photo_url: photoUrl,
    });
    // Reset form
    setDamageType('scratch');
    setCustomNote('');
    setPhotoUrl(null);
  };

  const handleClose = () => {
    setDamageType('scratch');
    setCustomNote('');
    setPhotoUrl(null);
    onOpenChange(false);
  };

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent>
        <DrawerHeader className="flex items-center justify-between">
          <DrawerTitle>
            {isEditing ? 'Edytuj uszkodzenie' : 'Dodaj uszkodzenie'}
          </DrawerTitle>
          <Button variant="ghost" size="icon" onClick={handleClose}>
            <X className="h-4 w-4" />
          </Button>
        </DrawerHeader>

        <div className="px-4 space-y-6 pb-4">
          {/* Damage type selection */}
          <div className="space-y-3">
            <Label>Typ uszkodzenia</Label>
            <RadioGroup value={damageType} onValueChange={setDamageType}>
              <div className="grid grid-cols-2 gap-2">
                {DAMAGE_TYPES.map((type) => (
                  <label
                    key={type.value}
                    className={`flex items-center gap-3 p-3 border rounded-lg cursor-pointer transition-all ${
                      damageType === type.value 
                        ? 'border-primary bg-primary/5' 
                        : 'hover:bg-muted/50'
                    }`}
                  >
                    <RadioGroupItem value={type.value} />
                    <span className={`w-4 h-4 rounded-full ${type.color}`} />
                    <span className="text-sm font-medium">{type.label}</span>
                  </label>
                ))}
              </div>
            </RadioGroup>
          </div>

          {/* Photo upload */}
          <div className="space-y-3">
            <Label>Zdjęcie (opcjonalne)</Label>
            {photoUrl ? (
              <div className="relative">
                <img 
                  src={photoUrl} 
                  alt="Zdjęcie uszkodzenia" 
                  className="w-full h-48 object-cover rounded-lg"
                />
                <Button
                  variant="destructive"
                  size="icon"
                  className="absolute top-2 right-2"
                  onClick={() => setPhotoUrl(null)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-lg cursor-pointer hover:bg-muted/50 transition-colors">
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handlePhotoUpload}
                  disabled={uploading}
                />
                {uploading ? (
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                ) : (
                  <>
                    <Camera className="h-8 w-8 text-muted-foreground mb-2" />
                    <span className="text-sm text-muted-foreground">
                      Kliknij, aby dodać zdjęcie
                    </span>
                  </>
                )}
              </label>
            )}
          </div>

          {/* Custom note */}
          <div className="space-y-2">
            <Label>Notatka (opcjonalna)</Label>
            <Textarea
              value={customNote}
              onChange={(e) => setCustomNote(e.target.value)}
              placeholder="Dodatkowy opis uszkodzenia..."
              rows={3}
            />
          </div>
        </div>

        <DrawerFooter className="flex-row gap-2">
          {isEditing && onDelete && (
            <Button variant="destructive" onClick={onDelete} className="flex-1">
              <Trash2 className="h-4 w-4 mr-2" />
              Usuń
            </Button>
          )}
          <Button variant="outline" onClick={handleClose} className="flex-1">
            Anuluj
          </Button>
          <Button onClick={handleSave} className="flex-1">
            {isEditing ? 'Zapisz' : 'Dodaj'}
          </Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
};
