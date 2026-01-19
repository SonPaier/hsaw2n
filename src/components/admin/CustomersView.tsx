import { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Search, Phone, MessageSquare, ChevronLeft, ChevronRight, User, Building2, Plus, Trash2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent } from '@/components/ui/tabs';
import { AdminTabsList, AdminTabsTrigger } from './AdminTabsList';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { supabase } from '@/integrations/supabase/client';
import { useIsMobile } from '@/hooks/use-mobile';
import { useCombinedFeatures } from '@/hooks/useCombinedFeatures';
import CustomerEditDrawer from './CustomerEditDrawer';
import SendSmsDialog from './SendSmsDialog';
import { toast } from 'sonner';

interface Customer {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  notes: string | null;
  created_at: string | null;
  phone_verified: boolean | null;
  source: string;
  company: string | null;
  nip: string | null;
  address: string | null;
}

interface CustomerVehicle {
  phone: string;
  model: string;
  plate: string | null;
}

interface CustomersViewProps {
  instanceId: string | null;
}

type SortField = 'name' | 'phone' | 'created_at';
type SortDirection = 'asc' | 'desc';

const ITEMS_PER_PAGE = 10;

const CustomersView = ({ instanceId }: CustomersViewProps) => {
  const { t } = useTranslation();
  const isMobile = useIsMobile();
  const { hasFeature } = useCombinedFeatures(instanceId);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [vehicles, setVehicles] = useState<CustomerVehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortField] = useState<SortField>('name');
  const [sortDirection] = useState<SortDirection>('asc');
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [smsCustomer, setSmsCustomer] = useState<Customer | null>(null);
  const [activeTab, setActiveTab] = useState<'myjnia' | 'oferty'>('myjnia');
  const [isAddMode, setIsAddMode] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [customerToDelete, setCustomerToDelete] = useState<Customer | null>(null);

  const hasOffers = hasFeature('offers');

  const fetchCustomers = async () => {
    if (!instanceId) return;
    setLoading(true);
    
    // Fetch customers and vehicles in parallel
    const [customersResult, vehiclesResult] = await Promise.all([
      supabase
        .from('customers')
        .select('*')
        .eq('instance_id', instanceId)
        .order('name'),
      supabase
        .from('customer_vehicles')
        .select('phone, model, plate')
        .eq('instance_id', instanceId)
    ]);

    if (!customersResult.error && customersResult.data) {
      setCustomers(customersResult.data as Customer[]);
    }
    if (!vehiclesResult.error && vehiclesResult.data) {
      setVehicles(vehiclesResult.data as CustomerVehicle[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchCustomers();
  }, [instanceId]);

  // Get vehicles for a customer by phone
  const getVehiclesForCustomer = (phone: string) => {
    return vehicles.filter(v => v.phone === phone);
  };

  // Filter by source (tab)
  const customersBySource = useMemo(() => {
    return customers.filter(c => c.source === activeTab);
  }, [customers, activeTab]);

  // Filtered and sorted customers
  const filteredCustomers = useMemo(() => {
    let result = [...customersBySource];

    // Filter by search query (including vehicle search)
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(c => {
        // Search in customer fields
        const matchesCustomer = 
          c.name.toLowerCase().includes(query) ||
          c.phone.includes(query) ||
          (c.email && c.email.toLowerCase().includes(query)) ||
          (c.company && c.company.toLowerCase().includes(query)) ||
          (c.nip && c.nip.includes(query));
        
        // Search in vehicles
        const customerVehicles = getVehiclesForCustomer(c.phone);
        const matchesVehicle = customerVehicles.some(v => 
          v.model.toLowerCase().includes(query) ||
          (v.plate && v.plate.toLowerCase().includes(query))
        );
        
        return matchesCustomer || matchesVehicle;
      });
    }

    // Sort
    result.sort((a, b) => {
      let aVal = a[sortField];
      let bVal = b[sortField];
      if (aVal === null) aVal = '';
      if (bVal === null) bVal = '';
      if (typeof aVal === 'string' && typeof bVal === 'string') {
        const comparison = aVal.localeCompare(bVal, 'pl');
        return sortDirection === 'asc' ? comparison : -comparison;
      }
      return 0;
    });
    return result;
  }, [customersBySource, searchQuery, sortField, sortDirection, vehicles]);

  // Pagination
  const totalPages = Math.ceil(filteredCustomers.length / ITEMS_PER_PAGE);
  const paginatedCustomers = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredCustomers.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredCustomers, currentPage]);

  // Reset page when search or tab changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, activeTab]);

  const handleCall = (phone: string, e: React.MouseEvent) => {
    e.stopPropagation();
    window.location.href = `tel:${phone}`;
  };

  const handleSms = (customer: Customer, e: React.MouseEvent) => {
    e.stopPropagation();
    if (isMobile) {
      window.location.href = `sms:${customer.phone}`;
    } else {
      setSmsCustomer(customer);
    }
  };

  const handleAddCustomer = () => {
    setSelectedCustomer(null);
    setIsAddMode(true);
  };

  const handleCloseDrawer = () => {
    setSelectedCustomer(null);
    setIsAddMode(false);
  };

  const handleDeleteClick = (customer: Customer, e: React.MouseEvent) => {
    e.stopPropagation();
    setCustomerToDelete(customer);
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!customerToDelete) return;
    
    try {
      const { error } = await supabase
        .from('customers')
        .delete()
        .eq('id', customerToDelete.id);
      
      if (error) throw error;
      
      toast.success(t('customers.deleted'));
      fetchCustomers();
    } catch (error) {
      console.error('Error deleting customer:', error);
      toast.error(t('errors.generic'));
    } finally {
      setDeleteDialogOpen(false);
      setCustomerToDelete(null);
    }
  };

  const myjniaCount = customers.filter(c => c.source === 'myjnia').length;
  const ofertyCount = customers.filter(c => c.source === 'oferty').length;

  if (loading) {
    return (
      <div className="glass-card p-8 text-center text-muted-foreground">
        {t('common.loading')}
      </div>
    );
  }

  const renderCustomerList = () => (
    <>
      {/* Customers list */}
      <div className="glass-card overflow-hidden">
        {paginatedCustomers.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">
            {searchQuery ? t('common.noResults') : t('customers.noCustomers')}
          </div>
        ) : (
          <div className="divide-y divide-border/50">
            {paginatedCustomers.map(customer => {
              const customerVehicles = getVehiclesForCustomer(customer.phone);
              return (
                <div
                  key={customer.id}
                  onClick={() => {
                    setIsAddMode(false);
                    setSelectedCustomer(customer);
                  }}
                  className="p-4 flex items-center justify-between gap-4 transition-colors cursor-pointer bg-primary-foreground hover:bg-muted/50"
                >
                  <div className="min-w-0 flex-1 space-y-0.5">
                    {/* Line 1: Name */}
                    <div className="font-medium text-foreground">
                      {customer.name}
                    </div>
                    {/* Line 2: Phone */}
                    <div className="text-sm text-muted-foreground">
                      {customer.phone}
                    </div>
                    {/* Line 3: Vehicles */}
                    {customerVehicles.length > 0 && (
                      <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
                        {customerVehicles.slice(0, 3).map((v, idx) => (
                          <span
                            key={idx}
                            className="inline-flex items-center gap-1 px-2 py-0.5 bg-slate-700/90 text-white rounded-full text-xs"
                          >
                            {v.model}
                          </span>
                        ))}
                        {customerVehicles.length > 3 && (
                          <span className="text-xs text-muted-foreground">
                            +{customerVehicles.length - 3}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="w-8 h-8 text-muted-foreground hover:text-foreground hover:bg-muted"
                      onClick={e => handleSms(customer, e)}
                    >
                      <MessageSquare className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="w-8 h-8 text-muted-foreground hover:text-foreground hover:bg-muted"
                      onClick={e => handleCall(customer.phone, e)}
                    >
                      <Phone className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="w-8 h-8 text-muted-foreground hover:text-destructive hover:bg-muted"
                      onClick={e => handleDeleteClick(customer, e)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <div className="text-sm text-muted-foreground">
            {t('common.showingPagination', { 
              from: (currentPage - 1) * ITEMS_PER_PAGE + 1, 
              to: Math.min(currentPage * ITEMS_PER_PAGE, filteredCustomers.length), 
              total: filteredCustomers.length 
            })}
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              disabled={currentPage === 1}
              onClick={() => setCurrentPage(prev => prev - 1)}
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <span className="text-sm px-3 min-w-[60px] text-center">
              {currentPage} / {totalPages}
            </span>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              disabled={currentPage === totalPages}
              onClick={() => setCurrentPage(prev => prev + 1)}
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}
    </>
  );

  // If offers feature is not enabled, don't show tabs
  if (!hasOffers) {
    return (
      <div className="space-y-4 max-w-3xl mx-auto">
        {/* Sticky header on mobile */}
        <div className="sm:static sticky top-0 z-20 bg-background pb-4 -mx-4 px-4 sm:mx-0 sm:px-0">
          {/* Header with search and add button */}
          <div className="flex gap-4 items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder={t('customers.searchPlaceholder')}
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <Button onClick={handleAddCustomer} className="gap-2 shrink-0">
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">{t('common.add')}</span>
            </Button>
          </div>
        </div>

        {renderCustomerList()}

        {/* Customer Edit Drawer */}
        <CustomerEditDrawer
          customer={selectedCustomer}
          instanceId={instanceId}
          open={!!selectedCustomer || isAddMode}
          onClose={handleCloseDrawer}
          onCustomerUpdated={fetchCustomers}
          isAddMode={isAddMode}
        />

        {/* Send SMS Dialog (web only) */}
        <SendSmsDialog
          phone={smsCustomer?.phone || ''}
          customerName={smsCustomer?.name || ''}
          instanceId={instanceId}
          open={!!smsCustomer}
          onClose={() => setSmsCustomer(null)}
        />
      </div>
    );
  }

  return (
    <div className="space-y-4 max-w-3xl mx-auto">
      {/* Sticky header on mobile */}
      <div className="sm:static sticky top-0 z-20 bg-background pb-4 space-y-4 -mx-4 px-4 sm:mx-0 sm:px-0">
        {/* Header with search and add button */}
        <div className="flex gap-4 items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder={t('customers.searchPlaceholder')}
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <Button onClick={handleAddCustomer} className="gap-2 shrink-0">
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">{t('common.add')}</span>
          </Button>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'myjnia' | 'oferty')}>
          <AdminTabsList className="max-w-md">
            <AdminTabsTrigger value="myjnia">
              <User className="w-4 h-4" />
              {t('customers.tabs.carWash')}
              {myjniaCount > 0 && (
                <span className="ml-1 text-xs bg-primary/10 px-2 py-0.5 rounded-full">
                  {myjniaCount}
                </span>
              )}
            </AdminTabsTrigger>
            <AdminTabsTrigger value="oferty">
              <Building2 className="w-4 h-4" />
              {t('customers.tabs.offers')}
              {ofertyCount > 0 && (
                <span className="ml-1 text-xs bg-primary/10 px-2 py-0.5 rounded-full">
                  {ofertyCount}
                </span>
              )}
            </AdminTabsTrigger>
          </AdminTabsList>
        </Tabs>
      </div>

      {/* Content */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'myjnia' | 'oferty')}>
        <TabsContent value="myjnia" className="space-y-4 mt-0">
          {renderCustomerList()}
        </TabsContent>

        <TabsContent value="oferty" className="space-y-4 mt-0">
          {renderCustomerList()}
        </TabsContent>
      </Tabs>

      {/* Customer Edit Drawer */}
      <CustomerEditDrawer
        customer={selectedCustomer}
        instanceId={instanceId}
        open={!!selectedCustomer || isAddMode}
        onClose={handleCloseDrawer}
        onCustomerUpdated={fetchCustomers}
        isAddMode={isAddMode}
      />

      {/* Send SMS Dialog (web only) */}
      <SendSmsDialog
        phone={smsCustomer?.phone || ''}
        customerName={smsCustomer?.name || ''}
        instanceId={instanceId}
        open={!!smsCustomer}
        onClose={() => setSmsCustomer(null)}
      />
      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('customers.confirmDeleteTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('customers.confirmDeleteDescription', { name: customerToDelete?.name })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setCustomerToDelete(null)}>
              {t('common.cancel')}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {t('common.delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default CustomersView;
