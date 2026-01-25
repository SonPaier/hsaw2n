import { useState, useRef, useCallback, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile';

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
  const isMobile = useIsMobile();
  
  // Point size: larger in readOnly mode (public view) or on mobile for better touch/visibility
  // 1.875rem (30px) for public/mobile, 0.75rem (12px) for admin desktop
  const pointSize = (readOnly || isMobile) ? '1.875rem' : '0.75rem';
  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (readOnly || draggingPointId) return;
    if (!onAddPoint) return;
    
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    onAddPoint('full', x, y);
  };

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
      onClick={handleClick}
    >
      <div className="relative w-full" style={{ paddingBottom: '100%' }}>
        <img
          src={imagePath}
          alt="Diagram pojazdu"
          className="absolute inset-0 w-full h-full object-cover pointer-events-none select-none"
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
              width: pointSize,
              height: pointSize,
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
