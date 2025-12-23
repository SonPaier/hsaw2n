import { useState } from 'react';
import { Calendar, List, Clock, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';

interface Station {
  id: string;
  name: string;
  type: string;
}

interface Reservation {
  id: string;
  reservation_date: string;
  start_time: string;
  end_time: string;
  station_id: string | null;
  status: string;
}

interface MobileBottomNavProps {
  currentView: 'calendar' | 'reservations' | 'settings';
  onViewChange: (view: 'calendar' | 'reservations' | 'settings') => void;
  stations: Station[];
  reservations: Reservation[];
  currentDate: string;
}

// Working hours
const START_HOUR = 8;
const END_HOUR = 18;
const SLOT_DURATION = 30; // minutes

const generateTimeSlots = () => {
  const slots: string[] = [];
  for (let hour = START_HOUR; hour < END_HOUR; hour++) {
    slots.push(`${hour.toString().padStart(2, '0')}:00`);
    slots.push(`${hour.toString().padStart(2, '0')}:30`);
  }
  return slots;
};

const parseTimeToMinutes = (time: string): number => {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
};

const MobileBottomNav = ({
  currentView,
  onViewChange,
  stations,
  reservations,
  currentDate,
}: MobileBottomNavProps) => {
  const [freeSlotsOpen, setFreeSlotsOpen] = useState(false);

  const allSlots = generateTimeSlots();

  // Get free slots for a specific station
  const getFreeSlotsForStation = (stationId: string) => {
    const stationReservations = reservations.filter(
      r => r.reservation_date === currentDate && 
           r.station_id === stationId &&
           r.status !== 'cancelled'
    );

    return allSlots.filter(slot => {
      const slotStart = parseTimeToMinutes(slot);
      const slotEnd = slotStart + SLOT_DURATION;

      // Check if this slot overlaps with any reservation
      return !stationReservations.some(res => {
        const resStart = parseTimeToMinutes(res.start_time);
        const resEnd = parseTimeToMinutes(res.end_time);
        return slotStart < resEnd && slotEnd > resStart;
      });
    });
  };

  // Filter only washing stations (not PPF/detailing for quick view)
  const washingStations = stations.filter(s => s.type === 'washing' || s.type === 'universal');

  return (
    <>
      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 bg-card border-t border-border/50 lg:hidden">
        <div className="flex items-center justify-around py-2 px-4 safe-area-pb">
          <Button
            variant="ghost"
            size="sm"
            className={cn(
              "flex-col gap-1 h-auto py-2 px-4",
              currentView === 'calendar' && "text-primary"
            )}
            onClick={() => onViewChange('calendar')}
          >
            <Calendar className="w-5 h-5" />
            <span className="text-[10px]">Kalendarz</span>
          </Button>

          <Button
            variant="ghost"
            size="sm"
            className="flex-col gap-1 h-auto py-2 px-4"
            onClick={() => setFreeSlotsOpen(true)}
          >
            <Clock className="w-5 h-5" />
            <span className="text-[10px]">Wolne</span>
          </Button>

          <Button
            variant="ghost"
            size="sm"
            className={cn(
              "flex-col gap-1 h-auto py-2 px-4",
              currentView === 'reservations' && "text-primary"
            )}
            onClick={() => onViewChange('reservations')}
          >
            <List className="w-5 h-5" />
            <span className="text-[10px]">Lista</span>
          </Button>
        </div>
      </nav>

      {/* Free Slots Sheet */}
      <Sheet open={freeSlotsOpen} onOpenChange={setFreeSlotsOpen}>
        <SheetContent side="bottom" className="h-[70vh] rounded-t-2xl">
          <SheetHeader className="pb-4">
            <SheetTitle className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-primary" />
              Wolne sloty na dziś
            </SheetTitle>
          </SheetHeader>

          <div className="space-y-6 overflow-y-auto pb-8">
            {washingStations.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">
                Brak stanowisk do wyświetlenia
              </p>
            ) : (
              washingStations.map(station => {
                const freeSlots = getFreeSlotsForStation(station.id);
                
                return (
                  <div key={station.id} className="space-y-3">
                    <h3 className="font-semibold text-foreground flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-primary" />
                      {station.name}
                    </h3>
                    
                    {freeSlots.length === 0 ? (
                      <p className="text-sm text-muted-foreground pl-4">
                        Brak wolnych slotów
                      </p>
                    ) : (
                      <ul className="grid grid-cols-4 gap-2 pl-4">
                        {freeSlots.map(slot => (
                          <li
                            key={slot}
                            className="text-sm bg-success/10 text-success px-2 py-1 rounded-md text-center font-mono"
                          >
                            {slot}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                );
              })
            )}

            {/* Show all stations summary */}
            {stations.filter(s => s.type !== 'washing' && s.type !== 'universal').length > 0 && (
              <div className="pt-4 border-t border-border/50">
                <h3 className="font-semibold text-muted-foreground text-sm mb-3">
                  Inne stanowiska
                </h3>
                {stations
                  .filter(s => s.type !== 'washing' && s.type !== 'universal')
                  .map(station => {
                    const freeSlots = getFreeSlotsForStation(station.id);
                    return (
                      <div key={station.id} className="flex items-center justify-between py-2">
                        <span className="text-sm">{station.name}</span>
                        <span className="text-xs text-muted-foreground">
                          {freeSlots.length} wolnych
                        </span>
                      </div>
                    );
                  })}
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
};

export default MobileBottomNav;
