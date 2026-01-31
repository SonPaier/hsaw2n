import { useState } from 'react';
import { useEmployees, Employee } from '@/hooks/useEmployees';
import { useTimeEntries } from '@/hooks/useTimeEntries';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Plus, Pencil, User, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import AddEditEmployeeDialog from './AddEditEmployeeDialog';
import WorkerTimeDialog from './WorkerTimeDialog';

interface EmployeesListProps {
  instanceId: string | null;
  centered?: boolean; // For Hall view - center content
}

const EmployeesList = ({ instanceId, centered = false }: EmployeesListProps) => {
  const { hasRole } = useAuth();
  const isAdmin = hasRole('admin') || hasRole('super_admin');
  const isHall = hasRole('hall');
  const canAddEmployee = isAdmin || isHall;
  
  const { data: employees = [], isLoading } = useEmployees(instanceId);
  
  // Get today's time entries to show working status
  const today = format(new Date(), 'yyyy-MM-dd');
  const { data: timeEntries = [] } = useTimeEntries(instanceId, undefined, today, today);
  
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [workerDialogEmployee, setWorkerDialogEmployee] = useState<Employee | null>(null);

  // Filter only active (not soft-deleted) employees
  const activeEmployees = employees.filter(e => e.active && !(e as any).deleted_at);

  const handleEdit = (e: React.MouseEvent, employee: Employee) => {
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

  // Check if employee is currently working (has active time entry)
  const isEmployeeWorking = (employeeId: string) => {
    return timeEntries.some(
      (e) => e.employee_id === employeeId && !e.end_time
    );
  };

  // Get start time of active work session
  const getWorkingFromTime = (employeeId: string) => {
    const activeEntry = timeEntries.find(
      (e) => e.employee_id === employeeId && !e.end_time
    );
    return activeEntry?.start_time?.slice(0, 5);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className={`space-y-4 ${centered ? 'h-full flex flex-col' : ''}`}>
      {!centered && (
        <div className="flex justify-between items-center">
          <h2 className="text-lg font-semibold">Lista pracowników</h2>
          {canAddEmployee && (
            <Button onClick={() => setDialogOpen(true)} size="sm">
              <Plus className="w-4 h-4 mr-1" />
              Dodaj pracownika
            </Button>
          )}
        </div>
      )}

      {centered && canAddEmployee && (
        <div className="flex justify-center mb-4">
          <Button onClick={() => setDialogOpen(true)} size="sm">
            <Plus className="w-4 h-4 mr-1" />
            Dodaj pracownika
          </Button>
        </div>
      )}

      {activeEmployees.length === 0 ? (
        <div className={`py-12 text-center ${centered ? 'flex-1 flex flex-col items-center justify-center' : ''}`}>
          <User className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" />
          <p className="text-muted-foreground">Brak pracowników</p>
          <p className="text-sm text-muted-foreground mt-1">
            Dodaj pierwszego pracownika, aby rozpocząć rejestrację czasu pracy
          </p>
          {canAddEmployee && (
            <Button onClick={() => setDialogOpen(true)} className="mt-4">
              <Plus className="w-4 h-4 mr-1" />
              Dodaj pracownika
            </Button>
          )}
        </div>
      ) : (
        <div className={`${centered ? 'flex-1 flex items-center justify-center px-10' : ''}`}>
          <div className={`grid gap-6 ${centered ? 'grid-cols-3 w-full max-w-2xl' : 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5'}`}>
            {activeEmployees.map((employee) => {
              const isWorking = isEmployeeWorking(employee.id);
              const workingFrom = getWorkingFromTime(employee.id);
              
              return (
                <div
                  key={employee.id}
                  onClick={() => handleTileClick(employee)}
                  className={`relative flex flex-col items-center rounded-lg border bg-card cursor-pointer hover:bg-accent/50 transition-colors ${centered ? 'p-6' : 'p-4'}`}
                >
                  {/* Working status indicator */}
                  <div
                    className={`absolute top-2 right-2 rounded-full ${
                      isWorking ? 'bg-green-500' : 'bg-muted'
                    } ${centered ? 'w-4 h-4' : 'w-3 h-3'}`}
                  />
                  
                  <Avatar className={centered ? 'h-28 w-28 mb-4' : 'h-20 w-20 mb-3'}>
                    <AvatarImage src={employee.photo_url || undefined} alt={employee.name} />
                    <AvatarFallback className={`bg-primary/10 text-primary ${centered ? 'text-3xl' : 'text-xl'}`}>
                      {employee.name.slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  
                  <div className="flex items-center gap-1">
                    <span className={`font-medium text-center truncate ${centered ? 'text-base max-w-[140px]' : 'text-sm max-w-[120px]'}`}>
                      {employee.name}
                    </span>
                    {isAdmin && (
                      <button
                        onClick={(e) => handleEdit(e, employee)}
                        className="p-1 rounded hover:bg-muted"
                      >
                        <Pencil className="w-3.5 h-3.5 text-muted-foreground" />
                      </button>
                    )}
                  </div>

                  {/* Working from time label */}
                  {isWorking && workingFrom && (
                    <span className="text-xs text-primary mt-1">
                      W pracy od {workingFrom}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

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
    </div>
  );
};

export default EmployeesList;
