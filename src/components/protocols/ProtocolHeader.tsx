import { X, Phone, Mail } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Instance {
  id: string;
  name: string;
  logo_url: string | null;
  phone?: string | null;
  email?: string | null;
}

interface ProtocolHeaderProps {
  instance: Instance | null;
  protocolNumber?: string;
  onClose?: () => void;
}

export const ProtocolHeader = ({ instance, protocolNumber, onClose }: ProtocolHeaderProps) => {
  return (
    <header className="bg-white border-b sticky top-0 z-50">
      <div className="w-full px-4 py-4">
        <div className="flex items-center justify-between">
          {/* Left side: Logo + Company name */}
          <div className="flex items-center gap-3">
            {instance?.logo_url ? (
              <img 
                src={instance.logo_url} 
                alt={instance.name} 
                className="h-10 sm:h-12 object-contain" 
              />
            ) : (
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                <span className="text-primary font-bold text-lg">
                  {instance?.name?.charAt(0) || 'P'}
                </span>
              </div>
            )}
            <div>
              <h1 className="font-bold text-base sm:text-lg">{instance?.name || 'Protokół'}</h1>
              <p className="text-xs sm:text-sm text-muted-foreground">
                {protocolNumber 
                  ? `Protokół #${protocolNumber}` 
                  : 'Protokół przyjęcia pojazdu'}
              </p>
            </div>
          </div>

          {/* Right side: Contact info + Close button */}
          <div className="flex items-center gap-4">
            {/* Contact info - hidden on very small screens */}
            <div className="hidden sm:flex flex-col items-end text-sm text-muted-foreground">
              {instance?.phone && (
                <div className="flex items-center gap-1.5">
                  <Phone className="h-3.5 w-3.5" />
                  <span>{instance.phone}</span>
                </div>
              )}
              {instance?.email && (
                <div className="flex items-center gap-1.5">
                  <Mail className="h-3.5 w-3.5" />
                  <span>{instance.email}</span>
                </div>
              )}
            </div>

            {/* Close button */}
            {onClose && (
              <Button 
                variant="ghost" 
                size="icon"
                onClick={onClose}
                className="h-10 w-10"
              >
                <X className="h-5 w-5" />
              </Button>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
