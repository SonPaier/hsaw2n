import { useState, useMemo } from 'react';
import { useEmployees } from '@/hooks/useEmployees';
import { useEmployeeBreaks, useCreateEmployeeBreak, useDeleteEmployeeBreak, EmployeeBreak } from '@/hooks/useEmployeeBreaks';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { ChevronLeft, ChevronRight, Plus, Loader2, Coffee, Trash2 } from 'lucide-react';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { pl } from 'date-fns/locale';
import { toast } from 'sonner';
import AddEmployeeBreakDialog from './AddEmployeeBreakDialog';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';

interface EmployeeBreaksViewProps {
  instanceId: string | null;
}

const EmployeeBreaksView = ({ instanceId }: EmployeeBreaksViewProps) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [breakToDelete, setBreakToDelete] = useState<EmployeeBreak | null>(null);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const dateFrom = format(startOfMonth(currentDate), 'yyyy-MM-dd');
  const dateTo = format(endOfMonth(currentDate), 'yyyy-MM-dd');

  const { data: employees = [], isLoading: loadingEmployees } = useEmployees(instanceId);
  const { data: breaks = [], isLoading: loadingBreaks } = useEmployeeBreaks(
    instanceId,
    selectedEmployeeId === 'all' ? null : selectedEmployeeId,
    dateFrom,
    dateTo
  );
  const deleteBreak = useDeleteEmployeeBreak(instanceId);

  const activeEmployees = employees.filter(e => e.active);

  const handlePrevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };

  const handleDeleteBreak = async () => {
    if (!breakToDelete) return;
    
    try {
      await deleteBreak.mutateAsync(breakToDelete.id);
      toast.success('Przerwa została usunięta');
      setDeleteConfirmOpen(false);
      setBreakToDelete(null);
    } catch (error) {
      toast.error('Błąd podczas usuwania przerwy');
    }
  };

  // Calculate total break time per employee
  const breakSummary = useMemo(() => {
    const summary = new Map<string, number>();
    breaks.forEach(b => {
      const current = summary.get(b.employee_id) || 0;
      summary.set(b.employee_id, current + (b.duration_minutes || 0));
    });
    return summary;
  }, [breaks]);

  const getEmployeeName = (employeeId: string) => {
    return employees.find(e => e.id === employeeId)?.name || 'Nieznany';
  };

  const isLoading = loadingEmployees || loadingBreaks;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (activeEmployees.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <Coffee className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" />
          <p className="text-muted-foreground">Brak aktywnych pracowników</p>
          <p className="text-sm text-muted-foreground mt-1">
            Dodaj pracowników, aby móc rejestrować przerwy
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={handlePrevMonth}>
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <span className="font-medium min-w-[140px] text-center">
            {format(currentDate, 'LLLL yyyy', { locale: pl })}
          </span>
          <Button variant="outline" size="icon" onClick={handleNextMonth}>
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>

        <div className="flex items-center gap-2">
          <Select value={selectedEmployeeId} onValueChange={setSelectedEmployeeId}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Wszyscy pracownicy" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Wszyscy pracownicy</SelectItem>
              {activeEmployees.map(emp => (
                <SelectItem key={emp.id} value={emp.id}>{emp.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button onClick={() => setDialogOpen(true)} size="sm">
            <Plus className="w-4 h-4 mr-1" />
            Dodaj przerwę
          </Button>
        </div>
      </div>

      {/* Summary badges */}
      {breakSummary.size > 0 && (
        <div className="flex flex-wrap gap-2">
          {Array.from(breakSummary.entries()).map(([empId, minutes]) => (
            <Badge key={empId} variant="secondary">
              {getEmployeeName(empId)}: {Math.floor(minutes / 60)}h {minutes % 60}min
            </Badge>
          ))}
        </div>
      )}

      {/* Breaks table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead>Pracownik</TableHead>
                <TableHead>Godziny</TableHead>
                <TableHead className="text-right">Czas</TableHead>
                <TableHead className="w-[60px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {breaks.map(brk => (
                <TableRow key={brk.id}>
                  <TableCell>
                    {format(new Date(brk.break_date), 'd MMM yyyy', { locale: pl })}
                  </TableCell>
                  <TableCell>{getEmployeeName(brk.employee_id)}</TableCell>
                  <TableCell>
                    {brk.start_time.slice(0, 5)} - {brk.end_time.slice(0, 5)}
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    {brk.duration_minutes} min
                  </TableCell>
                  <TableCell>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-8 w-8 text-destructive hover:text-destructive"
                      onClick={() => {
                        setBreakToDelete(brk);
                        setDeleteConfirmOpen(true);
                      }}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {breaks.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                    Brak przerw w tym miesiącu
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <AddEmployeeBreakDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        instanceId={instanceId}
        employees={activeEmployees}
      />

      <ConfirmDialog
        open={deleteConfirmOpen}
        onOpenChange={setDeleteConfirmOpen}
        title="Usuń przerwę"
        description="Czy na pewno chcesz usunąć tę przerwę?"
        confirmLabel="Usuń"
        onConfirm={handleDeleteBreak}
        variant="destructive"
      />
    </div>
  );
};

export default EmployeeBreaksView;
