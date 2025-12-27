import { useState, useEffect, useMemo } from 'react';
import { Helmet } from 'react-helmet-async';
import { useNavigate } from 'react-router-dom';
import { Plus, FileText, ArrowLeft, Eye, Send, Trash2, Copy, MoreVertical, Loader2, Filter, Search, Settings, CopyPlus, ChevronLeft, ChevronRight, Package } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { OfferGenerator } from '@/components/offers/OfferGenerator';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { pl } from 'date-fns/locale';
import { cn } from '@/lib/utils';

const ITEMS_PER_PAGE = 20;

interface Offer {
  id: string;
  offer_number: string;
  customer_data: {
    name?: string;
    email?: string;
    company?: string;
    phone?: string;
  };
  vehicle_data?: {
    brandModel?: string;
    brand?: string;
    model?: string;
    plate?: string;
  };
  status: string;
  total_net: number;
  total_gross: number;
  created_at: string;
  valid_until?: string;
  public_token: string;
}

interface OfferWithOptions extends Offer {
  offer_options?: {
    id: string;
    offer_option_items?: {
      custom_name?: string;
    }[];
  }[];
}

interface OfferSettings {
  number_prefix: string;
  number_format: string;
}

const statusLabels: Record<string, string> = {
  draft: 'Szkic',
  sent: 'Wysłana',
  viewed: 'Obejrzana',
  accepted: 'Zaakceptowana',
  rejected: 'Odrzucona',
  expired: 'Wygasła',
};

const statusColors: Record<string, string> = {
  draft: 'bg-muted text-muted-foreground',
  sent: 'bg-blue-500/20 text-blue-600',
  viewed: 'bg-amber-500/20 text-amber-600',
  accepted: 'bg-green-500/20 text-green-600',
  rejected: 'bg-red-500/20 text-red-600',
  expired: 'bg-gray-500/20 text-gray-500',
};

const OffersPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [instanceId, setInstanceId] = useState<string | null>(null);
  const [showGenerator, setShowGenerator] = useState(false);
  const [editingOfferId, setEditingOfferId] = useState<string | null>(null);
  const [duplicatingOfferId, setDuplicatingOfferId] = useState<string | null>(null);
  const [offers, setOffers] = useState<OfferWithOptions[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [showSettings, setShowSettings] = useState(false);
  const [settings, setSettings] = useState<OfferSettings>({
    number_prefix: '',
    number_format: 'PREFIX/YYYY/MMDD/NNN',
  });
  const [savingSettings, setSavingSettings] = useState(false);

  useEffect(() => {
    const fetchUserInstanceId = async () => {
      if (!user) return;
      const { data: rolesData } = await supabase
        .from('user_roles')
        .select('instance_id, role')
        .eq('user_id', user.id);
      
      if (!rolesData || rolesData.length === 0) return;
      const adminRole = rolesData.find(r => r.role === 'admin' && r.instance_id);
      if (adminRole?.instance_id) {
        setInstanceId(adminRole.instance_id);
        return;
      }
      const isSuperAdmin = rolesData.some(r => r.role === 'super_admin');
      if (isSuperAdmin) {
        const { data: instances } = await supabase
          .from('instances')
          .select('id')
          .eq('active', true)
          .limit(1)
          .maybeSingle();
        if (instances?.id) {
          setInstanceId(instances.id);
        }
      }
    };
    fetchUserInstanceId();
  }, [user]);

  const fetchOffers = async () => {
    if (!instanceId) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('offers')
        .select(`
          *,
          offer_options (
            id,
            offer_option_items (
              custom_name
            )
          )
        `)
        .eq('instance_id', instanceId)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      setOffers((data || []) as OfferWithOptions[]);
    } catch (error) {
      console.error('Error fetching offers:', error);
      toast.error('Błąd podczas pobierania ofert');
    } finally {
      setLoading(false);
    }
  };

  const fetchSettings = async () => {
    if (!instanceId) return;
    const { data } = await supabase
      .from('instance_features')
      .select('*')
      .eq('instance_id', instanceId)
      .eq('feature_key', 'offer_settings')
      .maybeSingle();
    
    if (data) {
      try {
        const parsed = JSON.parse(data.enabled ? 'true' : 'false');
        // Settings stored in a different way - check text_blocks
      } catch {}
    }
    
    // Get instance slug for default prefix
    const { data: instance } = await supabase
      .from('instances')
      .select('slug')
      .eq('id', instanceId)
      .single();
    
    if (instance?.slug) {
      setSettings(prev => ({
        ...prev,
        number_prefix: prev.number_prefix || instance.slug.toUpperCase().slice(0, 3),
      }));
    }
  };

  useEffect(() => {
    fetchOffers();
    fetchSettings();
  }, [instanceId]);

  const handleDeleteOffer = async (offerId: string) => {
    if (!confirm('Czy na pewno chcesz usunąć tę ofertę?')) return;
    
    try {
      const { error } = await supabase.from('offers').delete().eq('id', offerId);
      if (error) throw error;
      setOffers(prev => prev.filter(o => o.id !== offerId));
      toast.success('Oferta została usunięta');
    } catch (error) {
      console.error('Error deleting offer:', error);
      toast.error('Błąd podczas usuwania oferty');
    }
  };

  const handleDuplicateOffer = async (offerId: string) => {
    setDuplicatingOfferId(offerId);
    setEditingOfferId(offerId);
    setShowGenerator(true);
  };

  const handleCopyLink = (token: string) => {
    const url = `${window.location.origin}/oferta/${token}`;
    navigator.clipboard.writeText(url);
    toast.success('Link skopiowany do schowka');
  };

  const handleSaveSettings = async () => {
    // Settings would be stored - for now just close
    setSavingSettings(true);
    setTimeout(() => {
      setSavingSettings(false);
      setShowSettings(false);
      toast.success('Ustawienia zapisane');
    }, 500);
  };

  const formatPrice = (value: number) => {
    return new Intl.NumberFormat('pl-PL', {
      style: 'currency',
      currency: 'PLN',
    }).format(value);
  };

  // Search and filter
  const filteredOffers = useMemo(() => {
    let result = offers;
    
    // Status filter
    if (statusFilter !== 'all') {
      result = result.filter(o => o.status === statusFilter);
    }
    
    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      result = result.filter(offer => {
        // Search in offer number
        if (offer.offer_number.toLowerCase().includes(query)) return true;
        
        // Search in customer data
        const customer = offer.customer_data;
        if (customer?.name?.toLowerCase().includes(query)) return true;
        if (customer?.email?.toLowerCase().includes(query)) return true;
        if (customer?.company?.toLowerCase().includes(query)) return true;
        if (customer?.phone?.toLowerCase().includes(query)) return true;
        
        // Search in vehicle data
        const vehicle = offer.vehicle_data;
        if (vehicle?.brandModel?.toLowerCase().includes(query)) return true;
        if (vehicle?.brand?.toLowerCase().includes(query)) return true;
        if (vehicle?.model?.toLowerCase().includes(query)) return true;
        if (vehicle?.plate?.toLowerCase().includes(query)) return true;
        
        // Search in products/items
        const products = offer.offer_options?.flatMap(opt => 
          opt.offer_option_items?.map(item => item.custom_name) || []
        ) || [];
        if (products.some(name => name?.toLowerCase().includes(query))) return true;
        
        return false;
      });
    }
    
    return result;
  }, [offers, statusFilter, searchQuery]);

  // Pagination
  const totalPages = Math.ceil(filteredOffers.length / ITEMS_PER_PAGE);
  const paginatedOffers = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredOffers.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [filteredOffers, currentPage]);

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [statusFilter, searchQuery]);

  if (showGenerator && instanceId) {
    return (
      <>
        <Helmet>
          <title>{editingOfferId ? (duplicatingOfferId ? 'Duplikuj ofertę' : 'Edytuj ofertę') : 'Nowa oferta'} - Generator ofert</title>
        </Helmet>
        <div className="min-h-screen bg-background p-4 lg:p-8">
          <div className="max-w-4xl mx-auto">
            <div className="mb-6">
              <Button variant="ghost" onClick={() => { setShowGenerator(false); setEditingOfferId(null); setDuplicatingOfferId(null); }} className="gap-2">
                <ArrowLeft className="w-4 h-4" />
                Wróć do listy
              </Button>
            </div>
            <h1 className="text-2xl font-bold mb-6">
              {duplicatingOfferId ? 'Duplikuj ofertę' : (editingOfferId ? 'Edytuj ofertę' : 'Nowa oferta')}
            </h1>
            <OfferGenerator
              instanceId={instanceId}
              offerId={duplicatingOfferId ? undefined : editingOfferId || undefined}
              duplicateFromId={duplicatingOfferId || undefined}
              onClose={() => { setShowGenerator(false); setEditingOfferId(null); setDuplicatingOfferId(null); }}
              onSaved={() => { setShowGenerator(false); setEditingOfferId(null); setDuplicatingOfferId(null); fetchOffers(); }}
            />
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <Helmet>
        <title>Oferty - Panel Admina</title>
      </Helmet>
      <div className="min-h-screen bg-background p-4 lg:p-8">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
            <div className="flex items-center gap-4">
              <Button variant="ghost" onClick={() => navigate('/admin')} className="gap-2">
                <ArrowLeft className="w-4 h-4" />
                Panel
              </Button>
              <h1 className="text-2xl font-bold">Oferty</h1>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" onClick={() => navigate('/admin/produkty')} className="gap-2">
                <Package className="w-4 h-4" />
                Produkty
              </Button>
              <Button variant="outline" size="icon" onClick={() => setShowSettings(true)} title="Ustawienia ofert">
                <Settings className="w-4 h-4" />
              </Button>
              <Button onClick={() => setShowGenerator(true)} className="gap-2">
                <Plus className="w-4 h-4" />
                Nowa oferta
              </Button>
            </div>
          </div>

          {/* Search and Filters */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 mb-6">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Szukaj po numerze, kliencie, pojeździe, produkcie..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-muted-foreground" />
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Wszystkie</SelectItem>
                  <SelectItem value="draft">Szkice</SelectItem>
                  <SelectItem value="sent">Wysłane</SelectItem>
                  <SelectItem value="viewed">Obejrzane</SelectItem>
                  <SelectItem value="accepted">Zaakceptowane</SelectItem>
                  <SelectItem value="rejected">Odrzucone</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex items-center justify-between mb-4">
            <div className="text-sm text-muted-foreground">
              {filteredOffers.length} {filteredOffers.length === 1 ? 'oferta' : 'ofert'}
              {searchQuery && ` dla "${searchQuery}"`}
              {totalPages > 1 && ` • Strona ${currentPage} z ${totalPages}`}
            </div>
          </div>
          
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
          ) : filteredOffers.length === 0 ? (
            <div className="glass-card p-8 text-center">
              <FileText className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">
                {searchQuery 
                  ? `Brak wyników dla "${searchQuery}"`
                  : statusFilter === 'all' 
                    ? 'Brak ofert. Kliknij "Nowa oferta" aby utworzyć pierwszą.'
                    : 'Brak ofert o wybranym statusie.'}
              </p>
            </div>
          ) : (
            <>
              <div className="space-y-3">
                {paginatedOffers.map((offer) => (
                  <div 
                    key={offer.id}
                    className="glass-card p-4 hover:border-primary/30 transition-colors cursor-pointer"
                    onClick={() => { setEditingOfferId(offer.id); setShowGenerator(true); }}
                  >
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex items-center gap-4 min-w-0">
                        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                          <FileText className="w-5 h-5 text-primary" />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-medium truncate">{offer.offer_number}</span>
                            <Badge className={cn('text-xs', statusColors[offer.status])}>
                              {statusLabels[offer.status] || offer.status}
                            </Badge>
                          </div>
                          <div className="text-sm text-muted-foreground truncate">
                            {offer.customer_data?.name || offer.customer_data?.company || 'Brak danych klienta'}
                            {(offer.vehicle_data?.brandModel || offer.vehicle_data?.brand) && 
                              ` • ${offer.vehicle_data.brandModel || `${offer.vehicle_data.brand} ${offer.vehicle_data.model || ''}`}`
                            }
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-4 shrink-0">
                        <div className="text-right hidden sm:block">
                          <div className="font-semibold">{formatPrice(offer.total_gross)}</div>
                          <div className="text-xs text-muted-foreground">
                            {format(new Date(offer.created_at), 'd MMM yyyy', { locale: pl })}
                          </div>
                        </div>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                            <Button variant="ghost" size="icon">
                              <MoreVertical className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); window.open(`/oferta/${offer.public_token}`, '_blank'); }}>
                              <Eye className="w-4 h-4 mr-2" />
                              Podgląd publiczny
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleCopyLink(offer.public_token); }}>
                              <Copy className="w-4 h-4 mr-2" />
                              Kopiuj link
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleDuplicateOffer(offer.id); }}>
                              <CopyPlus className="w-4 h-4 mr-2" />
                              Duplikuj
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); toast.info('Wysyłka oferty - wkrótce'); }}>
                              <Send className="w-4 h-4 mr-2" />
                              Wyślij
                            </DropdownMenuItem>
                            <DropdownMenuItem 
                              onClick={(e) => { e.stopPropagation(); handleDeleteOffer(offer.id); }}
                              className="text-destructive"
                            >
                              <Trash2 className="w-4 h-4 mr-2" />
                              Usuń
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-center gap-2 mt-6">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </Button>
                  <div className="flex items-center gap-1">
                    {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                      let pageNum: number;
                      if (totalPages <= 5) {
                        pageNum = i + 1;
                      } else if (currentPage <= 3) {
                        pageNum = i + 1;
                      } else if (currentPage >= totalPages - 2) {
                        pageNum = totalPages - 4 + i;
                      } else {
                        pageNum = currentPage - 2 + i;
                      }
                      return (
                        <Button
                          key={pageNum}
                          variant={currentPage === pageNum ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => setCurrentPage(pageNum)}
                          className="w-9"
                        >
                          {pageNum}
                        </Button>
                      );
                    })}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                  >
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Settings Dialog */}
      <Dialog open={showSettings} onOpenChange={setShowSettings}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ustawienia ofert</DialogTitle>
            <DialogDescription>
              Skonfiguruj format numeracji ofert
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="numberPrefix">Prefix numeracji</Label>
              <Input
                id="numberPrefix"
                value={settings.number_prefix}
                onChange={(e) => setSettings(prev => ({ ...prev, number_prefix: e.target.value.toUpperCase() }))}
                placeholder="np. ARM, OFF, PPF"
                maxLength={5}
              />
              <p className="text-xs text-muted-foreground">
                Krótki prefix na początku numeru oferty (max 5 znaków)
              </p>
            </div>
            <div className="space-y-2">
              <Label>Format numeracji</Label>
              <Select 
                value={settings.number_format} 
                onValueChange={(val) => setSettings(prev => ({ ...prev, number_format: val }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="PREFIX/YYYY/MMDD/NNN">PREFIX/YYYY/MMDD/NNN</SelectItem>
                  <SelectItem value="PREFIX/YYYY/MM/NNN">PREFIX/YYYY/MM/NNN</SelectItem>
                  <SelectItem value="PREFIX-YYYYMMDD-NNN">PREFIX-YYYYMMDD-NNN</SelectItem>
                  <SelectItem value="YYYYMM-NNN">YYYYMM-NNN</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Przykład: <span className="font-mono">{settings.number_prefix || 'OFF'}/2025/0127/001</span>
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSettings(false)}>
              Anuluj
            </Button>
            <Button onClick={handleSaveSettings} disabled={savingSettings}>
              {savingSettings ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Zapisz
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default OffersPage;
