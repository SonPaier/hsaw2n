import { useState, useRef, useEffect, useCallback } from 'react';
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

const circleButtonClass =
  'flex items-center justify-center h-12 w-12 rounded-full bg-white text-black shadow-2xl border-2 border-gray-300 hover:bg-gray-100 active:bg-gray-200 disabled:opacity-40 disabled:pointer-events-none';

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
  const [isDrawingMode, setIsDrawingMode] = useState(true);
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
    setIsDrawingMode(true);
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
        <DialogPrimitive.Overlay className="fixed inset-0 z-[10001] bg-black/95" />
        <DialogPrimitive.Content className="fixed inset-0 z-[10002] flex flex-col outline-none">
          {/* Top bar */}
          <div className="fixed top-4 left-4 right-4 z-[10003] flex items-center justify-between">
            {/* Left: colors (when drawing) */}
            <div className="flex items-center gap-2">
              {isDrawingMode && COLORS.map(c => (
                <button
                  key={c.value}
                  type="button"
                  className="h-10 w-10 rounded-full border transition-transform shadow-lg"
                  style={{
                    backgroundColor: c.value,
                    borderColor: activeColor === c.value ? 'white' : 'rgba(255,255,255,0.3)',
                    borderWidth: activeColor === c.value ? '2px' : '1px',
                    transform: activeColor === c.value ? 'scale(1.15)' : 'scale(1)',
                  }}
                  onClick={() => setActiveColor(c.value)}
                  aria-label={c.label}
                />
              ))}
            </div>

            {/* Right: pencil + X */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                className={circleButtonClass}
                style={isDrawingMode ? { backgroundColor: 'transparent', borderColor: 'white', color: 'white' } : undefined}
                onClick={() => setIsDrawingMode(!isDrawingMode)}
                aria-label="Rysik"
              >
                <Pencil className="h-6 w-6" />
              </button>
              <button type="button" className={circleButtonClass} onClick={handleClose} aria-label="Zamknij">
                <X className="h-7 w-7" />
              </button>
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

          {/* Bottom bar: undo/redo/clear on left, save on right - only when drawing */}
          {isDrawingMode && hasStrokes && (
            <div className="fixed bottom-4 left-4 right-4 z-[10003] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <button type="button" className={circleButtonClass} onClick={handleUndo} disabled={!canUndo} aria-label="Cofnij">
                  <Undo2 className="h-5 w-5" />
                </button>
                <button type="button" className={circleButtonClass} onClick={handleRedo} disabled={!canRedo} aria-label="Ponów">
                  <Redo2 className="h-5 w-5" />
                </button>
                <button type="button" className={circleButtonClass} onClick={handleClear} disabled={!hasStrokes} aria-label="Wyczyść">
                  <Trash2 className="h-5 w-5" />
                </button>
              </div>
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="px-6 py-3 rounded-full bg-white text-black font-medium shadow-2xl border-2 border-gray-300 hover:bg-gray-100 active:bg-gray-200 disabled:opacity-50 flex items-center gap-2"
              >
                {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                Zapisz
              </button>
            </div>
          )}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
};
