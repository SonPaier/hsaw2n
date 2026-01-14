import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ClipboardCheck, Plus, Search, Loader2, Calendar, User, Car } from 'lucide-react';
import { format } from 'date-fns';
import { pl } from 'date-fns/locale';
import { CreateProtocolForm } from './CreateProtocolForm';

interface Protocol {
  id: string;
  offer_number: string | null;
  customer_name: string;
  vehicle_model: string | null;
  registration_number: string | null;
  protocol_date: string;
  status: string;
  created_at: string;
}

interface ProtocolsViewProps {
  instanceId: string;
}

export const ProtocolsView = ({ instanceId }: ProtocolsViewProps) => {
  const [protocols, setProtocols] = useState<Protocol[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showCreateForm, setShowCreateForm] = useState(false);

  useEffect(() => {
    fetchProtocols();
  }, [instanceId]);

  const fetchProtocols = async () => {
    try {
      const { data, error } = await supabase
        .from('vehicle_protocols')
        .select('id, offer_number, customer_name, vehicle_model, registration_number, protocol_date, status, created_at')
        .eq('instance_id', instanceId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setProtocols(data || []);
    } catch (error) {
      console.error('Error fetching protocols:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredProtocols = protocols.filter(p => {
    const query = searchQuery.toLowerCase();
    return (
      p.customer_name.toLowerCase().includes(query) ||
      p.offer_number?.toLowerCase().includes(query) ||
      p.vehicle_model?.toLowerCase().includes(query) ||
      p.registration_number?.toLowerCase().includes(query)
    );
  });

  if (showCreateForm) {
    return (
      <CreateProtocolForm
        instanceId={instanceId}
        onBack={() => {
          setShowCreateForm(false);
          fetchProtocols();
        }}
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold flex items-center gap-2">
          <ClipboardCheck className="h-5 w-5" />
          Protokoły przyjęcia
        </h2>
        <Button onClick={() => setShowCreateForm(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Nowy protokół
        </Button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Szukaj po nazwisku, numerze oferty, pojeździe..."
          className="pl-10"
        />
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : filteredProtocols.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <ClipboardCheck className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="font-medium text-lg mb-2">
              {searchQuery ? 'Brak wyników' : 'Brak protokołów'}
            </h3>
            <p className="text-muted-foreground mb-4">
              {searchQuery 
                ? 'Spróbuj zmienić kryteria wyszukiwania'
                : 'Utwórz pierwszy protokół przyjęcia pojazdu'}
            </p>
            {!searchQuery && (
              <Button onClick={() => setShowCreateForm(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Nowy protokół
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {filteredProtocols.map((protocol) => (
            <Card key={protocol.id} className="hover:shadow-md transition-shadow cursor-pointer">
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                      <span className="font-medium truncate">{protocol.customer_name}</span>
                      {protocol.offer_number && (
                        <Badge variant="secondary" className="text-xs">
                          #{protocol.offer_number}
                        </Badge>
                      )}
                    </div>
                    {(protocol.vehicle_model || protocol.registration_number) && (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Car className="h-4 w-4 flex-shrink-0" />
                        <span className="truncate">
                          {[protocol.vehicle_model, protocol.registration_number].filter(Boolean).join(' • ')}
                        </span>
                      </div>
                    )}
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Calendar className="h-4 w-4 flex-shrink-0" />
                      <span>
                        {format(new Date(protocol.protocol_date), 'PPP', { locale: pl })}
                      </span>
                    </div>
                  </div>
                  <Badge variant={protocol.status === 'completed' ? 'default' : 'secondary'}>
                    {protocol.status === 'completed' ? 'Zakończony' : 'Szkic'}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};
