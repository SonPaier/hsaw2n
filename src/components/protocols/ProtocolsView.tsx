import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ClipboardCheck, Plus, Search, Loader2, Calendar, User, Car, MoreVertical, Pencil, Link2, Trash2, Mail } from 'lucide-react';
import { format } from 'date-fns';
import { pl } from 'date-fns/locale';
import { CreateProtocolForm } from './CreateProtocolForm';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { toast } from 'sonner';
import { SendProtocolEmailDialog } from './SendProtocolEmailDialog';

interface Protocol {
  id: string;
  offer_number: string | null;
  customer_name: string;
  vehicle_model: string | null;
  registration_number: string | null;
  protocol_date: string;
  status: string;
  created_at: string;
  public_token: string;
}

interface ProtocolsViewProps {
  instanceId: string;
}

export const ProtocolsView = ({ instanceId }: ProtocolsViewProps) => {
  const [protocols, setProtocols] = useState<Protocol[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [protocolToDelete, setProtocolToDelete] = useState<Protocol | null>(null);
  const [instanceSlug, setInstanceSlug] = useState<string>('');
  const [editingProtocolId, setEditingProtocolId] = useState<string | null>(null);
  const [emailDialogOpen, setEmailDialogOpen] = useState(false);
  const [protocolToEmail, setProtocolToEmail] = useState<Protocol | null>(null);

  useEffect(() => {
    fetchProtocols();
    fetchInstanceSlug();
  }, [instanceId]);

  const fetchInstanceSlug = async () => {
    const { data } = await supabase
      .from('instances')
      .select('slug')
      .eq('id', instanceId)
      .single();
    if (data) setInstanceSlug(data.slug);
  };

  const fetchProtocols = async () => {
    try {
      const { data, error } = await supabase
        .from('vehicle_protocols')
        .select('id, offer_number, customer_name, vehicle_model, registration_number, protocol_date, status, created_at, public_token')
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

  const handleCopyLink = (protocol: Protocol) => {
    const baseUrl = window.location.origin;
    const url = `${baseUrl}/protocols/${protocol.public_token}`;
    navigator.clipboard.writeText(url);
    toast.success('Link skopiowany do schowka');
  };

  const handleDeleteProtocol = async () => {
    if (!protocolToDelete) return;
    
    try {
      // First delete related damage points
      await supabase
        .from('protocol_damage_points')
        .delete()
        .eq('protocol_id', protocolToDelete.id);
      
      // Then delete the protocol
      const { error } = await supabase
        .from('vehicle_protocols')
        .delete()
        .eq('id', protocolToDelete.id);
      
      if (error) throw error;
      
      setProtocols(prev => prev.filter(p => p.id !== protocolToDelete.id));
      toast.success('Protokół został usunięty');
    } catch (error) {
      console.error('Error deleting protocol:', error);
      toast.error('Nie udało się usunąć protokołu');
    } finally {
      setDeleteDialogOpen(false);
      setProtocolToDelete(null);
    }
  };

  if (showCreateForm || editingProtocolId) {
    return (
      <CreateProtocolForm
        instanceId={instanceId}
        protocolId={editingProtocolId}
        onBack={() => {
          setShowCreateForm(false);
          setEditingProtocolId(null);
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
        <>
          <div className="grid gap-3">
            {filteredProtocols.map((protocol) => (
              <Card 
                key={protocol.id} 
                className="hover:shadow-md transition-shadow"
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div 
                      className="flex-1 min-w-0 space-y-1 cursor-pointer"
                      onClick={() => setEditingProtocolId(protocol.id)}
                    >
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
                    <div className="flex items-center gap-2">
                      <Badge variant={protocol.status === 'completed' ? 'default' : 'secondary'}>
                        {protocol.status === 'completed' ? 'Zakończony' : 'Szkic'}
                      </Badge>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="bg-white">
                          <DropdownMenuItem 
                            onClick={() => setEditingProtocolId(protocol.id)}
                            className="cursor-pointer"
                          >
                            <Pencil className="h-4 w-4 mr-2" />
                            Edytuj
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            onClick={() => handleCopyLink(protocol)}
                            className="cursor-pointer"
                          >
                            <Link2 className="h-4 w-4 mr-2" />
                            Kopiuj link
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            onClick={() => {
                              setProtocolToEmail(protocol);
                              setEmailDialogOpen(true);
                            }}
                            className="cursor-pointer"
                          >
                            <Mail className="h-4 w-4 mr-2" />
                            Wyślij emailem
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            onClick={() => {
                              setProtocolToDelete(protocol);
                              setDeleteDialogOpen(true);
                            }}
                            className="cursor-pointer text-destructive focus:text-destructive"
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Usuń
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
          
          <ConfirmDialog
            open={deleteDialogOpen}
            onOpenChange={setDeleteDialogOpen}
            title="Usuń protokół"
            description={`Czy na pewno chcesz usunąć protokół dla ${protocolToDelete?.customer_name}? Tej operacji nie można cofnąć.`}
            confirmLabel="Usuń"
            onConfirm={handleDeleteProtocol}
            variant="destructive"
          />

          <SendProtocolEmailDialog
            open={emailDialogOpen}
            onOpenChange={setEmailDialogOpen}
            protocolId={protocolToEmail?.id || ''}
            customerName={protocolToEmail?.customer_name || ''}
            vehicleInfo={[protocolToEmail?.vehicle_model, protocolToEmail?.registration_number].filter(Boolean).join(' ')}
          />
        </>
      )}
    </div>
  );
};
