import { useState, useEffect, useMemo } from 'react';
import { format } from 'date-fns';
import { Car } from 'lucide-react';

interface Station {
  id: string;
  name: string;
  type: string;
}

interface Reservation {
  id: string;
  vehicle_plate: string;
  reservation_date: string;
  start_time: string;
  end_time: string;
  station_id: string;
  status: string;
}

interface HallNextReservationsProps {
  stations: Station[];
  reservations: Reservation[];
}

const formatTimeRemaining = (minutes: number): string => {
  if (minutes <= 0) {
    return 'Teraz';
  }
  
  if (minutes < 60) {
    if (minutes === 1) return 'Za 1 minutę';
    if (minutes >= 2 && minutes <= 4) return `Za ${minutes} minuty`;
    return `Za ${minutes} minut`;
  }
  
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  
  let hoursText = '';
  if (hours === 1) {
    hoursText = 'Za godzinę';
  } else if (hours >= 2 && hours <= 4) {
    hoursText = `Za ${hours} godziny`;
  } else {
    hoursText = `Za ${hours} godzin`;
  }
  
  if (remainingMinutes === 0) {
    return hoursText;
  }
  
  // For "Za godzinę" we need to change to "Za godzinę i X minut"
  if (hours === 1) {
    if (remainingMinutes === 1) return `Za godzinę i 1 minutę`;
    if (remainingMinutes >= 2 && remainingMinutes <= 4) return `Za godzinę i ${remainingMinutes} minuty`;
    return `Za godzinę i ${remainingMinutes} minut`;
  }
  
  // For multiple hours
  if (remainingMinutes === 1) return `${hoursText} i 1 minutę`;
  if (remainingMinutes >= 2 && remainingMinutes <= 4) return `${hoursText} i ${remainingMinutes} minuty`;
  return `${hoursText} i ${remainingMinutes} minut`;
};

const HallNextReservations = ({ stations, reservations }: HallNextReservationsProps) => {
  const [now, setNow] = useState(new Date());

  // Refresh every minute
  useEffect(() => {
    const interval = setInterval(() => {
      setNow(new Date());
    }, 60000);

    return () => clearInterval(interval);
  }, []);

  const getNextReservation = useMemo(() => {
    const today = format(now, 'yyyy-MM-dd');
    const currentMinutes = now.getHours() * 60 + now.getMinutes();

    return (stationId: string) => {
      const stationReservations = reservations
        .filter(r => 
          r.station_id === stationId && 
          r.reservation_date === today &&
          r.status !== 'cancelled' &&
          r.status !== 'completed'
        )
        .map(r => {
          const [hours, minutes] = r.start_time.split(':').map(Number);
          const startMinutes = hours * 60 + minutes;
          return { ...r, startMinutes };
        })
        .filter(r => r.startMinutes > currentMinutes)
        .sort((a, b) => a.startMinutes - b.startMinutes);

      if (stationReservations.length === 0) return null;

      const next = stationReservations[0];
      const minutesRemaining = next.startMinutes - currentMinutes;

      return {
        vehicle: next.vehicle_plate,
        minutesRemaining,
        timeText: formatTimeRemaining(minutesRemaining)
      };
    };
  }, [reservations, now]);

  const washingStations = stations.filter(s => s.type === 'washing');

  if (washingStations.length === 0) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-background/95 backdrop-blur-sm border-t border-border px-4 py-3">
      <div className="flex justify-center gap-8">
        {washingStations.map(station => {
          const next = getNextReservation(station.id);
          
          return (
            <div key={station.id} className="text-center min-w-[200px]">
              <div className="text-xs text-muted-foreground mb-1 uppercase tracking-wide">
                {station.name}
              </div>
              {next ? (
                <div className="flex flex-col items-center gap-2">
                  <span className="text-lg font-medium text-foreground">
                    {next.timeText}
                  </span>
                  <div className="flex items-center gap-2">
                    <Car className="w-5 h-5 text-primary" />
                    <span className="font-bold text-primary text-lg">{next.vehicle}</span>
                  </div>
                </div>
              ) : (
                <div className="text-lg text-muted-foreground">
                  Brak kolejnych rezerwacji
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default HallNextReservations;
