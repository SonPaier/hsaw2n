import { useState, useMemo } from 'react';
import { useEmployees } from '@/hooks/useEmployees';
import { useEmployeeDaysOff, useDeleteEmployeeDayOff, EmployeeDayOff, DAY_OFF_TYPE_LABELS, calculateVacationDaysUsed } from '@/hooks/useEmployeeDaysOff';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Plus, Loader2, CalendarOff, Trash2 } from 'lucide-react';
import { format, differenceInDays, parseISO } from 'date-fns';
import { pl } from 'date-fns/locale';
import { toast } from 'sonner';
import AddEmployeeDayOffDialog from './AddEmployeeDayOffDialog';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';

interface EmployeeDaysOffViewProps {
  instanceId: string | null;
}

const EmployeeDaysOffView = ({ instanceId }: EmployeeDaysOffViewProps) => {
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [dayOffToDelete, setDayOffToDelete] = useState<EmployeeDayOff | null>(null);

  const { data: employees = [], isLoading: loadingEmployees } = useEmployees(instanceId);
  const { data: daysOff = [], isLoading: loadingDaysOff } = useEmployeeDaysOff(
    instanceId,
    selectedEmployeeId === 'all' ? null : selectedEmployeeId
  );
  const deleteDayOff = useDeleteEmployeeDayOff(instanceId);

  const activeEmployees = employees.filter(e => e.active);
  const currentYear = new Date().getFullYear();

  const handleDeleteDayOff = async () => {
    if (!dayOffToDelete) return;
    
    try {
      await deleteDayOff.mutateAsync(dayOffToDelete.id);
      toast.success('Nieobecność została usunięta');
      setDeleteConfirmOpen(false);
      setDayOffToDelete(null);
    } catch (error) {
      toast.error('Błąd podczas usuwania nieobecności');
    }
  };

  // Calculate vacation days used per employee this year
  const vacationSummary = useMemo(() => {
    const summary = new Map<string, number>();
    activeEmployees.forEach(emp => {
      const empDaysOff = daysOff.filter(d => d.employee_id === emp.id);
      summary.set(emp.id, calculateVacationDaysUsed(empDaysOff, currentYear));
    });
    return summary;
  }, [daysOff, activeEmployees, currentYear]);

  const getEmployeeName = (employeeId: string) => {
    return employees.find(e => e.id === employeeId)?.name || 'Nieznany';
  };

  const getDaysCount = (from: string, to: string) => {
    return differenceInDays(parseISO(to), parseISO(from)) + 1;
  };

  const getTypeColor = (type: string): 'default' | 'secondary' | 'destructive' | 'outline' => {
    switch (type) {
      case 'vacation': return 'default';
      case 'sick': return 'destructive';
      case 'personal': return 'secondary';
      default: return 'outline';
    }
  };

  const isLoading = loadingEmployees || loadingDaysOff;

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
          <CalendarOff className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" />
          <p className="text-muted-foreground">Brak aktywnych pracowników</p>
          <p className="text-sm text-muted-foreground mt-1">
            Dodaj pracowników, aby móc rejestrować nieobecności
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h2 className="text-lg font-semibold">Nieobecności</h2>

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
            Dodaj nieobecność
          </Button>
        </div>
      </div>

      {/* Vacation summary cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {activeEmployees
          .filter(e => selectedEmployeeId === 'all' || e.id === selectedEmployeeId)
          .map(employee => {
            const vacationDays = vacationSummary.get(employee.id) || 0;
            
            return (
              <Card key={employee.id}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">{employee.name}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{vacationDays} dni</div>
                  <div className="text-xs text-muted-foreground">
                    urlopu w {currentYear}
                  </div>
                </CardContent>
              </Card>
            );
          })}
      </div>

      {/* Days off table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Pracownik</TableHead>
                <TableHead>Okres</TableHead>
                <TableHead>Typ</TableHead>
                <TableHead className="text-right">Dni</TableHead>
                <TableHead className="w-[60px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {daysOff.map(dayOff => (
                <TableRow key={dayOff.id}>
                  <TableCell>{getEmployeeName(dayOff.employee_id)}</TableCell>
                  <TableCell>
                    {format(parseISO(dayOff.date_from), 'd MMM', { locale: pl })}
                    {dayOff.date_from !== dayOff.date_to && (
                      <> - {format(parseISO(dayOff.date_to), 'd MMM yyyy', { locale: pl })}</>
                    )}
                    {dayOff.date_from === dayOff.date_to && (
                      <> {format(parseISO(dayOff.date_from), 'yyyy', { locale: pl })}</>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant={getTypeColor(dayOff.day_off_type)}>
                      {DAY_OFF_TYPE_LABELS[dayOff.day_off_type]}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    {getDaysCount(dayOff.date_from, dayOff.date_to)}
                  </TableCell>
                  <TableCell>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-8 w-8 text-destructive hover:text-destructive"
                      onClick={() => {
                        setDayOffToDelete(dayOff);
                        setDeleteConfirmOpen(true);
                      }}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {daysOff.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                    Brak nieobecności
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <AddEmployeeDayOffDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        instanceId={instanceId}
        employees={activeEmployees}
      />

      <ConfirmDialog
        open={deleteConfirmOpen}
        onOpenChange={setDeleteConfirmOpen}
        title="Usuń nieobecność"
        description="Czy na pewno chcesz usunąć tę nieobecność?"
        confirmLabel="Usuń"
        onConfirm={handleDeleteDayOff}
        variant="destructive"
      />
    </div>
  );
};

export default EmployeeDaysOffView;
