import { ClipboardCheck } from 'lucide-react';

interface Instance {
  id: string;
  name: string;
  logo_url: string | null;
}

interface ProtocolHeaderProps {
  instance: Instance | null;
  protocolNumber?: string;
}

export const ProtocolHeader = ({ instance, protocolNumber }: ProtocolHeaderProps) => {
  return (
    <header className="bg-white border-b">
      <div className="max-w-4xl mx-auto px-4 py-6">
        <div className="flex items-center gap-4">
          {/* Logo po lewej */}
          {instance?.logo_url ? (
            <img 
              src={instance.logo_url} 
              alt={instance.name} 
              className="h-12 object-contain" 
            />
          ) : (
            <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
              <ClipboardCheck className="w-6 h-6 text-primary" />
            </div>
          )}
          {/* Nazwa firmy po prawej */}
          <div>
            <h1 className="font-bold text-lg">{instance?.name || 'Protokół'}</h1>
            <p className="text-sm text-muted-foreground">
              {protocolNumber 
                ? `Protokół przyjęcia pojazdu #${protocolNumber}` 
                : 'Protokół przyjęcia pojazdu'}
            </p>
          </div>
        </div>
      </div>
    </header>
  );
};
