import React, { useState, useMemo } from 'react';
import { useCarModels } from '@/contexts/CarModelsContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Plus, Search, Upload, Download, Pencil, Trash2, Loader2, Car } from 'lucide-react';
import { AddCarModelDialog } from './AddCarModelDialog';
import { EditCarModelDialog } from './EditCarModelDialog';

const ITEMS_PER_PAGE = 20;

export const CarModelsManager: React.FC = () => {
  const { carModels, isLoading, refetch, getBrands } = useCarModels();
  const [searchQuery, setSearchQuery] = useState('');
  const [brandFilter, setBrandFilter] = useState<string>('all');
  const [sizeFilter, setSizeFilter] = useState<string>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [isImporting, setIsImporting] = useState(false);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [editingModel, setEditingModel] = useState<{ id: string; brand: string; name: string; size: string } | null>(null);

  const brands = useMemo(() => getBrands(), [getBrands]);

  const filteredModels = useMemo(() => {
    return carModels.filter(model => {
      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchesBrand = model.brand.toLowerCase().includes(query);
        const matchesName = model.name.toLowerCase().includes(query);
        if (!matchesBrand && !matchesName) return false;
      }
      
      // Brand filter
      if (brandFilter !== 'all' && model.brand !== brandFilter) return false;
      
      // Size filter
      if (sizeFilter !== 'all' && model.size !== sizeFilter) return false;
      
      return true;
    });
  }, [carModels, searchQuery, brandFilter, sizeFilter]);

  const paginatedModels = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredModels.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredModels, currentPage]);

  const totalPages = Math.ceil(filteredModels.length / ITEMS_PER_PAGE);

  const handleImportFromJson = async () => {
    try {
      setIsImporting(true);
      const { data, error } = await supabase.functions.invoke('seed-car-models');
      
      if (error) throw error;
      
      toast.success(`Zaimportowano ${data.inserted} modeli (${data.skipped} już istniało)`);
      await refetch();
    } catch (error) {
      console.error('Import error:', error);
      toast.error('Błąd podczas importu danych');
    } finally {
      setIsImporting(false);
    }
  };

  const handleExportToCsv = () => {
    const headers = ['Marka', 'Model', 'Rozmiar'];
    const rows = carModels.map(m => [m.brand, m.name, m.size]);
    const csvContent = [headers, ...rows]
      .map(row => row.map(cell => `"${cell}"`).join(','))
      .join('\n');

    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `samochody_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    
    toast.success('Wyeksportowano do CSV');
  };

  const handleDeleteModel = async (id: string, brand: string, name: string) => {
    if (!confirm(`Czy na pewno chcesz usunąć ${brand} ${name}?`)) return;
    
    try {
      const { error } = await supabase
        .from('car_models')
        .update({ active: false })
        .eq('id', id);
      
      if (error) throw error;
      
      toast.success(`Usunięto ${brand} ${name}`);
      await refetch();
    } catch (error) {
      console.error('Delete error:', error);
      toast.error('Błąd podczas usuwania');
    }
  };

  const getSizeBadgeVariant = (size: string) => {
    switch (size) {
      case 'S': return 'secondary';
      case 'M': return 'default';
      case 'L': return 'destructive';
      default: return 'outline';
    }
  };

  const getSizeLabel = (size: string) => {
    switch (size) {
      case 'S': return 'Mały';
      case 'M': return 'Średni';
      case 'L': return 'Duży';
      default: return size;
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Car className="h-6 w-6 text-primary" />
          <h2 className="text-2xl font-bold">Baza samochodów</h2>
          <Badge variant="outline" className="ml-2">
            {carModels.length} modeli
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleImportFromJson}
            disabled={isImporting}
          >
            {isImporting ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <Upload className="h-4 w-4 mr-2" />
            )}
            Importuj z JSON
          </Button>
          <Button variant="outline" size="sm" onClick={handleExportToCsv}>
            <Download className="h-4 w-4 mr-2" />
            Eksportuj CSV
          </Button>
          <Button size="sm" onClick={() => setShowAddDialog(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Dodaj model
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Szukaj marki lub modelu..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
                className="pl-8"
              />
            </div>
            <Select value={brandFilter} onValueChange={(v) => { setBrandFilter(v); setCurrentPage(1); }}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Marka" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Wszystkie marki</SelectItem>
                {brands.map(brand => (
                  <SelectItem key={brand} value={brand}>{brand}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={sizeFilter} onValueChange={(v) => { setSizeFilter(v); setCurrentPage(1); }}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Rozmiar" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Wszystkie</SelectItem>
                <SelectItem value="S">Mały (S)</SelectItem>
                <SelectItem value="M">Średni (M)</SelectItem>
                <SelectItem value="L">Duży (L)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Marka</TableHead>
                <TableHead>Model</TableHead>
                <TableHead>Rozmiar</TableHead>
                <TableHead className="w-[100px]">Akcje</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedModels.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                    {carModels.length === 0 
                      ? 'Brak modeli w bazie. Kliknij "Importuj z JSON" aby załadować dane.'
                      : 'Brak wyników dla podanych filtrów'}
                  </TableCell>
                </TableRow>
              ) : (
                paginatedModels.map(model => (
                  <TableRow key={model.id}>
                    <TableCell className="font-medium">{model.brand}</TableCell>
                    <TableCell>{model.name}</TableCell>
                    <TableCell>
                      <Badge variant={getSizeBadgeVariant(model.size)}>
                        {getSizeLabel(model.size)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setEditingModel({ 
                            id: model.id, 
                            brand: model.brand, 
                            name: model.name, 
                            size: model.size 
                          })}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDeleteModel(model.id, model.brand, model.name)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4">
              <p className="text-sm text-muted-foreground">
                Pokazuję {((currentPage - 1) * ITEMS_PER_PAGE) + 1}-
                {Math.min(currentPage * ITEMS_PER_PAGE, filteredModels.length)} z {filteredModels.length}
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                >
                  Poprzednia
                </Button>
                <span className="text-sm text-muted-foreground">
                  Strona {currentPage} z {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                >
                  Następna
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <AddCarModelDialog
        open={showAddDialog}
        onOpenChange={setShowAddDialog}
        onSuccess={refetch}
      />

      {editingModel && (
        <EditCarModelDialog
          open={!!editingModel}
          onOpenChange={(open) => !open && setEditingModel(null)}
          model={editingModel}
          onSuccess={refetch}
        />
      )}
    </div>
  );
};
