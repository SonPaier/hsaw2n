import { useState, useEffect, useMemo } from 'react';
import { Helmet } from 'react-helmet-async';
import { useSearchParams } from 'react-router-dom';
import { Plus, FileText, Eye, Send, Trash2, Copy, MoreVertical, Loader2, Filter, Search, Settings, CopyPlus, ChevronLeft, ChevronRight, Package, ArrowLeft, ClipboardCopy, RefreshCw } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { OfferGenerator } from '@/components/offers/OfferGenerator';
import { OfferSettingsDialog } from '@/components/offers/settings/OfferSettingsDialog';
import { SendOfferEmailDialog } from './SendOfferEmailDialog';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { pl } from 'date-fns/locale';
import { cn } from '@/lib/utils';

const PAGE_SIZE_OPTIONS = [20, 50, 100];

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
  approved_at?: string | null;
}

interface OfferWithOptions extends Offer {
  offer_options?: {
    id: string;
    scope_id?: string | null;
    offer_option_items?: {
      custom_name?: string;
    }[];
  }[];
  offer_scopes?: {
    id: string;
    name: string;
  }[];
}

const statusColors: Record<string, string> = {
  draft: 'bg-slate-200 text-slate-600',
  sent: 'bg-blue-500/20 text-blue-600',
  viewed: 'bg-amber-500/20 text-amber-600',
  accepted: 'bg-green-500/20 text-green-600',
  rejected: 'bg-red-500/20 text-red-600',
  expired: 'bg-gray-500/20 text-gray-500',
};

const STATUS_OPTIONS = ['draft', 'sent', 'viewed', 'accepted', 'rejected'] as const;

interface InstanceData {
  name?: string;
  email?: string;
  phone?: string;
  address?: string;
  website?: string;
  contact_person?: string;
  slug?: string;
  offer_email_template?: string;
}

interface OffersViewProps {
  instanceId: string | null;
  instanceData?: InstanceData | null;
  onNavigateToProducts: () => void;
}

export default function OffersView({ instanceId, instanceData, onNavigateToProducts }: OffersViewProps) {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const [showGenerator, setShowGenerator] = useState(false);
  const [editingOfferId, setEditingOfferId] = useState<string | null>(null);
  const [duplicatingOfferId, setDuplicatingOfferId] = useState<string | null>(null);
  const [offers, setOffers] = useState<OfferWithOptions[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Read initial pagination from URL
  const initialPage = parseInt(searchParams.get('page') || '1', 10);
  const initialPageSize = parseInt(searchParams.get('pageSize') || '20', 10);
  const [currentPage, setCurrentPage] = useState(isNaN(initialPage) || initialPage < 1 ? 1 : initialPage);
  const [pageSize, setPageSize] = useState(PAGE_SIZE_OPTIONS.includes(initialPageSize) ? initialPageSize : 20);
  
  const [showScopesSettings, setShowScopesSettings] = useState(false);
  
  // Email dialog state
  const [sendEmailDialogOpen, setSendEmailDialogOpen] = useState(false);
  const [selectedOfferForEmail, setSelectedOfferForEmail] = useState<OfferWithOptions | null>(null);
  
  // Delete confirmation dialog state
  const [deleteOfferDialog, setDeleteOfferDialog] = useState<{ open: boolean; offer: OfferWithOptions | null }>({ open: false, offer: null });

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
            scope_id,
            offer_option_items (
              custom_name
            )
          )
        `)
        .eq('instance_id', instanceId)
        .order('created_at', { ascending: false });
      
      if (error) throw error;

      // Fetch unique scope names for badges
      const scopeIds = [...new Set((data || []).flatMap(o => 
        o.offer_options?.map((opt: { scope_id?: string | null }) => opt.scope_id).filter(Boolean) || []
      ))];

      let scopesMap: Record<string, string> = {};
      if (scopeIds.length > 0) {
        const { data: scopesData } = await supabase
          .from('offer_scopes')
          .select('id, name')
          .in('id', scopeIds);
        scopesMap = (scopesData || []).reduce((acc, s) => ({ ...acc, [s.id]: s.name }), {});
      }

      // Attach scope names to offers
      const offersWithScopes = (data || []).map(o => ({
        ...o,
        offer_scopes: [...new Set(o.offer_options?.map((opt: { scope_id?: string | null }) => opt.scope_id).filter(Boolean) || [])]
          .map(id => ({ id, name: scopesMap[id as string] || '' }))
          .filter(s => s.name)
      }));

      setOffers(offersWithScopes as OfferWithOptions[]);
    } catch (error) {
      console.error('Error fetching offers:', error);
      toast.error(t('offers.errors.fetchError'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOffers();
  }, [instanceId]);

  const handleDeleteOffer = async (offerId: string) => {
    try {
      const { error } = await supabase.from('offers').delete().eq('id', offerId);
      if (error) throw error;
      setOffers(prev => prev.filter(o => o.id !== offerId));
      toast.success(t('offers.deleteSuccess'));
    } catch (error) {
      console.error('Error deleting offer:', error);
      toast.error(t('offers.errors.deleteError'));
    }
  };

  const handleDuplicateOffer = async (offerId: string) => {
    setDuplicatingOfferId(offerId);
    setEditingOfferId(offerId);
    setShowGenerator(true);
  };

  const handleCopyLink = (token: string) => {
    const hostname = window.location.hostname;
    let publicUrl: string;
    
    // On admin subdomain (armcar.admin.n2wash.com) → generate link to public (armcar.n2wash.com)
    if (hostname.endsWith('.admin.n2wash.com')) {
      const instanceSlug = hostname.replace('.admin.n2wash.com', '');
      publicUrl = `https://${instanceSlug}.n2wash.com/offers/${token}`;
    } else if (hostname.endsWith('.n2wash.com')) {
      // Already on public subdomain
      publicUrl = `${window.location.origin}/offers/${token}`;
    } else {
      // Dev/staging - use origin
      publicUrl = `${window.location.origin}/offers/${token}`;
    }
    
    navigator.clipboard.writeText(publicUrl);
    toast.success(t('offers.linkCopied'));
  };

  const handleCopyOfferNumber = (offerNumber: string, e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(offerNumber);
    toast.success(t('offers.offerNumberCopied'));
  };

  const handleChangeStatus = async (offerId: string, newStatus: string) => {
    try {
      const updateData: Record<string, unknown> = { status: newStatus };
      if (newStatus === 'sent') updateData.sent_at = new Date().toISOString();
      
      const { error } = await supabase
        .from('offers')
        .update(updateData)
        .eq('id', offerId);
      
      if (error) throw error;
      
      setOffers(prev => prev.map(o => 
        o.id === offerId ? { ...o, status: newStatus } : o
      ));
      toast.success(t('offers.statusChanged'));
    } catch (error) {
      console.error('Error changing status:', error);
      toast.error(t('offers.errors.statusChangeError'));
    }
  };

  const handleOpenSendEmailDialog = (offer: OfferWithOptions) => {
    if (!offer.customer_data?.email) {
      toast.error(t('offers.noCustomerEmail'));
      return;
    }
    setSelectedOfferForEmail(offer);
    setSendEmailDialogOpen(true);
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
        if (offer.offer_number.toLowerCase().includes(query)) return true;
        
        const customer = offer.customer_data;
        if (customer?.name?.toLowerCase().includes(query)) return true;
        if (customer?.email?.toLowerCase().includes(query)) return true;
        if (customer?.company?.toLowerCase().includes(query)) return true;
        if (customer?.phone?.toLowerCase().includes(query)) return true;
        
        const vehicle = offer.vehicle_data;
        if (vehicle?.brandModel?.toLowerCase().includes(query)) return true;
        if (vehicle?.brand?.toLowerCase().includes(query)) return true;
        if (vehicle?.model?.toLowerCase().includes(query)) return true;
        if (vehicle?.plate?.toLowerCase().includes(query)) return true;
        
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
  const totalPages = Math.ceil(filteredOffers.length / pageSize);
  const paginatedOffers = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    return filteredOffers.slice(startIndex, startIndex + pageSize);
  }, [filteredOffers, currentPage, pageSize]);

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [statusFilter, searchQuery]);

  if (showGenerator && instanceId) {
    return (
      <>
        <Helmet>
          <title>{editingOfferId ? (duplicatingOfferId ? t('offers.duplicateOffer') : t('offers.editOffer')) : t('offers.newOffer')} - {t('offers.generator')}</title>
        </Helmet>
        <div className="max-w-4xl mx-auto">
          <div className="mb-6">
            <Button variant="ghost" onClick={() => { setShowGenerator(false); setEditingOfferId(null); setDuplicatingOfferId(null); }} className="gap-2">
              <ArrowLeft className="w-4 h-4" />
              {t('offers.backToList')}
            </Button>
          </div>
          <h1 className="text-2xl font-bold mb-6">
            {duplicatingOfferId ? t('offers.duplicateOffer') : (editingOfferId ? t('offers.editOffer') : t('offers.newOffer'))}
          </h1>
          <OfferGenerator
            instanceId={instanceId}
            offerId={duplicatingOfferId ? undefined : editingOfferId || undefined}
            duplicateFromId={duplicatingOfferId || undefined}
            onClose={() => { setShowGenerator(false); setEditingOfferId(null); setDuplicatingOfferId(null); }}
            onSaved={async () => { 
              await fetchOffers();
              setShowGenerator(false); 
              setEditingOfferId(null); 
              setDuplicatingOfferId(null); 
            }}
          />
        </div>
      </>
    );
  }

  return (
    <>
      <Helmet>
        <title>{t('offers.title')} - {t('common.adminPanel')}</title>
      </Helmet>
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
          <h1 className="text-2xl font-bold">{t('offers.title')}</h1>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={onNavigateToProducts} className="gap-2 px-2 sm:px-4">
              <Package className="w-4 h-4" />
              <span className="hidden sm:inline">{t('offers.products')}</span>
            </Button>
            <Button variant="outline" onClick={() => setShowScopesSettings(true)} className="gap-2 px-2 sm:px-4">
              <Settings className="w-4 h-4" />
              <span className="hidden sm:inline">{t('offers.settings')}</span>
            </Button>
            <Button onClick={() => setShowGenerator(true)} className="gap-2">
              <Plus className="w-4 h-4" />
              {t('offers.newOffer')}
            </Button>
          </div>
        </div>

        {/* Search and Filters */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder={t('offers.searchPlaceholder')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-muted-foreground" />
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder={t('offers.status')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('offers.statusAll')}</SelectItem>
                <SelectItem value="draft">{t('offers.statusDraft')}</SelectItem>
                <SelectItem value="sent">{t('offers.statusSent')}</SelectItem>
                <SelectItem value="viewed">{t('offers.statusViewed')}</SelectItem>
                <SelectItem value="accepted">{t('offers.statusAccepted')}</SelectItem>
                <SelectItem value="rejected">{t('offers.statusRejected')}</SelectItem>
              </SelectContent>
            </Select>
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
                ? t('offers.noResultsFor', { query: searchQuery })
                : statusFilter === 'all' 
                  ? t('offers.noOffers')
                  : t('offers.noOffersForStatus')}
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
                          <button
                            onClick={(e) => handleCopyOfferNumber(offer.offer_number, e)}
                            className="p-1 hover:bg-secondary/80 rounded transition-colors"
                            title={t('offers.copyOfferNumber')}
                          >
                            <ClipboardCopy className="w-3.5 h-3.5 text-muted-foreground hover:text-foreground" />
                          </button>
                          <Badge className={cn('text-xs', statusColors[offer.approved_at ? 'accepted' : offer.status])}>
                            {offer.approved_at ? t('offers.statusAccepted') : t(`offers.status${offer.status.charAt(0).toUpperCase() + offer.status.slice(1)}`, offer.status)}
                          </Badge>
                        </div>
                        <div className="text-sm text-muted-foreground truncate">
                          {offer.customer_data?.name || offer.customer_data?.company || t('offers.noCustomer')}
                          {offer.vehicle_data?.brandModel && ` • ${offer.vehicle_data.brandModel}`}
                        </div>
                        {offer.offer_scopes && offer.offer_scopes.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1">
                            {offer.offer_scopes.map((scope) => (
                              <Badge key={scope.id} variant="secondary" className="text-xs">
                                {scope.name}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right hidden sm:block">
                        <div className="font-medium">
                          {offer.approved_at ? formatPrice(offer.total_gross) : <span className="text-muted-foreground text-sm">—</span>}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          Utworzono: {format(new Date(offer.created_at), 'dd.MM.yyyy', { locale: pl })}
                        </div>
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" onClick={e => e.stopPropagation()}>
                            <MoreVertical className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={(e) => { e.stopPropagation(); window.open(`/offers/${offer.public_token}`, '_blank'); }}>
                            <Eye className="w-4 h-4 mr-2" />
                            {t('offers.preview')}
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleCopyLink(offer.public_token); }}>
                            <Copy className="w-4 h-4 mr-2" />
                            {t('offers.copyLink')}
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleDuplicateOffer(offer.id); }}>
                            <CopyPlus className="w-4 h-4 mr-2" />
                            {t('offers.duplicate')}
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleOpenSendEmailDialog(offer); }}>
                            <Send className="w-4 h-4 mr-2" />
                            {t('offers.send')}
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuSub>
                            <DropdownMenuSubTrigger onClick={(e) => e.stopPropagation()}>
                              <RefreshCw className="w-4 h-4 mr-2" />
                              {t('offers.changeStatus')}
                            </DropdownMenuSubTrigger>
                            <DropdownMenuSubContent>
                              {STATUS_OPTIONS.map((status) => (
                                <DropdownMenuItem
                                  key={status}
                                  onClick={(e) => { e.stopPropagation(); handleChangeStatus(offer.id, status); }}
                                  disabled={offer.status === status}
                                >
                                  <Badge className={cn('text-xs mr-2', statusColors[status])}>
                                    {t(`offers.status${status.charAt(0).toUpperCase() + status.slice(1)}`)}
                                  </Badge>
                                </DropdownMenuItem>
                              ))}
                            </DropdownMenuSubContent>
                          </DropdownMenuSub>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem 
                            onClick={(e) => { e.stopPropagation(); setDeleteOfferDialog({ open: true, offer }); }}
                            className="text-destructive focus:text-destructive"
                          >
                            <Trash2 className="w-4 h-4 mr-2" />
                            {t('offers.delete')}
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
              <div className="flex items-center justify-between mt-6 pt-4 border-t">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <span>{t('offers.show')}</span>
                  <Select value={String(pageSize)} onValueChange={v => { setPageSize(Number(v)); setCurrentPage(1); }}>
                    <SelectTrigger className="w-20 h-8">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PAGE_SIZE_OPTIONS.map(size => (
                        <SelectItem key={size} value={String(size)}>{size}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <span>{t('offers.perPage')}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8"
                    disabled={currentPage === 1}
                    onClick={() => setCurrentPage(p => p - 1)}
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </Button>
                  <span className="text-sm text-muted-foreground px-2">
                    {currentPage} / {totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8"
                    disabled={currentPage === totalPages}
                    onClick={() => setCurrentPage(p => p + 1)}
                  >
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Scopes Settings Dialog */}
      {instanceId && (
        <OfferSettingsDialog
          open={showScopesSettings}
          onOpenChange={setShowScopesSettings}
          instanceId={instanceId}
        />
      )}

      {/* Send Email Dialog */}
      {selectedOfferForEmail && (
        <SendOfferEmailDialog
          open={sendEmailDialogOpen}
          onOpenChange={setSendEmailDialogOpen}
          offer={selectedOfferForEmail}
          instanceData={instanceData || null}
          onSent={fetchOffers}
        />
      )}

      {/* Delete Offer Confirmation Dialog */}
      <ConfirmDialog
        open={deleteOfferDialog.open}
        onOpenChange={(open) => !open && setDeleteOfferDialog({ open: false, offer: null })}
        title={t('offers.confirmDeleteTitle')}
        description={t('offers.confirmDeleteDesc', { number: deleteOfferDialog.offer?.offer_number || '' })}
        confirmLabel={t('common.delete')}
        cancelLabel={t('common.cancel')}
        variant="destructive"
        onConfirm={() => {
          if (deleteOfferDialog.offer) {
            handleDeleteOffer(deleteOfferDialog.offer.id);
            setDeleteOfferDialog({ open: false, offer: null });
          }
        }}
      />
    </>
  );
}
