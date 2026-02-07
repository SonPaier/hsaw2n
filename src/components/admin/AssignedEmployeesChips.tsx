import { X, Plus, User } from 'lucide-react';
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
}

export function AssignedEmployeesChips({
  employeeIds,
  employees,
  onRemove,
  onAdd,
  readonly = false,
  variant = 'default',
  maxVisible,
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

  const chipBaseClasses = 'inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium transition-colors';
  
  const variantClasses = {
    default: readonly 
      ? 'bg-slate-200 text-slate-700'
      : 'bg-slate-700 text-white',
    blue: 'bg-blue-500 text-white',
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
              className="ml-0.5 hover:opacity-70"
            >
              <X className="w-3 h-3" />
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
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-muted hover:bg-muted/80 text-muted-foreground transition-colors"
        >
          <Plus className="w-3 h-3" />
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
