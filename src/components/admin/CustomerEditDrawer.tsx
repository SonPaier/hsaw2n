import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { pl } from 'date-fns/locale';
import { Phone, MessageSquare, Mail, Car, Clock, X } from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent } from '@/components/ui/tabs';
import { AdminTabsList, AdminTabsTrigger } from './AdminTabsList';
import { supabase } from '@/integrations/supabase/client';
import { useIsMobile } from '@/hooks/use-mobile';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { normalizePhone } from '@/lib/phoneUtils';
import SendSmsDialog from './SendSmsDialog';
import { CustomerRemindersTab } from './CustomerRemindersTab';
import { CustomerVehiclesEditor, VehicleChip } from './CustomerVehiclesEditor';

interface Customer {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  notes: string | null;
  company?: string | null;
  nip?: string | null;
  source?: string;
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

interface CustomerEditDrawerProps {
  customer: Customer | null;
  instanceId: string | null;
  open: boolean;
  onClose: () => void;
  onCustomerUpdated?: () => void;
  isAddMode?: boolean;
}

const CustomerEditDrawer = ({ 
  customer, 
  instanceId, 
  open, 
  onClose, 
  onCustomerUpdated,
  isAddMode = false 
}: CustomerEditDrawerProps) => {
  const { t } = useTranslation();
  const isMobile = useIsMobile();
  const [visits, setVisits] = useState<VisitHistory[]>([]);
  const [loading, setLoading] = useState(false);
  const [smsDialogOpen, setSmsDialogOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'info' | 'visits' | 'reminders'>('info');
  
  // Edit mode state
  const [isEditing, setIsEditing] = useState(isAddMode);
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [editCompany, setEditCompany] = useState('');
  const [editNip, setEditNip] = useState('');
  const [editDiscountPercent, setEditDiscountPercent] = useState('');
  const [editVehicles, setEditVehicles] = useState<VehicleChip[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      if (isAddMode) {
        // Reset for new customer
        setIsEditing(true);
        setEditName('');
        setEditPhone('');
        setEditEmail('');
        setEditNotes('');
        setEditCompany('');
        setEditNip('');
        setEditDiscountPercent('');
        setEditVehicles([]);
        setVisits([]);
        setActiveTab('info');
      } else if (customer && instanceId) {
        fetchVisitHistory();
        fetchCustomerVehicles();
        setIsEditing(false);
        setEditName(customer.name);
        setEditPhone(customer.phone);
        setEditEmail(customer.email || '');
        setEditNotes(customer.notes || '');
        setEditCompany(customer.company || '');
        setEditNip(customer.nip || '');
        setEditDiscountPercent((customer as any).discount_percent?.toString() || '');
        setActiveTab('info');
      }
    }
  }, [customer, instanceId, open, isAddMode]);

  const fetchCustomerVehicles = async () => {
    if (!customer || !instanceId) return;

    // Fetch by phone (same as customer list) to ensure consistency
    const normalizedPhone = normalizePhone(customer.phone);
    const { data } = await supabase
      .from('customer_vehicles')
      .select('id, model, car_size')
      .eq('instance_id', instanceId)
      .eq('phone', normalizedPhone)
      .order('last_used_at', { ascending: false });

    if (data) {
      setEditVehicles(
        data.map((v) => ({
          id: v.id,
          model: v.model,
          carSize: (v.car_size as 'S' | 'M' | 'L') || 'M',
        }))
      );
    }
  };

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
        service_ids
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
        service_name: null, // Legacy relation removed - would need to lookup from service_ids
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
      window.location.href = `sms:${customer.phone}`;
    } else {
      setSmsDialogOpen(true);
    }
  };

  const handleSaveCustomer = async () => {
    if (!instanceId) return;
    
    if (!editName.trim() || !editPhone.trim()) {
      toast.error(t('common.required'));
      return;
    }

    setSaving(true);
    try {
      let customerId: string | undefined;

      if (isAddMode) {
        // Create new customer
        const { data: newCustomer, error } = await supabase
          .from('customers')
          .insert({
            instance_id: instanceId,
            name: editName.trim(),
            phone: normalizePhone(editPhone.trim()),
            email: editEmail.trim() || null,
            notes: editNotes.trim() || null,
            company: editCompany.trim() || null,
            nip: editNip.trim() || null,
            discount_percent: editDiscountPercent ? parseInt(editDiscountPercent, 10) : null,
            source: 'myjnia',
          })
          .select('id')
          .single();
        
        if (error) throw error;
        customerId = newCustomer?.id;
      } else if (customer) {
        // Update existing customer
        const { error } = await supabase
          .from('customers')
          .update({
            name: editName.trim(),
            phone: normalizePhone(editPhone.trim()),
            email: editEmail.trim() || null,
            notes: editNotes.trim() || null,
            company: editCompany.trim() || null,
            nip: editNip.trim() || null,
            discount_percent: editDiscountPercent ? parseInt(editDiscountPercent, 10) : null,
          })
          .eq('id', customer.id);
        
        if (error) throw error;
        customerId = customer.id;
      }

      // Sync vehicles
      if (customerId) {
        await syncCustomerVehicles(customerId);
      }

      toast.success(t('customers.saved'));
      onCustomerUpdated?.();
      onClose();
    } catch (error) {
      console.error('Error saving customer:', error);
      toast.error(t('errors.generic'));
    } finally {
      setSaving(false);
    }
  };

  const syncCustomerVehicles = async (customerId: string) => {
    if (!instanceId) return;

    const normalizedPhone = normalizePhone(editPhone.trim());

    // Get current vehicles from DB by phone (same as fetch) for consistency
    const { data: existingVehicles } = await supabase
      .from('customer_vehicles')
      .select('id, model')
      .eq('instance_id', instanceId)
      .eq('phone', normalizedPhone);

    const existingIds = existingVehicles?.map((v) => v.id) || [];
    const existingModels = existingVehicles?.map((v) => v.model) || [];

    // Delete vehicles that were removed
    const currentIds = editVehicles.filter((v) => v.id).map((v) => v.id!);
    const toDelete = existingIds.filter((id) => !currentIds.includes(id));

    if (toDelete.length > 0) {
      await supabase.from('customer_vehicles').delete().in('id', toDelete);
    }

    // Add new vehicles
    const toAdd = editVehicles.filter(
      (v) => v.isNew && !existingModels.includes(v.model)
    );

    if (toAdd.length > 0) {
      await supabase.from('customer_vehicles').insert(
        toAdd.map((v) => ({
          instance_id: instanceId,
          customer_id: customerId,
          phone: normalizedPhone,
          model: v.model,
          car_size: v.carSize,
        }))
      );
    }
  };

  const handleCancelEdit = () => {
    if (isAddMode) {
      onClose();
    } else {
      setIsEditing(false);
      setEditName(customer?.name || '');
      setEditPhone(customer?.phone || '');
      setEditEmail(customer?.email || '');
      setEditNotes(customer?.notes || '');
      setEditCompany(customer?.company || '');
      setEditNip(customer?.nip || '');
      setEditDiscountPercent((customer as any)?.discount_percent?.toString() || '');
      // Re-fetch vehicles to restore original state
      fetchCustomerVehicles();
    }
  };

  const getStatusLabel = (status: string | null) => {
    switch (status) {
      case 'confirmed': return t('reservations.confirmed');
      case 'completed': return t('hall.completed');
      case 'cancelled': return t('reservations.cancelled');
      case 'in_progress': return t('hall.inProgress');
      case 'released': return t('reservations.statuses.released');
      default: return t('reservations.pending');
    }
  };

  const getStatusColor = (status: string | null) => {
    switch (status) {
      case 'confirmed': return 'bg-green-500/10 text-green-600';
      case 'completed': return 'bg-sky-500/10 text-sky-600';
      case 'cancelled': return 'bg-destructive/10 text-destructive';
      case 'in_progress': return 'bg-green-500/10 text-green-600';
      case 'released': return 'bg-gray-500/10 text-gray-600';
      case 'pending': return 'bg-yellow-500/10 text-yellow-600';
      default: return 'bg-yellow-500/10 text-yellow-600';
    }
  };

  const handleClose = () => {
    setIsEditing(isAddMode);
    onClose();
  };

  if (!customer && !isAddMode) return null;

  return (
    <>
      <Sheet open={open} onOpenChange={handleClose}>
        <SheetContent 
          className="w-full sm:max-w-md p-0 flex flex-col"
          hideCloseButton
          onFocusOutside={(e) => e.preventDefault()}
        >
          <div className="p-6 flex-1 overflow-y-auto">
          <SheetHeader>
            <div className="flex items-center justify-between">
              <SheetTitle className="flex items-center gap-2 flex-1 min-w-0">
                <div className="text-xl font-semibold truncate">
                  {isAddMode ? t('customers.newCustomer') : (isEditing ? editName || customer?.name : customer?.name)}
                </div>
                {!isAddMode && !isEditing && (
                  <div className="flex items-center gap-1 ml-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={handleSmsButton}
                      className="w-8 h-8 text-muted-foreground hover:text-foreground hover:bg-muted"
                    >
                      <MessageSquare className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={handleCall}
                      className="w-8 h-8 text-muted-foreground hover:text-foreground hover:bg-muted"
                    >
                      <Phone className="w-4 h-4" />
                    </Button>
                  </div>
                )}
              </SheetTitle>
              <button 
                type="button"
                onClick={handleClose}
                className="p-2 rounded-full hover:bg-muted transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
          </SheetHeader>

          <div className="mt-6">
            {isAddMode || isEditing ? (
              // Edit/Add Form
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium mb-1.5 block">{t('customers.fullName')} *</label>
                  <Input
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    placeholder={t('customers.fullName')}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1.5 block">{t('common.phone')} *</label>
                  <Input
                    value={editPhone}
                    onChange={(e) => setEditPhone(e.target.value)}
                    placeholder={t('common.phone')}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1.5 block">{t('common.email')}</label>
                  <Input
                    type="email"
                    value={editEmail}
                    onChange={(e) => setEditEmail(e.target.value)}
                    placeholder={t('common.email')}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1.5 block">{t('customers.company')}</label>
                  <Input
                    value={editCompany}
                    onChange={(e) => setEditCompany(e.target.value)}
                    placeholder={t('customers.company')}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1.5 block">{t('customers.nip')}</label>
                  <Input
                    value={editNip}
                    onChange={(e) => setEditNip(e.target.value)}
                    placeholder={t('customers.nip')}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1.5 block">{t('common.notes')}</label>
                  <Textarea
                    value={editNotes}
                    onChange={(e) => setEditNotes(e.target.value)}
                    placeholder={t('customers.notesPlaceholder')}
                    rows={3}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1.5 block">{t('customers.discountPercent')}</label>
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      min="0"
                      max="100"
                      value={editDiscountPercent}
                      onChange={(e) => setEditDiscountPercent(e.target.value)}
                      className="w-24"
                      placeholder="0"
                    />
                    <span className="text-muted-foreground">%</span>
                  </div>
                </div>
                
                {/* Vehicles editor */}
                <CustomerVehiclesEditor
                  vehicles={editVehicles}
                  onChange={setEditVehicles}
                  disabled={saving}
                />
              </div>
            ) : (
              // View mode with tabs
              <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'info' | 'visits' | 'reminders')}>
                <AdminTabsList className="mb-4" columns={3}>
                  <AdminTabsTrigger value="info">{t('common.details')}</AdminTabsTrigger>
                  <AdminTabsTrigger value="visits">{t('customers.visitHistory')}</AdminTabsTrigger>
                  <AdminTabsTrigger value="reminders">{t('customers.reminders')}</AdminTabsTrigger>
                </AdminTabsList>

                <TabsContent value="info" className="space-y-4 mt-0">
                  {/* Phone */}
                  <div className="flex items-center gap-3 text-lg">
                    <Phone className="w-5 h-5 text-muted-foreground" />
                    <span className="font-medium">{customer?.phone}</span>
                  </div>
                  
                  {/* Contact info */}
                  <div className="space-y-2 text-sm">
                    {customer?.email && (
                      <div className="flex items-center gap-2">
                        <Mail className="w-4 h-4 text-muted-foreground" />
                        <span>{customer.email}</span>
                      </div>
                    )}
                    {customer?.company && (
                      <div className="text-muted-foreground">
                        <span className="font-medium text-foreground">{t('customers.company')}:</span> {customer.company}
                      </div>
                    )}
                    {customer?.nip && (
                      <div className="text-muted-foreground">
                        <span className="font-medium text-foreground">{t('customers.nip')}:</span> {customer.nip}
                      </div>
                    )}
                  </div>

                  {/* Vehicles */}
                  {editVehicles.length > 0 && (
                    <div>
                      <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                        <Car className="w-4 h-4" />
                        {t('customers.vehicles')}
                      </h4>
                      <div className="flex flex-wrap gap-2">
                        {editVehicles.map((vehicle, idx) => (
                          <div
                            key={vehicle.id || `v-${idx}`}
                            className="px-3 py-1.5 bg-slate-700/90 text-white rounded-full text-sm"
                          >
                            {vehicle.model}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Notes */}
                  {customer?.notes && (
                    <div>
                      <h4 className="text-sm font-medium mb-2">{t('common.notes')}</h4>
                      <p className="text-sm text-muted-foreground whitespace-pre-wrap">{customer.notes}</p>
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="visits" className="mt-0">
                  {loading ? (
                    <div className="text-center text-muted-foreground py-8">
                      {t('common.loading')}
                    </div>
                  ) : visits.length === 0 ? (
                    <div className="text-center text-muted-foreground py-8">
                      {t('customers.noVisitHistory')}
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {visits.map((visit) => (
                        <div
                          key={visit.id}
                          className="p-3 bg-muted/30 rounded-lg border border-border/50"
                        >
                          <div className="flex items-center justify-between mb-1">
                            <div className="font-medium text-sm">
                              {format(new Date(visit.reservation_date), 'd MMMM yyyy', { locale: pl })}
                            </div>
                            <div className="text-xs text-muted-foreground flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {visit.start_time?.slice(0, 5)}
                            </div>
                          </div>
                          <div className="flex items-center justify-between text-sm">
                            <div className="text-muted-foreground">
                              {visit.service_name || t('reservations.service')} • {visit.vehicle_plate}
                            </div>
                            {visit.price && (
                              <div className="font-medium">
                                {visit.price} zł
                              </div>
                            )}
                          </div>
                          <div className="mt-1">
                            <span className={`text-xs px-2 py-0.5 rounded-full ${getStatusColor(visit.status)}`}>
                              {getStatusLabel(visit.status)}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="reminders" className="mt-0">
                  {customer && instanceId && (
                    <CustomerRemindersTab
                      customerPhone={customer.phone}
                      customerName={customer.name}
                      instanceId={instanceId}
                    />
                  )}
                </TabsContent>
              </Tabs>
            )}
          </div>
          </div>
          {/* Sticky footer buttons */}
          <div className="p-4 bg-background border-t shrink-0">
            {isAddMode || isEditing ? (
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={handleCancelEdit}
                  disabled={saving}
                  className="flex-1"
                >
                  {t('common.cancel')}
                </Button>
                <Button
                  onClick={handleSaveCustomer}
                  disabled={saving}
                  className="flex-1"
                >
                  {saving ? t('common.loading') : t('common.save')}
                </Button>
              </div>
            ) : (
              <Button
                onClick={() => setIsEditing(true)}
                className="w-full"
              >
                {t('common.edit')}
              </Button>
            )}
          </div>
        </SheetContent>
      </Sheet>

      {/* SMS Dialog */}
      {customer && (
        <SendSmsDialog
          phone={customer.phone}
          customerName={customer.name}
          instanceId={instanceId}
          open={smsDialogOpen}
          onClose={() => setSmsDialogOpen(false)}
        />
      )}
    </>
  );
};

export default CustomerEditDrawer;
