import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/integrations/supabase/client';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { Loader2, Search, User, Check } from 'lucide-react';
import { format, addMonths } from 'date-fns';
import { ScrollArea } from '@/components/ui/scroll-area';

interface Customer {
  id: string;
  name: string;
  phone: string;
}

interface FollowUpService {
  id: string;
  name: string;
  default_interval_months: number;
}

interface AddCustomerToServiceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  instanceId: string;
  service: FollowUpService;
  onSuccess: () => void;
}

export function AddCustomerToServiceDialog({
  open,
  onOpenChange,
  instanceId,
  service,
  onSuccess,
}: AddCustomerToServiceDialogProps) {
  const { t } = useTranslation();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [reminderDate, setReminderDate] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      // Set default reminder date based on interval
      const defaultDate = addMonths(new Date(), service.default_interval_months);
      setReminderDate(format(defaultDate, 'yyyy-MM-dd'));
    }
  }, [open, service.default_interval_months]);

  useEffect(() => {
    const searchCustomers = async () => {
      if (!searchQuery || searchQuery.length < 2) {
        setCustomers([]);
        return;
      }

      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('customers')
          .select('id, name, phone')
          .eq('instance_id', instanceId)
          .or(`name.ilike.%${searchQuery}%,phone.ilike.%${searchQuery}%`)
          .limit(10);

        if (error) throw error;
        setCustomers(data || []);
      } catch (error) {
        console.error('Error searching customers:', error);
      } finally {
        setLoading(false);
      }
    };

    const debounce = setTimeout(searchCustomers, 300);
    return () => clearTimeout(debounce);
  }, [searchQuery, instanceId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedCustomer) {
      toast.error(t('followup.selectCustomer'));
      return;
    }

    if (!reminderDate) {
      toast.error(t('followup.selectReminderDate'));
      return;
    }

    setSaving(true);
    try {
      // Check if customer already has this service
      const { data: existing } = await supabase
        .from('followup_events')
        .select('id')
        .eq('instance_id', instanceId)
        .eq('followup_service_id', service.id)
        .eq('customer_id', selectedCustomer.id)
        .eq('status', 'active')
        .maybeSingle();

      if (existing) {
        toast.error(t('followup.customerAlreadyAssigned'));
        setSaving(false);
        return;
      }

      const { error } = await supabase.from('followup_events').insert({
        instance_id: instanceId,
        followup_service_id: service.id,
        customer_id: selectedCustomer.id,
        customer_name: selectedCustomer.name,
        customer_phone: selectedCustomer.phone,
        next_reminder_date: reminderDate,
        notes: notes.trim() || null,
        status: 'active',
      });

      if (error) throw error;

      toast.success(t('followup.customerAdded'));
      onSuccess();
      handleClose();
    } catch (error) {
      console.error('Error adding customer to service:', error);
      toast.error(t('followup.addCustomerError'));
    } finally {
      setSaving(false);
    }
  };

  const handleClose = () => {
    onOpenChange(false);
    setSearchQuery('');
    setSelectedCustomer(null);
    setNotes('');
    setCustomers([]);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t('followup.addCustomerToService')}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>{t('followup.searchCustomerLabel')}</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={t('followup.searchCustomerPlaceholder')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            
            {loading && (
              <div className="text-sm text-muted-foreground flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                {t('followup.searching')}
              </div>
            )}

            {customers.length > 0 && !selectedCustomer && (
              <ScrollArea className="h-40 border rounded-md">
                <div className="p-2 space-y-1">
                  {customers.map((customer) => (
                    <div
                      key={customer.id}
                      className="p-2 rounded cursor-pointer hover:bg-accent flex items-center justify-between"
                      onClick={() => {
                        setSelectedCustomer(customer);
                        setSearchQuery('');
                        setCustomers([]);
                      }}
                    >
                      <div>
                        <div className="font-medium">{customer.name}</div>
                        <div className="text-sm text-muted-foreground">{customer.phone}</div>
                      </div>
                      <User className="h-4 w-4 text-muted-foreground" />
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}

            {selectedCustomer && (
              <div className="p-3 rounded-md bg-accent flex items-center justify-between">
                <div>
                  <div className="font-medium flex items-center gap-2">
                    <Check className="h-4 w-4 text-green-500" />
                    {selectedCustomer.name}
                  </div>
                  <div className="text-sm text-muted-foreground">{selectedCustomer.phone}</div>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedCustomer(null)}
                >
                  {t('followup.change')}
                </Button>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="reminderDate">{t('followup.reminderDate')}</Label>
            <Input
              id="reminderDate"
              type="date"
              value={reminderDate}
              onChange={(e) => setReminderDate(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              {t('followup.defaultFromToday', { months: service.default_interval_months })}
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">{t('followup.notesOptional')}</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={t('followup.notesPlaceholder')}
              rows={2}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleClose}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" disabled={saving || !selectedCustomer}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {t('common.add')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
