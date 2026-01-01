import { ReactNode, forwardRef, useEffect, useState } from 'react';
import { Car, Phone } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface Instance {
  id: string;
  name: string;
  phone: string | null;
  logo_url: string | null;
}

interface ClientLayoutProps {
  children: ReactNode;
  hideHeader?: boolean;
  hideFooter?: boolean;
}

const ClientLayout = forwardRef<HTMLDivElement, ClientLayoutProps>(({ children, hideHeader = false, hideFooter = false }, ref) => {
  const [instance, setInstance] = useState<Instance | null>(null);

  useEffect(() => {
    const fetchInstance = async () => {
      // Get subdomain from hostname
      const hostname = window.location.hostname;
      let slug = 'armcar'; // default fallback
      
      if (hostname.endsWith('.n2wash.com')) {
        slug = hostname.replace('.n2wash.com', '');
      }
      
      const { data } = await supabase
        .from('instances')
        .select('id, name, phone, logo_url')
        .eq('slug', slug)
        .single();
      if (data) {
        setInstance(data);
      }
    };
    fetchInstance();
  }, []);

  return (
    <div ref={ref} className="min-h-screen flex flex-col bg-background">
      {/* Header */}
      {!hideHeader && (
        <header className="sticky top-0 z-50 bg-background">
          <div className="container py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {instance?.logo_url ? (
                  <img 
                    src={instance.logo_url} 
                    alt={instance.name} 
                    className="w-10 h-10 rounded-xl object-contain"
                  />
                ) : (
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-blue-500 flex items-center justify-center glow-primary">
                    <Car className="w-5 h-5 text-primary-foreground" />
                  </div>
                )}
                <div>
                  <h1 className="text-lg font-bold text-foreground leading-tight">
                    {instance?.name?.split(' ').slice(0, 2).join(' ') || 'ARM CAR'}
                  </h1>
                  <p className="text-xs text-muted-foreground">
                    {instance?.name?.split(' ').slice(2).join(' ') || 'AUTO SPA'}
                  </p>
                </div>
              </div>
              {instance?.phone && (
                <a 
                  href={`tel:${instance.phone}`}
                  className="flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors"
                >
                  <Phone className="w-4 h-4" />
                  <span className="hidden sm:inline">{instance.phone}</span>
                </a>
              )}
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
            <p className="text-sm text-muted-foreground text-center">
              © {new Date().getFullYear()} ARM CAR AUTO SPA
            </p>
          </div>
        </footer>
      )}
    </div>
  );
});

ClientLayout.displayName = 'ClientLayout';

export default ClientLayout;
