import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Loader2, FileText } from 'lucide-react';

interface PriceList {
  id: string;
  name: string;
  file_path: string;
  file_type: string;
  status: string;
  products_count: number;
  is_global: boolean;
}

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
}

interface PriceListViewerProps {
  priceList: PriceList;
  products: Product[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function PriceListViewer({
  priceList,
  products,
  open,
  onOpenChange,
}: PriceListViewerProps) {
  const [loading, setLoading] = useState(true);
  const [extractedProducts, setExtractedProducts] = useState<Product[]>([]);

  useEffect(() => {
    const fetchProducts = async () => {
      setLoading(true);
      
      // For now, show all products since we don't have direct linkage
      // In a full implementation, we'd link products to price lists via a junction table
      const { data } = await supabase
        .from('products_library')
        .select('*')
        .order('category', { ascending: true })
        .order('name', { ascending: true });

      setExtractedProducts((data as Product[]) || []);
      setLoading(false);
    };

    if (open) {
      fetchProducts();
    }
  }, [open, priceList.id]);

  const formatPrice = (value: number) => {
    return new Intl.NumberFormat('pl-PL', {
      style: 'currency',
      currency: 'PLN',
    }).format(value);
  };

  const formatMetadata = (metadata: Record<string, unknown> | null) => {
    if (!metadata) return null;
    
    const items: string[] = [];
    
    if (metadata.thickness_um) items.push(`${metadata.thickness_um}μm`);
    if (metadata.width_cm) items.push(`szer. ${metadata.width_cm}cm`);
    if (metadata.length_m) items.push(`${metadata.length_m}mb`);
    if (metadata.durability_years) items.push(`${metadata.durability_years} lat`);
    if (metadata.finish) items.push(String(metadata.finish));
    
    return items.length > 0 ? items.join(' • ') : null;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            {priceList.name}
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-auto">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : extractedProducts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <p className="text-muted-foreground">
                Brak wyekstrahowanych produktów z tego cennika.
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="bg-primary/10 border border-border">
                  <TableHead>Produkt</TableHead>
                  <TableHead>Marka</TableHead>
                  <TableHead>Kategoria</TableHead>
                  <TableHead>Parametry</TableHead>
                  <TableHead className="text-right">Cena netto</TableHead>
                  <TableHead>Jednostka</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {extractedProducts.map((product) => (
                  <TableRow key={product.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{product.name}</p>
                        {product.description && (
                          <p className="text-xs text-muted-foreground line-clamp-2">
                            {product.description}
                          </p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>{product.brand || '-'}</TableCell>
                    <TableCell>
                      {product.category && (
                        <Badge variant="outline" className="text-xs">
                          {product.category}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {formatMetadata(product.metadata) && (
                        <span className="text-xs text-muted-foreground">
                          {formatMetadata(product.metadata)}
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {formatPrice(product.default_price)}
                    </TableCell>
                    <TableCell>{product.unit}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
