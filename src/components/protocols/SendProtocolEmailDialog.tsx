import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Loader2, Send } from 'lucide-react';

interface SendProtocolEmailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  protocolId: string;
  customerName: string;
  customerEmail?: string;
  vehicleInfo?: string;
}

export const SendProtocolEmailDialog = ({
  open,
  onOpenChange,
  protocolId,
  customerName,
  customerEmail,
  vehicleInfo,
}: SendProtocolEmailDialogProps) => {
  const [email, setEmail] = useState(customerEmail || '');
  const [subject, setSubject] = useState(`Protokół przyjęcia pojazdu${vehicleInfo ? ` - ${vehicleInfo}` : ''}`);
  const [message, setMessage] = useState(
    `Dzień dobry ${customerName},\n\nW załączeniu przesyłamy protokół przyjęcia pojazdu${vehicleInfo ? ` ${vehicleInfo}` : ''}.\n\nProsimy o zapoznanie się z dokumentem.\n\nPozdrawiamy`
  );
  const [sending, setSending] = useState(false);

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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Wyślij protokół emailem</DialogTitle>
        </DialogHeader>

        <div className="flex-1 space-y-4 overflow-y-auto py-4">
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

          <div className="space-y-2">
            <Label htmlFor="message">Treść wiadomości</Label>
            <Textarea
              id="message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={8}
              className="resize-none"
            />
          </div>
        </div>

        <DialogFooter className="border-t pt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Anuluj
          </Button>
          <Button onClick={handleSend} disabled={sending || !email}>
            {sending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Send className="h-4 w-4 mr-2" />
            )}
            Wyślij
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
