import { useState, useEffect, useMemo } from 'react';
import { Search, Phone, MessageSquare, ChevronLeft, ChevronRight, ArrowUpDown, User, Building2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { useIsMobile } from '@/hooks/use-mobile';
import CustomerDetailsDialog from './CustomerDetailsDialog';
import SendSmsDialog from './SendSmsDialog';

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

interface CustomersViewProps {
  instanceId: string | null;
}

type SortField = 'name' | 'phone' | 'created_at';
type SortDirection = 'asc' | 'desc';

const ITEMS_PER_PAGE = 10;

const CustomersView = ({ instanceId }: CustomersViewProps) => {
  const isMobile = useIsMobile();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortField, setSortField] = useState<SortField>('name');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [smsCustomer, setSmsCustomer] = useState<Customer | null>(null);
  const [activeTab, setActiveTab] = useState<'myjnia' | 'oferty'>('myjnia');

  const fetchCustomers = async () => {
    if (!instanceId) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('customers')
      .select('*')
      .eq('instance_id', instanceId)
      .order('name');
    if (!error && data) {
      setCustomers(data as Customer[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchCustomers();
  }, [instanceId]);

  // Filter by source (tab)
  const customersBySource = useMemo(() => {
    return customers.filter(c => c.source === activeTab);
  }, [customers, activeTab]);

  // Filtered and sorted customers
  const filteredCustomers = useMemo(() => {
    let result = [...customersBySource];

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        c =>
          c.name.toLowerCase().includes(query) ||
          c.phone.includes(query) ||
          (c.email && c.email.toLowerCase().includes(query)) ||
          (c.company && c.company.toLowerCase().includes(query)) ||
          (c.nip && c.nip.includes(query))
      );
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
  }, [customersBySource, searchQuery, sortField, sortDirection]);

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

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

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

  const myjniaCount = customers.filter(c => c.source === 'myjnia').length;
  const ofertyCount = customers.filter(c => c.source === 'oferty').length;

  if (loading) {
    return (
      <div className="glass-card p-8 text-center text-muted-foreground">
        Ładowanie klientów...
      </div>
    );
  }

  const renderCustomerList = () => (
    <>
      {/* Search and filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder={activeTab === 'oferty' ? "Szukaj po nazwie, firmie, NIP, telefonie..." : "Szukaj po imieniu, telefonie lub email..."}
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => handleSort('name')} className="gap-2">
            <ArrowUpDown className="w-4 h-4" />
            Nazwa {sortField === 'name' && (sortDirection === 'asc' ? '↑' : '↓')}
          </Button>
          <Button variant="outline" size="sm" onClick={() => handleSort('created_at')} className="gap-2">
            Data {sortField === 'created_at' && (sortDirection === 'asc' ? '↑' : '↓')}
          </Button>
        </div>
      </div>

      {/* Customers list */}
      <div className="glass-card overflow-hidden">
        {paginatedCustomers.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">
            {searchQuery ? 'Nie znaleziono klientów' : 'Brak klientów'}
          </div>
        ) : (
          <div className="divide-y divide-border/50">
            {paginatedCustomers.map(customer => (
              <div
                key={customer.id}
                onClick={() => setSelectedCustomer(customer)}
                className="p-4 flex items-center justify-between gap-4 transition-colors cursor-pointer bg-primary-foreground hover:bg-muted/50"
              >
                <div className="flex items-center gap-4 min-w-0">
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0 bg-primary/10 text-primary">
                    {activeTab === 'oferty' && customer.company ? (
                      <Building2 className="w-5 h-5" />
                    ) : (
                      <User className="w-5 h-5" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="font-medium text-foreground truncate">
                      {customer.name}
                    </div>
                    <div className="text-sm text-muted-foreground truncate">
                      {customer.phone}
                      {customer.email && ` • ${customer.email}`}
                      {customer.nip && ` • NIP: ${customer.nip}`}
                    </div>
                    {customer.company && (
                      <div className="text-xs text-muted-foreground truncate">
                        Firma: {customer.company}
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9 text-success hover:text-success hover:bg-success/10"
                    onClick={e => handleCall(customer.phone, e)}
                  >
                    <Phone className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9 text-primary hover:text-primary hover:bg-primary/10"
                    onClick={e => handleSms(customer, e)}
                  >
                    <MessageSquare className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <div className="text-sm text-muted-foreground">
            Pokazano {(currentPage - 1) * ITEMS_PER_PAGE + 1}-
            {Math.min(currentPage * ITEMS_PER_PAGE, filteredCustomers.length)} z{' '}
            {filteredCustomers.length}
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={currentPage === 1}
              onClick={() => setCurrentPage(prev => prev - 1)}
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <span className="text-sm px-2">
              {currentPage} / {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
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

  return (
    <div className="space-y-4">
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'myjnia' | 'oferty')}>
        <TabsList className="grid w-full grid-cols-2 max-w-md">
          <TabsTrigger value="myjnia" className="gap-2">
            <User className="w-4 h-4" />
            Myjnia
            {myjniaCount > 0 && (
              <span className="ml-1 text-xs bg-primary/10 px-2 py-0.5 rounded-full">
                {myjniaCount}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="oferty" className="gap-2">
            <Building2 className="w-4 h-4" />
            Oferty
            {ofertyCount > 0 && (
              <span className="ml-1 text-xs bg-primary/10 px-2 py-0.5 rounded-full">
                {ofertyCount}
              </span>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="myjnia" className="space-y-4 mt-4">
          {renderCustomerList()}
        </TabsContent>

        <TabsContent value="oferty" className="space-y-4 mt-4">
          {renderCustomerList()}
        </TabsContent>
      </Tabs>

      {/* Customer Details Dialog */}
      <CustomerDetailsDialog
        customer={selectedCustomer}
        instanceId={instanceId}
        open={!!selectedCustomer}
        onClose={() => setSelectedCustomer(null)}
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
};

export default CustomersView;
