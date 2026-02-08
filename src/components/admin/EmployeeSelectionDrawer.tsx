import { useState, useMemo } from 'react';
import { Search, X, User, Check } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useEmployees, Employee } from '@/hooks/useEmployees';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';

interface EmployeeSelectionDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  instanceId: string;
  selectedEmployeeIds: string[];
  onSelect: (employeeIds: string[]) => void;
}

export function EmployeeSelectionDrawer({
  open,
  onOpenChange,
  instanceId,
  selectedEmployeeIds,
  onSelect,
}: EmployeeSelectionDrawerProps) {
  const { t } = useTranslation();
  const { data: employees = [], isLoading } = useEmployees(instanceId);
  const [searchQuery, setSearchQuery] = useState('');
  const [localSelectedIds, setLocalSelectedIds] = useState<string[]>(selectedEmployeeIds);

  // Reset local state when drawer opens
  useMemo(() => {
    if (open) {
      setLocalSelectedIds(selectedEmployeeIds);
      setSearchQuery('');
    }
  }, [open, selectedEmployeeIds]);

  // Filter only active employees
  const activeEmployees = useMemo(() => 
    employees.filter(e => e.active !== false),
    [employees]
  );

  // Filter by search query
  const filteredEmployees = useMemo(() => {
    if (!searchQuery.trim()) return activeEmployees;
    const query = searchQuery.toLowerCase();
    return activeEmployees.filter(e => 
      e.name.toLowerCase().includes(query)
    );
  }, [activeEmployees, searchQuery]);

  const toggleEmployee = (employeeId: string) => {
    setLocalSelectedIds(prev => 
      prev.includes(employeeId)
        ? prev.filter(id => id !== employeeId)
        : [...prev, employeeId]
    );
  };

  const handleConfirm = () => {
    onSelect(localSelectedIds);
    onOpenChange(false);
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(word => word[0])
      .slice(0, 2)
      .join('')
      .toUpperCase();
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md p-0 flex flex-col">
        <SheetHeader className="p-4 pb-2 border-b shrink-0">
          <SheetTitle className="flex items-center gap-2">
            <User className="w-5 h-5" />
            Wybierz pracowników
          </SheetTitle>
        </SheetHeader>

        {/* Search */}
        <div className="p-4 pb-2 shrink-0">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Szukaj pracownika..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 pr-9"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2"
              >
                <X className="w-4 h-4 text-muted-foreground" />
              </button>
            )}
          </div>
        </div>

        {/* Employee list */}
        <ScrollArea className="flex-1 px-4">
          {isLoading ? (
            <div className="py-8 text-center text-muted-foreground">
              Ładowanie...
            </div>
          ) : filteredEmployees.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">
              {searchQuery 
                ? 'Brak wyników wyszukiwania'
                : 'Brak aktywnych pracowników'
              }
            </div>
          ) : (
            <div className="py-2">
              {filteredEmployees.map((employee) => {
                const isSelected = localSelectedIds.includes(employee.id);
                return (
                  <button
                    key={employee.id}
                    type="button"
                    onClick={() => toggleEmployee(employee.id)}
                    className={cn(
                      "w-full flex items-center px-4 py-3 border-b border-border/50 transition-colors",
                      isSelected ? "bg-primary/5" : "hover:bg-muted/30"
                    )}
                  >
                    <Avatar className="w-9 h-9 mr-3">
                      {employee.photo_url ? (
                        <AvatarImage src={employee.photo_url} alt={employee.name} />
                      ) : null}
                      <AvatarFallback className="bg-primary/10 text-primary text-sm">
                        {getInitials(employee.name)}
                      </AvatarFallback>
                    </Avatar>
                    <span className="flex-1 text-left font-medium">{employee.name}</span>
                    
                    <div className={cn(
                      "w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors",
                      isSelected 
                        ? "bg-primary border-primary" 
                        : "border-muted-foreground/40"
                    )}>
                      {isSelected && <Check className="w-4 h-4 text-primary-foreground" />}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </ScrollArea>

        {/* Footer */}
        <div className="p-4 border-t shrink-0">
          <Button 
            onClick={handleConfirm} 
            className="w-full"
            disabled={isLoading}
          >
            Dodaj ({localSelectedIds.length})
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
