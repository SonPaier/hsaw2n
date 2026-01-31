import { useState } from 'react';
import { useEmployees, useDeleteEmployee, Employee } from '@/hooks/useEmployees';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Plus, Pencil, Trash2, User, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import AddEditEmployeeDialog from './AddEditEmployeeDialog';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';

interface EmployeesListProps {
  instanceId: string | null;
}

const EmployeesList = ({ instanceId }: EmployeesListProps) => {
  const { data: employees = [], isLoading } = useEmployees(instanceId);
  const deleteEmployee = useDeleteEmployee(instanceId);
  
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [employeeToDelete, setEmployeeToDelete] = useState<Employee | null>(null);

  const handleEdit = (employee: Employee) => {
    setEditingEmployee(employee);
    setDialogOpen(true);
  };

  const handleDelete = async () => {
    if (!employeeToDelete) return;
    
    try {
      await deleteEmployee.mutateAsync(employeeToDelete.id);
      toast.success('Pracownik został usunięty');
      setDeleteConfirmOpen(false);
      setEmployeeToDelete(null);
    } catch (error) {
      toast.error('Błąd podczas usuwania pracownika');
    }
  };

  const handleDialogClose = () => {
    setDialogOpen(false);
    setEditingEmployee(null);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-semibold">Lista pracowników</h2>
        <Button onClick={() => setDialogOpen(true)} size="sm">
          <Plus className="w-4 h-4 mr-1" />
          Dodaj pracownika
        </Button>
      </div>

      {employees.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <User className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" />
            <p className="text-muted-foreground">Brak pracowników</p>
            <p className="text-sm text-muted-foreground mt-1">
              Dodaj pierwszego pracownika, aby rozpocząć rejestrację czasu pracy
            </p>
            <Button onClick={() => setDialogOpen(true)} className="mt-4">
              <Plus className="w-4 h-4 mr-1" />
              Dodaj pracownika
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {employees.map((employee) => (
            <Card key={employee.id} className="relative group">
              <CardHeader className="pb-2">
                <div className="flex items-start gap-3">
                  <Avatar className="h-12 w-12">
                    <AvatarImage src={employee.photo_url || undefined} alt={employee.name} />
                    <AvatarFallback className="bg-primary/10 text-primary">
                      {employee.name.slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <CardTitle className="text-base truncate">{employee.name}</CardTitle>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant={employee.active ? 'default' : 'secondary'}>
                        {employee.active ? 'Aktywny' : 'Nieaktywny'}
                      </Badge>
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-2">
                {employee.hourly_rate && (
                  <p className="text-sm text-muted-foreground">
                    Stawka: <span className="font-medium">{employee.hourly_rate} zł/h</span>
                  </p>
                )}
                <div className="flex gap-2 mt-3 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleEdit(employee)}
                  >
                    <Pencil className="w-3.5 h-3.5 mr-1" />
                    Edytuj
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setEmployeeToDelete(employee);
                      setDeleteConfirmOpen(true);
                    }}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <AddEditEmployeeDialog
        open={dialogOpen}
        onOpenChange={handleDialogClose}
        instanceId={instanceId}
        employee={editingEmployee}
      />

      <ConfirmDialog
        open={deleteConfirmOpen}
        onOpenChange={setDeleteConfirmOpen}
        title="Usuń pracownika"
        description={`Czy na pewno chcesz usunąć pracownika "${employeeToDelete?.name}"? Ta operacja jest nieodwracalna.`}
        confirmLabel="Usuń"
        onConfirm={handleDelete}
        variant="destructive"
      />
    </div>
  );
};

export default EmployeesList;
