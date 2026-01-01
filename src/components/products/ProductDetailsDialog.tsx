import { useTranslation } from 'react-i18next';
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
  const { t } = useTranslation();

  const formatPrice = (value: number) => {
    return new Intl.NumberFormat('pl-PL', {
      style: 'currency',
      currency: 'PLN',
    }).format(value);
  };

  const metadataLabels: Record<string, string> = {
    thickness_um: t('productDetails.metadata.thickness'),
    width_cm: t('productDetails.metadata.width'),
    length_m: t('productDetails.metadata.length'),
    durability_years: t('productDetails.metadata.durability'),
    color: t('productDetails.metadata.color'),
    finish: t('productDetails.metadata.finish'),
    prices: t('productDetails.metadata.prices'),
  };

  const formatMetadataValue = (key: string, value: unknown): string => {
    if (key === 'thickness_um') return `${value} μm`;
    if (key === 'width_cm') return `${value} cm`;
    if (key === 'length_m') return `${value} mb`;
    if (key === 'durability_years') return `${value} ${t('productDetails.metadata.years')}`;
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
            {t('productDetails.title')}
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
                  {t('productDetails.perUnit', { unit: product.unit })}
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
              {product.source === 'global' ? t('productDetails.global') : t('productDetails.local')}
            </Badge>
            <Badge variant={product.active ? 'default' : 'outline'}>
              {product.active ? t('productDetails.active') : t('productDetails.inactive')}
            </Badge>
          </div>

          {/* Description */}
          {product.description && (
            <div>
              <h4 className="text-sm font-medium mb-1">{t('productDetails.description')}</h4>
              <p className="text-sm text-muted-foreground">{product.description}</p>
            </div>
          )}

          {/* Metadata */}
          {product.metadata && Object.keys(product.metadata).length > 0 && (
            <div>
              <h4 className="text-sm font-medium mb-3">{t('productDetails.technicalParams')}</h4>
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
