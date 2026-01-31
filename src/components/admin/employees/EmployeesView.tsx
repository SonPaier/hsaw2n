import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Users, Clock, CalendarOff } from 'lucide-react';
import EmployeesList from './EmployeesList';
import TimeEntriesView from './TimeEntriesView';
import EmployeeDaysOffView from './EmployeeDaysOffView';

interface EmployeesViewProps {
  instanceId: string | null;
}

const EmployeesView = ({ instanceId }: EmployeesViewProps) => {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState('employees');

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Pracownicy i czas pracy</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Zarządzaj pracownikami, rejestruj czas pracy i nieobecności
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid grid-cols-3 w-full max-w-md">
          <TabsTrigger value="employees" className="gap-1.5">
            <Users className="w-4 h-4" />
            <span className="hidden sm:inline">Pracownicy</span>
          </TabsTrigger>
          <TabsTrigger value="time" className="gap-1.5">
            <Clock className="w-4 h-4" />
            <span className="hidden sm:inline">Czas pracy</span>
          </TabsTrigger>
          <TabsTrigger value="daysoff" className="gap-1.5">
            <CalendarOff className="w-4 h-4" />
            <span className="hidden sm:inline">Nieobecności</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="employees" className="mt-6">
          <EmployeesList instanceId={instanceId} />
        </TabsContent>

        <TabsContent value="time" className="mt-6">
          <TimeEntriesView instanceId={instanceId} />
        </TabsContent>

        <TabsContent value="daysoff" className="mt-6">
          <EmployeeDaysOffView instanceId={instanceId} />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default EmployeesView;
