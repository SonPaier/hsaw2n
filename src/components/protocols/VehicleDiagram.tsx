import { useState, useRef, useCallback, useEffect } from 'react';
import { cn } from '@/lib/utils';

export type VehicleView = 'full';
export type BodyType = 'sedan' | 'suv' | 'coupe' | 'cabrio' | 'van' | 'kombi' | 'hatchback';

export interface DamagePoint {
  id: string;
  view: VehicleView;
  x_percent: number;
  y_percent: number;
  damage_type?: string;
  custom_note?: string;
  photo_url?: string;
  photo_urls?: string[];
  isNew?: boolean;
}

interface VehicleDiagramProps {
  bodyType: BodyType;
  damagePoints: DamagePoint[];
  onAddPoint?: (view: VehicleView, xPercent: number, yPercent: number) => void;
  onSelectPoint?: (point: DamagePoint) => void;
  onUpdatePointPosition?: (pointId: string, xPercent: number, yPercent: number) => void;
  selectedPointId?: string | null;
  readOnly?: boolean;
}

// Consistent large dot size across all devices: 3rem (48px)
const POINT_SIZE = '3rem';

export const VehicleDiagram = ({
  bodyType,
  damagePoints,
  onAddPoint,
  onSelectPoint,
  onUpdatePointPosition,
  selectedPointId,
  readOnly = false,
}: VehicleDiagramProps) => {
  const [draggingPointId, setDraggingPointId] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressFiredRef = useRef(false);
  const touchStartPosRef = useRef<{ x: number; y: number } | null>(null);

  // Long-press to add point (mobile-friendly, prevents accidental adds)
  const handlePointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (readOnly || !onAddPoint) return;
    // Only handle primary pointer on the container itself (not on dots)
    if (e.target !== e.currentTarget && !(e.target as HTMLElement).classList.contains('diagram-bg')) return;
    
    longPressFiredRef.current = false;
    touchStartPosRef.current = { x: e.clientX, y: e.clientY };
    
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;

    longPressTimerRef.current = setTimeout(() => {
      longPressFiredRef.current = true;
      onAddPoint('full', x, y);
    }, 500); // 500ms long-press
  }, [readOnly, onAddPoint]);

  const handlePointerUp = useCallback(() => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  }, []);

  const handlePointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    // Cancel long-press if finger moved too much
    if (touchStartPosRef.current && longPressTimerRef.current) {
      const dx = e.clientX - touchStartPosRef.current.x;
      const dy = e.clientY - touchStartPosRef.current.y;
      if (Math.sqrt(dx * dx + dy * dy) > 10) {
        clearTimeout(longPressTimerRef.current);
        longPressTimerRef.current = null;
      }
    }
  }, []);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
    };
  }, []);

  const updatePosition = useCallback((clientX: number, clientY: number) => {
    if (!draggingPointId) return;
    
    const container = containerRef.current;
    if (!container) return;
    
    const rect = container.getBoundingClientRect();
    const newX = ((clientX - rect.left) / rect.width) * 100;
    const newY = ((clientY - rect.top) / rect.height) * 100;
    
    const clampedX = Math.max(0, Math.min(100, newX));
    const clampedY = Math.max(0, Math.min(100, newY));
    
    onUpdatePointPosition?.(draggingPointId, clampedX, clampedY);
  }, [draggingPointId, onUpdatePointPosition]);

  useEffect(() => {
    if (!draggingPointId || readOnly) return;

    const handleGlobalMove = (e: MouseEvent | TouchEvent) => {
      e.preventDefault();
      const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
      const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
      updatePosition(clientX, clientY);
    };

    const handleGlobalEnd = () => {
      setDraggingPointId(null);
    };

    window.addEventListener('mousemove', handleGlobalMove, { passive: false });
    window.addEventListener('mouseup', handleGlobalEnd);
    window.addEventListener('touchmove', handleGlobalMove, { passive: false });
    window.addEventListener('touchend', handleGlobalEnd);

    return () => {
      window.removeEventListener('mousemove', handleGlobalMove);
      window.removeEventListener('mouseup', handleGlobalEnd);
      window.removeEventListener('touchmove', handleGlobalMove);
      window.removeEventListener('touchend', handleGlobalEnd);
    };
  }, [draggingPointId, updatePosition, readOnly]);

  const handlePointMouseDown = useCallback((e: React.MouseEvent | React.TouchEvent, point: DamagePoint) => {
    if (readOnly) return;
    e.stopPropagation();
    e.preventDefault();
    setDraggingPointId(point.id);
  }, [readOnly]);

  const handlePointClick = useCallback((e: React.MouseEvent, point: DamagePoint) => {
    e.stopPropagation();
    if (!draggingPointId) {
      onSelectPoint?.(point);
    }
  }, [draggingPointId, onSelectPoint]);

  const imagePath = `/assets/vehicles/${bodyType}/full.png`;

  return (
    <div
      className={cn(
        "relative bg-white rounded-lg border touch-none w-full",
        readOnly ? "cursor-default max-w-[600px] mx-auto" : "cursor-crosshair"
      )}
      ref={containerRef}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerMove={handlePointerMove}
      onPointerCancel={handlePointerUp}
    >
      <div className="relative w-full" style={{ paddingBottom: '100%' }}>
        <img
          src={imagePath}
          alt="Diagram pojazdu"
          className="diagram-bg absolute inset-0 w-full h-full object-cover pointer-events-none select-none"
          draggable={false}
        />
        
        {damagePoints.map((point) => (
          <div
            key={point.id}
            className={cn(
              "absolute rounded-full border-2 border-white shadow-lg transform -translate-x-1/2 -translate-y-1/2 transition-all bg-blue-500",
              readOnly ? "cursor-pointer" : "cursor-grab active:cursor-grabbing",
              point.isNew && "animate-pulse",
              selectedPointId === point.id && "ring-2 ring-offset-2 ring-primary scale-125",
              !readOnly && draggingPointId === point.id && "scale-150 z-50"
            )}
            style={{
              left: `${point.x_percent}%`,
              top: `${point.y_percent}%`,
              width: POINT_SIZE,
              height: POINT_SIZE,
            }}
            onMouseDown={(e) => !readOnly && handlePointMouseDown(e, point)}
            onTouchStart={(e) => !readOnly && handlePointMouseDown(e, point)}
            onClick={(e) => handlePointClick(e, point)}
          />
        ))}
      </div>
    </div>
  );
};
