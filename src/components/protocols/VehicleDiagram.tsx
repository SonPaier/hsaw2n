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
  photo_urls?: string[]; // Support multiple photos
  isNew?: boolean; // Flag for newly created, unsaved points
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

const DAMAGE_TYPE_COLORS: Record<string, string> = {
  scratch: 'bg-yellow-500',
  dent: 'bg-orange-500',
  damage: 'bg-red-500',
  chip: 'bg-blue-500',
  custom: 'bg-purple-500',
};

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

  // Global mouse/touch move handlers for smooth dragging (disabled in readOnly mode)
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
    if (readOnly) return; // Disable dragging in readOnly mode
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
    <div className="space-y-4">
      <div
        className={cn(
          "relative bg-white rounded-lg border p-4 touch-none w-full",
          readOnly ? "cursor-default max-w-[600px] mx-auto" : "cursor-crosshair"
        )}
        ref={containerRef}
        onClick={handleClick}
      >
        <div className="relative w-full" style={{ paddingBottom: '60%' }}>
          <img
            src={imagePath}
            alt="Diagram pojazdu"
            className="absolute inset-0 w-full h-full object-contain pointer-events-none select-none"
            draggable={false}
          />
          
          {/* Damage points */}
          {damagePoints.map((point) => (
            <div
              key={point.id}
              className={cn(
                "absolute rounded-full border-2 border-white shadow-lg transform -translate-x-1/2 -translate-y-1/2 transition-all",
                readOnly ? "cursor-pointer bg-blue-500" : "cursor-grab active:cursor-grabbing",
                !readOnly && point.isNew && !point.damage_type 
                  ? 'bg-gray-400 animate-pulse' 
                  : (!readOnly && (DAMAGE_TYPE_COLORS[point.damage_type || 'custom'] || 'bg-gray-500')),
                selectedPointId === point.id && "ring-2 ring-offset-2 ring-primary scale-125",
                !readOnly && draggingPointId === point.id && "scale-150 z-50"
              )}
              style={{
                left: `${point.x_percent}%`,
                top: `${point.y_percent}%`,
                width: '0.75rem',
                height: '0.75rem',
              }}
              onMouseDown={(e) => !readOnly && handlePointMouseDown(e, point)}
              onTouchStart={(e) => !readOnly && handlePointMouseDown(e, point)}
              onClick={(e) => handlePointClick(e, point)}
            />
          ))}
        </div>
      </div>
      
      {/* Legend - only show in edit mode */}
      {!readOnly && (
        <div className="flex flex-wrap gap-3 justify-center text-xs">
          {[
            { color: 'bg-yellow-500', label: 'Rysa' },
            { color: 'bg-orange-500', label: 'Wgniecenie' },
            { color: 'bg-red-500', label: 'Uszkodzenie' },
            { color: 'bg-blue-500', label: 'Odprysk' },
            { color: 'bg-purple-500', label: 'Inne' },
          ].map(item => (
            <div key={item.label} className="flex items-center gap-1.5">
              <span className={cn("w-3 h-3 rounded-full", item.color)} />
              <span className="text-muted-foreground">{item.label}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
