import { useState, useRef, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Pencil, Undo2, Redo2, Trash2, X, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format } from 'date-fns';
import * as DialogPrimitive from '@radix-ui/react-dialog';

type Stroke = { points: { x: number; y: number }[] };

const COLORS = [
  { value: '#FF0000', label: 'Czerwony' },
  { value: '#FFD600', label: 'Żółty' },
  { value: '#0066FF', label: 'Niebieski' },
];

const STROKE_WIDTH = 4;
const MAX_UNDO = 20;

interface PhotoAnnotationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  photoUrl: string;
  onSave: (newUrl: string) => void;
}

export const PhotoAnnotationDialog = ({
  open,
  onOpenChange,
  photoUrl,
  onSave,
}: PhotoAnnotationDialogProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [redoStack, setRedoStack] = useState<Stroke[]>([]);
  const [activeColor, setActiveColor] = useState('#FF0000');
  const [isDrawingMode, setIsDrawingMode] = useState(false);
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentStroke, setCurrentStroke] = useState<{ x: number; y: number }[]>([]);
  const [saving, setSaving] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);

  const hasStrokes = strokes.length > 0;
  const canUndo = strokes.length > 0;
  const canRedo = redoStack.length > 0;

  // Load image when dialog opens
  useEffect(() => {
    if (!open || !photoUrl) return;
    setStrokes([]);
    setRedoStack([]);
    setActiveColor('#FF0000');
    setIsDrawingMode(false);
    setImageLoaded(false);

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      imageRef.current = img;
      setImageLoaded(true);
    };
    img.onerror = () => {
      toast.error('Nie udało się załadować zdjęcia');
      onOpenChange(false);
    };
    img.src = photoUrl;
  }, [open, photoUrl]);

  // Redraw canvas whenever strokes, color, or image changes
  const redrawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const img = imageRef.current;
    if (!canvas || !img) return;

    const container = containerRef.current;
    if (!container) return;

    const containerW = container.clientWidth;
    const containerH = container.clientHeight;

    // Fit image to container
    const scale = Math.min(containerW / img.width, containerH / img.height);
    const drawW = img.width * scale;
    const drawH = img.height * scale;

    canvas.width = drawW;
    canvas.height = drawH;
    canvas.style.width = `${drawW}px`;
    canvas.style.height = `${drawH}px`;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(img, 0, 0, drawW, drawH);

    // Draw all strokes with active color
    const allStrokes = [...strokes, ...(currentStroke.length > 1 ? [{ points: currentStroke }] : [])];
    for (const stroke of allStrokes) {
      if (stroke.points.length < 2) continue;
      ctx.beginPath();
      ctx.strokeStyle = activeColor;
      ctx.lineWidth = STROKE_WIDTH;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.moveTo(stroke.points[0].x * drawW, stroke.points[0].y * drawH);
      for (let i = 1; i < stroke.points.length; i++) {
        ctx.lineTo(stroke.points[i].x * drawW, stroke.points[i].y * drawH);
      }
      ctx.stroke();
    }
  }, [strokes, activeColor, currentStroke]);

  useEffect(() => {
    if (imageLoaded) redrawCanvas();
  }, [imageLoaded, redrawCanvas]);

  // Resize handler
  useEffect(() => {
    if (!open || !imageLoaded) return;
    const handler = () => redrawCanvas();
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, [open, imageLoaded, redrawCanvas]);

  const getPointerPos = (e: React.PointerEvent): { x: number; y: number } | null => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) / rect.width,
      y: (e.clientY - rect.top) / rect.height,
    };
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    if (!isDrawingMode) return;
    e.preventDefault();
    const pos = getPointerPos(e);
    if (!pos) return;
    setIsDrawing(true);
    setCurrentStroke([pos]);
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDrawing || !isDrawingMode) return;
    e.preventDefault();
    const pos = getPointerPos(e);
    if (!pos) return;
    setCurrentStroke(prev => [...prev, pos]);
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (!isDrawing) return;
    e.preventDefault();
    setIsDrawing(false);
    if (currentStroke.length > 1) {
      setStrokes(prev => {
        const newStrokes = [...prev, { points: currentStroke }];
        return newStrokes.length > MAX_UNDO ? newStrokes.slice(-MAX_UNDO) : newStrokes;
      });
      setRedoStack([]);
    }
    setCurrentStroke([]);
  };

  const handleUndo = () => {
    if (!canUndo) return;
    setStrokes(prev => {
      const last = prev[prev.length - 1];
      setRedoStack(r => [...r, last]);
      return prev.slice(0, -1);
    });
  };

  const handleRedo = () => {
    if (!canRedo) return;
    setRedoStack(prev => {
      const last = prev[prev.length - 1];
      setStrokes(s => [...s, last]);
      return prev.slice(0, -1);
    });
  };

  const handleClear = () => {
    setStrokes([]);
    setRedoStack([]);
  };

  const handleSave = async () => {
    const img = imageRef.current;
    if (!img || strokes.length === 0) return;

    setSaving(true);
    try {
      // Render to offscreen canvas at original resolution (max 1200px)
      const offscreen = document.createElement('canvas');
      let w = img.width;
      let h = img.height;
      if (w > 1200) {
        h = (h * 1200) / w;
        w = 1200;
      }
      offscreen.width = w;
      offscreen.height = h;
      const ctx = offscreen.getContext('2d');
      if (!ctx) throw new Error('No canvas context');

      ctx.drawImage(img, 0, 0, w, h);

      // Draw strokes
      for (const stroke of strokes) {
        if (stroke.points.length < 2) continue;
        ctx.beginPath();
        ctx.strokeStyle = activeColor;
        ctx.lineWidth = STROKE_WIDTH;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.moveTo(stroke.points[0].x * w, stroke.points[0].y * h);
        for (let i = 1; i < stroke.points.length; i++) {
          ctx.lineTo(stroke.points[i].x * w, stroke.points[i].y * h);
        }
        ctx.stroke();
      }

      const blob = await new Promise<Blob>((resolve, reject) => {
        offscreen.toBlob(
          b => b ? resolve(b) : reject(new Error('toBlob failed')),
          'image/jpeg',
          0.85
        );
      });

      const fileName = `protokol-szkoda-${format(new Date(), 'yyyyMMdd-HHmmss')}.jpg`;

      const { error: uploadError } = await supabase.storage
        .from('protocol-photos')
        .upload(fileName, blob, { contentType: 'image/jpeg' });
      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from('protocol-photos')
        .getPublicUrl(fileName);

      // Delete old file from storage
      try {
        const oldParts = photoUrl.split('/');
        const oldFileName = oldParts[oldParts.length - 1];
        if (oldFileName) {
          await supabase.storage.from('protocol-photos').remove([oldFileName]);
        }
      } catch {
        // ignore deletion errors
      }

      onSave(urlData.publicUrl);
      toast.success('Zdjęcie zapisane z adnotacjami');
      onOpenChange(false);
    } catch (error) {
      console.error('Error saving annotated photo:', error);
      toast.error('Błąd podczas zapisywania zdjęcia');
    } finally {
      setSaving(false);
    }
  };

  const handleClose = () => {
    setStrokes([]);
    setRedoStack([]);
    setCurrentStroke([]);
    setIsDrawingMode(false);
    onOpenChange(false);
  };

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-[9998] bg-black/95" />
        <DialogPrimitive.Content className="fixed inset-0 z-[9999] flex flex-col outline-none">
          {/* Top toolbar */}
          <div className="flex items-center justify-between p-2 bg-black/80 gap-2 shrink-0">
            <div className="flex items-center gap-2">
              {/* Drawing mode toggle */}
              <Button
                variant={isDrawingMode ? 'default' : 'outline'}
                size="icon"
                className="h-10 w-10 shrink-0"
                onClick={() => setIsDrawingMode(!isDrawingMode)}
              >
                <Pencil className="h-5 w-5" />
              </Button>

              {/* Colors - only visible when drawing mode on */}
              {isDrawingMode && (
                <div className="flex gap-1">
                  {COLORS.map(c => (
                    <button
                      key={c.value}
                      type="button"
                      className="h-8 w-8 rounded-full border-2 transition-transform"
                      style={{
                        backgroundColor: c.value,
                        borderColor: activeColor === c.value ? 'white' : 'transparent',
                        transform: activeColor === c.value ? 'scale(1.2)' : 'scale(1)',
                      }}
                      onClick={() => setActiveColor(c.value)}
                      aria-label={c.label}
                    />
                  ))}
                </div>
              )}
            </div>

            <div className="flex items-center gap-1">
              {/* Undo/Redo/Clear - only when drawing mode on */}
              {isDrawingMode && (
                <>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-10 w-10 text-white hover:bg-white/20"
                    onClick={handleUndo}
                    disabled={!canUndo}
                  >
                    <Undo2 className="h-5 w-5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-10 w-10 text-white hover:bg-white/20"
                    onClick={handleRedo}
                    disabled={!canRedo}
                  >
                    <Redo2 className="h-5 w-5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-10 w-10 text-white hover:bg-white/20"
                    onClick={handleClear}
                    disabled={!hasStrokes}
                  >
                    <Trash2 className="h-5 w-5" />
                  </Button>
                </>
              )}

              {/* Close */}
              <Button
                variant="ghost"
                size="icon"
                className="h-10 w-10 text-white hover:bg-white/20"
                onClick={handleClose}
              >
                <X className="h-5 w-5" />
              </Button>
            </div>
          </div>

          {/* Canvas area */}
          <div
            ref={containerRef}
            className="flex-1 flex items-center justify-center overflow-hidden p-2"
            style={{ touchAction: isDrawingMode ? 'none' : 'auto' }}
          >
            <canvas
              ref={canvasRef}
              className="max-w-full max-h-full"
              style={{ cursor: isDrawingMode ? 'crosshair' : 'default' }}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
            />
          </div>

          {/* Save button - only when drawing mode on AND has strokes */}
          {isDrawingMode && hasStrokes && (
            <div className="p-4 bg-black/80 flex justify-center shrink-0">
              <Button
                onClick={handleSave}
                disabled={saving}
                className="w-full max-w-xs"
              >
                {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Zapisz
              </Button>
            </div>
          )}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
};
