import { useState, useMemo } from 'react';
import { format } from 'date-fns';
import { pl } from 'date-fns/locale';
import { Label } from '@/components/ui/label';
import { ProtocolHeader } from './ProtocolHeader';
import { VehicleDiagram, type BodyType, type DamagePoint, type VehicleView } from './VehicleDiagram';
import { DamageViewDrawer } from './DamageViewDrawer';
import { PhotoFullscreenDialog } from './PhotoFullscreenDialog';

export type ProtocolType = 'reception' | 'pickup';

const PROTOCOL_TYPE_LABELS: Record<ProtocolType, string> = {
  reception: 'przyjęcia',
  pickup: 'odbioru',
};

interface Instance {
  id: string;
  name: string;
  logo_url: string | null;
  phone: string | null;
  email: string | null;
  address?: string | null;
}

interface Protocol {
  id: string;
  public_token: string;
  offer_number: string | null;
  customer_name: string;
  customer_email: string | null;
  vehicle_model: string | null;
  nip: string | null;
  phone: string | null;
  registration_number: string | null;
  fuel_level: number | null;
  odometer_reading: number | null;
  body_type: BodyType;
  protocol_date: string;
  protocol_time: string | null;
  received_by: string | null;
  status: string;
  customer_signature: string | null;
  protocol_type?: ProtocolType;
  photo_urls?: string[];
}

interface PublicProtocolCustomerViewProps {
  protocol: Protocol;
  instance: Instance;
  damagePoints: DamagePoint[];
  offerPublicToken?: string | null;
}

const DAMAGE_TYPE_LABELS: Record<string, string> = {
  scratch: 'Rysa',
  dent: 'Wgniecenie',
  damage: 'Uszkodzenie',
  chip: 'Odprysek',
  custom: 'Inne',
};

const VIEW_LABELS: Record<string, string> = {
  full: 'Diagram pojazdu',
};

export const PublicProtocolCustomerView = ({
  protocol,
  instance,
  damagePoints,
  offerPublicToken,
}: PublicProtocolCustomerViewProps) => {
  const [selectedPoint, setSelectedPoint] = useState<DamagePoint | null>(null);
  const [viewerOpen, setViewerOpen] = useState(false);
  
  // Photo fullscreen state
  const [fullscreenPhoto, setFullscreenPhoto] = useState<string | null>(null);
  const [photoDialogOpen, setPhotoDialogOpen] = useState(false);

  const handleSelectPoint = (point: DamagePoint) => {
    setSelectedPoint(point);
    setViewerOpen(true);
  };
  
  const handlePhotoClick = (url: string) => {
    setFullscreenPhoto(url);
    setPhotoDialogOpen(true);
  };

  // Check if there are any damage points
  const hasDamagePoints = damagePoints.length > 0;
  
  // Check if there are general protocol photos
  const hasProtocolPhotos = protocol.photo_urls && protocol.photo_urls.length > 0;
  
  // Collect all damage photos from damage points
  const allDamagePhotos = useMemo(() => {
    return damagePoints.flatMap(p => {
      return p.photo_urls || (p.photo_url ? [p.photo_url] : []);
    });
  }, [damagePoints]);

  // Generate notes from damage points
  const generatedNotes = useMemo(() => {
    if (damagePoints.length === 0) return null;
    const notesWithContent = damagePoints
      .filter(point => point.custom_note && point.custom_note.trim())
      .map(point => `• ${point.custom_note!.trim()}`);
    return notesWithContent.length > 0 ? notesWithContent.join('\n') : null;
  }, [damagePoints]);

  // Protocol type label
  const protocolTypeLabel = PROTOCOL_TYPE_LABELS[protocol.protocol_type || 'reception'];
  const protocolTitle = `Protokół ${protocolTypeLabel} pojazdu${protocol.vehicle_model ? ` ${protocol.vehicle_model}` : ''}`;

  return (
    <div className="min-h-screen bg-muted/30 flex flex-col">
      {/* Sticky header */}
      <div className="w-full max-w-3xl mx-auto bg-white">
        <ProtocolHeader 
          instance={instance} 
          protocolNumber={protocol.offer_number || undefined}
        />
      </div>

      {/* Scrollable content */}
      <main className="flex-1 overflow-y-auto pb-8">
        <div className="w-full max-w-3xl mx-auto px-4 py-6 space-y-6 bg-white min-h-full">
          {/* Protocol title */}
          <div className="space-y-1">
            <h1 className="text-xl font-semibold">{protocolTitle}</h1>
            {protocol.offer_number && (
              <p className="text-muted-foreground text-sm">
                Oferta{' '}
                {offerPublicToken ? (
                  <a 
                    href={`/offers/${offerPublicToken}`}
                    className="text-primary hover:underline"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {protocol.offer_number}
                  </a>
                ) : (
                  protocol.offer_number
                )}
              </p>
            )}
          </div>

          {/* Customer data */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label className="text-muted-foreground text-sm">Imię i nazwisko Klienta</Label>
              <p className="text-base font-medium">{protocol.customer_name}</p>
            </div>
            
            {protocol.phone && (
              <div className="space-y-1">
                <Label className="text-muted-foreground text-sm">Telefon</Label>
                <p className="text-base">{protocol.phone}</p>
              </div>
            )}
            
            {protocol.nip && (
              <div className="space-y-1">
                <Label className="text-muted-foreground text-sm">NIP firmy</Label>
                <p className="text-base">{protocol.nip}</p>
              </div>
            )}
          </div>

          {/* Vehicle data */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {protocol.vehicle_model && (
              <div className="space-y-1">
                <Label className="text-muted-foreground text-sm">Model samochodu</Label>
                <p className="text-base font-medium">{protocol.vehicle_model}</p>
              </div>
            )}
            
            {protocol.registration_number && (
              <div className="space-y-1">
                <Label className="text-muted-foreground text-sm">Numer rejestracyjny</Label>
                <p className="text-base font-medium">{protocol.registration_number}</p>
              </div>
            )}
            
            {protocol.fuel_level !== null && (
              <div className="space-y-1">
                <Label className="text-muted-foreground text-sm">Stan paliwa</Label>
                <p className="text-base">{protocol.fuel_level}%</p>
              </div>
            )}
            
            {protocol.odometer_reading !== null && (
              <div className="space-y-1">
                <Label className="text-muted-foreground text-sm">Stan licznika</Label>
                <p className="text-base">{protocol.odometer_reading.toLocaleString('pl-PL')} km</p>
              </div>
            )}
          </div>

          {/* General protocol photos */}
          {hasProtocolPhotos && (
            <div className="space-y-2">
              <Label className="text-muted-foreground text-sm">Zdjęcia pojazdu</Label>
              <div className="grid grid-cols-4 gap-2">
                {protocol.photo_urls!.map((url, index) => (
                  <div 
                    key={index} 
                    className="relative aspect-square cursor-pointer"
                    onClick={() => handlePhotoClick(url)}
                  >
                    <img
                      src={url}
                      alt={`Zdjęcie ${index + 1}`}
                      className="w-full h-full object-cover rounded-lg hover:opacity-90 transition-opacity"
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Vehicle diagram - show if there are damage points */}
          {hasDamagePoints && (
            <div className="space-y-2">
              <Label className="text-muted-foreground text-sm">Stan pojazdu</Label>
              <p className="text-xs text-muted-foreground">Kliknij na punkt, aby zapoznać się z uszkodzeniem</p>
              <VehicleDiagram
                bodyType={protocol.body_type}
                damagePoints={damagePoints}
                readOnly
                onSelectPoint={handleSelectPoint}
              />
            </div>
          )}

          {/* Damage photos - collected from all damage points */}
          {allDamagePhotos.length > 0 && (
            <div className="space-y-2">
              <Label className="text-muted-foreground text-sm">Zdjęcia usterek</Label>
              <div className="grid grid-cols-4 gap-2">
                {allDamagePhotos.map((url, index) => (
                  <div 
                    key={index} 
                    className="relative aspect-square cursor-pointer"
                    onClick={() => handlePhotoClick(url)}
                  >
                    <img
                      src={url}
                      alt={`Zdjęcie usterki ${index + 1}`}
                      className="w-full h-full object-cover rounded-lg hover:opacity-90 transition-opacity"
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Notes */}
          <div className="space-y-2">
            <Label className="text-muted-foreground text-sm">Uwagi</Label>
            <div className="whitespace-pre-line text-sm">
              {generatedNotes || '--- brak uwag ---'}
            </div>
          </div>

          {/* Protocol metadata */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label className="text-muted-foreground text-sm">Data sporządzenia protokołu</Label>
              <p className="text-base">
                {format(new Date(protocol.protocol_date), 'PPP', { locale: pl })}
                {protocol.protocol_time && `, ${protocol.protocol_time.slice(0, 5)}`}
              </p>
            </div>
            
            {protocol.received_by && (
              <div className="space-y-1">
                <Label className="text-muted-foreground text-sm">Przyjął</Label>
                <p className="text-base">{protocol.received_by}</p>
              </div>
            )}
          </div>

          {/* Customer signature */}
          {protocol.customer_signature && (
            <div className="space-y-2">
              <Label className="text-muted-foreground text-sm">Podpis Klienta</Label>
              <div className="h-24 border rounded-lg bg-white flex items-center justify-center">
                <img 
                  src={protocol.customer_signature} 
                  alt="Podpis klienta" 
                  className="max-h-20 max-w-full object-contain"
                />
              </div>
            </div>
          )}

          {/* Footer with company info */}
          <div className="pt-6 border-t text-center text-sm text-muted-foreground">
            <p className="font-medium">{instance.name}</p>
            {instance.address && <p>{instance.address}</p>}
            {instance.phone && <p>Tel: {instance.phone}</p>}
            {instance.email && <p>Email: {instance.email}</p>}
          </div>

          {/* App footer */}
          <div className="text-center text-xs text-muted-foreground pt-4">
            Protokół sporządzono przy użyciu aplikacji{' '}
            <a href="https://n2wash.com" target="_blank" rel="noopener noreferrer" className="underline hover:text-foreground transition-colors">
              n2wash.com
            </a>
          </div>
        </div>
      </main>

      {/* Damage view drawer for read-only - constrained width */}
      <DamageViewDrawer
        open={viewerOpen}
        onOpenChange={setViewerOpen}
        point={selectedPoint}
      />
      
      {/* Photo fullscreen dialog */}
      <PhotoFullscreenDialog
        open={photoDialogOpen}
        onOpenChange={setPhotoDialogOpen}
        photoUrl={fullscreenPhoto}
        allPhotos={[...(protocol.photo_urls || []), ...allDamagePhotos]}
        initialIndex={fullscreenPhoto ? [...(protocol.photo_urls || []), ...allDamagePhotos].indexOf(fullscreenPhoto) : 0}
      />
    </div>
  );
};
