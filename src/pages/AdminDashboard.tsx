import { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet-async';
import { 
  Car, Calendar, LogOut, 
  Menu, Clock, CheckCircle2, Settings, Users
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { pl } from 'date-fns/locale';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import AdminCalendar from '@/components/admin/AdminCalendar';
import ReservationDetails from '@/components/admin/ReservationDetails';
import AddReservationDialog from '@/components/admin/AddReservationDialog';
import MobileBottomNav from '@/components/admin/MobileBottomNav';
import PriceListSettings from '@/components/admin/PriceListSettings';
import { toast } from 'sonner';

// Mock data for demo - will be replaced with real data
const mockStations = [
  { id: 'st1', name: 'Stanowisko 1', type: 'washing' },
  { id: 'st2', name: 'Stanowisko 2', type: 'washing' },
  { id: 'st3', name: 'Stanowisko 3', type: 'ppf' },
  { id: 'st4', name: 'Stanowisko 4', type: 'detailing' },
];

const mockReservations = [
  {
    id: 'res1',
    instance_id: 'mock-instance',
    customer_name: 'Jan Kowalski',
    customer_phone: '123 456 789',
    vehicle_plate: 'GD 12345',
    reservation_date: format(new Date(), 'yyyy-MM-dd'),
    start_time: '09:00',
    end_time: '10:30',
    station_id: 'st1',
    status: 'confirmed',
    confirmation_code: '123',
    service: { name: 'Mycie premium' },
    price: 120,
  },
  {
    id: 'res2',
    instance_id: 'mock-instance',
    customer_name: 'Anna Nowak',
    customer_phone: '987 654 321',
    vehicle_plate: 'GD 54321',
    reservation_date: format(new Date(), 'yyyy-MM-dd'),
    start_time: '10:00',
    end_time: '11:00',
    station_id: 'st2',
    status: 'confirmed',
    confirmation_code: '456',
    service: { name: 'Mycie podstawowe' },
    price: 50,
  },
  {
    id: 'res3',
    instance_id: 'mock-instance',
    customer_name: 'Piotr Wiśniewski',
    customer_phone: '555 666 777',
    vehicle_plate: 'GDA 9999',
    reservation_date: format(new Date(), 'yyyy-MM-dd'),
    start_time: '11:30',
    end_time: '15:30',
    station_id: 'st3',
    status: 'confirmed',
    confirmation_code: '789',
    service: { name: 'Folia PPF Full Front' },
    price: 5000,
  },
  {
    id: 'res4',
    instance_id: 'mock-instance',
    customer_name: 'Maria Dąbrowska',
    customer_phone: '111 222 333',
    vehicle_plate: 'GD 77777',
    reservation_date: format(new Date(), 'yyyy-MM-dd'),
    start_time: '14:00',
    end_time: '15:00',
    station_id: 'st1',
    status: 'confirmed',
    confirmation_code: '101',
    service: { name: 'Mycie detailingowe' },
    price: 350,
  },
];

type ViewType = 'calendar' | 'reservations' | 'settings';

const AdminDashboard = () => {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [currentView, setCurrentView] = useState<ViewType>('calendar');
  const [selectedReservation, setSelectedReservation] = useState<typeof mockReservations[0] | null>(null);
  const [reservations, setReservations] = useState(mockReservations);
  
  // Add reservation dialog state
  const [addReservationOpen, setAddReservationOpen] = useState(false);
  const [newReservationData, setNewReservationData] = useState({
    stationId: '',
    date: '',
    time: '',
  });

  // Get user's instance ID from user_roles
  const [instanceId, setInstanceId] = useState<string | null>(null);

  useEffect(() => {
    const fetchUserInstanceId = async () => {
      if (!user) return;
      
      const { data, error } = await supabase
        .from('user_roles')
        .select('instance_id')
        .eq('user_id', user.id)
        .maybeSingle();
      
      if (!error && data?.instance_id) {
        setInstanceId(data.instance_id);
      }
    };
    
    fetchUserInstanceId();
  }, [user]);

  // Calculate free time ranges (gaps) per station
  const getFreeRangesPerStation = () => {
    const now = new Date();
    const currentHour = now.getHours();
    const currentMinutes = now.getMinutes();
    const currentTimeMinutes = currentHour * 60 + currentMinutes;
    const today = format(now, 'yyyy-MM-dd');
    
    // Working hours 8:00 - 18:00
    const workStart = 8 * 60; // 8:00 in minutes
    const workEnd = 18 * 60;  // 18:00 in minutes
    
    return mockStations.map(station => {
      const stationReservations = reservations
        .filter(r => r.station_id === station.id && r.reservation_date === today)
        .map(r => ({
          start: parseInt(r.start_time.split(':')[0]) * 60 + parseInt(r.start_time.split(':')[1]),
          end: parseInt(r.end_time.split(':')[0]) * 60 + parseInt(r.end_time.split(':')[1]),
        }))
        .sort((a, b) => a.start - b.start);
      
      // Find gaps
      const gaps: { start: number; end: number }[] = [];
      let searchStart = Math.max(workStart, currentTimeMinutes);
      
      for (const res of stationReservations) {
        if (res.start > searchStart) {
          gaps.push({ start: searchStart, end: res.start });
        }
        searchStart = Math.max(searchStart, res.end);
      }
      
      // Add gap at the end if there's time left
      if (searchStart < workEnd) {
        gaps.push({ start: searchStart, end: workEnd });
      }
      
      // Format gaps as readable strings
      const freeRanges = gaps.map(gap => {
        const startHour = Math.floor(gap.start / 60);
        const startMin = gap.start % 60;
        const endHour = Math.floor(gap.end / 60);
        const endMin = gap.end % 60;
        const durationHours = (gap.end - gap.start) / 60;
        
        const startStr = `${startHour}:${startMin.toString().padStart(2, '0')}`;
        const endStr = `${endHour}:${endMin.toString().padStart(2, '0')}`;
        const durationStr = durationHours >= 1 
          ? `${Math.floor(durationHours)}h${durationHours % 1 > 0 ? ` ${Math.round((durationHours % 1) * 60)}min` : ''}`
          : `${Math.round(durationHours * 60)}min`;
        
        return {
          label: `${startStr} - ${endStr}`,
          duration: durationStr,
          durationMinutes: gap.end - gap.start,
        };
      });
      
      return {
        ...station,
        freeRanges,
      };
    });
  };

  const stationsWithRanges = getFreeRangesPerStation();

  const handleLogout = async () => {
    await signOut();
    navigate('/auth');
  };

  const handleReservationClick = (reservation: typeof mockReservations[0]) => {
    setSelectedReservation(reservation);
  };

  const handleDeleteReservation = async (
    reservationId: string, 
    customerData: { name: string; phone: string; email?: string; instance_id: string }
  ) => {
    try {
      // First, save the customer to customers table (upsert by phone)
      const { error: customerError } = await supabase
        .from('customers')
        .upsert(
          {
            instance_id: customerData.instance_id,
            name: customerData.name,
            phone: customerData.phone,
            email: customerData.email,
          },
          { 
            onConflict: 'instance_id,phone',
            ignoreDuplicates: false 
          }
        );
      
      if (customerError) {
        console.error('Error saving customer:', customerError);
        // Continue with deletion even if customer save fails
      }
      
      // Delete the reservation from database
      const { error: deleteError } = await supabase
        .from('reservations')
        .delete()
        .eq('id', reservationId);
      
      if (deleteError) {
        toast.error('Błąd podczas usuwania rezerwacji');
        console.error('Error deleting reservation:', deleteError);
        return;
      }
      
      // Remove from local state
      setReservations(prev => prev.filter(r => r.id !== reservationId));
      setSelectedReservation(null);
      toast.success('Rezerwacja została anulowana, dane klienta zachowane');
    } catch (error) {
      console.error('Error in delete operation:', error);
      toast.error('Wystąpił błąd');
    }
  };

  const handleReservationSave = (reservationId: string, data: Partial<typeof mockReservations[0]>) => {
    setReservations(prev => 
      prev.map(r => r.id === reservationId ? { ...r, ...data } : r)
    );
    setSelectedReservation(null);
    toast.success('Rezerwacja została zaktualizowana');
  };

  const handleAddReservation = (stationId: string, date: string, time: string) => {
    setNewReservationData({ stationId, date, time });
    setAddReservationOpen(true);
  };

  const handleReservationAdded = () => {
    // For now, just close the dialog
    // In the future, this will refresh the reservations from the database
    toast.info('Rezerwacja dodana - odśwież aby zobaczyć');
  };

  const handleReservationMove = (reservationId: string, newStationId: string, newTime?: string) => {
    setReservations(prev => 
      prev.map(r => {
        if (r.id === reservationId) {
          const updated = { ...r, station_id: newStationId };
          if (newTime) {
            // Calculate new end time based on duration
            const [startHours, startMinutes] = newTime.split(':').map(Number);
            const [endHours, endMinutes] = r.end_time.split(':').map(Number);
            const [origStartHours, origStartMinutes] = r.start_time.split(':').map(Number);
            
            const durationMinutes = (endHours * 60 + endMinutes) - (origStartHours * 60 + origStartMinutes);
            const newEndTotalMinutes = startHours * 60 + startMinutes + durationMinutes;
            const newEndHours = Math.floor(newEndTotalMinutes / 60);
            const newEndMins = newEndTotalMinutes % 60;
            
            updated.start_time = newTime;
            updated.end_time = `${newEndHours.toString().padStart(2, '0')}:${newEndMins.toString().padStart(2, '0')}`;
          }
          return updated;
        }
        return r;
      })
    );
    const station = mockStations.find(s => s.id === newStationId);
    toast.success(`Rezerwacja przeniesiona na ${station?.name || 'nowe stanowisko'}`);
  };

  return (
    <>
      <Helmet>
        <title>Panel Admina - ARM CAR AUTO SPA</title>
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>

      <div className="min-h-screen bg-background flex">
        {/* Sidebar - Mobile Overlay */}
        {sidebarOpen && (
          <div 
            className="fixed inset-0 bg-background/80 backdrop-blur-sm z-40 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Sidebar */}
        <aside className={cn(
          "fixed lg:static inset-y-0 left-0 z-50 w-64 bg-card border-r border-border/50 transition-transform duration-300",
          sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        )}>
          <div className="flex flex-col h-full">
            {/* Logo */}
            <div className="p-6 border-b border-border/50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-blue-500 flex items-center justify-center">
                  <Car className="w-5 h-5 text-primary-foreground" />
                </div>
                <div>
                  <h1 className="font-bold text-foreground">ARM CAR</h1>
                  <p className="text-xs text-muted-foreground">Panel Admina</p>
                </div>
              </div>
            </div>

            {/* Navigation */}
            <nav className="flex-1 p-4 space-y-2">
              <Button 
                variant={currentView === 'calendar' ? 'secondary' : 'ghost'} 
                className="w-full justify-start gap-3"
                onClick={() => setCurrentView('calendar')}
              >
                <Calendar className="w-4 h-4" />
                Kalendarz
              </Button>
              <Button 
                variant={currentView === 'reservations' ? 'secondary' : 'ghost'} 
                className="w-full justify-start gap-3"
                onClick={() => setCurrentView('reservations')}
              >
                <Users className="w-4 h-4" />
                Rezerwacje
              </Button>
              <Button 
                variant={currentView === 'settings' ? 'secondary' : 'ghost'} 
                className="w-full justify-start gap-3"
                onClick={() => setCurrentView('settings')}
              >
                <Settings className="w-4 h-4" />
                Ustawienia
              </Button>
            </nav>

            {/* User Info & Logout */}
            <div className="p-4 border-t border-border/50 space-y-2">
              {user && (
                <div className="px-3 py-2 text-sm text-muted-foreground truncate">
                  {user.email}
                </div>
              )}
              <Button 
                variant="ghost" 
                className="w-full justify-start gap-3 text-muted-foreground"
                onClick={handleLogout}
              >
                <LogOut className="w-4 h-4" />
                Wyloguj się
              </Button>
            </div>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 flex flex-col min-w-0">
          {/* Mobile Header */}
          <header className="lg:hidden sticky top-0 z-30 glass-card border-b border-border/50 p-4">
            <div className="flex items-center justify-between">
              <Button variant="ghost" size="icon" onClick={() => setSidebarOpen(true)}>
                <Menu className="w-5 h-5" />
              </Button>
              <div className="flex items-center gap-2">
                <Car className="w-5 h-5 text-primary" />
                <span className="font-bold">ARM CAR</span>
              </div>
              <Button variant="ghost" size="icon" onClick={handleLogout}>
                <LogOut className="w-5 h-5" />
              </Button>
            </div>
          </header>

          {/* Content */}
          <div className="flex-1 p-4 lg:p-8 space-y-6 overflow-auto pb-20 lg:pb-8">
            {/* Header */}
            <div>
              <h1 className="text-2xl font-bold text-foreground">
                {currentView === 'calendar' ? 'Kalendarz rezerwacji' : 
                 currentView === 'reservations' ? 'Lista rezerwacji' : 'Ustawienia'}
              </h1>
              <p className="text-muted-foreground">
                {format(new Date(), 'd MMMM yyyy', { locale: pl })}
              </p>
            </div>

            {/* Free Time Ranges Per Station */}
            <div className="glass-card p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm font-medium">Wolne terminy na dziś</span>
                </div>
                <span className="text-xs text-muted-foreground">{format(new Date(), 'HH:mm')}</span>
              </div>
              <div className="space-y-3">
                {stationsWithRanges.map(station => (
                  <div key={station.id} className="bg-secondary/30 rounded-lg p-3">
                    <div className="text-sm font-medium mb-2">{station.name}</div>
                    {station.freeRanges.length > 0 ? (
                      <div className="flex flex-wrap gap-2">
                        {station.freeRanges.map((range, idx) => (
                          <span 
                            key={idx} 
                            className="text-xs bg-success/20 text-success px-2 py-1 rounded"
                          >
                            {range.label} <span className="opacity-70">({range.duration})</span>
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground">Brak wolnych terminów</span>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* View Content */}
            {currentView === 'calendar' && (
              <div className="flex-1 min-h-[600px]">
                <AdminCalendar 
                  stations={mockStations}
                  reservations={reservations}
                  onReservationClick={handleReservationClick}
                  onAddReservation={handleAddReservation}
                  onReservationMove={handleReservationMove}
                />
              </div>
            )}

            {currentView === 'reservations' && (
              <div className="space-y-4">
                <div className="glass-card overflow-hidden">
                  <div className="divide-y divide-border/50">
                    {reservations.map((reservation) => (
                      <div 
                        key={reservation.id}
                        className="p-4 flex items-center justify-between gap-4 hover:bg-secondary/30 transition-colors cursor-pointer"
                        onClick={() => handleReservationClick(reservation)}
                      >
                        <div className="flex items-center gap-4 min-w-0">
                          <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0 bg-success/10 text-success">
                            <CheckCircle2 className="w-5 h-5" />
                          </div>
                          <div className="min-w-0">
                            <div className="font-medium text-foreground truncate">
                              {reservation.customer_name}
                            </div>
                            <div className="text-sm text-muted-foreground truncate">
                              {reservation.service?.name} • {reservation.vehicle_plate}
                            </div>
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <div className="font-medium text-foreground">
                            {reservation.start_time}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {format(new Date(reservation.reservation_date), 'd MMM', { locale: pl })}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {currentView === 'settings' && (
              <div className="glass-card p-6 space-y-6">
                <div>
                  <h2 className="text-lg font-semibold mb-2">Ustawienia instancji</h2>
                  <p className="text-muted-foreground text-sm">
                    Zarządzaj cennikiem, stanowiskami i godzinami pracy.
                  </p>
                </div>
                
                <PriceListSettings instanceId={instanceId} />
              </div>
            )}
          </div>
        </main>
      </div>

      {/* Reservation Details Modal */}
      <ReservationDetails
        reservation={selectedReservation}
        open={!!selectedReservation}
        onClose={() => setSelectedReservation(null)}
        onDelete={handleDeleteReservation}
        onSave={handleReservationSave}
      />

      {/* Add Reservation Dialog */}
      {instanceId && (
        <AddReservationDialog
          open={addReservationOpen}
          onClose={() => setAddReservationOpen(false)}
          stationId={newReservationData.stationId}
          date={newReservationData.date}
          time={newReservationData.time}
          instanceId={instanceId}
          onSuccess={handleReservationAdded}
        />
      )}

      {/* Mobile Bottom Navigation */}
      <MobileBottomNav
        currentView={currentView}
        onViewChange={setCurrentView}
        stations={mockStations}
        reservations={reservations}
        currentDate={format(new Date(), 'yyyy-MM-dd')}
      />
    </>
  );
};

export default AdminDashboard;
