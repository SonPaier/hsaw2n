import { useState, useMemo } from 'react';
import { useEmployees, useDeleteEmployee, Employee } from '@/hooks/useEmployees';
import { useTimeEntriesForMonth, calculateMonthlySummary, formatMinutesToTime, useDeleteTimeEntry, TimeEntry } from '@/hooks/useTimeEntries';
import { useEmployeeDaysOff, DAY_OFF_TYPE_LABELS, DayOffType } from '@/hooks/useEmployeeDaysOff';
import { useAuth } from '@/hooks/useAuth';
import { useIsMobile } from '@/hooks/use-mobile';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Plus, ChevronLeft, ChevronRight, Loader2, User, Pencil, Clock, CalendarOff, Trash2 } from 'lucide-react';
import { format, parseISO, isWeekend, startOfMonth, endOfMonth, isSameMonth, isWithinInterval, differenceInDays } from 'date-fns';
import { pl } from 'date-fns/locale';
import { toast } from 'sonner';
import AddEditEmployeeDialog from './AddEditEmployeeDialog';
import WorkerTimeDialog from './WorkerTimeDialog';
import AddEditTimeEntryDialog from './AddEditTimeEntryDialog';
import AddEmployeeDayOffDialog from './AddEmployeeDayOffDialog';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';

interface EmployeesViewProps {
  instanceId: string | null;
}

const EmployeesView = ({ instanceId }: EmployeesViewProps) => {
  const { hasRole } = useAuth();
  const isMobile = useIsMobile();
  const isAdmin = hasRole('admin') || hasRole('super_admin');
  
  const [currentDate, setCurrentDate] = useState(new Date());
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [workerDialogEmployee, setWorkerDialogEmployee] = useState<Employee | null>(null);
  const [timeEntryDialogOpen, setTimeEntryDialogOpen] = useState(false);
  const [editingTimeEntry, setEditingTimeEntry] = useState<TimeEntry | null>(null);
  const [dayOffDialogOpen, setDayOffDialogOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [entryToDelete, setEntryToDelete] = useState<TimeEntry | null>(null);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);

  const { data: employees = [], isLoading: loadingEmployees } = useEmployees(instanceId);
  const { data: timeEntries = [], isLoading: loadingEntries } = useTimeEntriesForMonth(instanceId, year, month);
  const { data: daysOff = [], isLoading: loadingDaysOff } = useEmployeeDaysOff(instanceId, null);
  const deleteTimeEntry = useDeleteTimeEntry(instanceId);

  // Filter only active (not soft-deleted) employees
  const activeEmployees = employees.filter(e => e.active && !(e as any).deleted_at);

  // Calculate monthly totals
  const monthlySummary = useMemo(() => calculateMonthlySummary(timeEntries), [timeEntries]);

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

  // Get days off for this month
  const getDaysOffForEmployee = (employeeId: string) => {
    return daysOff.filter(d => {
      if (d.employee_id !== employeeId) return false;
      const from = parseISO(d.date_from);
      const to = parseISO(d.date_to);
      // Check if any day in the range overlaps with current month
      return isWithinInterval(monthStart, { start: from, end: to }) ||
             isWithinInterval(monthEnd, { start: from, end: to }) ||
             (from <= monthStart && to >= monthEnd);
    });
  };

  const handlePrevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };

  const handleAddEmployee = () => {
    setEditingEmployee(null);
    setDialogOpen(true);
  };

  const handleEditEmployee = (e: React.MouseEvent, employee: Employee) => {
    e.stopPropagation();
    setEditingEmployee(employee);
    setDialogOpen(true);
  };

  const handleTileClick = (employee: Employee) => {
    setWorkerDialogEmployee(employee);
  };

  const handleDialogClose = () => {
    setDialogOpen(false);
    setEditingEmployee(null);
  };

  const handleEditTimeEntry = (entry: TimeEntry) => {
    setEditingTimeEntry(entry);
    setTimeEntryDialogOpen(true);
  };

  const handleDeleteTimeEntry = async () => {
    if (!entryToDelete) return;
    
    try {
      await deleteTimeEntry.mutateAsync(entryToDelete.id);
      toast.success('Wpis został usunięty');
      setDeleteConfirmOpen(false);
      setEntryToDelete(null);
    } catch (error) {
      toast.error('Błąd podczas usuwania wpisu');
    }
  };

  const isLoading = loadingEmployees || loadingEntries || loadingDaysOff;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Pracownicy i czas pracy</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Zarządzaj pracownikami i ich czasem pracy
          </p>
        </div>
        {isAdmin && (
          <div className="flex gap-2">
            <Button onClick={() => setDayOffDialogOpen(true)} variant="outline" size="sm">
              <CalendarOff className="w-4 h-4 mr-1" />
              <span className="hidden sm:inline">Dodaj nieobecność</span>
            </Button>
            <Button onClick={handleAddEmployee} size="sm">
              <Plus className="w-4 h-4 mr-1" />
              <span className="hidden sm:inline">Dodaj pracownika</span>
            </Button>
          </div>
        )}
      </div>

      {/* Month picker */}
      <div className="flex items-center justify-center gap-2">
        <Button variant="outline" size="icon" onClick={handlePrevMonth}>
          <ChevronLeft className="w-4 h-4" />
        </Button>
        <span className="font-medium min-w-[160px] text-center text-lg">
          {format(currentDate, 'LLLL yyyy', { locale: pl })}
        </span>
        <Button variant="outline" size="icon" onClick={handleNextMonth}>
          <ChevronRight className="w-4 h-4" />
        </Button>
      </div>

      {/* Empty state */}
      {activeEmployees.length === 0 ? (
        <div className="py-12 text-center">
          <User className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" />
          <p className="text-muted-foreground">Brak pracowników</p>
          <p className="text-sm text-muted-foreground mt-1">
            Dodaj pierwszego pracownika, aby rozpocząć rejestrację czasu pracy
          </p>
          {isAdmin && (
            <Button onClick={handleAddEmployee} className="mt-4">
              <Plus className="w-4 h-4 mr-1" />
              Dodaj pracownika
            </Button>
          )}
        </div>
      ) : (
        <>
          {/* Employee cards with summary */}
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {activeEmployees.map((employee) => {
              const summary = monthlySummary.get(employee.id);
              const totalHours = summary ? formatMinutesToTime(summary.total_minutes) : '0:00';
              const earnings = summary && employee.hourly_rate 
                ? ((summary.total_minutes / 60) * employee.hourly_rate).toFixed(2)
                : null;
              const employeeDaysOff = getDaysOffForEmployee(employee.id);
              
              return (
                <Card 
                  key={employee.id} 
                  className="cursor-pointer hover:bg-accent/50 transition-colors"
                  onClick={() => handleTileClick(employee)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <Avatar className="h-12 w-12">
                        <AvatarImage src={employee.photo_url || undefined} alt={employee.name} />
                        <AvatarFallback className="bg-primary/10 text-primary">
                          {employee.name.slice(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1">
                          <span className="font-medium truncate">{employee.name}</span>
                          {isAdmin && (
                            <button
                              onClick={(e) => handleEditEmployee(e, employee)}
                              className="p-1 rounded hover:bg-muted shrink-0"
                            >
                              <Pencil className="w-3.5 h-3.5 text-muted-foreground" />
                            </button>
                          )}
                        </div>
                        
                        {/* Hours summary */}
                        <div className="flex items-center gap-1 mt-1 text-sm">
                          <Clock className="w-3.5 h-3.5 text-muted-foreground" />
                          <span className="font-semibold">{totalHours}</span>
                          {earnings && isAdmin && (
                            <span className="text-muted-foreground">• {earnings} zł</span>
                          )}
                        </div>
                        
                        {/* Days off badges */}
                        {employeeDaysOff.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-2">
                            {employeeDaysOff.slice(0, 2).map((d) => {
                              const days = differenceInDays(parseISO(d.date_to), parseISO(d.date_from)) + 1;
                              return (
                                <Badge key={d.id} variant="secondary" className="text-xs">
                                  {DAY_OFF_TYPE_LABELS[d.day_off_type as DayOffType]?.split(' ')[0] || 'Wolne'} ({days}d)
                                </Badge>
                              );
                            })}
                            {employeeDaysOff.length > 2 && (
                              <Badge variant="outline" className="text-xs">
                                +{employeeDaysOff.length - 2}
                              </Badge>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Time entries - mobile cards, desktop minimal */}
          {timeEntries.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-sm font-medium text-muted-foreground">
                Wpisy czasu pracy w tym miesiącu ({timeEntries.length})
              </h3>
              
              {isMobile ? (
                // Mobile: Cards
                <div className="space-y-2">
                  {activeEmployees.flatMap(employee => {
                    const employeeEntries = entriesByEmployeeAndDate.get(employee.id);
                    if (!employeeEntries) return [];
                    
                    return Array.from(employeeEntries.entries())
                      .sort(([a], [b]) => b.localeCompare(a))
                      .flatMap(([date, entries]) => 
                        entries.map((entry) => (
                          <Card key={entry.id} className="bg-white">
                            <CardContent className="p-3">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                  <div className="text-sm">
                                    <div className="flex items-center gap-2">
                                      <span className="font-medium">
                                        {format(new Date(entry.entry_date), 'd MMM', { locale: pl })}
                                      </span>
                                      {isWeekend(new Date(entry.entry_date)) && (
                                        <Badge variant="secondary" className="text-xs">weekend</Badge>
                                      )}
                                    </div>
                                    <div className="text-muted-foreground">
                                      {employee.name}
                                    </div>
                                  </div>
                                </div>
                                <div className="flex items-center gap-2">
                                  <div className="text-right">
                                    {entry.start_time && entry.end_time ? (
                                      <div className="text-xs text-muted-foreground">
                                        {entry.start_time.slice(0, 5)} - {entry.end_time.slice(0, 5)}
                                      </div>
                                    ) : null}
                                    <div className="font-semibold">
                                      {formatMinutesToTime(entry.total_minutes)}
                                    </div>
                                  </div>
                                  {isAdmin && (
                                    <div className="flex gap-1">
                                      <Button 
                                        variant="ghost" 
                                        size="icon" 
                                        className="h-8 w-8"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleEditTimeEntry(entry);
                                        }}
                                      >
                                        <Pencil className="w-3.5 h-3.5" />
                                      </Button>
                                      <Button 
                                        variant="ghost" 
                                        size="icon" 
                                        className="h-8 w-8 text-destructive hover:text-destructive"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setEntryToDelete(entry);
                                          setDeleteConfirmOpen(true);
                                        }}
                                      >
                                        <Trash2 className="w-3.5 h-3.5" />
                                      </Button>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        ))
                      );
                  })}
                </div>
              ) : (
                // Desktop: Simple list
                <Card>
                  <CardContent className="p-0">
                    <div className="divide-y">
                      {activeEmployees.flatMap(employee => {
                        const employeeEntries = entriesByEmployeeAndDate.get(employee.id);
                        if (!employeeEntries) return [];
                        
                        return Array.from(employeeEntries.entries())
                          .sort(([a], [b]) => b.localeCompare(a))
                          .flatMap(([date, entries]) => 
                            entries.map((entry) => (
                              <div key={entry.id} className="flex items-center justify-between px-4 py-2 hover:bg-muted/50">
                                <div className="flex items-center gap-4">
                                  <div className="flex items-center gap-2 min-w-[100px]">
                                    <span className="text-sm">
                                      {format(new Date(entry.entry_date), 'd MMM', { locale: pl })}
                                    </span>
                                    {isWeekend(new Date(entry.entry_date)) && (
                                      <Badge variant="secondary" className="text-xs">weekend</Badge>
                                    )}
                                  </div>
                                  <span className="text-sm text-muted-foreground min-w-[120px]">
                                    {employee.name}
                                  </span>
                                  {entry.start_time && entry.end_time && (
                                    <span className="text-sm text-muted-foreground">
                                      {entry.start_time.slice(0, 5)} - {entry.end_time.slice(0, 5)}
                                    </span>
                                  )}
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className="font-medium">
                                    {formatMinutesToTime(entry.total_minutes)}
                                  </span>
                                  {isAdmin && (
                                    <>
                                      <Button 
                                        variant="ghost" 
                                        size="icon" 
                                        className="h-7 w-7"
                                        onClick={() => handleEditTimeEntry(entry)}
                                      >
                                        <Pencil className="w-3 h-3" />
                                      </Button>
                                      <Button 
                                        variant="ghost" 
                                        size="icon" 
                                        className="h-7 w-7 text-destructive hover:text-destructive"
                                        onClick={() => {
                                          setEntryToDelete(entry);
                                          setDeleteConfirmOpen(true);
                                        }}
                                      >
                                        <Trash2 className="w-3 h-3" />
                                      </Button>
                                    </>
                                  )}
                                </div>
                              </div>
                            ))
                          );
                      })}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </>
      )}

      {/* Dialogs */}
      <AddEditEmployeeDialog
        open={dialogOpen}
        onOpenChange={handleDialogClose}
        instanceId={instanceId}
        employee={editingEmployee}
        isAdmin={isAdmin}
      />

      {workerDialogEmployee && instanceId && (
        <WorkerTimeDialog
          open={!!workerDialogEmployee}
          onOpenChange={(open) => !open && setWorkerDialogEmployee(null)}
          employee={workerDialogEmployee}
          instanceId={instanceId}
        />
      )}

      <AddEditTimeEntryDialog
        open={timeEntryDialogOpen}
        onOpenChange={(open) => {
          setTimeEntryDialogOpen(open);
          if (!open) setEditingTimeEntry(null);
        }}
        instanceId={instanceId}
        employees={activeEmployees}
        entry={editingTimeEntry}
      />

      <AddEmployeeDayOffDialog
        open={dayOffDialogOpen}
        onOpenChange={setDayOffDialogOpen}
        instanceId={instanceId}
        employees={activeEmployees}
      />

      <ConfirmDialog
        open={deleteConfirmOpen}
        onOpenChange={setDeleteConfirmOpen}
        title="Usuń wpis"
        description="Czy na pewno chcesz usunąć ten wpis czasu pracy?"
        confirmLabel="Usuń"
        onConfirm={handleDeleteTimeEntry}
        variant="destructive"
      />
    </div>
  );
};

export default EmployeesView;