import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '@/components/ui/drawer';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Loader2, Send } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';

type ProtocolType = 'reception' | 'pickup';

const PROTOCOL_TYPE_LABELS: Record<ProtocolType, string> = {
  reception: 'przyjęcia',
  pickup: 'odbioru',
};

interface SendProtocolEmailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  protocolId: string;
  customerName: string;
  customerEmail?: string;
  vehicleInfo?: string;
  protocolType?: ProtocolType;
  instanceId?: string;
}

const getDefaultMessage = (customerName: string, vehicleInfo: string | undefined, protocolType: ProtocolType, template?: string | null) => {
  if (template) {
    const typeLabel = PROTOCOL_TYPE_LABELS[protocolType];
    return template
      .replace(/{imie}/g, customerName)
      .replace(/{pojazd}/g, vehicleInfo || '')
      .replace(/{typ_protokolu}/g, typeLabel);
  }
  const typeLabel = PROTOCOL_TYPE_LABELS[protocolType];
  return `Dzień dobry ${customerName},\n\nPrzesyłamy protokół ${typeLabel} pojazdu${vehicleInfo ? ` ${vehicleInfo}` : ''}.\n\nProsimy o zapoznanie się z dokumentem.\n\n[Link do protokołu zostanie automatycznie dołączony]`;
};

const getDefaultSubject = (vehicleInfo: string | undefined, protocolType: ProtocolType) => {
  const typeLabel = PROTOCOL_TYPE_LABELS[protocolType];
  return `Protokół ${typeLabel} pojazdu${vehicleInfo ? ` - ${vehicleInfo}` : ''}`;
};

export const SendProtocolEmailDialog = ({
  open,
  onOpenChange,
  protocolId,
  customerName,
  customerEmail,
  vehicleInfo,
  protocolType = 'reception',
  instanceId,
}: SendProtocolEmailDialogProps) => {
  const [email, setEmail] = useState('');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [emailTemplate, setEmailTemplate] = useState<string | null>(null);

  // Reset form when dialog opens or props change
  useEffect(() => {
    if (open) {
      setEmail(customerEmail || '');
      setSubject(getDefaultSubject(vehicleInfo, protocolType));
      
      // Fetch email template if instanceId is provided
      if (instanceId) {
        supabase
          .from('instances')
          .select('protocol_email_template')
          .eq('id', instanceId)
          .single()
          .then(({ data }) => {
            const template = data?.protocol_email_template || null;
            setEmailTemplate(template);
            setMessage(getDefaultMessage(customerName, vehicleInfo, protocolType, template));
          });
      } else {
        setMessage(getDefaultMessage(customerName, vehicleInfo, protocolType));
      }
    }
  }, [open, customerEmail, customerName, vehicleInfo, protocolType, instanceId]);

  const isValidEmail = (email: string) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  };

  const handleSend = async () => {
    if (!email || !isValidEmail(email)) {
      toast.error('Podaj poprawny adres email');
      return;
    }

    setSending(true);
    try {
      const { data, error } = await supabase.functions.invoke('send-protocol-email', {
        body: {
          protocolId,
          recipientEmail: email,
          subject,
          message,
        },
      });

      if (error) throw error;

      toast.success('Email został wysłany');
      onOpenChange(false);
    } catch (error) {
      console.error('Error sending email:', error);
      toast.error('Nie udało się wysłać emaila');
    } finally {
      setSending(false);
    }
  };

  const isMobile = useIsMobile();

  const formContent = (
    <div className="flex-1 space-y-4 overflow-y-auto py-4 px-4 sm:px-0">
      <div className="space-y-2">
        <Label htmlFor="email">Adres email odbiorcy</Label>
        <Input
          id="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="klient@email.com"
          className={!isValidEmail(email) && email ? 'border-destructive' : ''}
        />
        {!isValidEmail(email) && email && (
          <p className="text-xs text-destructive">Nieprawidłowy format adresu email</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="subject">Temat</Label>
        <Input
          id="subject"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
        />
      </div>

      <div className="space-y-2 flex-1 flex flex-col">
        <Label htmlFor="message">Treść wiadomości</Label>
        <Textarea
          id="message"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={16}
          className="resize-none flex-1"
        />
      </div>
    </div>
  );

  const footerContent = (
    <div className="flex gap-2 w-full">
      <Button variant="outline" onClick={() => onOpenChange(false)} className="flex-1 bg-white">
        Anuluj
      </Button>
      <Button onClick={handleSend} disabled={sending || !email} className="flex-1">
        {sending ? (
          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
        ) : (
          <Send className="h-4 w-4 mr-2" />
        )}
        Wyślij
      </Button>
    </div>
  );

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent className="h-[100dvh] flex flex-col">
          <DrawerHeader className="border-b">
            <DrawerTitle>Wyślij protokół emailem</DrawerTitle>
          </DrawerHeader>
          {formContent}
          <div className="border-t p-4 mt-auto">
            {footerContent}
          </div>
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Wyślij protokół emailem</DialogTitle>
        </DialogHeader>
        {formContent}
        <div className="border-t pt-4">
          {footerContent}
        </div>
      </DialogContent>
    </Dialog>
  );
};
