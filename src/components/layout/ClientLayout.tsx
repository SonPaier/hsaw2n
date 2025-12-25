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

      {/* Minimalist Footer */}
      {!hideFooter && (
        <footer className="border-t border-border/50 mt-auto">
          <div className="container py-4">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
              {/* Logo & copyright */}
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Car className="w-4 h-4 text-primary" />
                <span>© {new Date().getFullYear()} ARM CAR AUTO SPA</span>
              </div>

              {/* Contact & Social */}
              <div className="flex items-center gap-4">
                <a 
                  href={`tel:${mockInstance.phone}`}
                  className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary transition-colors"
                >
                  <Phone className="w-3 h-3" />
                  {mockInstance.phone}
                </a>

                <div className="flex gap-2">
                  {mockInstance.socialLinks?.facebook && (
                    <a
                      href={mockInstance.socialLinks.facebook}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-7 h-7 rounded-md bg-secondary flex items-center justify-center hover:bg-primary hover:text-primary-foreground transition-colors"
                    >
                      <Facebook className="w-3.5 h-3.5" />
                    </a>
                  )}
                  {mockInstance.socialLinks?.instagram && (
                    <a
                      href={mockInstance.socialLinks.instagram}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-7 h-7 rounded-md bg-secondary flex items-center justify-center hover:bg-primary hover:text-primary-foreground transition-colors"
                    >
                      <Instagram className="w-3.5 h-3.5" />
                    </a>
                  )}
                </div>
              </div>
            </div>
          </div>
        </footer>
      )}
    </div>
  );
});

ClientLayout.displayName = 'ClientLayout';

export default ClientLayout;
