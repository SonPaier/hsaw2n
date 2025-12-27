import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Package } from 'lucide-react';

interface Product {
  id: string;
  name: string;
  brand: string | null;
  description: string | null;
  category: string | null;
  unit: string;
  default_price: number;
  metadata: Record<string, unknown> | null;
  active: boolean;
  source: string;
}

interface ProductDetailsDialogProps {
  product: Product;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ProductDetailsDialog({
  product,
  open,
  onOpenChange,
}: ProductDetailsDialogProps) {
  const formatPrice = (value: number) => {
    return new Intl.NumberFormat('pl-PL', {
      style: 'currency',
      currency: 'PLN',
    }).format(value);
  };

  const metadataLabels: Record<string, string> = {
    thickness_um: 'Grubość',
    width_cm: 'Szerokość',
    length_m: 'Długość',
    durability_years: 'Trwałość',
    color: 'Kolor',
    finish: 'Wykończenie',
    prices: 'Ceny wariantów',
  };

  const formatMetadataValue = (key: string, value: unknown): string => {
    if (key === 'thickness_um') return `${value} μm`;
    if (key === 'width_cm') return `${value} cm`;
    if (key === 'length_m') return `${value} mb`;
    if (key === 'durability_years') return `${value} lat`;
    if (key === 'prices' && typeof value === 'object') {
      return Object.entries(value as Record<string, number>)
        .map(([k, v]) => `${k}: ${formatPrice(v)}`)
        .join(', ');
    }
    return String(value);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5 text-primary" />
            Szczegóły produktu
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Header */}
          <div>
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-lg font-semibold">{product.name}</h3>
                {product.brand && (
                  <p className="text-muted-foreground">{product.brand}</p>
                )}
              </div>
              <div className="flex flex-col items-end gap-2">
                <span className="text-2xl font-bold text-primary">
                  {formatPrice(product.default_price)}
                </span>
                <span className="text-sm text-muted-foreground">
                  za {product.unit}
                </span>
              </div>
            </div>
          </div>

          {/* Badges */}
          <div className="flex flex-wrap gap-2">
            {product.category && (
              <Badge variant="outline">{product.category}</Badge>
            )}
            <Badge variant={product.source === 'global' ? 'secondary' : 'default'}>
              {product.source === 'global' ? 'Globalny' : 'Własny'}
            </Badge>
            <Badge variant={product.active ? 'default' : 'outline'}>
              {product.active ? 'Aktywny' : 'Nieaktywny'}
            </Badge>
          </div>

          {/* Description */}
          {product.description && (
            <div>
              <h4 className="text-sm font-medium mb-1">Opis</h4>
              <p className="text-sm text-muted-foreground">{product.description}</p>
            </div>
          )}

          {/* Metadata */}
          {product.metadata && Object.keys(product.metadata).length > 0 && (
            <div>
              <h4 className="text-sm font-medium mb-3">Parametry techniczne</h4>
              <div className="grid grid-cols-2 gap-3">
                {Object.entries(product.metadata).map(([key, value]) => {
                  if (value === null || value === undefined) return null;
                  return (
                    <div 
                      key={key}
                      className="flex flex-col p-3 bg-muted/50 rounded-lg"
                    >
                      <span className="text-xs text-muted-foreground">
                        {metadataLabels[key] || key}
                      </span>
                      <span className="font-medium text-sm">
                        {formatMetadataValue(key, value)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
