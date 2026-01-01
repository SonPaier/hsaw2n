import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Plus, Users, Calendar, ChevronRight, Settings } from 'lucide-react';
import { toast } from 'sonner';
import { AddFollowUpServiceDialog } from './AddFollowUpServiceDialog';
import { FollowUpServiceCustomers } from './FollowUpServiceCustomers';

interface FollowUpService {
  id: string;
  name: string;
  description: string | null;
  default_interval_months: number;
  active: boolean;
  sort_order: number | null;
}

interface FollowUpServicesProps {
  instanceId: string;
}

export function FollowUpServices({ instanceId }: FollowUpServicesProps) {
  const { t } = useTranslation();
  const [services, setServices] = useState<FollowUpService[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [selectedService, setSelectedService] = useState<FollowUpService | null>(null);

  const fetchServices = async () => {
    try {
      const { data, error } = await supabase
        .from('followup_services')
        .select('*')
        .eq('instance_id', instanceId)
        .eq('active', true)
        .order('sort_order', { ascending: true });

      if (error) throw error;
      setServices(data || []);
    } catch (error) {
      console.error('Error fetching followup services:', error);
      toast.error(t('followup.fetchServicesError'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchServices();
  }, [instanceId]);

  if (selectedService) {
    return (
      <FollowUpServiceCustomers
        instanceId={instanceId}
        service={selectedService}
        onBack={() => setSelectedService(null)}
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-semibold">{t('followup.services')}</h2>
        <Button onClick={() => setShowAddDialog(true)}>
          <Plus className="h-4 w-4 mr-2" />
          {t('followup.addService')}
        </Button>
      </div>

      {loading ? (
        <div className="text-center py-8 text-muted-foreground">{t('common.loading')}</div>
      ) : services.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            <Calendar className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>{t('followup.noServices')}</p>
            <p className="text-sm">{t('followup.addFirstService')}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {services.map((service) => (
            <Card
              key={service.id}
              className="cursor-pointer hover:bg-accent/50 transition-colors"
              onClick={() => setSelectedService(service)}
            >
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">{service.name}</CardTitle>
                  <ChevronRight className="h-5 w-5 text-muted-foreground" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <Calendar className="h-4 w-4" />
                    <span>{t('followup.intervalLabel', { months: service.default_interval_months })}</span>
                  </div>
                  {service.description && (
                    <span className="truncate">{service.description}</span>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <AddFollowUpServiceDialog
        open={showAddDialog}
        onOpenChange={setShowAddDialog}
        instanceId={instanceId}
        onSuccess={fetchServices}
      />
    </div>
  );
}
