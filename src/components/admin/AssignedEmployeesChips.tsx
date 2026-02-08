import { X, Plus, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Employee } from '@/hooks/useEmployees';

interface AssignedEmployeesChipsProps {
  employeeIds: string[];
  employees: Employee[];
  onRemove?: (id: string) => void;
  onAdd?: () => void;
  readonly?: boolean;
  variant?: 'default' | 'blue';
  maxVisible?: number;
  loading?: boolean;
}

export function AssignedEmployeesChips({
  employeeIds,
  employees,
  onRemove,
  onAdd,
  readonly = false,
  variant = 'default',
  maxVisible,
  loading = false,
}: AssignedEmployeesChipsProps) {
  // Build a map for quick lookups
  const employeeMap = new Map(employees.map(e => [e.id, e]));
  
  // Get employee names with fallback for deleted employees
  const resolvedEmployees = employeeIds.map(id => {
    const employee = employeeMap.get(id);
    return {
      id,
      name: employee?.name || 'Usunięty',
      shortName: employee ? getShortName(employee.name) : '?',
    };
  });

  // Limit visible items if maxVisible is set
  const visibleEmployees = maxVisible 
    ? resolvedEmployees.slice(0, maxVisible)
    : resolvedEmployees;
  const hiddenCount = maxVisible 
    ? Math.max(0, resolvedEmployees.length - maxVisible)
    : 0;

  if (employeeIds.length === 0 && readonly) {
    return null;
  }

  const chipBaseClasses =
    'inline-flex items-center gap-1.5 px-3 py-1 rounded-md text-sm font-medium transition-colors leading-none';

  const variantClasses = {
    default: readonly
      ? 'bg-muted text-muted-foreground'
      : 'bg-foreground text-background',
    blue: 'bg-primary text-primary-foreground',
  };

  return (
    <div className="flex flex-wrap gap-1.5 items-center">
      {visibleEmployees.map(({ id, shortName }) => (
        <span
          key={id}
          className={cn(chipBaseClasses, variantClasses[variant])}
        >
          {shortName}
          {!readonly && onRemove && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onRemove(id);
              }}
              className="ml-1 hover:opacity-70"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </span>
      ))}

      {hiddenCount > 0 && (
        <span className={cn(chipBaseClasses, variantClasses[variant])}>
          +{hiddenCount}
        </span>
      )}

      {!readonly && onAdd && (
        <button
          type="button"
          onClick={onAdd}
          disabled={loading}
          className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md text-sm font-medium bg-muted hover:bg-muted/80 text-muted-foreground transition-colors disabled:opacity-50"
        >
          {loading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Plus className="w-4 h-4" />
          )}
          Dodaj
        </button>
      )}
    </div>
  );
}

function getShortName(fullName: string): string {
  const parts = fullName.trim().split(/\s+/);
  if (parts.length === 1) {
    return parts[0].slice(0, 8);
  }
  // First name + last name initial
  const firstName = parts[0];
  const lastInitial = parts[parts.length - 1][0];
  return `${firstName} ${lastInitial}.`;
}
