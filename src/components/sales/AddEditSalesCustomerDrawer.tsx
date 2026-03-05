import { useState, useEffect } from 'react';
import { X, Pencil } from 'lucide-react';
import {
  Sheet,
  SheetContent,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useIsMobile } from '@/hooks/use-mobile';
import NipLookupForm from './NipLookupForm';

interface SalesCustomer {
  id: string;
  name: string;
  contact_person: string | null;
  phone: string;
  email: string | null;
  discount_percent: number | null;
  is_net_payer: boolean;
  sales_notes: string | null;
  shipping_street: string | null;
  shipping_postal_code: string | null;
  shipping_city: string | null;
  shipping_street_line2: string | null;
  nip: string | null;
  company: string | null;
  billing_street: string | null;
  billing_postal_code: string | null;
  billing_city: string | null;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customer: SalesCustomer | null;
  instanceId: string;
  onSaved: () => void;
}

const emptyForm = {
  name: '',
  contactPerson: '',
  phone: '',
  email: '',
  discountEnabled: false,
  discountPercent: 0,
  isNetPayer: false,
  notes: '',
  shippingAddressee: '',
  shippingStreet: '',
  shippingPostalCode: '',
  shippingCity: '',
  nip: '',
  company: '',
  billingStreet: '',
  billingPostalCode: '',
  billingCity: '',
};

const AddEditSalesCustomerDrawer = ({ open, onOpenChange, customer, instanceId, onSaved }: Props) => {
  const isMobile = useIsMobile();
  const isEdit = !!customer;
  const [editMode, setEditMode] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [activeTab, setActiveTab] = useState('data');

  const isFormMode = !isEdit || editMode;

  useEffect(() => {
    if (!open) {
      setEditMode(false);
      setActiveTab('data');
      return;
    }
    if (customer) {
      setForm({
        name: customer.name || '',
        contactPerson: customer.contact_person || '',
        phone: customer.phone || '',
        email: customer.email || '',
        discountEnabled: (customer.discount_percent ?? 0) > 0,
        discountPercent: customer.discount_percent ?? 0,
        isNetPayer: customer.is_net_payer ?? false,
        notes: customer.sales_notes || '',
        shippingAddressee: customer.shipping_street_line2 || '',
        shippingStreet: customer.shipping_street || '',
        shippingPostalCode: customer.shipping_postal_code || '',
        shippingCity: customer.shipping_city || '',
        nip: customer.nip || '',
        company: customer.company || '',
        billingStreet: customer.billing_street || '',
        billingPostalCode: customer.billing_postal_code || '',
        billingCity: customer.billing_city || '',
      });
    } else {
      setForm(emptyForm);
      setEditMode(true);
    }
  }, [open, customer]);

  const handleSave = async () => {
    if (!form.name.trim()) {
      toast.error('Nazwa jest wymagana');
      return;
    }
    if (!form.phone.trim()) {
      toast.error('Telefon jest wymagany');
      return;
    }

    setSaving(true);
    try {
      const payload: Record<string, any> = {
        instance_id: instanceId,
        name: form.name.trim(),
        contact_person: form.contactPerson.trim() || null,
        phone: form.phone.trim(),
        email: form.email.trim() || null,
        discount_percent: form.discountEnabled ? form.discountPercent : null,
        is_net_payer: form.isNetPayer,
        sales_notes: form.notes.trim() || null,
        shipping_street_line2: form.shippingAddressee.trim() || null,
        shipping_street: form.shippingStreet.trim() || null,
        shipping_postal_code: form.shippingPostalCode.trim() || null,
        shipping_city: form.shippingCity.trim() || null,
        nip: form.nip.trim() || null,
        company: form.company.trim() || null,
        billing_street: form.billingStreet.trim() || null,
        billing_postal_code: form.billingPostalCode.trim() || null,
        billing_city: form.billingCity.trim() || null,
        source: 'sales',
      };

      if (customer?.id) {
        const { error } = await (supabase
          .from('customers')
          .update(payload)
          .eq('id', customer.id) as any);
        if (error) throw error;
        toast.success('Klient zaktualizowany');
      } else {
        const { error } = await (supabase
          .from('customers')
          .insert(payload as any) as any);
        if (error) throw error;
        toast.success('Klient dodany');
      }

      onSaved();
      onOpenChange(false);
    } catch (err: any) {
      console.error(err);
      toast.error('Błąd zapisu: ' + (err.message || 'Nieznany błąd'));
    } finally {
      setSaving(false);
    }
  };

  const renderViewMode = () => (
    <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col min-h-0">
      <TabsList className="bg-background border border-border/50 grid grid-cols-2 w-full">
        <TabsTrigger value="data" className="data-[state=active]:bg-primary/5 data-[state=active]:text-foreground hover:bg-primary/5 hover:text-foreground">Dane</TabsTrigger>
        <TabsTrigger value="orders" className="data-[state=active]:bg-primary/5 data-[state=active]:text-foreground hover:bg-primary/5 hover:text-foreground">Zamówienia</TabsTrigger>
      </TabsList>

      <TabsContent value="data" className="flex-1 overflow-y-auto space-y-4 pr-1">
        <div className="space-y-3 text-sm">
          <ViewField label="Nazwa" value={form.name} />
          <ViewField label="Osoba kontaktowa" value={form.contactPerson} />
          <ViewField label="Telefon" value={form.phone} isPhone />
          <ViewField label="Email" value={form.email} isEmail />
          {form.discountEnabled && (
            <ViewField label="Rabat" value={`${form.discountPercent}%`} />
          )}
          <ViewField label="Płatnik" value={form.isNetPayer ? 'netto' : 'brutto'} />
          <ViewField label="Notatki" value={form.notes} />
        </div>

        {(form.shippingStreet || form.shippingCity) && (
          <>
            <Separator />
            <div className="space-y-3 text-sm">
              <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Adres wysyłki</h4>
              {form.shippingAddressee && <ViewField label="Adresat" value={form.shippingAddressee} />}
              <ViewField label="Adres" value={[form.shippingStreet, `${form.shippingPostalCode} ${form.shippingCity}`].filter(Boolean).join(', ')} />
            </div>
          </>
        )}

        <Separator />
        <NipLookupForm
          readOnly
          value={{
            nip: form.nip,
            company: form.company,
            billingStreet: form.billingStreet,
            billingPostalCode: form.billingPostalCode,
            billingCity: form.billingCity,
          }}
          onChange={() => {}}
        />
      </TabsContent>

      <TabsContent value="orders" className="flex-1 overflow-y-auto">
        <p className="text-sm text-muted-foreground text-center py-8">Brak zamówień</p>
      </TabsContent>
    </Tabs>
  );

  const renderFormMode = () => (
    <div className="flex-1 overflow-y-auto space-y-4 pr-1">
      <div className="space-y-3">
        <div>
          <Label htmlFor="name">Nazwa *</Label>
          <Input id="name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </div>
        <div>
          <Label htmlFor="contact-person">Osoba kontaktowa</Label>
          <Input id="contact-person" value={form.contactPerson} onChange={(e) => setForm({ ...form, contactPerson: e.target.value })} />
        </div>
        <div>
          <Label htmlFor="phone">Telefon *</Label>
          <Input id="phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
        </div>
        <div>
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        </div>
      </div>

      <Separator />

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label htmlFor="discount-toggle">Rabat</Label>
          <Switch
            id="discount-toggle"
            checked={form.discountEnabled}
            onCheckedChange={(checked) => setForm({ ...form, discountEnabled: checked })}
          />
        </div>
        {form.discountEnabled && (
          <div className="flex items-center gap-2">
            <Input
              type="number"
              min={0}
              max={100}
              className="w-24"
              value={form.discountPercent}
              onChange={(e) => setForm({ ...form, discountPercent: Number(e.target.value) })}
            />
            <span className="text-sm text-muted-foreground">%</span>
          </div>
        )}

        <div className="flex items-center justify-between">
          <Label htmlFor="net-payer-toggle">Płatnik netto</Label>
          <Switch
            id="net-payer-toggle"
            checked={form.isNetPayer}
            onCheckedChange={(checked) => setForm({ ...form, isNetPayer: checked })}
          />
        </div>
      </div>

      <div>
        <Label htmlFor="notes">Notatki</Label>
        <Textarea
          id="notes"
          rows={3}
          value={form.notes}
          onChange={(e) => setForm({ ...form, notes: e.target.value })}
        />
      </div>

      <Separator />

      <div className="space-y-3">
        <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Adres wysyłki</h4>
        <div>
          <Label htmlFor="ship-addressee">Adresat</Label>
          <Input id="ship-addressee" value={form.shippingAddressee} onChange={(e) => setForm({ ...form, shippingAddressee: e.target.value })} />
        </div>
        <div>
          <Label htmlFor="ship-street">Ulica</Label>
          <Input id="ship-street" value={form.shippingStreet} onChange={(e) => setForm({ ...form, shippingStreet: e.target.value })} />
        </div>
        <div className="grid grid-cols-[120px_1fr] gap-2">
          <div>
            <Label htmlFor="ship-postal">Kod pocztowy</Label>
            <Input id="ship-postal" placeholder="00-000" value={form.shippingPostalCode} onChange={(e) => setForm({ ...form, shippingPostalCode: e.target.value })} />
          </div>
          <div>
            <Label htmlFor="ship-city">Miasto</Label>
            <Input id="ship-city" value={form.shippingCity} onChange={(e) => setForm({ ...form, shippingCity: e.target.value })} />
          </div>
        </div>
      </div>

      <Separator />

      <NipLookupForm
        value={{
          nip: form.nip,
          company: form.company,
          billingStreet: form.billingStreet,
          billingPostalCode: form.billingPostalCode,
          billingCity: form.billingCity,
        }}
        onChange={(nipData) =>
          setForm({
            ...form,
            nip: nipData.nip,
            company: nipData.company,
            billingStreet: nipData.billingStreet,
            billingPostalCode: nipData.billingPostalCode,
            billingCity: nipData.billingCity,
          })
        }
      />
    </div>
  );

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="flex flex-col p-0 gap-0"
        style={{ width: isMobile ? '100vw' : '440px', maxWidth: '100vw' }}
        hideCloseButton
      >
        {/* Sticky header */}
        <div className="flex items-center justify-between px-5 py-4 border-b shrink-0">
          <h2 className="font-semibold text-lg">
            {isEdit ? form.name || 'Klient' : 'Nowy klient'}
          </h2>
          <div className="flex items-center gap-1">
            {isEdit && !editMode && (
              <Button variant="ghost" size="icon" onClick={() => setEditMode(true)}>
                <Pencil className="w-4 h-4" />
              </Button>
            )}
            <Button variant="ghost" size="icon" onClick={() => onOpenChange(false)}>
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 flex flex-col min-h-0 px-5 py-4">
          {isFormMode ? renderFormMode() : renderViewMode()}
        </div>

        {/* Sticky footer */}
        {isFormMode && (
          <div className="flex items-center gap-2 px-5 py-3 border-t shrink-0 bg-background">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => {
                if (isEdit) setEditMode(false);
                else onOpenChange(false);
              }}
            >
              Anuluj
            </Button>
            <Button className="flex-1" onClick={handleSave} disabled={saving}>
              {saving ? 'Zapisywanie...' : 'Zapisz'}
            </Button>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
};

const ViewField = ({ label, value, isPhone, isEmail }: { label: string; value?: string | null; isPhone?: boolean; isEmail?: boolean }) => {
  if (!value) return null;
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      {isPhone ? (
        <a href={`tel:${value.replace(/\s/g, '')}`} className="text-primary hover:underline font-medium">{value}</a>
      ) : isEmail ? (
        <a href={`mailto:${value}`} className="text-primary hover:underline font-medium">{value}</a>
      ) : (
        <p className="font-medium">{value}</p>
      )}
    </div>
  );
};

export default AddEditSalesCustomerDrawer;
