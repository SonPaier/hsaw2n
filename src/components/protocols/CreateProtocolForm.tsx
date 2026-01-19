import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Textarea } from '@/components/ui/textarea';
import { CalendarIcon, Loader2, PenLine, Mail, Settings } from 'lucide-react';
import { format } from 'date-fns';
import { pl } from 'date-fns/locale';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { ProtocolHeader } from './ProtocolHeader';
import { VehicleDiagram, type BodyType, type VehicleView, type DamagePoint } from './VehicleDiagram';
import { DamagePointDrawer } from './DamagePointDrawer';
import { OfferSearchAutocomplete } from './OfferSearchAutocomplete';
import { SignatureDialog } from './SignatureDialog';
import { SendProtocolEmailDialog } from './SendProtocolEmailDialog';
import ClientSearchAutocomplete, { type ClientSearchValue } from '@/components/ui/client-search-autocomplete';
import { CarSearchAutocomplete, type CarSearchValue } from '@/components/ui/car-search-autocomplete';

type ProtocolType = 'reception' | 'pickup';

interface Instance {
  id: string;
  name: string;
  logo_url: string | null;
  phone: string | null;
  email: string | null;
}

interface CreateProtocolFormProps {
  instanceId: string;
  protocolId?: string | null;
  onBack: () => void;
  onOpenSettings?: () => void;
}

const BODY_TYPES: { value: BodyType; label: string }[] = [
  { value: 'sedan', label: 'Sedan' },
  { value: 'suv', label: 'SUV' },
  { value: 'coupe', label: 'Coupe' },
  { value: 'cabrio', label: 'Kabriolet' },
  { value: 'van', label: 'Van' },
  { value: 'kombi', label: 'Kombi' },
  { value: 'hatchback', label: 'Hatchback' },
];

const VIEW_LABELS: Record<VehicleView, string> = {
  full: 'Diagram pojazdu',
};

const DAMAGE_TYPE_LABELS: Record<string, string> = {
  scratch: 'rysa',
  dent: 'wgniecenie',
  damage: 'uszkodzenie',
  chip: 'odprysek',
  custom: 'inne',
};

export const CreateProtocolForm = ({ instanceId, protocolId, onBack, onOpenSettings }: CreateProtocolFormProps) => {
  const [instance, setInstance] = useState<Instance | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingAndSending, setSavingAndSending] = useState(false);
  const isEditMode = !!protocolId;

  // Form state
  const [offerNumber, setOfferNumber] = useState('');
  const [offerId, setOfferId] = useState<string | null>(null);
  const [customerName, setCustomerName] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [vehicleModel, setVehicleModel] = useState('');
  const [nip, setNip] = useState('');
  const [phone, setPhone] = useState('');
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [registrationNumber, setRegistrationNumber] = useState('');
  const [fuelLevel, setFuelLevel] = useState('');
  const [odometerReading, setOdometerReading] = useState('');
  const [bodyType, setBodyType] = useState<BodyType>('sedan');
  const [protocolDate, setProtocolDate] = useState<Date>(new Date());
  const [receivedBy, setReceivedBy] = useState('');
  const [notes, setNotes] = useState('');
  const [protocolType, setProtocolType] = useState<ProtocolType>('reception');

  // Damage points
  const [damagePoints, setDamagePoints] = useState<DamagePoint[]>([]);
  const [pendingPoint, setPendingPoint] = useState<{ view: VehicleView; x_percent: number; y_percent: number } | null>(null);
  const [selectedPoint, setSelectedPoint] = useState<DamagePoint | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Signature
  const [customerSignature, setCustomerSignature] = useState<string | null>(null);
  const [signatureDialogOpen, setSignatureDialogOpen] = useState(false);

  // Email dialog
  const [emailDialogOpen, setEmailDialogOpen] = useState(false);
  const [savedProtocolIdForEmail, setSavedProtocolIdForEmail] = useState<string | null>(null);

  // Generate notes from damage points
  const generatedNotes = useMemo(() => {
    if (damagePoints.length === 0) return '';
    return damagePoints.map(point => {
      const viewLabel = VIEW_LABELS[point.view];
      const damageLabel = point.damage_type ? DAMAGE_TYPE_LABELS[point.damage_type] || point.damage_type : 'usterka';
      const customNote = point.custom_note ? ` - ${point.custom_note}` : '';
      return `- ${viewLabel}: ${damageLabel}${customNote}`;
    }).join('\n');
  }, [damagePoints]);

  // Update notes when damage points change
  useEffect(() => {
    setNotes(generatedNotes);
  }, [generatedNotes]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch instance with contact info
        const { data: instanceData, error: instanceError } = await supabase
          .from('instances')
          .select('id, name, logo_url, phone, email')
          .eq('id', instanceId)
          .single();

        if (instanceError) throw instanceError;
        setInstance(instanceData);

        // If editing, fetch protocol data
        if (protocolId) {
          const { data: protocolData, error: protocolError } = await supabase
            .from('vehicle_protocols')
            .select('*')
            .eq('id', protocolId)
            .single();

          if (protocolError) throw protocolError;

          // Set form values
          setOfferNumber(protocolData.offer_number || '');
          setOfferId(protocolData.offer_id || null);
          setCustomerName(protocolData.customer_name || '');
          setCustomerEmail(protocolData.customer_email || '');
          setVehicleModel(protocolData.vehicle_model || '');
          setNip(protocolData.nip || '');
          setPhone(protocolData.phone || '');
          setRegistrationNumber(protocolData.registration_number || '');
          setProtocolType((protocolData.protocol_type as ProtocolType) || 'reception');
          setCustomerSignature(protocolData.customer_signature || null);
          setFuelLevel(protocolData.fuel_level?.toString() || '');
          setOdometerReading(protocolData.odometer_reading?.toString() || '');
          setBodyType((protocolData.body_type as BodyType) || 'sedan');
          setProtocolDate(new Date(protocolData.protocol_date));
          setReceivedBy(protocolData.received_by || '');

          // Fetch damage points
          const { data: pointsData, error: pointsError } = await supabase
            .from('protocol_damage_points')
            .select('*')
            .eq('protocol_id', protocolId);

          if (pointsError) throw pointsError;

          if (pointsData) {
            setDamagePoints(pointsData.map((p: any) => ({
              id: p.id,
              view: p.view as VehicleView,
              x_percent: p.x_percent,
              y_percent: p.y_percent,
              damage_type: p.damage_type || undefined,
              custom_note: p.custom_note || undefined,
              photo_url: p.photo_url || undefined,
              photo_urls: p.photo_urls || undefined,
            })));
          }
        }
      } catch (error) {
        console.error('Error fetching data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [instanceId, protocolId]);

  const handleOfferSelect = (offer: {
    id: string;
    offer_number: string;
    customer_name: string;
    customer_phone: string;
    customer_email?: string;
    customer_nip?: string;
    vehicle_model?: string;
  }) => {
    setOfferId(offer.id);
    setOfferNumber(offer.offer_number);
    setCustomerName(offer.customer_name);
    setPhone(offer.customer_phone);
    if (offer.customer_email) setCustomerEmail(offer.customer_email);
    if (offer.customer_nip) setNip(offer.customer_nip);
    if (offer.vehicle_model) setVehicleModel(offer.vehicle_model);
  };

  const handleCustomerSelect = (customer: ClientSearchValue) => {
    setCustomerId(customer.id);
    setCustomerName(customer.name);
    setPhone(customer.phone);
  };

  const handleCustomerClear = () => {
    setCustomerId(null);
    setCustomerName('');
    setPhone('');
  };

  const handleAddPoint = (view: VehicleView, xPercent: number, yPercent: number) => {
    // Create a new unsaved point immediately (no drawer yet)
    const newPoint: DamagePoint = {
      id: `temp-${Date.now()}`,
      view: view,
      x_percent: xPercent,
      y_percent: yPercent,
      isNew: true, // Mark as new/unsaved
    };
    setDamagePoints(prev => [...prev, newPoint]);
  };

  const handleSelectPoint = (point: DamagePoint) => {
    setSelectedPoint(point);
    setPendingPoint(null);
    setDrawerOpen(true);
  };

  const handleUpdatePointPosition = (pointId: string, xPercent: number, yPercent: number) => {
    setDamagePoints(prev => 
      prev.map(p => p.id === pointId ? { ...p, x_percent: xPercent, y_percent: yPercent } : p)
    );
  };

  const handleSavePoint = (data: { damage_type: string; custom_note: string; photo_url: string | null; photo_urls: string[] }) => {
    if (selectedPoint) {
      // Update existing point - remove isNew flag
      setDamagePoints(prev => 
        prev.map(p => p.id === selectedPoint.id ? { ...p, ...data, isNew: false } : p)
      );
    } else if (pendingPoint) {
      // Add new point (legacy path)
      const newPoint: DamagePoint = {
        id: `temp-${Date.now()}`,
        view: pendingPoint.view,
        x_percent: pendingPoint.x_percent,
        y_percent: pendingPoint.y_percent,
        ...data,
      };
      setDamagePoints(prev => [...prev, newPoint]);
    }
    setDrawerOpen(false);
    setPendingPoint(null);
    setSelectedPoint(null);
  };

  const handleDeletePoint = () => {
    if (selectedPoint) {
      setDamagePoints(prev => prev.filter(p => p.id !== selectedPoint.id));
    }
    setDrawerOpen(false);
    setSelectedPoint(null);
  };

  const handleSave = async (openEmailAfter = false) => {
    if (!customerName.trim()) {
      toast.error('Podaj imię i nazwisko klienta');
      return null;
    }

    if (openEmailAfter) {
      setSavingAndSending(true);
    } else {
      setSaving(true);
    }

    try {
      const protocolPayload = {
        instance_id: instanceId,
        offer_id: offerId,
        offer_number: offerNumber || null,
        customer_name: customerName,
        customer_email: customerEmail || null,
        vehicle_model: vehicleModel || null,
        nip: nip || null,
        phone: phone || null,
        registration_number: registrationNumber || null,
        fuel_level: fuelLevel ? parseInt(fuelLevel) : null,
        odometer_reading: odometerReading ? parseInt(odometerReading) : null,
        body_type: bodyType,
        protocol_date: format(protocolDate, 'yyyy-MM-dd'),
        received_by: receivedBy || null,
        status: 'completed',
        protocol_type: protocolType,
        customer_signature: customerSignature,
      };

      let savedProtocolId = protocolId;

      if (isEditMode && protocolId) {
        // Update existing protocol
        const { error: protocolError } = await supabase
          .from('vehicle_protocols')
          .update(protocolPayload)
          .eq('id', protocolId);

        if (protocolError) throw protocolError;

        // Delete old damage points and re-insert
        await supabase
          .from('protocol_damage_points')
          .delete()
          .eq('protocol_id', protocolId);
      } else {
        // Create new protocol with current time
        const now = new Date();
        const currentTime = format(now, 'HH:mm:ss');

        const { data: protocol, error: protocolError } = await supabase
          .from('vehicle_protocols')
          .insert({
            ...protocolPayload,
            protocol_time: currentTime,
          } as any)
          .select('id')
          .single();

        if (protocolError) throw protocolError;
        savedProtocolId = protocol.id;
      }

      // Save damage points
      if (damagePoints.length > 0 && savedProtocolId) {
        const pointsToInsert = damagePoints.map(p => ({
          protocol_id: savedProtocolId,
          view: p.view,
          x_percent: p.x_percent,
          y_percent: p.y_percent,
          damage_type: p.damage_type || null,
          custom_note: p.custom_note || null,
          photo_url: p.photo_url || null,
          photo_urls: p.photo_urls || null,
        }));

        const { error: pointsError } = await supabase
          .from('protocol_damage_points')
          .insert(pointsToInsert as any);

        if (pointsError) throw pointsError;
      }

      if (openEmailAfter && savedProtocolId) {
        toast.success('Protokół zapisany');
        setSavedProtocolIdForEmail(savedProtocolId);
        setEmailDialogOpen(true);
        return savedProtocolId;
      } else {
        toast.success(isEditMode ? 'Protokół zaktualizowany' : 'Protokół zapisany');
        onBack();
        return savedProtocolId;
      }
    } catch (error) {
      console.error('Error saving protocol:', error);
      toast.error('Błąd podczas zapisywania protokołu');
      return null;
    } finally {
      setSaving(false);
      setSavingAndSending(false);
    }
  };

  const handleSaveAndSendEmail = () => {
    handleSave(true);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-white">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white flex flex-col">
      {/* Sticky header */}
      <ProtocolHeader instance={instance} onClose={onBack} />

      {/* Scrollable content */}
      <main className="flex-1 overflow-y-auto pb-24">
        <div className="w-full px-4 py-6 space-y-6">
          {/* Protocol type selector */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Typ protokołu</Label>
              <Select value={protocolType} onValueChange={(v) => setProtocolType(v as ProtocolType)}>
                <SelectTrigger className="bg-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="reception">Protokół przyjęcia</SelectItem>
                  <SelectItem value="pickup">Protokół odbioru</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Numer oferty</Label>
              <OfferSearchAutocomplete
                instanceId={instanceId}
                value={offerNumber}
                onChange={setOfferNumber}
                onOfferSelect={handleOfferSelect}
              />
            </div>
          </div>

          {/* Customer data */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Imię i nazwisko *</Label>
              <ClientSearchAutocomplete
                instanceId={instanceId}
                value={customerName}
                onChange={setCustomerName}
                onSelect={handleCustomerSelect}
                onClear={handleCustomerClear}
                placeholder="Wyszukaj klienta lub wpisz nowe dane"
                className="bg-white"
                suppressAutoSearch={isEditMode}
              />
            </div>
            <div className="space-y-2">
              <Label>Telefon</Label>
              <ClientSearchAutocomplete
                instanceId={instanceId}
                value={phone}
                suppressAutoSearch={isEditMode}
                onChange={setPhone}
                onSelect={handleCustomerSelect}
                onClear={handleCustomerClear}
                placeholder="Wyszukaj po numerze telefonu"
                className="bg-white"
              />
            </div>
            <div className="space-y-2">
              <Label>Email klienta</Label>
              <Input
                type="email"
                value={customerEmail}
                onChange={(e) => setCustomerEmail(e.target.value)}
                placeholder="klient@email.com"
              />
            </div>
            <div className="space-y-2">
              <Label>Model samochodu</Label>
              <CarSearchAutocomplete
                value={vehicleModel}
                onChange={(val: CarSearchValue) => {
                  if (val && 'label' in val) {
                    setVehicleModel(val.label);
                  } else {
                    setVehicleModel('');
                  }
                }}
                onClear={() => setVehicleModel('')}
                className="bg-white"
              />
            </div>
            <div className="space-y-2">
              <Label>NIP firmy</Label>
              <Input
                value={nip}
                onChange={(e) => setNip(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Numer rejestracyjny</Label>
              <Input
                value={registrationNumber}
                onChange={(e) => setRegistrationNumber(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Stan paliwa (%)</Label>
              <Input
                type="number"
                min="0"
                max="100"
                value={fuelLevel}
                onChange={(e) => setFuelLevel(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Stan licznika (km)</Label>
              <Input
                type="number"
                min="0"
                value={odometerReading}
                onChange={(e) => setOdometerReading(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Typ nadwozia</Label>
              <Select value={bodyType} onValueChange={(v) => setBodyType(v as BodyType)}>
                <SelectTrigger className="bg-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {BODY_TYPES.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Vehicle diagram */}
          <div className="space-y-2">
            <Label>Diagram pojazdu</Label>
            <VehicleDiagram
              bodyType={bodyType}
              damagePoints={damagePoints}
              onAddPoint={handleAddPoint}
              onSelectPoint={handleSelectPoint}
              onUpdatePointPosition={handleUpdatePointPosition}
              selectedPointId={selectedPoint?.id}
            />
          </div>

          {/* Notes - auto-filled with damage points */}
          <div className="space-y-2">
            <Label>Uwagi</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Uwagi dotyczące stanu pojazdu..."
              rows={3}
              className="resize-none"
            />
          </div>

          {/* Protocol metadata */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Data protokołu</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal bg-white",
                      !protocolDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {protocolDate ? format(protocolDate, 'PPP', { locale: pl }) : 'Wybierz datę'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0 bg-white" align="start">
                  <Calendar
                    mode="single"
                    selected={protocolDate}
                    onSelect={(date) => date && setProtocolDate(date)}
                    locale={pl}
                  />
                </PopoverContent>
              </Popover>
            </div>
            <div className="space-y-2">
              <Label>Przyjął</Label>
              <Input
                value={receivedBy}
                onChange={(e) => setReceivedBy(e.target.value)}
              />
            </div>
          </div>

          {/* Customer signature */}
          <div className="space-y-2">
            <Label>Podpis klienta</Label>
            {customerSignature ? (
              <div 
                className="h-24 border rounded-lg bg-white flex items-center justify-center cursor-pointer hover:bg-muted/30 transition-colors"
                onClick={() => setSignatureDialogOpen(true)}
              >
                <img 
                  src={customerSignature} 
                  alt="Podpis klienta" 
                  className="max-h-20 max-w-full object-contain"
                />
              </div>
            ) : (
              <Button
                type="button"
                variant="outline"
                className="w-full h-24 border-2 border-dashed"
                onClick={() => setSignatureDialogOpen(true)}
              >
                <PenLine className="h-5 w-5 mr-2" />
                Kliknij, aby złożyć podpis
              </Button>
            )}
          </div>
        </div>
      </main>

      {/* Fixed footer */}
      <footer className="fixed bottom-0 left-0 right-0 bg-white border-t p-4 flex justify-between items-center z-50">
        <Button variant="outline" onClick={onBack}>
          Anuluj
        </Button>
        <div className="flex gap-2">
          {onOpenSettings && (
            <Button variant="outline" size="icon" onClick={onOpenSettings}>
              <Settings className="h-4 w-4" />
            </Button>
          )}
          <Button 
            variant="outline" 
            onClick={handleSaveAndSendEmail} 
            disabled={saving || savingAndSending}
          >
            {savingAndSending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            <Mail className="h-4 w-4 mr-2" />
            Zapisz i wyślij
          </Button>
          <Button onClick={() => handleSave(false)} disabled={saving || savingAndSending}>
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Zapisz
          </Button>
        </div>
      </footer>

      <DamagePointDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        point={selectedPoint || pendingPoint}
        onSave={handleSavePoint}
        onDelete={selectedPoint ? handleDeletePoint : undefined}
        isEditing={!!selectedPoint}
        offerNumber={offerNumber}
      />

      <SignatureDialog
        open={signatureDialogOpen}
        onOpenChange={setSignatureDialogOpen}
        onSave={setCustomerSignature}
        initialSignature={customerSignature}
      />

      <SendProtocolEmailDialog
        open={emailDialogOpen}
        onOpenChange={(open) => {
          setEmailDialogOpen(open);
          if (!open) {
            onBack(); // Return to list after closing email dialog
          }
        }}
        protocolId={savedProtocolIdForEmail || protocolId || ''}
        customerName={customerName}
        customerEmail={customerEmail}
        vehicleInfo={[vehicleModel, registrationNumber].filter(Boolean).join(' ')}
        protocolType={protocolType}
      />
    </div>
  );
};
