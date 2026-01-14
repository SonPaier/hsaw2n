import { useState, useRef } from 'react';
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
}

interface VehicleDiagramProps {
  bodyType: BodyType;
  damagePoints: DamagePoint[];
  onAddPoint: (view: VehicleView, xPercent: number, yPercent: number) => void;
  onSelectPoint?: (point: DamagePoint) => void;
  selectedPointId?: string | null;
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
  selectedPointId,
}: VehicleDiagramProps) => {
  const [hoveredView, setHoveredView] = useState<VehicleView | null>(null);

  const handleClick = (view: VehicleView, e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    onAddPoint(view, Math.round(x * 100) / 100, Math.round(y * 100) / 100);
  };

  const getImagePath = (view: VehicleView) => {
    // We use the full image for now since splitting requires external tools
    // The full image contains all views in a grid layout
    return `/assets/vehicles/${bodyType}/full.png`;
  };

  const renderViewPanel = (view: VehicleView) => {
    const viewPoints = damagePoints.filter(p => p.view === view);
    const isHovered = hoveredView === view;

    // Calculate clip path based on view position in the combined image
    // Image layout: top row (right side view), middle row (front, rear), bottom row (left side view)
    const getClipStyle = (): React.CSSProperties => {
      switch (view) {
        case 'right':
          return { objectPosition: 'center 0%', objectFit: 'cover' as const };
        case 'front':
          return { objectPosition: '0% 50%', objectFit: 'cover' as const };
        case 'rear':
          return { objectPosition: '100% 50%', objectFit: 'cover' as const };
        case 'left':
          return { objectPosition: 'center 100%', objectFit: 'cover' as const };
        default:
          return {};
      }
    };

    return (
      <div 
        key={view}
        className={cn(
          "relative border rounded-lg overflow-hidden cursor-crosshair transition-all",
          isHovered && "ring-2 ring-primary",
          "bg-muted/30"
        )}
        onMouseEnter={() => setHoveredView(view)}
        onMouseLeave={() => setHoveredView(null)}
        onClick={(e) => handleClick(view, e)}
      >
        {/* View label */}
        <div className="absolute top-2 left-2 z-10 bg-background/80 px-2 py-1 rounded text-xs font-medium">
          {VIEW_LABELS[view]}
        </div>

        {/* Vehicle image container */}
        <div className="aspect-[4/3] relative flex items-center justify-center p-4">
          <img
            src={getImagePath(view)}
            alt={`${bodyType} - ${view}`}
            className="max-h-full max-w-full object-contain pointer-events-none select-none"
            draggable={false}
          />
        </div>

        {/* Damage point markers */}
        {viewPoints.map((point) => (
          <button
            key={point.id}
            className={cn(
              "absolute w-6 h-6 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-lg flex items-center justify-center text-white text-xs font-bold transition-transform hover:scale-110 z-20",
              point.damage_type ? DAMAGE_TYPE_COLORS[point.damage_type] : 'bg-red-500',
              selectedPointId === point.id && "ring-2 ring-offset-2 ring-primary scale-110"
            )}
            style={{
              left: `${point.x_percent}%`,
              top: `${point.y_percent}%`,
            }}
            onClick={(e) => {
              e.stopPropagation();
              onSelectPoint?.(point);
            }}
          >
            •
          </button>
        ))}
      </div>
    );
  };

  return (
    <div className="space-y-2">
      <p className="text-sm text-muted-foreground">
        Kliknij na diagram, aby zaznaczyć uszkodzenie
      </p>
      <div className="grid grid-cols-2 gap-3">
        {renderViewPanel('front')}
        {renderViewPanel('rear')}
      {renderViewPanel('left')}
        {renderViewPanel('right')}
      </div>
    </div>
  );
};
