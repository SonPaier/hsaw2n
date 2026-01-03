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
const ClientLayout = forwardRef<HTMLDivElement, ClientLayoutProps>(({
  children,
  hideHeader = false,
  hideFooter = false
}, ref) => {
  const [instance, setInstance] = useState<Instance | null>(null);
  useEffect(() => {
    const fetchInstance = async () => {
      // Get subdomain from hostname
      const hostname = window.location.hostname;
      let slug = 'armcar'; // default fallback

      if (hostname.endsWith('.n2wash.com')) {
        slug = hostname.replace('.n2wash.com', '');
      }
      const {
        data
      } = await supabase.from('instances').select('id, name, phone, logo_url').eq('slug', slug).single();
      if (data) {
        setInstance(data);
      }
    };
    fetchInstance();
  }, []);
  return <div ref={ref} className="min-h-screen flex flex-col bg-background">
      {/* Header */}
      {!hideHeader && <header className="sticky top-0 z-50 bg-background">
          <div className="container py-4">
            <div className="flex items-center justify-center">
              {instance?.logo_url ? <img src={instance.logo_url} alt={instance.name} className="w-12 h-12 rounded-xl object-contain" /> : <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary to-blue-500 flex items-center justify-center glow-primary">
                  <Car className="w-6 h-6 text-primary-foreground" />
                </div>}
            </div>
          </div>
        </header>}

      {/* Main Content */}
      <main className="flex-1">
        {children}
      </main>

      {/* Minimalist Footer */}
      {!hideFooter && <footer className="border-t border-border/50 mt-auto">
          <div className="container py-4">
            <p className="text-sm text-muted-foreground text-center">
              <a href="https://n2wash.com" target="_blank" rel="noopener noreferrer" className="hover:text-foreground transition-colors">N2Wash.com</a> - System rezerwacji online
            </p>
          </div>
        </footer>}
    </div>;
});
ClientLayout.displayName = 'ClientLayout';
export default ClientLayout;