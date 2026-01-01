import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/integrations/supabase/client';
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
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';

interface AddFollowUpServiceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  instanceId: string;
  onSuccess: () => void;
}

export function AddFollowUpServiceDialog({
  open,
  onOpenChange,
  instanceId,
  onSuccess,
}: AddFollowUpServiceDialogProps) {
  const { t } = useTranslation();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [intervalMonths, setIntervalMonths] = useState(12);
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!name.trim()) {
      toast.error(t('followup.enterServiceName'));
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase.from('followup_services').insert({
        instance_id: instanceId,
        name: name.trim(),
        description: description.trim() || null,
        default_interval_months: intervalMonths,
      });

      if (error) throw error;

      toast.success(t('followup.serviceAdded'));
      onSuccess();
      onOpenChange(false);
      setName('');
      setDescription('');
      setIntervalMonths(12);
    } catch (error) {
      console.error('Error adding followup service:', error);
      toast.error(t('followup.addServiceError'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('followup.newService')}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">{t('followup.serviceName')}</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t('followup.serviceNamePlaceholder')}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">{t('followup.descriptionOptional')}</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t('followup.descriptionPlaceholder')}
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="interval">{t('followup.defaultInterval')}</Label>
            <Input
              id="interval"
              type="number"
              min={1}
              max={60}
              value={intervalMonths}
              onChange={(e) => setIntervalMonths(parseInt(e.target.value) || 12)}
            />
            <p className="text-xs text-muted-foreground">
              {t('followup.intervalHint')}
            </p>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {t('followup.addService')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
