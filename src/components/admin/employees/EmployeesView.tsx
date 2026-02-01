import { useState, useMemo } from 'react';
import { useEmployees, Employee } from '@/hooks/useEmployees';
import { useTimeEntriesForMonth, useTimeEntriesForDateRange, calculateMonthlySummary, formatMinutesToTime, TimeEntry } from '@/hooks/useTimeEntries';
import { useEmployeeDaysOff, DAY_OFF_TYPE_LABELS, DayOffType, EmployeeDayOff } from '@/hooks/useEmployeeDaysOff';
import { useWorkersSettings } from '@/hooks/useWorkersSettings';
import { useWorkingHours } from '@/hooks/useWorkingHours';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell, TableFooter } from '@/components/ui/table';
import { Plus, ChevronLeft, ChevronRight, Loader2, User, Pencil, CalendarOff, Settings2 } from 'lucide-react';
import { format, parseISO, startOfMonth, endOfMonth, startOfWeek, endOfWeek, getISOWeek, addWeeks, subWeeks, isWithinInterval, eachDayOfInterval, isSameMonth, isSameWeek, getDay } from 'date-fns';
import { pl } from 'date-fns/locale';
import AddEditEmployeeDialog from './AddEditEmployeeDialog';
import WorkerTimeDialog from './WorkerTimeDialog';
import AddEmployeeDayOffDialog from './AddEmployeeDayOffDialog';
import WorkersSettingsDrawer from './WorkersSettingsDrawer';

// Weekday index to working_hours key map (0=Sunday, 1=Monday, etc)
const WEEKDAY_TO_KEY: Record<number, string> = {
  0: 'sunday',
  1: 'monday',
  2: 'tuesday',
  3: 'wednesday',
  4: 'thursday',
  5: 'friday',
  6: 'saturday',
};

interface EmployeesViewProps {
  instanceId: string | null;
}

const WEEKDAY_SHORT: Record<number, string> = {
  0: 'ND',
  1: 'PN',
  2: 'WT',
  3: 'ŚR',
  4: 'CZ',
  5: 'PT',
  6: 'SB',
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
  const { data: workingHours } = useWorkingHours(instanceId);

  // Helper to get opening time for a given date
  const getOpeningTime = (dateStr: string): Date | null => {
    if (!workingHours) return null;
    // Use ISO format with time to avoid timezone issues
    const date = new Date(dateStr + 'T12:00:00'); // Use noon so getDay() works correctly
    const dayOfWeek = getDay(date);
    const dayKey = WEEKDAY_TO_KEY[dayOfWeek];
    const dayHours = workingHours[dayKey];
    if (!dayHours || !dayHours.open) return null;
    
    const [hours, minutes] = dayHours.open.split(':').map(Number);
    // Create opening date in local time
    const openingDate = new Date(dateStr + 'T00:00:00');
    openingDate.setHours(hours, minutes, 0, 0);
    return openingDate;
  };

  // Calculate pre-opening minutes for entries on a given date
  const calculatePreOpeningMinutes = (entries: TimeEntry[], dateStr: string): number => {
    const openingTime = getOpeningTime(dateStr);
    if (!openingTime) return 0;
    
    let preOpeningMinutes = 0;
    entries.forEach(entry => {
      if (!entry.start_time) return;
      const startTime = new Date(entry.start_time);
      if (startTime < openingTime) {
        const endTime = entry.end_time ? new Date(entry.end_time) : new Date();
        const effectiveEnd = endTime < openingTime ? endTime : openingTime;
        const diffMs = effectiveEnd.getTime() - startTime.getTime();
        preOpeningMinutes += Math.max(0, Math.floor(diffMs / 60000));
      }
    });
    return preOpeningMinutes;
  };

  // Calculate pre-opening time per employee for the period
  const preOpeningByEmployee = useMemo(() => {
    const result = new Map<string, number>();
    
    // Group entries by employee and date
    const entriesByEmployeeDate = new Map<string, Map<string, TimeEntry[]>>();
    timeEntries.forEach(entry => {
      if (!entriesByEmployeeDate.has(entry.employee_id)) {
        entriesByEmployeeDate.set(entry.employee_id, new Map());
      }
      const dateMap = entriesByEmployeeDate.get(entry.employee_id)!;
      if (!dateMap.has(entry.entry_date)) {
        dateMap.set(entry.entry_date, []);
      }
      dateMap.get(entry.entry_date)!.push(entry);
    });
    
    entriesByEmployeeDate.forEach((dateMap, employeeId) => {
      let totalPreOpening = 0;
      dateMap.forEach((entries, dateStr) => {
        totalPreOpening += calculatePreOpeningMinutes(entries, dateStr);
      });
      result.set(employeeId, totalPreOpening);
    });
    
    return result;
  }, [timeEntries, workingHours]);

  // Filter only active (not soft-deleted) employees
  const activeEmployees = employees.filter(e => e.active && !(e as any).deleted_at);

  // Calculate period totals (works for both weekly and monthly)
  const periodSummary = useMemo(() => calculateMonthlySummary(timeEntries), [timeEntries]);

  // Time calculation mode from settings (default: start_to_stop)
  const timeCalculationMode = workersSettings?.time_calculation_mode ?? 'start_to_stop';

  // Calculate total earnings (admin only) - based on time calculation mode
  const totalEarnings = useMemo(() => {
    return activeEmployees.reduce((sum, employee) => {
      const summary = periodSummary.get(employee.id);
      if (summary && employee.hourly_rate) {
        const preOpeningMinutes = preOpeningByEmployee.get(employee.id) || 0;
        // If mode is opening_to_stop and we have pre-opening time, use real time
        // Edge case: if preOpeningMinutes is 0 in opening_to_stop mode, it might be because
        // there were no opening hours defined - in that case, use total time
        const displayMinutes = timeCalculationMode === 'opening_to_stop'
          ? Math.max(0, summary.total_minutes - preOpeningMinutes)
          : summary.total_minutes;
        return sum + (displayMinutes / 60) * employee.hourly_rate;
      }
      return sum;
    }, 0);
  }, [activeEmployees, periodSummary, preOpeningByEmployee, timeCalculationMode]);

  // Get days off for this period
  const getDaysOffForEmployee = (employeeId: string) => {
    return daysOff.filter(d => {
      if (d.employee_id !== employeeId) return false;
      const from = parseISO(d.date_from);
      const to = parseISO(d.date_to);
      // Check if the day off range overlaps with the current period
      // Overlap exists if: dayOff.from <= periodEnd AND dayOff.to >= periodStart
      return from <= periodEnd && to >= periodStart;
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

  // Format days off as array of objects with from/to dates for display
  type DayOffLine = { from: string; to: string | null };
  
  const formatDaysOffForPeriodLines = (employeeDaysOff: EmployeeDayOff[]): DayOffLine[] => {
    const allDates: Date[] = [];
    
    employeeDaysOff.forEach(item => {
      const from = parseISO(item.date_from);
      const to = parseISO(item.date_to);
      const daysInRange = eachDayOfInterval({ start: from, end: to });
      daysInRange.forEach(day => {
        const isInPeriod = isWeeklyMode 
          ? isSameWeek(day, currentDate, { weekStartsOn: 1 })
          : isSameMonth(day, currentDate);
        if (isInPeriod) {
          allDates.push(day);
        }
      });
    });

    if (allDates.length === 0) return [];

    // Sort and deduplicate
    allDates.sort((a, b) => a.getTime() - b.getTime());
    const uniqueDates = allDates.filter((d, i, arr) => 
      i === 0 || d.getTime() !== arr[i-1].getTime()
    );

    // Group consecutive dates into ranges - each range is separate line
    const lines: DayOffLine[] = [];
    let rangeStart: Date | null = null;
    let rangeEnd: Date | null = null;

    const formatDateWithDay = (date: Date) => {
      const dayNum = format(date, 'd');
      const monthName = format(date, 'LLLL', { locale: pl });
      const weekday = WEEKDAY_SHORT[getDay(date)];
      return `${dayNum} ${monthName} (${weekday})`;
    };

    uniqueDates.forEach((date, idx) => {
      const prevDate = uniqueDates[idx - 1];
      const isConsecutive = prevDate && 
        (date.getTime() - prevDate.getTime()) === 24 * 60 * 60 * 1000;

      if (isConsecutive && rangeStart) {
        rangeEnd = date;
      } else {
        if (rangeStart) {
          lines.push({
            from: formatDateWithDay(rangeStart),
            to: rangeEnd ? formatDateWithDay(rangeEnd) : null
          });
        }
        rangeStart = date;
        rangeEnd = null;
      }
    });

    // Close last range
    if (rangeStart) {
      lines.push({
        from: formatDateWithDay(rangeStart),
        to: rangeEnd ? formatDateWithDay(rangeEnd) : null
      });
    }

    return lines;
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
    // Also close worker time dialog when edit dialog closes
    setWorkerDialogEmployee(null);
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
    <div className="space-y-6 pb-24">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h1 className="text-2xl font-bold">Pracownicy i czas pracy</h1>
        {isAdmin && (
          <div className="flex gap-2">
            <Button 
              onClick={() => setSettingsDrawerOpen(true)} 
              variant="outline" 
              size="icon"
              className="bg-white h-10 w-10"
              title="Ustawienia czasu pracy"
            >
              <Settings2 className="w-5 h-5" />
            </Button>
            <Button 
              onClick={() => setDayOffDialogOpen(true)} 
              variant="outline" 
              size="icon"
              className="bg-white h-10 w-10"
              title="Dodaj nieobecność"
            >
              <CalendarOff className="w-5 h-5" />
            </Button>
            <Button 
              onClick={handleAddEmployee} 
              size="icon"
              className="h-10 w-10"
              title="Dodaj pracownika"
            >
              <Plus className="w-5 h-5" />
            </Button>
          </div>
        )}
      </div>

      {/* Period picker (Month or Week) */}
      <div className="flex items-center justify-center gap-2">
        <Button variant="outline" size="icon" onClick={handlePrevPeriod} className="bg-white">
          <ChevronLeft className="w-4 h-4" />
        </Button>
        <span className="font-medium min-w-[200px] text-center text-lg">
          {isWeeklyMode 
            ? formatWeekDisplay()
            : format(currentDate, 'LLLL yyyy', { locale: pl })
          }
        </span>
        <Button variant="outline" size="icon" onClick={handleNextPeriod} className="bg-white">
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
          {/* Table layout */}
          <div className="overflow-hidden rounded-lg max-w-full">
            <Table className="bg-white w-full" style={{ tableLayout: 'fixed' }}>
              <TableBody>
                {activeEmployees.map((employee) => {
                  const summary = periodSummary.get(employee.id);
                  const totalMinutes = summary?.total_minutes || 0;
                  const preOpeningMinutes = preOpeningByEmployee.get(employee.id) || 0;
                  
                  // Calculate display minutes based on time calculation mode
                  const displayMinutes = timeCalculationMode === 'opening_to_stop'
                    ? Math.max(0, totalMinutes - preOpeningMinutes)
                    : totalMinutes;
                  
                  const displayHours = formatMinutesToTime(displayMinutes);
                  
                  // Earnings based on display time
                  const earnings = employee.hourly_rate 
                    ? ((displayMinutes / 60) * employee.hourly_rate).toFixed(2)
                    : null;
                  
                  const hours = Math.floor(displayMinutes / 60);
                  const mins = displayMinutes % 60;
                  
                  return (
                    <TableRow 
                      key={employee.id} 
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => handleTileClick(employee)}
                    >
                      <TableCell className="py-3" style={{ width: '47%' }}>
                        <div className="flex items-center gap-2 min-w-0">
                          <Avatar className="h-8 w-8 flex-shrink-0">
                            <AvatarImage src={employee.photo_url || undefined} alt={employee.name} />
                            <AvatarFallback className="bg-primary/10 text-primary text-sm">
                              {employee.name.slice(0, 2).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <span className="font-medium truncate">{employee.name}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-center py-3" style={{ width: '23%' }}>
                        <div className="text-sm leading-tight">
                          {hours > 0 && <div>{hours}h</div>}
                          <div>{mins}min</div>
                        </div>
                      </TableCell>
                      <TableCell className="text-right py-3 whitespace-nowrap font-medium" style={{ width: '30%' }}>
                        {earnings ? `${earnings} zł` : '-'}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
              {isAdmin && totalEarnings > 0 && (
                <TableFooter className="bg-white">
                  <TableRow>
                    <TableCell colSpan={2} className="py-3 text-right text-xs text-muted-foreground">
                      Suma wypłat {isWeeklyMode ? 'tydzień' : format(currentDate, 'LLLL', { locale: pl })}:
                    </TableCell>
                    <TableCell className="text-right py-3 font-bold whitespace-nowrap" style={{ width: '30%' }}>
                      {totalEarnings.toLocaleString('pl-PL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} zł
                    </TableCell>
                  </TableRow>
                </TableFooter>
              )}
            </Table>
          </div>

          {/* Vacations/Days off section */}
          {(() => {
            // Collect all employees with days off in this period
            const employeesWithDaysOff = activeEmployees
              .map(emp => ({
                employee: emp,
                daysOffLines: formatDaysOffForPeriodLines(getDaysOffForEmployee(emp.id)),
              }))
              .filter(item => item.daysOffLines.length > 0);

            if (employeesWithDaysOff.length === 0) return null;

            return (
              <div className="mt-6 space-y-3">
                <h3 className="font-medium text-muted-foreground">Nieobecności</h3>
                <div className="space-y-2">
                  {employeesWithDaysOff.map(({ employee, daysOffLines }) => (
                    <div key={employee.id} className="flex items-start gap-3 p-3 border rounded-lg bg-card">
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={employee.photo_url || undefined} alt={employee.name} />
                        <AvatarFallback className="bg-primary/10 text-primary text-sm">
                          {employee.name.slice(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium mb-1">{employee.name}</div>
                        <div className="text-sm space-y-1.5">
                          {daysOffLines.map((line, idx) => (
                            <div key={idx}>
                              {line.to ? (
                                <>
                                  <span className="text-muted-foreground">od </span>
                                  <span className="font-medium text-foreground">{line.from}</span>
                                  <span className="text-muted-foreground"> do </span>
                                  <span className="font-medium text-foreground">{line.to}</span>
                                </>
                              ) : (
                                <span className="font-medium text-foreground">{line.from}</span>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}
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
          showEditButton={isAdmin}
          onEditEmployee={() => {
            setEditingEmployee(workerDialogEmployee);
            setDialogOpen(true);
          }}
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
