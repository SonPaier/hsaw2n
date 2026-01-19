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
  photo_urls?: string[]; // Support multiple photos
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
    onAddPoint(view, x, y);
  };

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
        className="relative bg-white rounded-lg border p-2 cursor-crosshair"
        onMouseEnter={() => setHoveredView(view)}
        onMouseLeave={() => setHoveredView(null)}
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
            <button
              key={point.id}
              type="button"
              className={cn(
                "absolute w-5 h-5 rounded-full border-2 border-white shadow-lg transform -translate-x-1/2 -translate-y-1/2 transition-transform",
                DAMAGE_TYPE_COLORS[point.damage_type || 'custom'] || 'bg-gray-500',
                selectedPointId === point.id && "ring-2 ring-offset-2 ring-primary scale-125"
              )}
              style={{
                left: `${point.x_percent}%`,
                top: `${point.y_percent}%`,
              }}
              onClick={(e) => {
                e.stopPropagation();
                onSelectPoint?.(point);
              }}
            />
          ))}
        </div>
        
        {/* Label */}
        <div className="absolute bottom-1 left-1/2 -translate-x-1/2 bg-black/60 text-white text-xs px-2 py-0.5 rounded">
          {VIEW_LABELS[view]}
        </div>
        
        {/* Hint on hover */}
        {hoveredView === view && points.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/10 rounded-lg pointer-events-none">
            <span className="text-xs text-muted-foreground bg-white/90 px-2 py-1 rounded">
              Kliknij, aby dodać punkt
            </span>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        {(['front', 'rear', 'left', 'right'] as VehicleView[]).map(renderView)}
      </div>
      
      {/* Legend */}
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
    </div>
  );
};
