import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2 } from 'lucide-react';

interface AdminOfferApprovalDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  offer: {
    id: string;
    customer_data: { name?: string };
    total_net: number | null;
    total_gross: number | null;
    admin_approved_net?: number | null;
    admin_approved_gross?: number | null;
  } | null;
  mode: 'approve' | 'edit';
  onConfirm: (netAmount: number, grossAmount: number) => Promise<void>;
}

const VAT_MULTIPLIER = 1.23;

export function AdminOfferApprovalDialog({
  open,
  onOpenChange,
  offer,
  mode,
  onConfirm,
}: AdminOfferApprovalDialogProps) {
  const { t } = useTranslation();
  const [netAmount, setNetAmount] = useState<string>('');
  const [grossAmount, setGrossAmount] = useState<string>('');
  const [lastEdited, setLastEdited] = useState<'net' | 'gross' | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Initialize values when dialog opens
  useEffect(() => {
    if (open && offer) {
      // Priority: admin_approved_* > total_* > empty
      const initialNet = offer.admin_approved_net ?? offer.total_net ?? null;
      const initialGross = offer.admin_approved_gross ?? offer.total_gross ?? null;
      
      setNetAmount(initialNet !== null ? String(initialNet) : '');
      setGrossAmount(initialGross !== null ? String(initialGross) : '');
      setLastEdited(null);
    }
  }, [open, offer]);

  const handleNetChange = (value: string) => {
    setNetAmount(value);
    setLastEdited('net');
    
    const numValue = parseFloat(value);
    if (!isNaN(numValue) && numValue >= 0) {
      const calculatedGross = Math.round(numValue * VAT_MULTIPLIER * 100) / 100;
      setGrossAmount(String(calculatedGross));
    } else if (value === '') {
      setGrossAmount('');
    }
  };

  const handleGrossChange = (value: string) => {
    setGrossAmount(value);
    setLastEdited('gross');
    
    const numValue = parseFloat(value);
    if (!isNaN(numValue) && numValue >= 0) {
      const calculatedNet = Math.round((numValue / VAT_MULTIPLIER) * 100) / 100;
      setNetAmount(String(calculatedNet));
    } else if (value === '') {
      setNetAmount('');
    }
  };

  const handleSubmit = async () => {
    const net = parseFloat(netAmount);
    const gross = parseFloat(grossAmount);
    
    if (isNaN(net) || isNaN(gross) || (net <= 0 && gross <= 0)) {
      return;
    }
    
    setIsSubmitting(true);
    try {
      await onConfirm(net, gross);
      onOpenChange(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  const isValid = () => {
    const net = parseFloat(netAmount);
    const gross = parseFloat(grossAmount);
    return !isNaN(net) && !isNaN(gross) && (net > 0 || gross > 0);
  };

  const customerName = offer?.customer_data?.name || 'Klient';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {mode === 'approve' ? 'Oferta zaakceptowana' : 'Zmień kwotę'}
          </DialogTitle>
          <DialogDescription>
            Oferta dla "{customerName}" {mode === 'approve' ? 'zaakceptowana' : ''} na kwotę:
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="net-amount">Kwota netto (zł)</Label>
            <Input
              id="net-amount"
              type="number"
              step="0.01"
              min="0"
              value={netAmount}
              onChange={(e) => handleNetChange(e.target.value)}
              placeholder="0.00"
            />
          </div>
          
          <div className="grid gap-2">
            <Label htmlFor="gross-amount">Kwota brutto (zł)</Label>
            <Input
              id="gross-amount"
              type="number"
              step="0.01"
              min="0"
              value={grossAmount}
              onChange={(e) => handleGrossChange(e.target.value)}
              placeholder="0.00"
            />
          </div>
          
          <p className="text-xs text-muted-foreground">
            VAT 23% — kwoty przeliczają się automatycznie
          </p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
            Anuluj
          </Button>
          <Button onClick={handleSubmit} disabled={!isValid() || isSubmitting}>
            {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Zapisz
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
