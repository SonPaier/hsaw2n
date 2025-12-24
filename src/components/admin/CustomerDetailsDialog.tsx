import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { pl } from 'date-fns/locale';
import { Phone, MessageSquare, Mail, Car, Calendar, Clock } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { supabase } from '@/integrations/supabase/client';
import { useIsMobile } from '@/hooks/use-mobile';
import { toast } from 'sonner';

interface Customer {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  notes: string | null;
}

interface VisitHistory {
  id: string;
  reservation_date: string;
  start_time: string;
  vehicle_plate: string;
  service_name: string | null;
  price: number | null;
  status: string | null;
}

interface CustomerDetailsDialogProps {
  customer: Customer | null;
  instanceId: string | null;
  open: boolean;
  onClose: () => void;
}

const CustomerDetailsDialog = ({ customer, instanceId, open, onClose }: CustomerDetailsDialogProps) => {
  const isMobile = useIsMobile();
  const [visits, setVisits] = useState<VisitHistory[]>([]);
  const [loading, setLoading] = useState(false);
  const [smsMessage, setSmsMessage] = useState('');
  const [sendingSms, setSendingSms] = useState(false);

  useEffect(() => {
    if (customer && instanceId && open) {
      fetchVisitHistory();
    }
  }, [customer, instanceId, open]);

  const fetchVisitHistory = async () => {
    if (!customer || !instanceId) return;
    
    setLoading(true);
    const { data, error } = await supabase
      .from('reservations')
      .select(`
        id,
        reservation_date,
        start_time,
        vehicle_plate,
        price,
        status,
        services:service_id (name)
      `)
      .eq('instance_id', instanceId)
      .eq('customer_phone', customer.phone)
      .order('reservation_date', { ascending: false })
      .order('start_time', { ascending: false });
    
    if (!error && data) {
      setVisits(data.map(v => ({
        id: v.id,
        reservation_date: v.reservation_date,
        start_time: v.start_time,
        vehicle_plate: v.vehicle_plate,
        service_name: v.services ? (v.services as any).name : null,
        price: v.price,
        status: v.status,
      })));
    }
    setLoading(false);
  };

  const handleCall = () => {
    if (customer) {
      window.location.href = `tel:${customer.phone}`;
    }
  };

  const handleSmsButton = () => {
    if (!customer) return;
    if (isMobile) {
      // On mobile, open native SMS app
      window.location.href = `sms:${customer.phone}`;
    }
    // On web, scroll to the SMS form below
  };

  const handleSendSms = async () => {
    if (!customer || !instanceId || !smsMessage.trim()) return;
    
    setSendingSms(true);
    try {
      // Use edge function to send SMS
      const { error } = await supabase.functions.invoke('send-sms-message', {
        body: {
          phone: customer.phone,
          message: smsMessage,
          instanceId,
        },
      });
      
      if (error) throw error;
      
      toast.success('SMS wysłany');
      setSmsMessage('');
    } catch (error) {
      console.error('Error sending SMS:', error);
      toast.error('Błąd podczas wysyłania SMS');
    } finally {
      setSendingSms(false);
    }
  };

  const getStatusLabel = (status: string | null) => {
    switch (status) {
      case 'confirmed': return 'Potwierdzona';
      case 'completed': return 'Zakończona';
      case 'cancelled': return 'Anulowana';
      case 'in_progress': return 'W trakcie';
      default: return 'Oczekująca';
    }
  };

  // Get unique vehicles from visits
  const uniqueVehicles = [...new Set(visits.map(v => v.vehicle_plate))];

  if (!customer) return null;

  return (
    <Dialog open={open} onOpenChange={() => onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-primary/10 text-primary">
              {customer.name.charAt(0).toUpperCase()}
            </div>
            <div>
              <div>{customer.name}</div>
              <div className="text-sm font-normal text-muted-foreground">{customer.phone}</div>
            </div>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Quick Actions */}
          <div className="flex gap-2">
            <Button
              variant="outline"
              className="flex-1 gap-2"
              onClick={handleCall}
            >
              <Phone className="w-4 h-4 text-success" />
              Zadzwoń
            </Button>
            <Button
              variant="outline"
              className="flex-1 gap-2"
              onClick={handleSmsButton}
            >
              <MessageSquare className="w-4 h-4 text-primary" />
              SMS
            </Button>
            {customer.email && (
              <Button
                variant="outline"
                className="flex-1 gap-2"
                onClick={() => window.location.href = `mailto:${customer.email}`}
              >
                <Mail className="w-4 h-4" />
                Email
              </Button>
            )}
          </div>

          {/* Vehicles */}
          {uniqueVehicles.length > 0 && (
            <div>
              <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                <Car className="w-4 h-4" />
                Pojazdy
              </h4>
              <div className="flex flex-wrap gap-2">
                {uniqueVehicles.map((plate) => (
                  <div
                    key={plate}
                    className="px-3 py-1.5 bg-secondary rounded-md text-sm font-mono"
                  >
                    {plate}
                  </div>
                ))}
              </div>
            </div>
          )}

          <Separator />

          {/* Send SMS - only on web */}
          {!isMobile && (
            <div>
              <h4 className="text-sm font-medium mb-2">Wyślij wiadomość SMS</h4>
              <div className="space-y-2">
                <Textarea
                  placeholder="Treść wiadomości..."
                  value={smsMessage}
                  onChange={(e) => setSmsMessage(e.target.value)}
                  rows={3}
                />
                <Button
                  onClick={handleSendSms}
                  disabled={!smsMessage.trim() || sendingSms}
                  className="w-full"
                >
                  {sendingSms ? 'Wysyłanie...' : 'Wyślij SMS'}
                </Button>
              </div>
            </div>
          )}

          <Separator />

          {/* Visit History */}
          <div>
            <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              Historia wizyt ({visits.length})
            </h4>
            
            {loading ? (
              <div className="text-center text-muted-foreground py-4">
                Ładowanie...
              </div>
            ) : visits.length === 0 ? (
              <div className="text-center text-muted-foreground py-4">
                Brak historii wizyt
              </div>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {visits.map((visit) => (
                  <div
                    key={visit.id}
                    className="p-3 bg-secondary/50 rounded-lg"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <div className="font-medium text-sm">
                        {format(new Date(visit.reservation_date), 'd MMMM yyyy', { locale: pl })}
                      </div>
                      <div className="text-xs text-muted-foreground flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {visit.start_time.slice(0, 5)}
                      </div>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <div className="text-muted-foreground">
                        {visit.service_name || 'Usługa'} • {visit.vehicle_plate}
                      </div>
                      {visit.price && (
                        <div className="font-medium">
                          {visit.price} zł
                        </div>
                      )}
                    </div>
                    <div className="mt-1">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${
                        visit.status === 'completed' ? 'bg-success/10 text-success' :
                        visit.status === 'cancelled' ? 'bg-destructive/10 text-destructive' :
                        'bg-muted text-muted-foreground'
                      }`}>
                        {getStatusLabel(visit.status)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Notes */}
          {customer.notes && (
            <>
              <Separator />
              <div>
                <h4 className="text-sm font-medium mb-2">Notatki</h4>
                <p className="text-sm text-muted-foreground">{customer.notes}</p>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default CustomerDetailsDialog;
