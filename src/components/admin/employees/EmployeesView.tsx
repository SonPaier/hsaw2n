import { useState, useMemo } from 'react';
import { useEmployees, Employee } from '@/hooks/useEmployees';
import { useTimeEntriesForMonth, useTimeEntriesForDateRange, calculateMonthlySummary, formatMinutesToTime } from '@/hooks/useTimeEntries';
import { useEmployeeDaysOff, DAY_OFF_TYPE_LABELS, DayOffType, EmployeeDayOff } from '@/hooks/useEmployeeDaysOff';
import { useWorkersSettings } from '@/hooks/useWorkersSettings';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Plus, ChevronLeft, ChevronRight, Loader2, User, Pencil, Clock, CalendarOff, Settings2 } from 'lucide-react';
import { format, parseISO, startOfMonth, endOfMonth, startOfWeek, endOfWeek, getISOWeek, addWeeks, subWeeks, isWithinInterval, eachDayOfInterval, isSameMonth, isSameWeek, getDay } from 'date-fns';
import { pl } from 'date-fns/locale';
import AddEditEmployeeDialog from './AddEditEmployeeDialog';
import WorkerTimeDialog from './WorkerTimeDialog';
import AddEmployeeDayOffDialog from './AddEmployeeDayOffDialog';
import WorkersSettingsDrawer from './WorkersSettingsDrawer';

interface EmployeesViewProps {
  instanceId: string | null;
}

const WEEKDAY_SHORT: Record<number, string> = {
  0: 'nd',
  1: 'pn',
  2: 'wt',
  3: 'śr',
  4: 'cz',
  5: 'pt',
  6: 'sb',
};

const EmployeesView = ({ instanceId }: EmployeesViewProps) => {
  const { hasRole } = useAuth();
  const isAdmin = hasRole('admin') || hasRole('super_admin');
  
  const [currentDate, setCurrentDate] = useState(new Date());
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [workerDialogEmployee, setWorkerDialogEmployee] = useState<Employee | null>(null);
  const [dayOffDialogOpen, setDayOffDialogOpen] = useState(false);
  const [settingsDrawerOpen, setSettingsDrawerOpen] = useState(false);

  // Fetch workers settings to determine if we're in weekly or monthly mode
  const { data: workersSettings, isLoading: loadingSettings } = useWorkersSettings(instanceId);
  const isWeeklyMode = workersSettings?.report_frequency === 'weekly';

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  
  // Month boundaries
  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  
  // Week boundaries (Monday to Sunday)
  const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(currentDate, { weekStartsOn: 1 });
  const weekNumber = getISOWeek(currentDate);
  
  // Date range for queries based on mode
  const dateFrom = isWeeklyMode ? format(weekStart, 'yyyy-MM-dd') : format(monthStart, 'yyyy-MM-dd');
  const dateTo = isWeeklyMode ? format(weekEnd, 'yyyy-MM-dd') : format(monthEnd, 'yyyy-MM-dd');
  
  // Period boundaries for days off calculation
  const periodStart = isWeeklyMode ? weekStart : monthStart;
  const periodEnd = isWeeklyMode ? weekEnd : monthEnd;

  const { data: employees = [], isLoading: loadingEmployees } = useEmployees(instanceId);
  const { data: timeEntries = [], isLoading: loadingEntries } = useTimeEntriesForDateRange(instanceId, dateFrom, dateTo);
  const { data: daysOff = [], isLoading: loadingDaysOff } = useEmployeeDaysOff(instanceId, null);

  // Filter only active (not soft-deleted) employees
  const activeEmployees = employees.filter(e => e.active && !(e as any).deleted_at);

  // Calculate period totals (works for both weekly and monthly)
  const periodSummary = useMemo(() => calculateMonthlySummary(timeEntries), [timeEntries]);

  // Calculate total earnings (admin only)
  const totalEarnings = useMemo(() => {
    return activeEmployees.reduce((sum, employee) => {
      const summary = periodSummary.get(employee.id);
      if (summary && employee.hourly_rate) {
        return sum + (summary.total_minutes / 60) * employee.hourly_rate;
      }
      return sum;
    }, 0);
  }, [activeEmployees, periodSummary]);

  // Get days off for this period
  const getDaysOffForEmployee = (employeeId: string) => {
    return daysOff.filter(d => {
      if (d.employee_id !== employeeId) return false;
      const from = parseISO(d.date_from);
      const to = parseISO(d.date_to);
      // Check if any day in the range overlaps with current period
      return isWithinInterval(periodStart, { start: from, end: to }) ||
             isWithinInterval(periodEnd, { start: from, end: to }) ||
             (from <= periodStart && to >= periodEnd);
    });
  };

  // Format days off for display on the card
  const formatDaysOffForPeriod = (employeeDaysOff: EmployeeDayOff[]) => {
    const result: { type: DayOffType; label: string; dates: string }[] = [];
    
    // Group by type
    const byType = new Map<DayOffType, EmployeeDayOff[]>();
    employeeDaysOff.forEach(d => {
      const type = d.day_off_type as DayOffType;
      if (!byType.has(type)) byType.set(type, []);
      byType.get(type)!.push(d);
    });

    byType.forEach((items, type) => {
      const allDates: { date: Date; dayOfWeek: number }[] = [];
      
      items.forEach(item => {
        const from = parseISO(item.date_from);
        const to = parseISO(item.date_to);
        
        // Get all days in the range that fall within the current period
        const daysInRange = eachDayOfInterval({ start: from, end: to });
        daysInRange.forEach(day => {
          const isInPeriod = isWeeklyMode 
            ? isSameWeek(day, currentDate, { weekStartsOn: 1 })
            : isSameMonth(day, currentDate);
          if (isInPeriod) {
            allDates.push({ date: day, dayOfWeek: getDay(day) });
          }
        });
      });

      // Sort by date
      allDates.sort((a, b) => a.date.getTime() - b.date.getTime());

      if (allDates.length === 0) return;

      // Format dates - group consecutive ranges
      const formattedParts: string[] = [];
      let rangeStart: Date | null = null;
      let rangeEnd: Date | null = null;

      allDates.forEach((item, idx) => {
        const prevItem = allDates[idx - 1];
        const isConsecutive = prevItem && 
          (item.date.getTime() - prevItem.date.getTime()) === 24 * 60 * 60 * 1000;

        if (isConsecutive && rangeStart) {
          rangeEnd = item.date;
        } else {
          // Close previous range
          if (rangeStart) {
            if (rangeEnd) {
              formattedParts.push(`${format(rangeStart, 'd')}-${format(rangeEnd, 'd.MM')}`);
            } else {
              const wd = WEEKDAY_SHORT[getDay(rangeStart)];
              formattedParts.push(`${format(rangeStart, 'd.MM')} (${wd})`);
            }
          }
          rangeStart = item.date;
          rangeEnd = null;
        }
      });

      // Close last range
      if (rangeStart) {
        if (rangeEnd) {
          formattedParts.push(`${format(rangeStart, 'd')}-${format(rangeEnd, 'd.MM')}`);
        } else {
          const wd = WEEKDAY_SHORT[getDay(rangeStart)];
          formattedParts.push(`${format(rangeStart, 'd.MM')} (${wd})`);
        }
      }

      const label = DAY_OFF_TYPE_LABELS[type]?.split(' ')[0] || 'Wolne';
      result.push({
        type,
        label,
        dates: formattedParts.join(', ')
      });
    });

    return result;
  };

  const handlePrevPeriod = () => {
    if (isWeeklyMode) {
      setCurrentDate(subWeeks(currentDate, 1));
    } else {
      setCurrentDate(new Date(year, month - 1, 1));
    }
  };

  const handleNextPeriod = () => {
    if (isWeeklyMode) {
      setCurrentDate(addWeeks(currentDate, 1));
    } else {
      setCurrentDate(new Date(year, month + 1, 1));
    }
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

  // Format week range display: "Tydzień 5 (27.01 - 02.02)"
  const formatWeekDisplay = () => {
    const startFormatted = format(weekStart, 'd.MM');
    const endFormatted = format(weekEnd, 'd.MM');
    return `Tydzień ${weekNumber} (${startFormatted} - ${endFormatted})`;
  };

  const isLoading = loadingEmployees || loadingEntries || loadingDaysOff || loadingSettings;

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
            <Button 
              onClick={() => setSettingsDrawerOpen(true)} 
              variant="ghost" 
              size="icon"
              title="Ustawienia czasu pracy"
            >
              <Settings2 className="w-5 h-5" />
            </Button>
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

      {/* Period picker (Month or Week) */}
      <div className="flex items-center justify-center gap-2">
        <Button variant="outline" size="icon" onClick={handlePrevPeriod}>
          <ChevronLeft className="w-4 h-4" />
        </Button>
        <span className="font-medium min-w-[200px] text-center text-lg">
          {isWeeklyMode 
            ? formatWeekDisplay()
            : format(currentDate, 'LLLL yyyy', { locale: pl })
          }
        </span>
        <Button variant="outline" size="icon" onClick={handleNextPeriod}>
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
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {activeEmployees.map((employee) => {
              const summary = periodSummary.get(employee.id);
              const totalHours = summary ? formatMinutesToTime(summary.total_minutes) : '0h 0min';
              const earnings = summary && employee.hourly_rate 
                ? ((summary.total_minutes / 60) * employee.hourly_rate).toFixed(2)
                : null;
              const employeeDaysOff = getDaysOffForEmployee(employee.id);
              const formattedDaysOff = formatDaysOffForPeriod(employeeDaysOff);
              
              return (
                <Card 
                  key={employee.id} 
                  className="cursor-pointer hover:bg-accent/50 transition-colors"
                  onClick={() => handleTileClick(employee)}
                >
                  <CardContent className="p-4 relative">
                    {/* Edit pencil in top-right corner */}
                    {isAdmin && (
                      <button
                        onClick={(e) => handleEditEmployee(e, employee)}
                        className="absolute top-3 right-3 p-1.5 rounded hover:bg-muted"
                      >
                        <Pencil className="w-5 h-5 text-muted-foreground" />
                      </button>
                    )}
                    
                    <div className="flex items-start gap-3 pr-8">
                      <Avatar className="h-12 w-12">
                        <AvatarImage src={employee.photo_url || undefined} alt={employee.name} />
                        <AvatarFallback className="bg-primary/10 text-primary">
                          {employee.name.slice(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      
                      <div className="flex-1 min-w-0">
                        <span className="font-medium truncate block">{employee.name}</span>
                        
                        {/* Hours summary */}
                        <div className="flex items-center gap-1 mt-1 text-sm">
                          <Clock className="w-3.5 h-3.5 text-muted-foreground" />
                          <span className="font-semibold">{totalHours}</span>
                          {earnings && isAdmin && (
                            <span className="text-muted-foreground">• {earnings} zł</span>
                          )}
                        </div>
                        
                        {/* Days off - detailed dates */}
                        {formattedDaysOff.length > 0 && (
                          <div className="mt-2 space-y-0.5">
                            {formattedDaysOff.map((item, idx) => (
                              <div key={idx} className="text-xs text-muted-foreground">
                                <span className="font-medium">{item.label}:</span> {item.dates}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Total earnings - admin only */}
          {isAdmin && totalEarnings > 0 && (
            <div className="pt-4 border-t mt-4">
              <div className="text-lg font-medium">
                Suma wypłat: {totalEarnings.toLocaleString('pl-PL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} zł
              </div>
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

      <AddEmployeeDayOffDialog
        open={dayOffDialogOpen}
        onOpenChange={setDayOffDialogOpen}
        instanceId={instanceId}
        employees={activeEmployees}
      />

      <WorkersSettingsDrawer
        open={settingsDrawerOpen}
        onOpenChange={setSettingsDrawerOpen}
        instanceId={instanceId}
      />
    </div>
  );
};

export default EmployeesView;
