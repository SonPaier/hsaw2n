import { ReactNode, forwardRef } from 'react';
import { Car, Phone, MapPin, Facebook, Instagram } from 'lucide-react';
import { mockInstance } from '@/data/mockData';

interface ClientLayoutProps {
  children: ReactNode;
  hideHeader?: boolean;
  hideFooter?: boolean;
}

const ClientLayout = forwardRef<HTMLDivElement, ClientLayoutProps>(({ children, hideHeader = false, hideFooter = false }, ref) => {
  return (
    <div ref={ref} className="min-h-screen flex flex-col bg-background">
      {/* Header */}
      {!hideHeader && (
        <header className="sticky top-0 z-50 glass-card border-b border-border/50">
          <div className="container py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-blue-500 flex items-center justify-center glow-primary">
                  <Car className="w-5 h-5 text-primary-foreground" />
                </div>
                <div>
                  <h1 className="text-lg font-bold text-foreground leading-tight">
                    ARM CAR
                  </h1>
                  <p className="text-xs text-muted-foreground">AUTO SPA</p>
                </div>
              </div>
              <a 
                href={`tel:${mockInstance.phone}`}
                className="flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors"
              >
                <Phone className="w-4 h-4" />
                <span className="hidden sm:inline">{mockInstance.phone}</span>
              </a>
            </div>
          </div>
        </header>
      )}

      {/* Main Content */}
      <main className="flex-1">
        {children}
      </main>

      {/* Footer */}
      {!hideFooter && (
        <footer className="glass-card border-t border-border/50 mt-auto">
          <div className="container py-8">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {/* Logo & Description */}
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-blue-500 flex items-center justify-center">
                    <Car className="w-5 h-5 text-primary-foreground" />
                  </div>
                  <div>
                    <h2 className="font-bold text-foreground">ARM CAR AUTO SPA</h2>
                    <p className="text-xs text-muted-foreground">GDAŃSK</p>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground">
                  Profesjonalna myjnia samochodowa i studio oklejania folią.
                </p>
              </div>

              {/* Contact */}
              <div className="space-y-4">
                <h3 className="font-semibold text-foreground">Kontakt</h3>
                <div className="space-y-2">
                  <a 
                    href={`tel:${mockInstance.phone}`}
                    className="flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors"
                  >
                    <Phone className="w-4 h-4" />
                    {mockInstance.phone}
                  </a>
                  <div className="flex items-start gap-2 text-sm text-muted-foreground">
                    <MapPin className="w-4 h-4 mt-0.5 shrink-0" />
                    <span>{mockInstance.address}</span>
                  </div>
                </div>
              </div>

              {/* Social Media */}
              <div className="space-y-4">
                <h3 className="font-semibold text-foreground">Social Media</h3>
                <div className="flex gap-3">
                  {mockInstance.socialLinks?.facebook && (
                    <a
                      href={mockInstance.socialLinks.facebook}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-10 h-10 rounded-lg bg-secondary flex items-center justify-center hover:bg-primary hover:text-primary-foreground transition-colors"
                    >
                      <Facebook className="w-5 h-5" />
                    </a>
                  )}
                  {mockInstance.socialLinks?.instagram && (
                    <a
                      href={mockInstance.socialLinks.instagram}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-10 h-10 rounded-lg bg-secondary flex items-center justify-center hover:bg-primary hover:text-primary-foreground transition-colors"
                    >
                      <Instagram className="w-5 h-5" />
                    </a>
                  )}
                </div>
              </div>
            </div>

            <div className="mt-8 pt-6 border-t border-border/50 text-center">
              <p className="text-xs text-muted-foreground">
                © {new Date().getFullYear()} ARM CAR AUTO SPA. Wszystkie prawa zastrzeżone.
              </p>
            </div>
          </div>
        </footer>
      )}
    </div>
  );
});

ClientLayout.displayName = 'ClientLayout';

export default ClientLayout;
