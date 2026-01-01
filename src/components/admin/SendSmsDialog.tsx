import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { MessageSquare } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface SendSmsDialogProps {
  phone: string;
  customerName: string;
  instanceId: string | null;
  open: boolean;
  onClose: () => void;
}

const SendSmsDialog = ({ phone, customerName, instanceId, open, onClose }: SendSmsDialogProps) => {
  const { t } = useTranslation();
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);

  const handleSend = async () => {
    if (!message.trim() || !instanceId) return;
    
    setSending(true);
    try {
      const { error } = await supabase.functions.invoke('send-sms-message', {
        body: {
          phone,
          message,
          instanceId,
        },
      });
      
      if (error) throw error;
      
      toast.success(t('sms.sent'));
      setMessage('');
      onClose();
    } catch (error) {
      console.error('Error sending SMS:', error);
      toast.error(t('sms.sendFailed'));
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={() => onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-primary" />
            {t('sms.sendSms')}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="text-sm text-muted-foreground">
            {t('sms.to')}: <span className="font-medium text-foreground">{customerName}</span> ({phone})
          </div>
          
          <Textarea
            placeholder={t('sms.messagePlaceholder')}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={4}
            autoFocus
          />
          
          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={onClose}>
              {t('common.cancel')}
            </Button>
            <Button
              onClick={handleSend}
              disabled={!message.trim() || sending}
            >
              {sending ? t('common.saving') : t('sms.send')}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default SendSmsDialog;
