import { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { normalizeSearchQuery } from '@/lib/textUtils';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ClipboardCheck, Search, Loader2, Calendar, User, Car, MoreVertical, Pencil, Link2, Trash2, Mail, FileText, ChevronLeft, ChevronRight, ArrowLeft, Settings } from 'lucide-react';
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
import { ProtocolSettingsDialog } from './ProtocolSettingsDialog';
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationEllipsis,
} from '@/components/ui/pagination';

interface Protocol {
  id: string;
  offer_number: string | null;
  customer_name: string;
  customer_email: string | null;
  vehicle_model: string | null;
  registration_number: string | null;
  protocol_date: string;
  protocol_type: 'reception' | 'pickup' | null;
  status: string;
  created_at: string;
  public_token: string;
}

interface ProtocolsViewProps {
  instanceId: string;
  kioskMode?: boolean;
  onBack?: () => void;
  onEditModeChange?: (isEditing: boolean) => void;
}

const ITEMS_PER_PAGE = 20;

export const ProtocolsView = ({ instanceId, kioskMode = false, onBack, onEditModeChange }: ProtocolsViewProps) => {
  const [searchParams, setSearchParams] = useSearchParams();
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
  const [currentPage, setCurrentPage] = useState(1);
  const [settingsDialogOpen, setSettingsDialogOpen] = useState(false);

  // Handle URL params for opening create form from reservation
  useEffect(() => {
    if (searchParams.get('action') === 'new') {
      setShowCreateForm(true);
    }
  }, [searchParams]);

  useEffect(() => {
    fetchProtocols();
    fetchInstanceSlug();
  }, [instanceId]);

  // Reset to first page when search changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery]);

  // Notify parent when entering/exiting edit mode
  useEffect(() => {
    const isEditing = showCreateForm || !!editingProtocolId;
    onEditModeChange?.(isEditing);
  }, [showCreateForm, editingProtocolId, onEditModeChange]);

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
        .select('id, offer_number, customer_name, customer_email, vehicle_model, registration_number, protocol_date, protocol_type, status, created_at, public_token')
        .eq('instance_id', instanceId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setProtocols((data || []) as Protocol[]);
    } catch (error) {
      console.error('Error fetching protocols:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredProtocols = useMemo(() => {
    return protocols.filter(p => {
      const query = searchQuery.toLowerCase();
      const normalizedQuery = normalizeSearchQuery(query);
      return (
        p.customer_name.toLowerCase().includes(query) ||
        (p.offer_number && normalizeSearchQuery(p.offer_number).toLowerCase().includes(normalizedQuery)) ||
        p.vehicle_model?.toLowerCase().includes(query) ||
        (p.registration_number && normalizeSearchQuery(p.registration_number).toLowerCase().includes(normalizedQuery))
      );
    });
  }, [protocols, searchQuery]);

  const totalPages = Math.ceil(filteredProtocols.length / ITEMS_PER_PAGE);
  
  const paginatedProtocols = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredProtocols.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [filteredProtocols, currentPage]);

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const getPageNumbers = () => {
    const pages: (number | 'ellipsis')[] = [];
    
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      pages.push(1);
      
      if (currentPage > 3) {
        pages.push('ellipsis');
      }
      
      const start = Math.max(2, currentPage - 1);
      const end = Math.min(totalPages - 1, currentPage + 1);
      
      for (let i = start; i <= end; i++) {
        pages.push(i);
      }
      
      if (currentPage < totalPages - 2) {
        pages.push('ellipsis');
      }
      
      pages.push(totalPages);
    }
    
    return pages;
  };

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
          // Clear URL params when closing form
          setSearchParams({});
          fetchProtocols();
        }}
      />
    );
  }

  const wrapperClassName = kioskMode 
    ? "min-h-screen bg-background p-4 pb-24" 
    : "space-y-4 max-w-3xl mx-auto";

  return (
    <div className={wrapperClassName}>
      <div className="flex items-center justify-between gap-2">
        {kioskMode && onBack && (
          <Button variant="ghost" onClick={onBack} className="gap-1">
            <ArrowLeft className="w-4 h-4" />
            <span className="hidden sm:inline">Wróć</span>
          </Button>
        )}
        <h1 className="text-2xl font-bold flex-1">
          Protokoły
        </h1>
        <div className="flex items-center gap-2">
          {!kioskMode && (
            <Button variant="outline" size="icon" onClick={() => setSettingsDialogOpen(true)}>
              <Settings className="h-4 w-4" />
            </Button>
          )}
          <Button onClick={() => setShowCreateForm(true)}>
            Dodaj protokół
          </Button>
        </div>
      </div>

      <div className="relative mt-4">
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
                Dodaj protokół
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Results count */}
          <p className="text-sm text-muted-foreground py-3">
            Wyświetlanie {((currentPage - 1) * ITEMS_PER_PAGE) + 1}-{Math.min(currentPage * ITEMS_PER_PAGE, filteredProtocols.length)} z {filteredProtocols.length}
          </p>

          <div className="grid gap-3">
            {paginatedProtocols.map((protocol) => (
              <Card 
                key={protocol.id} 
                className="hover:shadow-md transition-shadow"
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-2 sm:gap-4">
                    <div 
                      className="flex-1 min-w-0 space-y-1 cursor-pointer"
                      onClick={() => setEditingProtocolId(protocol.id)}
                    >
                      {/* Line 1: Customer name */}
                      <div className="flex items-center gap-2 flex-wrap">
                        <User className="h-4 w-4 text-muted-foreground flex-shrink-0 hidden sm:block" />
                        <span className="font-medium truncate">{protocol.customer_name}</span>
                      </div>
                      
                      {/* Line 2: Car */}
                      {(protocol.vehicle_model || protocol.registration_number) && (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Car className="h-4 w-4 flex-shrink-0" />
                          <span className="truncate">
                            {[protocol.vehicle_model, protocol.registration_number].filter(Boolean).join(' • ')}
                          </span>
                        </div>
                      )}
                      
                      {/* Line 3: Date */}
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Calendar className="h-4 w-4 flex-shrink-0" />
                        <span>
                          {format(new Date(protocol.protocol_date), 'PPP', { locale: pl })}
                        </span>
                      </div>
                      
                      {/* Line 4: Offer number + Protocol type (mobile) */}
                      <div className="flex items-center gap-2 text-sm text-muted-foreground sm:hidden">
                        <FileText className="h-4 w-4 flex-shrink-0" />
                        {protocol.offer_number && (
                          <span className="truncate">#{protocol.offer_number}</span>
                        )}
                        <Badge 
                          variant="outline" 
                          className="text-xs"
                        >
                          {protocol.protocol_type === 'pickup' ? 'Wydanie' : 'Przyjęcie'}
                        </Badge>
                      </div>
                      
                      {/* Offer badge + Protocol type - desktop only */}
                      <div className="hidden sm:flex items-center gap-2 mt-1">
                        {protocol.offer_number && (
                          <Badge variant="secondary" className="text-xs">
                            #{protocol.offer_number}
                          </Badge>
                        )}
                        <Badge 
                          variant="outline" 
                          className="text-xs"
                        >
                          {protocol.protocol_type === 'pickup' ? 'Wydanie' : 'Przyjęcie'}
                        </Badge>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
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

          {/* Pagination */}
          {totalPages > 1 && (
            <Pagination className="mt-6">
              <PaginationContent>
                <PaginationItem>
                  <PaginationLink
                    onClick={() => currentPage > 1 && handlePageChange(currentPage - 1)}
                    className={currentPage === 1 ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </PaginationLink>
                </PaginationItem>
                
                {getPageNumbers().map((page, index) => (
                  <PaginationItem key={index}>
                    {page === 'ellipsis' ? (
                      <PaginationEllipsis />
                    ) : (
                      <PaginationLink
                        isActive={currentPage === page}
                        onClick={() => handlePageChange(page)}
                        className="cursor-pointer"
                      >
                        {page}
                      </PaginationLink>
                    )}
                  </PaginationItem>
                ))}
                
                <PaginationItem>
                  <PaginationLink
                    onClick={() => currentPage < totalPages && handlePageChange(currentPage + 1)}
                    className={currentPage === totalPages ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </PaginationLink>
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          )}
          
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
            customerEmail={protocolToEmail?.customer_email || undefined}
            vehicleInfo={[protocolToEmail?.vehicle_model, protocolToEmail?.registration_number].filter(Boolean).join(' ')}
            protocolType={protocolToEmail?.protocol_type || 'reception'}
            instanceId={instanceId}
          />

          <ProtocolSettingsDialog
            open={settingsDialogOpen}
            onOpenChange={setSettingsDialogOpen}
            instanceId={instanceId}
          />
        </>
      )}
    </div>
  );
};
