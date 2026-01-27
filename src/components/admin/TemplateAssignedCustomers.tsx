import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { CustomersList, CustomerListItem, CustomerVehicle } from './CustomersList';
import CustomerEditDrawer from './CustomerEditDrawer';

interface TemplateAssignedCustomersProps {
  templateId: string | null;
  instanceId: string | null;
}

/**
 * Displays a list of customers assigned to a reminder template.
 * Fetches unique customers from customer_reminders table.
 */
export const TemplateAssignedCustomers = ({ templateId, instanceId }: TemplateAssignedCustomersProps) => {
  const { t } = useTranslation();
  const [customers, setCustomers] = useState<CustomerListItem[]>([]);
  const [vehicles, setVehicles] = useState<CustomerVehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerListItem | null>(null);

  useEffect(() => {
    if (templateId && instanceId) {
      fetchAssignedCustomers();
    }
  }, [templateId, instanceId]);

  const fetchAssignedCustomers = async () => {
    if (!templateId || !instanceId) return;
    
    setLoading(true);
    try {
      // Fetch customers from customer_reminders with this template
      const { data: reminders, error } = await supabase
        .from('customer_reminders')
        .select('customer_name, customer_phone')
        .eq('reminder_template_id', templateId)
        .eq('instance_id', instanceId);

      if (error) throw error;

      // Deduplicate by phone
      const uniqueCustomersMap = new Map<string, { customer_name: string; customer_phone: string }>();
      reminders?.forEach(r => {
        if (!uniqueCustomersMap.has(r.customer_phone)) {
          uniqueCustomersMap.set(r.customer_phone, r);
        }
      });

      const uniqueCustomers = Array.from(uniqueCustomersMap.values());

      // Try to match with actual customers in database
      const phones = uniqueCustomers.map(c => c.customer_phone);
      
      let matchedCustomers: CustomerListItem[] = [];
      
      if (phones.length > 0) {
        const { data: dbCustomers } = await supabase
          .from('customers')
          .select('id, name, phone, email, notes, source, company, nip')
          .eq('instance_id', instanceId)
          .in('phone', phones);

        const dbCustomerMap = new Map(dbCustomers?.map(c => [c.phone, c]) || []);

        // Build customer list - use DB customer if exists, otherwise temp object
        matchedCustomers = uniqueCustomers.map(uc => {
          const dbCustomer = dbCustomerMap.get(uc.customer_phone);
          if (dbCustomer) {
            return dbCustomer as CustomerListItem;
          }
          // Create temporary customer object (not in DB yet)
          return {
            id: '',
            name: uc.customer_name,
            phone: uc.customer_phone,
            email: null,
            notes: null,
            source: 'myjnia',
          };
        });

        // Fetch vehicles for these customers
        const { data: vehiclesData } = await supabase
          .from('customer_vehicles')
          .select('phone, model, plate')
          .eq('instance_id', instanceId)
          .in('phone', phones);

        setVehicles(vehiclesData || []);
      }

      setCustomers(matchedCustomers);
    } catch (error) {
      console.error('Error fetching assigned customers:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCustomerClick = (customer: CustomerListItem) => {
    setSelectedCustomer(customer);
  };

  const handleDrawerClose = () => {
    setSelectedCustomer(null);
  };

  const handleCustomerUpdated = () => {
    fetchAssignedCustomers();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <>
      <CustomersList
        customers={customers}
        vehicles={vehicles}
        onCustomerClick={handleCustomerClick}
        emptyMessage={t('reminders.noAssignedCustomers')}
        showActions={false}
      />

      <CustomerEditDrawer
        customer={selectedCustomer}
        instanceId={instanceId}
        open={!!selectedCustomer}
        onClose={handleDrawerClose}
        onCustomerUpdated={handleCustomerUpdated}
      />
    </>
  );
};
