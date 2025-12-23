import { useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { 
  Car, Calendar, Users, TrendingUp, LogOut, 
  Menu, X, Clock, CheckCircle2, AlertCircle, Settings
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { mockReservations } from '@/data/mockData';
import { cn } from '@/lib/utils';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { pl } from 'date-fns/locale';

const stats = [
  { label: 'Dzisiejsze rezerwacje', value: '8', icon: <Calendar className="w-5 h-5" />, trend: '+2' },
  { label: 'Oczekujące', value: '3', icon: <Clock className="w-5 h-5" />, color: 'text-warning' },
  { label: 'Potwierdzone', value: '5', icon: <CheckCircle2 className="w-5 h-5" />, color: 'text-success' },
  { label: 'Ten tydzień', value: '34', icon: <TrendingUp className="w-5 h-5" /> },
];

const AdminDashboard = () => {
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleLogout = () => {
    navigate('/admin/login');
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
              <Button variant="secondary" className="w-full justify-start gap-3">
                <Calendar className="w-4 h-4" />
                Kalendarz
              </Button>
              <Button variant="ghost" className="w-full justify-start gap-3">
                <Users className="w-4 h-4" />
                Rezerwacje
              </Button>
              <Button variant="ghost" className="w-full justify-start gap-3">
                <Settings className="w-4 h-4" />
                Ustawienia
              </Button>
            </nav>

            {/* Logout */}
            <div className="p-4 border-t border-border/50">
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
          <div className="flex-1 p-4 lg:p-8 space-y-8">
            {/* Header */}
            <div>
              <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
              <p className="text-muted-foreground">
                {format(new Date(), 'd MMMM yyyy', { locale: pl })}
              </p>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {stats.map((stat, index) => (
                <div key={index} className="glass-card p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className={cn("text-muted-foreground", stat.color)}>
                      {stat.icon}
                    </div>
                    {stat.trend && (
                      <span className="text-xs text-success font-medium bg-success/10 px-2 py-0.5 rounded-full">
                        {stat.trend}
                      </span>
                    )}
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-foreground">{stat.value}</div>
                    <div className="text-xs text-muted-foreground">{stat.label}</div>
                  </div>
                </div>
              ))}
            </div>

            {/* Recent Reservations */}
            <div className="space-y-4">
              <h2 className="text-lg font-semibold text-foreground">Ostatnie rezerwacje</h2>
              <div className="glass-card overflow-hidden">
                <div className="divide-y divide-border/50">
                  {mockReservations.map((reservation) => (
                    <div 
                      key={reservation.id}
                      className="p-4 flex items-center justify-between gap-4 hover:bg-secondary/30 transition-colors"
                    >
                      <div className="flex items-center gap-4 min-w-0">
                        <div className={cn(
                          "w-10 h-10 rounded-lg flex items-center justify-center shrink-0",
                          reservation.status === 'confirmed' 
                            ? "bg-success/10 text-success" 
                            : "bg-warning/10 text-warning"
                        )}>
                          {reservation.status === 'confirmed' 
                            ? <CheckCircle2 className="w-5 h-5" /> 
                            : <AlertCircle className="w-5 h-5" />
                          }
                        </div>
                        <div className="min-w-0">
                          <div className="font-medium text-foreground truncate">
                            {reservation.customerName}
                          </div>
                          <div className="text-sm text-muted-foreground truncate">
                            {reservation.serviceName} • {reservation.vehiclePlate}
                          </div>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="font-medium text-foreground">
                          {reservation.time}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {format(new Date(reservation.date), 'd MMM', { locale: pl })}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
    </>
  );
};

export default AdminDashboard;
