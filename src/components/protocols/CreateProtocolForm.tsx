import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Textarea } from '@/components/ui/textarea';
import { CalendarIcon, Loader2, PenLine, Mail, Settings, ArrowLeft, Camera, AlertTriangle } from 'lucide-react';
import { format } from 'date-fns';
import { pl } from 'date-fns/locale';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { normalizePhone } from '@/lib/phoneUtils';
import { VehicleDiagram, type BodyType, type VehicleView, type DamagePoint } from './VehicleDiagram';
import { DamagePointDrawer } from './DamagePointDrawer';
import { PhotoFullscreenDialog } from './PhotoFullscreenDialog';
import { OfferSearchAutocomplete } from './OfferSearchAutocomplete';
import { SignatureDialog } from './SignatureDialog';
import { SendProtocolEmailDialog } from './SendProtocolEmailDialog';
import { ProtocolPhotosUploader } from './ProtocolPhotosUploader';
import ClientSearchAutocomplete, { type ClientSearchValue } from '@/components/ui/client-search-autocomplete';
import { CarSearchAutocomplete, type CarSearchValue } from '@/components/ui/car-search-autocomplete';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

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
  const [searchParams] = useSearchParams();
  const [instance, setInstance] = useState<Instance | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingAndSending, setSavingAndSending] = useState(false);
  const isEditMode = !!protocolId;
  
  // URL params for reservation pre-fill
  const reservationIdFromUrl = searchParams.get('reservationId');
  const customerNameFromUrl = searchParams.get('customerName');
  const customerPhoneFromUrl = searchParams.get('customerPhone');
  const vehiclePlateFromUrl = searchParams.get('vehiclePlate');
  const emailFromUrl = searchParams.get('email');
  
  // Suppress auto-search when pre-filled from reservation URL
  const hasPrefilledData = !!(customerNameFromUrl || customerPhoneFromUrl);
  
  // Refs for scroll-to-error
  const customerNameRef = useRef<HTMLDivElement>(null);
  const customerEmailRef = useRef<HTMLInputElement>(null);
  const notesRef = useRef<HTMLTextAreaElement>(null);

  // Form state
  const [offerNumber, setOfferNumber] = useState('');
  const [offerId, setOfferId] = useState<string | null>(null);
  const [customerName, setCustomerName] = useState(customerNameFromUrl || '');
  const [customerEmail, setCustomerEmail] = useState(emailFromUrl || '');
  const [vehicleModel, setVehicleModel] = useState(vehiclePlateFromUrl || '');
  const [nip, setNip] = useState('');
  const [phone, setPhone] = useState(customerPhoneFromUrl || '');
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [reservationId, setReservationId] = useState<string | null>(reservationIdFromUrl);
  const [registrationNumber, setRegistrationNumber] = useState('');
  const [fuelLevel, setFuelLevel] = useState('');
  const [odometerReading, setOdometerReading] = useState('');
  const [bodyType, setBodyType] = useState<BodyType>('sedan');
  const [protocolDate, setProtocolDate] = useState<Date>(new Date());
  const [receivedBy, setReceivedBy] = useState('');
  const [notes, setNotes] = useState('');
  const [protocolType, setProtocolType] = useState<ProtocolType>('reception');
  
  // Protocol photos (general, not per-damage)
  const [protocolPhotoUrls, setProtocolPhotoUrls] = useState<string[]>([]);
  
  // Collapsible sections
  const [showPhotosSection, setShowPhotosSection] = useState(false);
  const [showDamageSection, setShowDamageSection] = useState(false);

  // Damage points
  const [damagePoints, setDamagePoints] = useState<DamagePoint[]>([]);
  const [pendingPoint, setPendingPoint] = useState<{ view: VehicleView; x_percent: number; y_percent: number } | null>(null);
  const [selectedPoint, setSelectedPoint] = useState<DamagePoint | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [fullscreenPhoto, setFullscreenPhoto] = useState<string | null>(null);

  // Signature
  const [customerSignature, setCustomerSignature] = useState<string | null>(null);
  const [signatureDialogOpen, setSignatureDialogOpen] = useState(false);

  // Email dialog
  const [emailDialogOpen, setEmailDialogOpen] = useState(false);
  const [savedProtocolIdForEmail, setSavedProtocolIdForEmail] = useState<string | null>(null);
  
  // Date picker
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  
  // Validation errors
  const [validationErrors, setValidationErrors] = useState<{ customerName?: boolean }>({});
  // Unsaved changes dialog
  const [showUnsavedDialog, setShowUnsavedDialog] = useState(false);
  const [pendingAction, setPendingAction] = useState<'back' | 'cancel' | null>(null);

  // Track photos uploaded during this session (for orphan cleanup)
  const [uploadedPhotosInSession, setUploadedPhotosInSession] = useState<string[]>([]);

  // Initial state snapshot for dirty checking
  const initialStateRef = useRef<{
    customerName: string;
    customerEmail: string;
    vehicleModel: string;
    registrationNumber: string;
    damagePointsCount: number;
    customerSignature: string | null;
    notes: string;
    protocolPhotoUrls: string[];
  } | null>(null);

  // Track if form has been saved at least once
  const hasBeenSavedRef = useRef(false);

  // Generate notes from damage points (exclude unsaved points with isNew flag)
  const generatedNotes = useMemo(() => {
    const savedPoints = damagePoints.filter(p => !p.isNew);
    if (savedPoints.length === 0) return '';
    return savedPoints.map(point => {
      const viewLabel = VIEW_LABELS[point.view];
      const damageLabel = point.damage_type ? DAMAGE_TYPE_LABELS[point.damage_type] || point.damage_type : 'usterka';
      const customNote = point.custom_note ? ` - ${point.custom_note}` : '';
      return `- ${viewLabel}: ${damageLabel}${customNote}`;
    }).join('\n');
  }, [damagePoints]);

  // Check if form is dirty (has unsaved changes)
  const isDirty = useMemo(() => {
    if (!initialStateRef.current) return false;
    const initial = initialStateRef.current;
    return (
      customerName !== initial.customerName ||
      customerEmail !== initial.customerEmail ||
      vehicleModel !== initial.vehicleModel ||
      registrationNumber !== initial.registrationNumber ||
      damagePoints.length !== initial.damagePointsCount ||
      customerSignature !== initial.customerSignature ||
      notes !== initial.notes ||
      protocolPhotoUrls.length !== initial.protocolPhotoUrls.length ||
      uploadedPhotosInSession.length > 0
    );
  }, [customerName, customerEmail, vehicleModel, registrationNumber, damagePoints.length, customerSignature, notes, protocolPhotoUrls.length, uploadedPhotosInSession.length]);

  // Auto-generate notes from damage points ONLY during creation (not edit mode) and ONLY if notes are empty
  useEffect(() => {
    // Skip auto-generation entirely in edit mode
    if (isEditMode) return;
    
    // Only set notes if field is completely empty
    setNotes((current) => {
      if (current.trim() === '') {
        return generatedNotes;
      }
      return current;
    });
  }, [generatedNotes, isEditMode]);

  // Auto-resize notes textarea
  useEffect(() => {
    if (notesRef.current) {
      notesRef.current.style.height = 'auto';
      notesRef.current.style.height = Math.max(150, notesRef.current.scrollHeight) + 'px';
    }
  }, [notes]);
  // Cleanup orphaned photos from storage
  const cleanupOrphanedPhotos = useCallback(async () => {
    if (uploadedPhotosInSession.length === 0) return;
    
    try {
      for (const url of uploadedPhotosInSession) {
        // Extract file name from URL
        const urlParts = url.split('/');
        const fileName = urlParts[urlParts.length - 1];
        if (fileName) {
          await supabase.storage.from('protocol-photos').remove([fileName]);
        }
      }
      console.log(`Cleaned up ${uploadedPhotosInSession.length} orphaned photos`);
    } catch (error) {
      console.error('Error cleaning up orphaned photos:', error);
    }
  }, [uploadedPhotosInSession]);

  // Handle photo uploaded callback from DamagePointDrawer
  const handlePhotoUploaded = useCallback((url: string) => {
    setUploadedPhotosInSession(prev => [...prev, url]);
  }, []);

  // Browser beforeunload guard
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isDirty && !hasBeenSavedRef.current) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isDirty]);

  // Safe navigation handler
  const handleNavigateBack = useCallback(() => {
    if (isDirty && !hasBeenSavedRef.current) {
      setPendingAction('back');
      setShowUnsavedDialog(true);
    } else {
      onBack();
    }
  }, [isDirty, onBack]);

  // Handle discard changes
  const handleDiscardChanges = useCallback(async () => {
    await cleanupOrphanedPhotos();
    setShowUnsavedDialog(false);
    onBack();
  }, [cleanupOrphanedPhotos, onBack]);


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
          setNotes(protocolData.notes || '');
          
          // Load protocol photos
          const loadedPhotos = (protocolData as any).photo_urls || [];
          setProtocolPhotoUrls(loadedPhotos);
          if (loadedPhotos.length > 0) {
            setShowPhotosSection(true);
          }

          // Fetch damage points
          const { data: pointsData, error: pointsError } = await supabase
            .from('protocol_damage_points')
            .select('*')
            .eq('protocol_id', protocolId);

          if (pointsError) throw pointsError;

          if (pointsData) {
            const points = pointsData.map((p: any) => ({
              id: p.id,
              view: p.view as VehicleView,
              x_percent: p.x_percent,
              y_percent: p.y_percent,
              damage_type: p.damage_type || undefined,
              custom_note: p.custom_note || undefined,
              photo_url: p.photo_url || undefined,
              photo_urls: p.photo_urls || undefined,
            }));
            setDamagePoints(points);
            if (points.length > 0) {
              setShowDamageSection(true);
            }
          }
        }
        
        // Set initial state for dirty checking (after data is loaded)
        setTimeout(() => {
          initialStateRef.current = {
            customerName: protocolId ? (customerName || '') : '',
            customerEmail: protocolId ? (customerEmail || '') : '',
            vehicleModel: protocolId ? (vehicleModel || '') : '',
            registrationNumber: protocolId ? (registrationNumber || '') : '',
            damagePointsCount: protocolId ? damagePoints.length : 0,
            customerSignature: protocolId ? customerSignature : null,
            notes: protocolId ? notes : '',
            protocolPhotoUrls: protocolId ? protocolPhotoUrls : [],
          };
        }, 100);
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

  const handleSavePoint = async (data: { damage_type: string; custom_note: string; photo_url: string | null; photo_urls: string[] }) => {
    if (selectedPoint) {
      // Update existing point - remove isNew flag
      const updatedPoint = { ...selectedPoint, ...data, isNew: false };
      setDamagePoints(prev => 
        prev.map(p => p.id === selectedPoint.id ? updatedPoint : p)
      );
      // Auto-persist to database in edit mode
      if (isEditMode && protocolId && selectedPoint.id && !selectedPoint.id.startsWith('temp-')) {
        try {
          await supabase
            .from('protocol_damage_points')
            .update({
              damage_type: data.damage_type || null,
              custom_note: data.custom_note || null,
              photo_url: data.photo_url,
              photo_urls: data.photo_urls,
            })
            .eq('id', selectedPoint.id);
        } catch (err) {
          console.error('Error auto-saving damage point:', err);
        }
      }
    } else if (pendingPoint) {
      // Add new point
      const newPoint: DamagePoint = {
        id: `temp-${Date.now()}`,
        view: pendingPoint.view,
        x_percent: pendingPoint.x_percent,
        y_percent: pendingPoint.y_percent,
        ...data,
      };
      setDamagePoints(prev => [...prev, newPoint]);
      // Auto-persist new point to database in edit mode
      if (isEditMode && protocolId) {
        try {
          const { data: inserted } = await supabase
            .from('protocol_damage_points')
            .insert({
              protocol_id: protocolId,
              view: pendingPoint.view,
              x_percent: pendingPoint.x_percent,
              y_percent: pendingPoint.y_percent,
              damage_type: data.damage_type || null,
              custom_note: data.custom_note || null,
              photo_url: data.photo_url,
              photo_urls: data.photo_urls,
            } as any)
            .select('id')
            .single();
          // Update the temp ID with the real one
          if (inserted) {
            setDamagePoints(prev => prev.map(p => p.id === newPoint.id ? { ...p, id: inserted.id } : p));
          }
        } catch (err) {
          console.error('Error auto-saving new damage point:', err);
        }
      }
    }
    setDrawerOpen(false);
    setPendingPoint(null);
    setSelectedPoint(null);
  };

  const handleDeletePoint = async () => {
    if (selectedPoint) {
      setDamagePoints(prev => prev.filter(p => p.id !== selectedPoint.id));
      // Auto-persist deletion in edit mode
      if (isEditMode && protocolId && selectedPoint.id && !selectedPoint.id.startsWith('temp-')) {
        try {
          await supabase
            .from('protocol_damage_points')
            .delete()
            .eq('id', selectedPoint.id);
        } catch (err) {
          console.error('Error auto-deleting damage point:', err);
        }
      }
    }
    setDrawerOpen(false);
    setSelectedPoint(null);
  };

  const handleSave = async (openEmailAfter = false) => {
    // Validate customer name
    if (!customerName.trim()) {
      setValidationErrors({ customerName: true });
      toast.error('Podaj imię i nazwisko Klienta');
      // Scroll to customer name field using ref
      setTimeout(() => {
        customerNameRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 100);
      return null;
    }
    
    // Validate email if sending
    if (openEmailAfter && !customerEmail.trim()) {
      toast.error('Aby wysłać protokół podaj email Klienta');
      // Scroll to email field using ref
      setTimeout(() => {
        customerEmailRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        customerEmailRef.current?.focus();
      }, 100);
      return null;
    }
    
    setValidationErrors({});

    if (openEmailAfter) {
      setSavingAndSending(true);
    } else {
      setSaving(true);
    }

    try {
      // Filter out unsaved damage points (those with isNew flag)
      const savedDamagePoints = damagePoints.filter(p => !p.isNew);
      
      const protocolPayload = {
        instance_id: instanceId,
        offer_id: offerId,
        offer_number: offerNumber || null,
        customer_name: customerName,
        customer_email: customerEmail || null,
        vehicle_model: vehicleModel || null,
        nip: nip || null,
        phone: normalizePhone(phone) || null,
        registration_number: registrationNumber || null,
        fuel_level: fuelLevel ? parseInt(fuelLevel) : null,
        odometer_reading: odometerReading ? parseInt(odometerReading) : null,
        body_type: bodyType,
        protocol_date: format(protocolDate, 'yyyy-MM-dd'),
        received_by: receivedBy || null,
        status: 'completed',
        protocol_type: protocolType,
        customer_signature: customerSignature,
        notes: notes || null,
        photo_urls: protocolPhotoUrls,
        reservation_id: reservationId || null,
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
        
        // Generate a short public token for public access
        const generateShortToken = () => {
          const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
          let result = '';
          for (let i = 0; i < 12; i++) {
            result += chars.charAt(Math.floor(Math.random() * chars.length));
          }
          return result;
        };

        const { data: protocol, error: protocolError } = await supabase
          .from('vehicle_protocols')
          .insert({
            ...protocolPayload,
            protocol_time: currentTime,
            public_token: generateShortToken(),
          } as any)
          .select('id')
          .single();

        if (protocolError) throw protocolError;
        savedProtocolId = protocol.id;
      }

      // Save damage points (only the saved ones, not isNew)
      if (savedDamagePoints.length > 0 && savedProtocolId) {
        const pointsToInsert = savedDamagePoints.map(p => ({
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
        hasBeenSavedRef.current = true;
        setUploadedPhotosInSession([]); // Clear tracked photos after save
        return savedProtocolId;
      } else {
        toast.success(isEditMode ? 'Protokół zaktualizowany' : 'Protokół zapisany');
        hasBeenSavedRef.current = true;
        setUploadedPhotosInSession([]); // Clear tracked photos after save
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

  // Handle save and exit (for dialog)
  const handleSaveAndExit = async () => {
    setShowUnsavedDialog(false);
    await handleSave(false);
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
    <div className="min-h-screen bg-muted/50 flex flex-col">
      {/* Sticky header - full width, edge-to-edge */}
      <div className="bg-white border-b fixed top-0 left-0 right-0 z-50">
        <div className="w-full max-w-3xl mx-auto px-4 py-3 flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={handleNavigateBack}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-lg font-semibold">
            {isEditMode ? 'Edycja protokołu' : 'Nowy protokół'}
          </h1>
          {onOpenSettings && (
            <Button variant="ghost" size="icon" className="ml-auto" onClick={onOpenSettings}>
              <Settings className="h-5 w-5" />
            </Button>
          )}
        </div>
      </div>

      {/* Spacer for fixed header */}
      <div className="h-14" />

      {/* Scrollable content */}
      <main className="flex-1 overflow-y-auto pb-32 sm:pb-24">
        <div className="w-full max-w-3xl mx-auto px-4 py-6 space-y-6 bg-white min-h-full">
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
              <Label>Powiązana oferta</Label>
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
            <div className="space-y-2" ref={customerNameRef}>
              <Label>Imię i nazwisko Klienta *</Label>
              <ClientSearchAutocomplete
                instanceId={instanceId}
                value={customerName}
                onChange={(val) => {
                  setCustomerName(val);
                  if (val.trim()) setValidationErrors(prev => ({ ...prev, customerName: false }));
                }}
                onSelect={handleCustomerSelect}
                onClear={handleCustomerClear}
                placeholder="Wyszukaj klienta lub wpisz nowe dane"
                className={cn("bg-white", validationErrors.customerName && "border-destructive")}
                suppressAutoSearch={isEditMode || hasPrefilledData}
              />
              {validationErrors.customerName && (
                <p className="text-xs text-destructive">Imię i nazwisko Klienta jest wymagane</p>
              )}
            </div>
            <div className="space-y-2">
              <Label>Telefon</Label>
              <ClientSearchAutocomplete
                instanceId={instanceId}
                value={phone}
                suppressAutoSearch={isEditMode || hasPrefilledData}
                onChange={setPhone}
                onSelect={handleCustomerSelect}
                onClear={handleCustomerClear}
                placeholder="Wyszukaj po numerze telefonu"
                className="bg-white"
              />
            </div>
            <div className="space-y-2">
              <Label>Email Klienta</Label>
              <Input
                ref={customerEmailRef}
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
          </div>

          {/* Photos section - collapsible */}
          {!showPhotosSection ? (
            <Button
              type="button"
              variant="outline"
              className="w-full border-dashed"
              onClick={() => setShowPhotosSection(true)}
            >
              <Camera className="h-4 w-4 mr-2" />
              Dodaj zdjęcia
            </Button>
          ) : (
            <div className="space-y-2">
              <Label>Zdjęcia pojazdu</Label>
              <ProtocolPhotosUploader
                photos={protocolPhotoUrls}
                onPhotosChange={setProtocolPhotoUrls}
                onPhotoUploaded={handlePhotoUploaded}
                protocolId={protocolId}
              />
            </div>
          )}

          {/* Damage section - collapsible */}
          {!showDamageSection ? (
            <Button
              type="button"
              variant="outline"
              className="w-full border-dashed"
              onClick={() => setShowDamageSection(true)}
            >
              <AlertTriangle className="h-4 w-4 mr-2" />
              Dodaj usterki
            </Button>
          ) : (
            <>
              {/* Body type selector */}
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

              {/* Vehicle diagram */}
              <div className="space-y-2">
                <Label>Zaznacz ewentualne usterki na diagramie pojazdu przetrzymując palec w danym miejscu</Label>
                <VehicleDiagram
                  bodyType={bodyType}
                  damagePoints={damagePoints}
                  onAddPoint={handleAddPoint}
                  onSelectPoint={handleSelectPoint}
                  onUpdatePointPosition={handleUpdatePointPosition}
                  selectedPointId={selectedPoint?.id}
                />
              </div>

              {/* Damage photos - collected from all damage points */}
              {damagePoints.some(p => (p.photo_urls && p.photo_urls.length > 0) || p.photo_url) && (
                <div className="space-y-2">
                  <Label className="text-muted-foreground">Zdjęcia usterek</Label>
                  <div className="grid grid-cols-4 gap-2">
                    {damagePoints.flatMap(p => {
                      const urls = p.photo_urls || (p.photo_url ? [p.photo_url] : []);
                      return urls.map((url, idx) => (
                        <div key={`${p.id}-${idx}`} className="relative aspect-square">
                          <img
                            src={url}
                            alt={`Zdjęcie usterki`}
                            className="w-full h-full object-cover rounded-lg cursor-pointer hover:opacity-90 transition-opacity"
                            onClick={() => setFullscreenPhoto(url)}
                          />
                        </div>
                      ));
                    })}
                  </div>
                </div>
              )}
            </>
          )}

          {/* Notes - auto-filled with damage points */}
          <div className="space-y-2">
            <Label>Uwagi</Label>
            <Textarea
              ref={notesRef}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Uwagi dotyczące stanu pojazdu..."
              className="resize-none overflow-hidden"
              style={{ minHeight: '150px' }}
            />
          </div>

          {/* Protocol metadata */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Data protokołu</Label>
              <Popover open={datePickerOpen} onOpenChange={setDatePickerOpen}>
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
                    onSelect={(date) => {
                      if (date) {
                        setProtocolDate(date);
                        setDatePickerOpen(false);
                      }
                    }}
                    locale={pl}
                    className="pointer-events-auto"
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
        <Button variant="outline" onClick={handleNavigateBack} className="bg-white">
          Anuluj
        </Button>
        <div className="flex gap-2">
          {onOpenSettings && (
            <Button variant="outline" size="icon" onClick={onOpenSettings} className="bg-white">
              <Settings className="h-4 w-4" />
            </Button>
          )}
          <Button 
            variant="outline" 
            onClick={handleSaveAndSendEmail} 
            disabled={saving || savingAndSending}
            className="bg-white"
          >
            {savingAndSending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            <Mail className="h-4 w-4 sm:mr-2" />
            <span className="hidden sm:inline">Zapisz i wyślij</span>
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
        onPhotoUploaded={handlePhotoUploaded}
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

      {/* Unsaved changes dialog */}
      <AlertDialog open={showUnsavedDialog} onOpenChange={setShowUnsavedDialog}>
        <AlertDialogContent className="bg-white">
          <AlertDialogHeader>
            <AlertDialogTitle>Niezapisane zmiany</AlertDialogTitle>
            <AlertDialogDescription>
              Masz niezapisane zmiany w protokole. Czy chcesz je zapisać przed wyjściem?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col sm:flex-row gap-2">
            <AlertDialogCancel onClick={() => setShowUnsavedDialog(false)}>
              Anuluj
            </AlertDialogCancel>
            <Button
              variant="outline"
              onClick={handleDiscardChanges}
              className="text-destructive hover:text-destructive hover:bg-destructive/10"
            >
              Nie zapisuj
            </Button>
            <AlertDialogAction onClick={handleSaveAndExit}>
              Zapisz
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <PhotoFullscreenDialog
        open={!!fullscreenPhoto}
        onOpenChange={(open) => !open && setFullscreenPhoto(null)}
        photoUrl={fullscreenPhoto}
        allPhotos={[...protocolPhotoUrls, ...damagePoints.flatMap(p => p.photo_urls || [])]}
        initialIndex={fullscreenPhoto ? [...protocolPhotoUrls, ...damagePoints.flatMap(p => p.photo_urls || [])].indexOf(fullscreenPhoto) : 0}
        onAnnotate={async (newUrl) => {
          const oldUrl = fullscreenPhoto;
          if (!oldUrl) return;
          // Replace URL in protocol photos
          const newPhotos = protocolPhotoUrls.map(u => u === oldUrl ? newUrl : u);
          setProtocolPhotoUrls(newPhotos);
          // Replace URL in damage points
          const newPoints = damagePoints.map(p => ({
            ...p,
            photo_url: p.photo_url === oldUrl ? newUrl : p.photo_url,
            photo_urls: p.photo_urls?.map(u => u === oldUrl ? newUrl : u),
          }));
          setDamagePoints(newPoints);
          setFullscreenPhoto(newUrl);
          // Auto-persist to database in edit mode
          if (isEditMode && protocolId) {
            try {
              await supabase
                .from('vehicle_protocols')
                .update({ photo_urls: newPhotos })
                .eq('id', protocolId);
              // Update damage points photo URLs in DB
              const savedPoints = newPoints.filter(p => !('isNew' in p && (p as any).isNew));
              for (const p of savedPoints) {
                if ('id' in p && p.id) {
                  await supabase
                    .from('protocol_damage_points')
                    .update({ photo_url: p.photo_url, photo_urls: p.photo_urls })
                    .eq('id', p.id);
                }
              }
            } catch (err) {
              console.error('Error auto-saving annotation:', err);
            }
          }
        }}
      />
    </div>
  );
};
