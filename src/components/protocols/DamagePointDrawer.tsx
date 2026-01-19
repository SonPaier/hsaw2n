import { useState, useEffect } from 'react';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerFooter } from '@/components/ui/drawer';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Camera, Loader2, X, Sparkles } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { VehicleView, DamagePoint } from './VehicleDiagram';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { VoiceNoteInput } from './VoiceNoteInput';

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
  
  const [customNote, setCustomNote] = useState('');
  const [photoUrls, setPhotoUrls] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);

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

  const analyzeImageWithAI = async (imageUrl: string) => {
    setAnalyzing(true);
    try {
      const { data, error } = await supabase.functions.invoke('analyze-damage', {
        body: { type: 'analyze_image', imageUrl }
      });

      if (error) {
        console.error('AI analysis error:', error);
        toast.error('Błąd analizy AI');
        return;
      }

      if (data?.result && data.result !== 'Brak widocznych uszkodzeń') {
        setCustomNote(data.result);
        toast.success('AI rozpoznało uszkodzenie');
      } else {
        toast.info('Nie wykryto widocznych uszkodzeń');
      }
    } catch (err) {
      console.error('AI analysis error:', err);
      toast.error('Błąd analizy AI');
    } finally {
      setAnalyzing(false);
    }
  };

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

      // Auto-analyze first uploaded image with AI
      if (uploadedUrls.length > 0 && !customNote) {
        analyzeImageWithAI(uploadedUrls[0]);
      }
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

  const handleAnalyzePhoto = (url: string) => {
    analyzeImageWithAI(url);
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
    setCustomNote('');
    setPhotoUrls([]);
  };

  const handleClose = () => {
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
          {/* Photos at the top */}
          <div className="space-y-2">
            <Label>Zdjęcia (AI rozpozna uszkodzenie)</Label>
            
            <label className="flex flex-col items-center justify-center w-full h-24 border-2 border-dashed rounded-lg cursor-pointer bg-white hover:bg-muted/30 transition-colors">
              <input
                type="file"
                accept="image/*"
                capture="environment"
                multiple
                className="hidden"
                onChange={handlePhotoUpload}
                disabled={uploading || analyzing}
              />
              {uploading ? (
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              ) : analyzing ? (
                <>
                  <Loader2 className="h-8 w-8 animate-spin text-primary mb-1" />
                  <span className="text-sm text-primary font-medium">AI analizuje zdjęcie...</span>
                </>
              ) : (
                <>
                  <Camera className="h-8 w-8 text-muted-foreground mb-1" />
                  <span className="text-sm text-muted-foreground font-medium">
                    Zrób zdjęcie lub wybierz z galerii
                  </span>
                </>
              )}
            </label>

            {photoUrls.length > 0 && (
              <ScrollArea className="w-full whitespace-nowrap rounded-lg">
                <div className="flex gap-3 pb-2 pr-2">
                  {photoUrls.map((url, index) => (
                    <div 
                      key={index} 
                      className="relative shrink-0 w-[calc(25%-10px)] min-w-[80px] aspect-square group"
                    >
                      <img 
                        src={url} 
                        alt={`Zdjęcie ${index + 1}`} 
                        className="w-full h-full object-cover rounded-lg border"
                      />
                      <div className="absolute top-1 right-1 flex gap-1">
                        <Button
                          variant="secondary"
                          size="icon"
                          className="h-6 w-6 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={() => handleAnalyzePhoto(url)}
                          disabled={analyzing}
                          title="Analizuj AI"
                        >
                          {analyzing ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <Sparkles className="h-3 w-3" />
                          )}
                        </Button>
                        <Button
                          variant="destructive"
                          size="icon"
                          className="h-6 w-6 rounded-full"
                          onClick={() => handleRemovePhoto(index)}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
                <ScrollBar orientation="horizontal" />
              </ScrollArea>
            )}
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
