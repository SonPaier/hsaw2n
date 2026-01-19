import { useState, useRef, useCallback, useEffect } from 'react';
import { cn } from '@/lib/utils';

export type VehicleView = 'front' | 'rear' | 'left' | 'right';

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
  visibleViews?: VehicleView[]; // Optional: only render these views
}

const VIEW_LABELS: Record<VehicleView, string> = {
  front: 'Przód',
  rear: 'Tył',
  left: 'Lewa strona',
  right: 'Prawa strona',
};

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
  visibleViews,
}: VehicleDiagramProps) => {
  const [hoveredView, setHoveredView] = useState<VehicleView | null>(null);
  const [draggingPointId, setDraggingPointId] = useState<string | null>(null);
  const containerRefs = useRef<Record<VehicleView, HTMLDivElement | null>>({
    front: null,
    rear: null,
    left: null,
    right: null,
  });

  const handleClick = (view: VehicleView, e: React.MouseEvent<HTMLDivElement>) => {
    if (readOnly || draggingPointId) return;
    if (!onAddPoint) return;
    
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    onAddPoint(view, x, y);
  };

  const updatePosition = useCallback((clientX: number, clientY: number, view: VehicleView) => {
    if (!draggingPointId) return;
    
    const container = containerRefs.current[view];
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

    const point = damagePoints.find(p => p.id === draggingPointId);
    if (!point) return;

    const handleGlobalMove = (e: MouseEvent | TouchEvent) => {
      e.preventDefault();
      const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
      const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
      updatePosition(clientX, clientY, point.view);
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
  }, [draggingPointId, damagePoints, updatePosition, readOnly]);

  const handlePointMouseDown = useCallback((e: React.MouseEvent | React.TouchEvent, point: DamagePoint) => {
    if (readOnly) return; // Disable dragging in readOnly mode
    e.stopPropagation();
    e.preventDefault();
    setDraggingPointId(point.id);
  }, []);

  const handlePointClick = useCallback((e: React.MouseEvent, point: DamagePoint) => {
    e.stopPropagation();
    if (!draggingPointId) {
      onSelectPoint?.(point);
    }
  }, [draggingPointId, onSelectPoint]);

  const getViewPoints = (view: VehicleView) => {
    return damagePoints.filter(p => p.view === view);
  };

  const renderView = (view: VehicleView) => {
    const points = getViewPoints(view);
    const imagePath = `/assets/vehicles/${bodyType}/full.png`;

    // Rotation for each view
    const rotationClass = {
      front: '',
      rear: 'rotate-180',
      left: '-rotate-90',
      right: 'rotate-90',
    }[view];

    return (
      <div
        key={view}
        className={cn(
          "relative bg-white rounded-lg border p-2 touch-none",
          readOnly ? "cursor-default" : "cursor-crosshair"
        )}
        ref={(el) => { containerRefs.current[view] = el; }}
        onMouseEnter={() => !readOnly && setHoveredView(view)}
        onMouseLeave={() => !readOnly && setHoveredView(null)}
        onClick={(e) => handleClick(view, e)}
      >
        <div className="aspect-square relative overflow-hidden">
          <img
            src={imagePath}
            alt={VIEW_LABELS[view]}
            className={cn(
              "w-full h-full object-contain pointer-events-none select-none",
              rotationClass
            )}
            draggable={false}
          />
          
          {/* Damage points */}
          {points.map((point) => (
            <div
              key={point.id}
              className={cn(
                "absolute rounded-full border-2 border-white shadow-lg transform -translate-x-1/2 -translate-y-1/2 transition-all",
                readOnly ? "w-9 h-9 cursor-pointer bg-blue-500" : "w-6 h-6 cursor-grab active:cursor-grabbing",
                !readOnly && point.isNew && !point.damage_type 
                  ? 'bg-gray-400 animate-pulse' 
                  : (!readOnly && (DAMAGE_TYPE_COLORS[point.damage_type || 'custom'] || 'bg-gray-500')),
                selectedPointId === point.id && "ring-2 ring-offset-2 ring-primary scale-125",
                !readOnly && draggingPointId === point.id && "scale-150 z-50"
              )}
              style={{
                left: `${point.x_percent}%`,
                top: `${point.y_percent}%`,
              }}
              onMouseDown={(e) => !readOnly && handlePointMouseDown(e, point)}
              onTouchStart={(e) => !readOnly && handlePointMouseDown(e, point)}
              onClick={(e) => handlePointClick(e, point)}
            />
          ))}
        </div>
        
        {/* Label */}
        <div className="absolute bottom-1 left-1/2 -translate-x-1/2 bg-black/60 text-white text-xs px-2 py-0.5 rounded">
          {VIEW_LABELS[view]}
        </div>
        
        {/* Hint on hover (only in edit mode) */}
        {!readOnly && hoveredView === view && points.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/10 rounded-lg pointer-events-none">
            <span className="text-xs text-muted-foreground bg-white/90 px-2 py-1 rounded">
              Kliknij, aby dodać punkt
            </span>
          </div>
        )}
      </div>
    );
  };

  // Determine which views to render
  const viewsToRender = visibleViews || (['front', 'rear', 'left', 'right'] as VehicleView[]);

  return (
    <div className="space-y-4">
      <div className={cn(
        "grid gap-3",
        viewsToRender.length === 1 ? "grid-cols-1 max-w-[200px] mx-auto" :
        viewsToRender.length === 2 ? "grid-cols-2 max-w-[400px] mx-auto" :
        "grid-cols-2"
      )}>
        {viewsToRender.map(renderView)}
      </div>
      
      {/* Legend - only show in edit mode */}
      {!readOnly && (
        <div className="flex flex-wrap gap-3 justify-center text-xs">
          {[
            { color: 'bg-yellow-500', label: 'Rysa' },
            { color: 'bg-orange-500', label: 'Wgniecenie' },
            { color: 'bg-red-500', label: 'Uszkodzenie' },
            { color: 'bg-blue-500', label: 'Odprysek' },
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
