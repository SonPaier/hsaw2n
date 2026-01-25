import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Send, Loader2, Mail } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';

import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface OfferData {
  id: string;
  offer_number: string;
  public_token: string;
  customer_data: {
    name?: string;
    email?: string;
  };
}

interface InstanceData {
  name?: string;
  email?: string;
  phone?: string;
  address?: string;
  website?: string;
  contact_person?: string;
  slug?: string;
  offer_email_template?: string;
}

interface SendOfferEmailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  offer: OfferData;
  instanceData: InstanceData | null;
  onSent: () => void;
}

const defaultEmailTemplate = `Dzień dobry,

przygotowaliśmy dla Państwa indywidualną ofertę usług Car Detailingu & Wrappingu, dopasowaną do wcześniejszych ustaleń.

Aby zapoznać się ze szczegółami, prosimy kliknąć poniższy link z ofertą:
{{offerUrl}}

W razie pytań chętnie doradzimy i dopasujemy ofertę do Państwa oczekiwań.

Pozdrawiamy serdecznie,
{{instanceName}}
{{contactPerson}}

📞 {{phone}}
📍 {{address}}
🌐 {{website}}`;

export function SendOfferEmailDialog({ 
  open, 
  onOpenChange, 
  offer, 
  instanceData,
  onSent 
}: SendOfferEmailDialogProps) {
  const { t } = useTranslation();
  const [sending, setSending] = useState(false);
  const [emailBody, setEmailBody] = useState('');

  const customerEmail = offer.customer_data?.email || '';

  // Generate offer URL
  const getOfferUrl = () => {
    const hostname = window.location.hostname;
    if (hostname.endsWith('.admin.n2wash.com')) {
      const instanceSlug = hostname.replace('.admin.n2wash.com', '');
      return `https://${instanceSlug}.n2wash.com/offers/${offer.public_token}`;
    } else if (hostname.endsWith('.n2wash.com')) {
      return `${window.location.origin}/offers/${offer.public_token}`;
    }
    return `${window.location.origin}/offers/${offer.public_token}`;
  };

  // Populate template when dialog opens
  useEffect(() => {
    if (open && instanceData) {
      const template = instanceData.offer_email_template || defaultEmailTemplate;
      const offerUrl = getOfferUrl();
      
      let body = template
        .replace(/\{\{offerUrl\}\}/g, offerUrl)
        .replace(/\{\{instanceName\}\}/g, instanceData.name || '')
        .replace(/\{\{contactPerson\}\}/g, instanceData.contact_person || '')
        .replace(/\{\{phone\}\}/g, instanceData.phone || '')
        .replace(/\{\{address\}\}/g, instanceData.address || '')
        .replace(/\{\{website\}\}/g, instanceData.website || '');
      
      // Clean up empty lines for missing data
      body = body.split('\n').filter(line => {
        const trimmed = line.trim();
        if (trimmed === '📞' || trimmed === '📍' || trimmed === '🌐') return false;
        return true;
      }).join('\n');
      
      setEmailBody(body);
    }
  }, [open, instanceData, offer.public_token]);

  const handleSend = async () => {
    if (!customerEmail) {
      toast.error(t('offers.noCustomerEmail'));
      return;
    }

    setSending(true);
    try {
      const { data, error } = await supabase.functions.invoke('send-offer-email', {
        body: { 
          offerId: offer.id,
          customEmailBody: emailBody 
        },
      });

      // Check for error in response body first (Edge Function returns JSON with error)
      if (data?.error) {
        throw new Error(data.error);
      }
      
      // Then check for network/invoke error
      if (error) {
        throw new Error(error.message || 'Błąd połączenia z serwerem');
      }

      toast.success(t('offers.emailSent'));
      onOpenChange(false);
      onSent();
    } catch (error: unknown) {
      console.error('Error sending email:', error);
      
      // Parse error message for human-readable display
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      let userMessage = 'Nie udało się wysłać wiadomości';
      
      if (errorMessage.includes('No customer email')) {
        userMessage = 'Brak adresu email klienta';
      } else if (errorMessage.includes('SMTP not configured')) {
        userMessage = 'Wysyłka email nie jest skonfigurowana';
      } else if (errorMessage.includes('Invalid address') || (errorMessage.includes('invalid') && errorMessage.includes('address'))) {
        userMessage = 'Nieprawidłowy adres email - sprawdź czy nie ma literówki';
      } else if (errorMessage.includes('mailbox unavailable') || errorMessage.includes('invalid DNS') || errorMessage.includes('550')) {
        userMessage = 'Nieprawidłowy adres email - domena nie istnieje lub zawiera błąd';
      } else if (errorMessage.includes('Mailbox not found') || errorMessage.includes('does not exist') || errorMessage.includes('User unknown')) {
        userMessage = 'Adres email nie istnieje - sprawdź poprawność';
      } else if (errorMessage.includes('connection') || errorMessage.includes('timeout')) {
        userMessage = 'Błąd połączenia z serwerem email - spróbuj ponownie';
      } else if (errorMessage.includes('rejected') || errorMessage.includes('spam')) {
        userMessage = 'Wiadomość została odrzucona przez serwer odbiorcy';
      } else if (errorMessage.includes('authentication') || errorMessage.includes('auth')) {
        userMessage = 'Błąd autoryzacji serwera email';
      } else if (errorMessage.includes('non-2xx') || errorMessage.includes('Edge Function')) {
        userMessage = 'Błąd wysyłki email - sprawdź poprawność adresu';
      }
      
      toast.error(userMessage);
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl h-[100dvh] sm:h-[80vh] flex flex-col p-0" style={{ zIndex: 1100 }}>
        <DialogHeader className="flex-shrink-0 px-6 pt-6 pb-2">
          <DialogTitle className="flex items-center gap-2">
            <Mail className="w-5 h-5" />
            {t('sendEmailDialog.title')}
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 flex flex-col overflow-hidden px-6 pb-4">
          {/* Recipient */}
          <div className="flex items-center gap-2 text-sm mb-3 flex-shrink-0">
            <span className="text-muted-foreground">{t('sendEmailDialog.to')}:</span>
            <span className="font-medium">{customerEmail || t('offers.noCustomerEmail')}</span>
          </div>

          {/* Email body editor */}
          <div className="flex flex-col flex-1 space-y-2">
            <Label>{t('sendEmailDialog.editTemplate')}</Label>
            <Textarea
              value={emailBody}
              onChange={(e) => setEmailBody(e.target.value)}
              className="flex-1 min-h-0 resize-none font-mono text-sm"
            />
          </div>
        </div>

        <DialogFooter className="flex-shrink-0 border-t bg-background px-6 py-4 gap-2 sm:gap-0 flex-col-reverse sm:flex-row">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={sending} className="bg-white w-full sm:w-auto">
            {t('sendEmailDialog.cancel')}
          </Button>
          <Button onClick={handleSend} disabled={sending || !customerEmail} className="w-full sm:w-auto">
            {sending ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                {t('sendEmailDialog.sending')}
              </>
            ) : (
              <>
                <Send className="w-4 h-4 mr-2" />
                {t('sendEmailDialog.send')}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
