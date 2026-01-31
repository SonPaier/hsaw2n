import { useState, useMemo } from 'react';
import { useEmployees } from '@/hooks/useEmployees';
import { useTimeEntriesForMonth, calculateMonthlySummary, formatMinutesToTime, useCreateTimeEntry, useUpdateTimeEntry, useDeleteTimeEntry, TimeEntry } from '@/hooks/useTimeEntries';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { ChevronLeft, ChevronRight, Plus, Loader2, Clock, Pencil, Trash2 } from 'lucide-react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isWeekend, isSameDay } from 'date-fns';
import { pl } from 'date-fns/locale';
import { toast } from 'sonner';
import AddEditTimeEntryDialog from './AddEditTimeEntryDialog';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';

interface TimeEntriesViewProps {
  instanceId: string | null;
}

const TimeEntriesView = ({ instanceId }: TimeEntriesViewProps) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<TimeEntry | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [entryToDelete, setEntryToDelete] = useState<TimeEntry | null>(null);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const { data: employees = [], isLoading: loadingEmployees } = useEmployees(instanceId);
  const { data: timeEntries = [], isLoading: loadingEntries } = useTimeEntriesForMonth(instanceId, year, month);
  const deleteEntry = useDeleteTimeEntry(instanceId);

  const activeEmployees = employees.filter(e => e.active);

  // Get days of current month
  const daysInMonth = useMemo(() => {
    const start = startOfMonth(currentDate);
    const end = endOfMonth(currentDate);
    return eachDayOfInterval({ start, end });
  }, [currentDate]);

  // Group entries by employee and date
  const entriesByEmployeeAndDate = useMemo(() => {
    const map = new Map<string, Map<string, TimeEntry[]>>();
    
    timeEntries.forEach(entry => {
      if (!map.has(entry.employee_id)) {
        map.set(entry.employee_id, new Map());
      }
      const employeeMap = map.get(entry.employee_id)!;
      
      if (!employeeMap.has(entry.entry_date)) {
        employeeMap.set(entry.entry_date, []);
      }
      employeeMap.get(entry.entry_date)!.push(entry);
    });
    
    return map;
  }, [timeEntries]);

  // Calculate monthly totals
  const monthlySummary = useMemo(() => calculateMonthlySummary(timeEntries), [timeEntries]);

  const handlePrevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };

  const handleAddEntry = (employeeId?: string, date?: string) => {
    setEditingEntry(null);
    setDialogOpen(true);
  };

  const handleEditEntry = (entry: TimeEntry) => {
    setEditingEntry(entry);
    setDialogOpen(true);
  };

  const handleDeleteEntry = async () => {
    if (!entryToDelete) return;
    
    try {
      await deleteEntry.mutateAsync(entryToDelete.id);
      toast.success('Wpis został usunięty');
      setDeleteConfirmOpen(false);
      setEntryToDelete(null);
    } catch (error) {
      toast.error('Błąd podczas usuwania wpisu');
    }
  };

  const filteredEmployees = selectedEmployeeId === 'all' 
    ? activeEmployees 
    : activeEmployees.filter(e => e.id === selectedEmployeeId);

  const isLoading = loadingEmployees || loadingEntries;

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
          <Clock className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" />
          <p className="text-muted-foreground">Brak aktywnych pracowników</p>
          <p className="text-sm text-muted-foreground mt-1">
            Dodaj pracowników, aby móc rejestrować czas pracy
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

          <Button onClick={() => handleAddEntry()} size="sm">
            <Plus className="w-4 h-4 mr-1" />
            Dodaj wpis
          </Button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {filteredEmployees.map(employee => {
          const summary = monthlySummary.get(employee.id);
          const totalHours = summary ? formatMinutesToTime(summary.total_minutes) : '0:00';
          const earnings = summary && employee.hourly_rate 
            ? ((summary.total_minutes / 60) * employee.hourly_rate).toFixed(2)
            : null;
          
          return (
            <Card key={employee.id}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">{employee.name}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{totalHours}</div>
                <div className="text-xs text-muted-foreground">
                  {summary?.entries_count || 0} wpisów
                  {earnings && ` • ${earnings} zł`}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Entries table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-[120px]">Data</TableHead>
                  <TableHead>Pracownik</TableHead>
                  <TableHead>Godziny</TableHead>
                  <TableHead className="text-right">Czas</TableHead>
                  <TableHead className="w-[80px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredEmployees.flatMap(employee => {
                  const employeeEntries = entriesByEmployeeAndDate.get(employee.id);
                  if (!employeeEntries) return [];
                  
                  return Array.from(employeeEntries.entries())
                    .sort(([a], [b]) => b.localeCompare(a))
                    .flatMap(([date, entries]) => 
                      entries.map((entry, idx) => (
                        <TableRow key={entry.id}>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <span>{format(new Date(entry.entry_date), 'd MMM', { locale: pl })}</span>
                              {isWeekend(new Date(entry.entry_date)) && (
                                <Badge variant="secondary" className="text-xs">weekend</Badge>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>{employee.name}</TableCell>
                          <TableCell>
                            {entry.start_time && entry.end_time ? (
                              <span className="text-sm">
                                {entry.start_time.slice(0, 5)} - {entry.end_time.slice(0, 5)}
                              </span>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </TableCell>
                          <TableCell className="text-right font-medium">
                            {formatMinutesToTime(entry.total_minutes)}
                          </TableCell>
                          <TableCell></TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                className="h-8 w-8"
                                onClick={() => handleEditEntry(entry)}
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </Button>
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                className="h-8 w-8 text-destructive hover:text-destructive"
                                onClick={() => {
                                  setEntryToDelete(entry);
                                  setDeleteConfirmOpen(true);
                                }}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    );
                })}
                {timeEntries.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                      Brak wpisów w tym miesiącu
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <AddEditTimeEntryDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        instanceId={instanceId}
        employees={activeEmployees}
        entry={editingEntry}
      />

      <ConfirmDialog
        open={deleteConfirmOpen}
        onOpenChange={setDeleteConfirmOpen}
        title="Usuń wpis"
        description="Czy na pewno chcesz usunąć ten wpis czasu pracy?"
        confirmLabel="Usuń"
        onConfirm={handleDeleteEntry}
        variant="destructive"
      />
    </div>
  );
};

export default TimeEntriesView;
