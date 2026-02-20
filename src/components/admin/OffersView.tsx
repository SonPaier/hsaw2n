import { useState, useEffect, useMemo } from 'react';
import { Helmet } from 'react-helmet-async';
import { useSearchParams, useLocation } from 'react-router-dom';
import { Plus, FileText, Eye, Send, Trash2, Copy, MoreVertical, Loader2, Filter, Search, Settings, CopyPlus, ChevronLeft, ChevronRight, ArrowLeft, ClipboardCopy, RefreshCw, CheckCircle, CheckCheck, Bell, Receipt, Layers, Banknote, Phone, CalendarPlus } from 'lucide-react';
import { normalizeSearchQuery, formatViewedDate } from '@/lib/textUtils';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
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
import { MarkOfferCompletedDialog } from '@/components/offers/MarkOfferCompletedDialog';
import { OfferRemindersDialog } from '@/components/offers/OfferRemindersDialog';
import { OfferSelectionDialog } from '@/components/offers/OfferSelectionDialog';

import { OfferServicesListView } from '@/components/offers/services/OfferServicesListView';
import { OfferServiceEditView } from '@/components/offers/services/OfferServiceEditView';
import { AdminOfferApprovalDialog } from '@/components/offers/AdminOfferApprovalDialog';
import { OfferFollowUpStatus } from './OfferFollowUpStatus';
import { OfferPreviewDialogByToken } from './OfferPreviewDialogByToken';
import { OfferViewsDialog } from '@/components/offers/OfferViewsDialog';
import { useOfferScopes } from '@/hooks/useOfferScopes';
import { useWorkingHours } from '@/hooks/useWorkingHours';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { pl } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { Textarea } from '@/components/ui/textarea';
import AddReservationDialogV2 from './AddReservationDialogV2';

const PAGE_SIZE_OPTIONS = [20, 50, 100];

interface SelectedState {
  selectedVariants?: Record<string, string>;
  selectedUpsells?: Record<string, boolean>;
  selectedOptionalItems?: Record<string, boolean>;
  selectedScopeId?: string | null;
  selectedItemInOption?: Record<string, string>;
}

type FollowUpPhoneStatus = 'called_discussed' | 'call_later' | 'called_no_answer' | null;

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
  source?: string;
  total_net: number;
  total_gross: number;
  admin_approved_net?: number | null;
  admin_approved_gross?: number | null;
  created_at: string;
  valid_until?: string;
  public_token: string;
  approved_at?: string | null;
  viewed_at?: string | null;
  selected_state?: SelectedState | null;
  follow_up_phone_status?: FollowUpPhoneStatus;
  internal_notes?: string | null;
}

interface OfferWithOptions extends Offer {
  offer_options?: {
    id: string;
    name?: string;
    scope_id?: string | null;
    is_upsell?: boolean;
    subtotal_net?: number;
    offer_option_items?: {
      id: string;
      custom_name?: string;
      unit_price?: number;
      quantity?: number;
      discount_percent?: number;
      product_id?: string | null;
    }[];
  }[];
  offer_scopes?: {
    id: string;
    name: string;
  }[];
  selectedOptionName?: string;
  vat_rate?: number;
}

const statusColors: Record<string, string> = {
  draft: 'bg-slate-200 text-slate-600',
  sent: 'bg-blue-500/20 text-blue-600',
  viewed: 'bg-amber-500/20 text-amber-600',
  accepted: 'bg-green-500/20 text-green-600',
  rejected: 'bg-red-500/20 text-red-600',
  expired: 'bg-gray-500/20 text-gray-500',
  completed: 'bg-emerald-600/20 text-emerald-700',
};

const STATUS_OPTIONS = ['draft', 'sent', 'viewed', 'accepted', 'rejected', 'completed'] as const;

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
}

export default function OffersView({ instanceId, instanceData }: OffersViewProps) {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const location = useLocation();
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
  
  // Mark as completed dialog state
  const [completeOfferDialog, setCompleteOfferDialog] = useState<{ open: boolean; offer: OfferWithOptions | null }>({ open: false, offer: null });
  
  // Reminders dialog state
  const [remindersDialog, setRemindersDialog] = useState<{ open: boolean; offer: OfferWithOptions | null }>({ open: false, offer: null });
  
  // Selection dialog state
  const [selectionDialog, setSelectionDialog] = useState<{ open: boolean; offer: OfferWithOptions | null }>({ open: false, offer: null });


  // Admin approval dialog state
  const [approvalDialog, setApprovalDialog] = useState<{ 
    open: boolean; 
    offer: OfferWithOptions | null;
    mode: 'approve' | 'edit';
  }>({ open: false, offer: null, mode: 'approve' });

  // Services view state
  const [showServicesView, setShowServicesView] = useState(false);
  const [editingServiceId, setEditingServiceId] = useState<string | null>(null);

  // Preview dialog state
  const [previewDialog, setPreviewDialog] = useState<{ open: boolean; token: string | null }>({ open: false, token: null });

   // Internal note drawer state
  const [noteDrawer, setNoteDrawer] = useState<{ open: boolean; offerId: string; notes: string }>({ open: false, offerId: '', notes: '' });

  // View history dialog state
  const [viewsDialog, setViewsDialog] = useState<{ open: boolean; offerId: string; viewedAt: string | null }>({ open: false, offerId: '', viewedAt: null });

  // Reservation from offer state
  const [reservationFromOffer, setReservationFromOffer] = useState<{
    open: boolean;
    offer: OfferWithOptions | null;
  }>({ open: false, offer: null });

  // CACHED HOOK - offer scopes with 7-day staleTime
  const { data: cachedScopes = [] } = useOfferScopes(instanceId);
  const { data: workingHours } = useWorkingHours(instanceId);
  
  // Build scopes map from cached data
  const scopesMap = useMemo(() => {
    const map: Record<string, string> = {};
    cachedScopes.forEach(s => { map[s.id] = s.name; });
    return map;
  }, [cachedScopes]);

  // Reactively map scope names onto offers — recalculates when scopesMap arrives from React Query
  // This fixes the race condition where fetchOffers runs before cachedScopes are loaded
  const offersWithMappedScopes = useMemo(() => {
    return offers.map(o => {
      let selectedOptionName: string | undefined;
      const selectedState = o.selected_state as unknown as SelectedState | null;
      if (selectedState?.selectedVariants && o.offer_options) {
        const selectedOptionIds = Object.values(selectedState.selectedVariants).filter(Boolean);
        if (selectedOptionIds.length > 0) {
          const selectedOption = o.offer_options.find(opt => selectedOptionIds.includes(opt.id));
          selectedOptionName = selectedOption?.name;
        }
      }
      return {
        ...o,
        offer_scopes: [...new Set(
          o.offer_options?.map(opt => opt.scope_id).filter(Boolean) || []
        )]
          .map(id => ({ id, name: scopesMap[id as string] || '' }))
          .filter(s => s.name && s.name !== 'Dodatki'),
        selectedOptionName,
      };
    });
  }, [offers, scopesMap]);

  // Reset generator state when clicking sidebar link (same route navigation)
  useEffect(() => {
    if (showGenerator || showServicesView) {
      setShowGenerator(false);
      setShowServicesView(false);
      setEditingOfferId(null);
      setDuplicatingOfferId(null);
      setEditingServiceId(null);
      fetchOffers();
    }
  }, [location.key]);

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
            name,
            scope_id,
            is_upsell,
            subtotal_net,
            offer_option_items (
              id,
              custom_name,
              unit_price,
              quantity,
              discount_percent,
              product_id
            )
          )
        `)
        .eq('instance_id', instanceId)
        .order('created_at', { ascending: false });
      
      if (error) throw error;

      // Store raw offers — scope name mapping is done reactively in useMemo below
      setOffers((data || []) as OfferWithOptions[]);
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

  const handleApproveOffer = async (
    offerId: string, 
    netAmount: number, 
    grossAmount: number,
    changeStatus: boolean
  ) => {
    try {
      const { data: userData } = await supabase.auth.getUser();
      const updateData: Record<string, unknown> = {
        admin_approved_net: netAmount,
        admin_approved_gross: grossAmount,
      };
      
      if (changeStatus) {
        updateData.status = 'accepted';
        updateData.approved_at = new Date().toISOString();
        updateData.approved_by = userData?.user?.id;
      }
      
      const { error } = await supabase
        .from('offers')
        .update(updateData)
        .eq('id', offerId);
      
      if (error) throw error;
      
      await fetchOffers();
      toast.success(changeStatus ? t('offers.statusChanged') : 'Kwota została zmieniona');
    } catch (error) {
      console.error('Error approving offer:', error);
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

  const handleFollowUpStatusChange = async (offerId: string, newStatus: FollowUpPhoneStatus) => {
    try {
      const { error } = await supabase
        .from('offers')
        .update({ follow_up_phone_status: newStatus })
        .eq('id', offerId);
      
      if (error) throw error;
      
      setOffers(prev => prev.map(o => 
        o.id === offerId ? { ...o, follow_up_phone_status: newStatus } : o
      ));
    } catch (error) {
      console.error('Error updating follow-up status:', error);
      toast.error('Błąd aktualizacji statusu');
    }
  };

  const handleOpenNoteDrawer = (offer: OfferWithOptions) => {
    setNoteDrawer({ open: true, offerId: offer.id, notes: offer.internal_notes || '' });
  };

  const handleSaveNote = async () => {
    try {
      const { error } = await supabase
        .from('offers')
        .update({ 
          internal_notes: noteDrawer.notes || null,
          follow_up_phone_status: 'called_discussed',
        })
        .eq('id', noteDrawer.offerId);
      
      if (error) throw error;
      
      setOffers(prev => prev.map(o => 
        o.id === noteDrawer.offerId 
          ? { ...o, internal_notes: noteDrawer.notes || null, follow_up_phone_status: 'called_discussed' as FollowUpPhoneStatus } 
          : o
      ));
      setNoteDrawer({ open: false, offerId: '', notes: '' });
      toast.success('Notatka zapisana');
    } catch (error) {
      console.error('Error saving note:', error);
      toast.error('Błąd zapisu notatki');
    }
  };

  const handleReserveFromOffer = (offer: OfferWithOptions) => {
    setReservationFromOffer({ open: true, offer });
  };

  const getReservationDataFromOffer = (offer: OfferWithOptions) => {
    // Extract unique product_ids from offer_option_items
    const serviceIds = [...new Set(
      offer.offer_options?.flatMap(opt => 
        opt.offer_option_items?.map(item => item.product_id).filter(Boolean) || []
      ) || []
    )] as string[];

    return {
      customer_name: offer.customer_data?.name || '',
      customer_phone: offer.customer_data?.phone || '',
      vehicle_plate: offer.vehicle_data?.brandModel || offer.vehicle_data?.plate || '',
      admin_notes: offer.internal_notes || undefined,
      offer_number: offer.offer_number,
      price: offer.admin_approved_gross ?? offer.total_gross ?? undefined,
      has_unified_services: true,
      service_ids: serviceIds.length > 0 ? serviceIds : undefined,
    };
  };

  const formatPrice = (value: number) => {
    return new Intl.NumberFormat('pl-PL', {
      style: 'currency',
      currency: 'PLN',
    }).format(value);
  };

  // Search and filter — use offersWithMappedScopes so scope pills are always reactive
  const filteredOffers = useMemo(() => {
    let result = offersWithMappedScopes;
    
    // Status filter
    if (statusFilter !== 'all') {
      result = result.filter(o => o.status === statusFilter);
    }
    
    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      const normalizedQuery = normalizeSearchQuery(query);
      result = result.filter(offer => {
        if (normalizeSearchQuery(offer.offer_number).toLowerCase().includes(normalizedQuery)) return true;
        
        const customer = offer.customer_data;
        if (customer?.name?.toLowerCase().includes(query)) return true;
        if (customer?.email?.toLowerCase().includes(query)) return true;
        if (customer?.company?.toLowerCase().includes(query)) return true;
        if (customer?.phone && normalizeSearchQuery(customer.phone).includes(normalizedQuery)) return true;
        
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
  }, [offersWithMappedScopes, statusFilter, searchQuery]);

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
          <div className="mb-2">
            <Button variant="ghost" onClick={async () => { 
              await fetchOffers();
              setShowGenerator(false); 
              setEditingOfferId(null); 
              setDuplicatingOfferId(null); 
            }} className="gap-2">
              <ArrowLeft className="w-4 h-4" />
              {t('offers.backToList')}
            </Button>
          </div>
          <h1 className="text-2xl font-bold mb-4">
            {duplicatingOfferId ? t('offers.duplicateOffer') : (editingOfferId ? t('offers.editOffer') : t('offers.newOffer'))}
          </h1>
          <OfferGenerator
            instanceId={instanceId}
            offerId={duplicatingOfferId ? undefined : editingOfferId || undefined}
            duplicateFromId={duplicatingOfferId || undefined}
            onClose={async () => { 
              await fetchOffers();
              setShowGenerator(false); 
              setEditingOfferId(null); 
              setDuplicatingOfferId(null); 
            }}
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

  // Show services list view
  if (showServicesView && instanceId && !editingServiceId) {
    return (
      <OfferServicesListView
        instanceId={instanceId}
        onBack={() => setShowServicesView(false)}
        onEdit={(scopeId) => setEditingServiceId(scopeId)}
        onCreate={() => setEditingServiceId('new')}
      />
    );
  }

  // Show service edit/create view
  if (showServicesView && instanceId && editingServiceId) {
    return (
      <OfferServiceEditView
        instanceId={instanceId}
        scopeId={editingServiceId === 'new' ? undefined : editingServiceId}
        onBack={() => setEditingServiceId(null)}
      />
    );
  }

  return (
    <>
      <Helmet>
        <title>{t('offers.title')} - {t('common.adminPanel')}</title>
      </Helmet>
      <div className="max-w-3xl mx-auto pb-24">
        <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
          <h1 className="text-2xl font-bold">{t('offers.title')}</h1>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" onClick={() => setShowServicesView(true)} className="sm:w-auto sm:px-4 w-10 h-10 bg-white">
              <Layers className="w-4 h-4" />
              <span className="hidden sm:inline ml-2">Twoje Szablony</span>
            </Button>
            <Button variant="outline" size="icon" onClick={() => setShowScopesSettings(true)} className="sm:w-auto sm:px-4 w-10 h-10 bg-white">
              <Settings className="w-4 h-4" />
              <span className="hidden sm:inline ml-2">{t('offers.settings')}</span>
            </Button>
            <Button onClick={() => setShowGenerator(true)}>
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
                <SelectItem value="completed">{t('offers.statusCompleted')}</SelectItem>
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
            <div className="space-y-3 pb-24 lg:pb-0">
              {paginatedOffers.map((offer) => (
                <div 
                  key={offer.id}
                  className="glass-card p-4 hover:border-primary/30 transition-colors cursor-pointer relative"
                  onClick={() => { setEditingOfferId(offer.id); setShowGenerator(true); }}
                >
                  {/* MOBILE LAYOUT */}
                  <div className="md:hidden">
                    {/* Ellipsis menu — absolute top right */}
                    <div className="absolute top-3 right-3">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={e => e.stopPropagation()}>
                            <MoreVertical className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {offer.customer_data?.phone && (
                            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); window.location.href = `tel:${offer.customer_data.phone}`; }}>
                              <Phone className="w-4 h-4 mr-2" />
                              Zadzwoń
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem onClick={(e) => { e.stopPropagation(); setPreviewDialog({ open: true, token: offer.public_token }); }}>
                            <Eye className="w-4 h-4 mr-2" />
                            {t('offers.preview')}
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleCopyLink(offer.public_token); }}>
                            <Copy className="w-4 h-4 mr-2" />
                            {t('offers.copyLink')}
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleReserveFromOffer(offer); }}>
                            <CalendarPlus className="w-4 h-4 mr-2" />
                            Rezerwuj
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
                              {STATUS_OPTIONS.filter(s => s !== 'completed').map((status) => (
                                <DropdownMenuItem
                                  key={status}
                                  onClick={(e) => { 
                                    e.stopPropagation(); 
                                    if (status === 'accepted') {
                                      setApprovalDialog({ open: true, offer, mode: 'approve' });
                                    } else {
                                      handleChangeStatus(offer.id, status);
                                    }
                                  }}
                                  disabled={offer.status === status}
                                >
                                  <Badge className={cn('text-xs mr-2', statusColors[status])}>
                                    {t(`offers.status${status.charAt(0).toUpperCase() + status.slice(1)}`)}
                                  </Badge>
                                </DropdownMenuItem>
                              ))}
                              <DropdownMenuItem
                                onClick={(e) => { 
                                  e.stopPropagation(); 
                                  if (offer.status === 'accepted' || offer.approved_at) {
                                    setCompleteOfferDialog({ open: true, offer });
                                  } else {
                                    handleChangeStatus(offer.id, 'completed');
                                  }
                                }}
                                disabled={offer.status === 'completed'}
                              >
                                <Badge className={cn('text-xs mr-2', statusColors['completed'])}>
                                  {t('offers.statusCompleted')}
                                </Badge>
                              </DropdownMenuItem>
                            </DropdownMenuSubContent>
                          </DropdownMenuSub>
                          {(offer.status === 'accepted' || offer.approved_at) && offer.status !== 'completed' && (
                            <>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem 
                                onClick={(e) => { e.stopPropagation(); setCompleteOfferDialog({ open: true, offer }); }}
                                className="text-emerald-600 focus:text-emerald-600"
                              >
                                <CheckCheck className="w-4 h-4 mr-2" />
                                {t('offers.markAsCompleted')}
                              </DropdownMenuItem>
                            </>
                          )}
                          {offer.status === 'completed' && (
                            <>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem 
                                onClick={(e) => { e.stopPropagation(); setRemindersDialog({ open: true, offer }); }}
                              >
                                <Bell className="w-4 h-4 mr-2" />
                                {t('offers.reminders')}
                              </DropdownMenuItem>
                            </>
                          )}
                          {(offer.status === 'accepted' || offer.status === 'completed') && (
                            <DropdownMenuItem 
                              onClick={(e) => { 
                                e.stopPropagation(); 
                                setApprovalDialog({ open: true, offer, mode: 'edit' }); 
                              }}
                            >
                              <Banknote className="w-4 h-4 mr-2" />
                              Zmień kwotę
                            </DropdownMenuItem>
                          )}
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

                    {/* Line 1: Customer name + vehicle */}
                    <div className="flex items-baseline gap-1 font-semibold text-base leading-tight pr-10">
                      <span className="truncate">
                        {offer.customer_data?.name || offer.customer_data?.company || t('offers.noCustomer')}
                      </span>
                      {offer.vehicle_data?.brandModel && (
                        <>
                          <span className="text-muted-foreground font-normal">·</span>
                          <span className="text-muted-foreground font-normal truncate">{offer.vehicle_data.brandModel}</span>
                        </>
                      )}
                    </div>

                    {/* Line 2: Status badge */}
                    <div className="mt-2">
                      {offer.status === 'viewed' && offer.viewed_at ? (
                        <button
                          onClick={(e) => { e.stopPropagation(); setViewsDialog({ open: true, offerId: offer.id, viewedAt: offer.viewed_at ?? null }); }}
                          className="inline-flex"
                        >
                          <Badge className={cn('text-xs cursor-pointer hover:opacity-80', statusColors[offer.status])}>
                            <Eye className="w-3 h-3 mr-1" />
                            Obejrzana {formatViewedDate(offer.viewed_at)}
                          </Badge>
                        </button>
                      ) : (
                        <Badge className={cn('text-xs', statusColors[offer.status])}>
                          {t(`offers.status${offer.status.charAt(0).toUpperCase() + offer.status.slice(1)}`, offer.status)}
                        </Badge>
                      )}
                      {(offer.admin_approved_gross || offer.approved_at) && (
                        <span className="text-sm font-medium ml-2">
                          {formatPrice(offer.admin_approved_gross ?? offer.total_gross)}
                        </span>
                      )}
                    </div>

                    {/* Line 3: Offer number + created date */}
                    <div className="flex items-center gap-1 text-xs text-muted-foreground mt-2">
                      <span>{offer.offer_number}</span>
                      <span>·</span>
                      <span>Utworzono {format(new Date(offer.created_at), 'dd.MM.yyyy', { locale: pl })}</span>
                      {offer.source === 'website' && (
                        <>
                          <span>·</span>
                          <span className="text-blue-600">WWW</span>
                        </>
                      )}
                    </div>

                    {/* Line 4: Service pills */}
                    {offer.offer_scopes && offer.offer_scopes.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {offer.offer_scopes.map((scope) => {
                          const matchingOption = offer.offer_options?.find(opt => opt.scope_id === scope.id && !opt.is_upsell);
                          const scopePrice = matchingOption?.subtotal_net;
                          return (
                            <Badge key={scope.id} variant="secondary" className="text-xs bg-muted/20 text-foreground font-normal">
                              {scope.name}{scopePrice != null && scopePrice > 0 ? `: ${Math.round(scopePrice)} zł` : ''}
                            </Badge>
                          );
                        })}
                        {(offer.approved_at || offer.status === 'accepted' || offer.status === 'completed') && offer.selectedOptionName && (
                          <Badge className="text-xs bg-green-100 text-green-700 border-green-200">
                            {offer.selectedOptionName}
                          </Badge>
                        )}
                      </div>
                    )}

                    {/* Line 5: Follow-up phone status */}
                    {offer.customer_data?.phone && (
                      <div className="mt-3">
                        <OfferFollowUpStatus
                          offerId={offer.id}
                          currentStatus={offer.follow_up_phone_status ?? null}
                          onStatusChange={handleFollowUpStatusChange}
                          hasInternalNote={!!offer.internal_notes}
                          onNoteClick={() => handleOpenNoteDrawer(offer)}
                        />
                      </div>
                    )}
                  </div>

                  {/* DESKTOP LAYOUT (unchanged) */}
                  <div className="hidden md:block">
                    <div className="flex items-start justify-between gap-3 w-full">
                      <div className="min-w-0 flex-1">
                        {/* Line 1: Customer name + vehicle */}
                        <div className="flex items-baseline gap-1 font-semibold text-base leading-tight">
                          <span className="truncate">
                            {offer.customer_data?.name || offer.customer_data?.company || t('offers.noCustomer')}
                          </span>
                          {offer.vehicle_data?.brandModel && (
                            <>
                              <span className="text-muted-foreground font-normal">·</span>
                              <span className="text-muted-foreground font-normal truncate">{offer.vehicle_data.brandModel}</span>
                            </>
                          )}
                        </div>

                        {/* Line 2: Offer number + created date */}
                        <div className="flex items-center gap-1 text-xs text-muted-foreground mt-2">
                          <span>{offer.offer_number}</span>
                          <span>·</span>
                          <span>Utworzono {format(new Date(offer.created_at), 'dd.MM.yyyy', { locale: pl })}</span>
                          {offer.source === 'website' && (
                            <>
                              <span>·</span>
                              <span className="text-blue-600">WWW</span>
                            </>
                          )}
                        </div>

                        {/* Line 3: Service pills */}
                        {offer.offer_scopes && offer.offer_scopes.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-3">
                            {offer.offer_scopes.map((scope) => {
                              const matchingOption = offer.offer_options?.find(opt => opt.scope_id === scope.id && !opt.is_upsell);
                              const scopePrice = matchingOption?.subtotal_net;
                              return (
                                <Badge key={scope.id} variant="secondary" className="text-xs bg-muted/20 text-foreground font-normal">
                                  {scope.name}{scopePrice != null && scopePrice > 0 ? `: ${Math.round(scopePrice)} zł` : ''}
                                </Badge>
                              );
                            })}
                            {(offer.approved_at || offer.status === 'accepted' || offer.status === 'completed') && offer.selectedOptionName && (
                              <Badge className="text-xs bg-green-100 text-green-700 border-green-200">
                                {offer.selectedOptionName}
                              </Badge>
                            )}
                          </div>
                        )}

                        {/* Follow-up phone status */}
                        {offer.customer_data?.phone && (
                          <div className="mt-3">
                            <OfferFollowUpStatus
                              offerId={offer.id}
                              currentStatus={offer.follow_up_phone_status ?? null}
                              onStatusChange={handleFollowUpStatusChange}
                              hasInternalNote={!!offer.internal_notes}
                              onNoteClick={() => handleOpenNoteDrawer(offer)}
                            />
                          </div>
                        )}
                      </div>

                      {/* Right: status + menu */}
                      <div className="flex items-center gap-1 shrink-0">
                        {offer.status === 'viewed' && offer.viewed_at ? (
                          <button
                            onClick={(e) => { e.stopPropagation(); setViewsDialog({ open: true, offerId: offer.id, viewedAt: offer.viewed_at ?? null }); }}
                            className="inline-flex"
                          >
                            <Badge className={cn('text-xs cursor-pointer hover:opacity-80', statusColors[offer.status])}>
                              <Eye className="w-3 h-3 mr-1" />
                              Obejrzana {formatViewedDate(offer.viewed_at)}
                            </Badge>
                          </button>
                        ) : (
                          <Badge className={cn('text-xs', statusColors[offer.status])}>
                            {t(`offers.status${offer.status.charAt(0).toUpperCase() + offer.status.slice(1)}`, offer.status)}
                          </Badge>
                        )}
                        {(offer.admin_approved_gross || offer.approved_at) && (
                          <span className="text-sm font-medium ml-1">
                            {formatPrice(offer.admin_approved_gross ?? offer.total_gross)}
                          </span>
                        )}
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-7 w-7 -mr-2" onClick={e => e.stopPropagation()}>
                              <MoreVertical className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            {offer.customer_data?.phone && (
                              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); window.location.href = `tel:${offer.customer_data.phone}`; }}>
                                <Phone className="w-4 h-4 mr-2" />
                                Zadzwoń
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); setPreviewDialog({ open: true, token: offer.public_token }); }}>
                              <Eye className="w-4 h-4 mr-2" />
                              {t('offers.preview')}
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleCopyLink(offer.public_token); }}>
                              <Copy className="w-4 h-4 mr-2" />
                              {t('offers.copyLink')}
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleReserveFromOffer(offer); }}>
                              <CalendarPlus className="w-4 h-4 mr-2" />
                              Rezerwuj
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
                                {STATUS_OPTIONS.filter(s => s !== 'completed').map((status) => (
                                  <DropdownMenuItem
                                    key={status}
                                    onClick={(e) => { 
                                      e.stopPropagation(); 
                                      if (status === 'accepted') {
                                        setApprovalDialog({ open: true, offer, mode: 'approve' });
                                      } else {
                                        handleChangeStatus(offer.id, status);
                                      }
                                    }}
                                    disabled={offer.status === status}
                                  >
                                    <Badge className={cn('text-xs mr-2', statusColors[status])}>
                                      {t(`offers.status${status.charAt(0).toUpperCase() + status.slice(1)}`)}
                                    </Badge>
                                  </DropdownMenuItem>
                                ))}
                                <DropdownMenuItem
                                  onClick={(e) => { 
                                    e.stopPropagation(); 
                                    if (offer.status === 'accepted' || offer.approved_at) {
                                      setCompleteOfferDialog({ open: true, offer });
                                    } else {
                                      handleChangeStatus(offer.id, 'completed');
                                    }
                                  }}
                                  disabled={offer.status === 'completed'}
                                >
                                  <Badge className={cn('text-xs mr-2', statusColors['completed'])}>
                                    {t('offers.statusCompleted')}
                                  </Badge>
                                </DropdownMenuItem>
                              </DropdownMenuSubContent>
                            </DropdownMenuSub>
                            {(offer.status === 'accepted' || offer.approved_at) && offer.status !== 'completed' && (
                              <>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem 
                                  onClick={(e) => { e.stopPropagation(); setCompleteOfferDialog({ open: true, offer }); }}
                                  className="text-emerald-600 focus:text-emerald-600"
                                >
                                  <CheckCheck className="w-4 h-4 mr-2" />
                                  {t('offers.markAsCompleted')}
                                </DropdownMenuItem>
                              </>
                            )}
                            {offer.status === 'completed' && (
                              <>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem 
                                  onClick={(e) => { e.stopPropagation(); setRemindersDialog({ open: true, offer }); }}
                                >
                                  <Bell className="w-4 h-4 mr-2" />
                                  {t('offers.reminders')}
                                </DropdownMenuItem>
                              </>
                            )}
                            {(offer.status === 'accepted' || offer.status === 'completed') && (
                              <DropdownMenuItem 
                                onClick={(e) => { 
                                  e.stopPropagation(); 
                                  setApprovalDialog({ open: true, offer, mode: 'edit' }); 
                                }}
                              >
                                <Banknote className="w-4 h-4 mr-2" />
                                Zmień kwotę
                              </DropdownMenuItem>
                            )}
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

      {/* Mark as Completed Dialog */}
      {completeOfferDialog.offer && (
        <MarkOfferCompletedDialog
          open={completeOfferDialog.open}
          onOpenChange={(open) => !open && setCompleteOfferDialog({ open: false, offer: null })}
          offerId={completeOfferDialog.offer.id}
          offerNumber={completeOfferDialog.offer.offer_number}
          onCompleted={() => {
            fetchOffers();
            setCompleteOfferDialog({ open: false, offer: null });
          }}
        />
      )}

      {/* Reminders Dialog */}
      {remindersDialog.offer && (
        <OfferRemindersDialog
          open={remindersDialog.open}
          onOpenChange={(open) => !open && setRemindersDialog({ open: false, offer: null })}
          offerId={remindersDialog.offer.id}
          offerNumber={remindersDialog.offer.offer_number}
          customerName={remindersDialog.offer.customer_data?.name}
        />
      )}

      {/* Customer Selection Dialog */}
      {selectionDialog.offer && (
        <OfferSelectionDialog
          open={selectionDialog.open}
          onOpenChange={(open) => !open && setSelectionDialog({ open: false, offer: null })}
          offer={selectionDialog.offer}
        />
      )}


      {/* Admin Offer Approval Dialog */}
      {approvalDialog.offer && (
        <AdminOfferApprovalDialog
          open={approvalDialog.open}
          onOpenChange={(open) => !open && setApprovalDialog({ open: false, offer: null, mode: 'approve' })}
          offer={approvalDialog.offer}
          mode={approvalDialog.mode}
          onConfirm={async (netAmount, grossAmount) => {
            await handleApproveOffer(
              approvalDialog.offer!.id,
              netAmount,
              grossAmount,
              approvalDialog.mode === 'approve'
            );
            setApprovalDialog({ open: false, offer: null, mode: 'approve' });
          }}
        />
      )}

      {/* Offer Preview Dialog */}
      {previewDialog.token && (
        <OfferPreviewDialogByToken
          open={previewDialog.open}
          onClose={() => setPreviewDialog({ open: false, token: null })}
          token={previewDialog.token}
        />
      )}

      {/* Internal Note Drawer */}
      <Sheet open={noteDrawer.open} onOpenChange={(open) => !open && setNoteDrawer({ open: false, offerId: '', notes: '' })}>
        <SheetContent side="right" className="flex flex-col sm:max-w-md">
          <SheetHeader>
            <SheetTitle>Notatka wewnętrzna</SheetTitle>
            <SheetDescription className="sr-only">Dodaj notatkę wewnętrzną do oferty</SheetDescription>
          </SheetHeader>
          <div className="flex-1 py-4">
            <Textarea
              value={noteDrawer.notes}
              onChange={(e) => setNoteDrawer(prev => ({ ...prev, notes: e.target.value }))}
              placeholder="Wpisz notatkę..."
              className="h-full min-h-[200px] resize-none"
            />
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => setNoteDrawer({ open: false, offerId: '', notes: '' })}
            >
              Anuluj
            </Button>
            <Button
              className="flex-1"
              onClick={handleSaveNote}
            >
              Zapisz
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      {/* Reservation from Offer */}
      {reservationFromOffer.offer && instanceId && (
        <AddReservationDialogV2
          open={reservationFromOffer.open}
          onClose={() => setReservationFromOffer({ open: false, offer: null })}
          instanceId={instanceId}
          onSuccess={() => {
            setReservationFromOffer({ open: false, offer: null });
            toast.success('Rezerwacja utworzona z oferty');
          }}
          workingHours={workingHours}
          editingReservation={{
            id: '',
            ...getReservationDataFromOffer(reservationFromOffer.offer),
            reservation_date: '',
            start_time: '',
            end_time: '',
            station_id: null,
          }}
        />
      )}
      {/* Offer Views History Dialog */}
      <OfferViewsDialog
        offerId={viewsDialog.offerId}
        viewedAt={viewsDialog.viewedAt}
        open={viewsDialog.open}
        onOpenChange={(open) => setViewsDialog(prev => ({ ...prev, open }))}
      />
    </>
  );
}
