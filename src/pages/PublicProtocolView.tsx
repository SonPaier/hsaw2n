import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Helmet } from 'react-helmet-async';
import { Loader2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { PublicProtocolCustomerView } from '@/components/protocols/PublicProtocolCustomerView';
import type { VehicleView, BodyType, DamagePoint } from '@/components/protocols/VehicleDiagram';

interface Instance {
  id: string;
  name: string;
  logo_url: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
}

type ProtocolType = 'reception' | 'pickup';

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
  instance_id: string;
  protocol_type?: ProtocolType;
  photo_urls?: string[];
}

export default function PublicProtocolView() {
  const { token } = useParams<{ token: string }>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [protocol, setProtocol] = useState<Protocol | null>(null);
  const [instance, setInstance] = useState<Instance | null>(null);
  const [damagePoints, setDamagePoints] = useState<DamagePoint[]>([]);
  const [offerPublicToken, setOfferPublicToken] = useState<string | null>(null);

  useEffect(() => {
    const fetchProtocol = async () => {
      if (!token) {
        setError('Brak tokena protokołu');
        setLoading(false);
        return;
      }

      try {
        // Fetch protocol by public token
        const { data: protocolData, error: protocolError } = await supabase
          .from('vehicle_protocols')
          .select('*')
          .eq('public_token', token)
          .single();

        if (protocolError) {
          if (protocolError.code === 'PGRST116') {
            setError('Protokół nie został znaleziony');
          } else {
            throw protocolError;
          }
          setLoading(false);
          return;
        }

        setProtocol(protocolData as Protocol);

        // Fetch instance data
        const { data: instanceData, error: instanceError } = await supabase
          .from('instances')
          .select('id, name, logo_url, phone, email, address')
          .eq('id', protocolData.instance_id)
          .single();

        if (instanceError) throw instanceError;
        setInstance(instanceData);

        // Fetch damage points
        const { data: pointsData, error: pointsError } = await supabase
          .from('protocol_damage_points')
          .select('*')
          .eq('protocol_id', protocolData.id);

        if (pointsError) throw pointsError;

        if (pointsData) {
          setDamagePoints(pointsData.map(p => ({
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

        // Fetch offer public_token if offer_number exists
        if (protocolData.offer_number) {
          const { data: offerData } = await supabase
            .from('offers')
            .select('public_token')
            .eq('instance_id', protocolData.instance_id)
            .eq('offer_number', protocolData.offer_number)
            .single();

          if (offerData) {
            setOfferPublicToken(offerData.public_token);
          }
        }
      } catch (err) {
        console.error('Error fetching protocol:', err);
        setError('Wystąpił błąd podczas ładowania protokołu');
      } finally {
        setLoading(false);
      }
    };

    fetchProtocol();
  }, [token]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !protocol || !instance) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center">
            <h1 className="text-xl font-semibold mb-2">
              {error || 'Protokół nie został znaleziony'}
            </h1>
            <p className="text-muted-foreground">
              Sprawdź poprawność linku lub skontaktuj się z serwisem.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <>
      <Helmet>
        <title>Protokół przyjęcia pojazdu | {instance.name}</title>
        <meta name="description" content={`Protokół przyjęcia pojazdu ${protocol.vehicle_model || ''} ${protocol.registration_number || ''}`} />
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>
      
      <PublicProtocolCustomerView
        protocol={protocol}
        instance={instance}
        damagePoints={damagePoints}
        offerPublicToken={offerPublicToken}
      />
    </>
  );
}
