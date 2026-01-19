import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Loader2, Save } from 'lucide-react';

interface ProtocolSettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  instanceId: string;
}

const DEFAULT_TEMPLATE = `Dzień dobry {imie},

W załączeniu przesyłamy protokół {typ_protokolu} pojazdu {pojazd}.

Prosimy o zapoznanie się z dokumentem.

[Link do protokołu zostanie automatycznie dołączony]

Pozdrawiamy`;

export const ProtocolSettingsDialog = ({
  open,
  onOpenChange,
  instanceId,
}: ProtocolSettingsDialogProps) => {
  const [emailTemplate, setEmailTemplate] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open && instanceId) {
      fetchSettings();
    }
  }, [open, instanceId]);

  const fetchSettings = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('instances')
        .select('protocol_email_template')
        .eq('id', instanceId)
        .single();

      if (error) throw error;
      setEmailTemplate(data?.protocol_email_template || DEFAULT_TEMPLATE);
    } catch (error) {
      console.error('Error fetching protocol settings:', error);
      setEmailTemplate(DEFAULT_TEMPLATE);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from('instances')
        .update({ protocol_email_template: emailTemplate })
        .eq('id', instanceId);

      if (error) throw error;
      toast.success('Ustawienia zostały zapisane');
      onOpenChange(false);
    } catch (error) {
      console.error('Error saving protocol settings:', error);
      toast.error('Nie udało się zapisać ustawień');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Ustawienia protokołów</DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="flex-1 space-y-4 overflow-y-auto py-4">
            <div className="space-y-2">
              <Label htmlFor="emailTemplate">Szablon wiadomości email</Label>
              <p className="text-xs text-muted-foreground">
                Dostępne zmienne: {'{imie}'}, {'{pojazd}'}, {'{typ_protokolu}'}
              </p>
              <Textarea
                id="emailTemplate"
                value={emailTemplate}
                onChange={(e) => setEmailTemplate(e.target.value)}
                rows={12}
                className="resize-none font-mono text-sm"
                placeholder="Wpisz szablon wiadomości..."
              />
            </div>
          </div>
        )}

        <DialogFooter className="border-t pt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Anuluj
          </Button>
          <Button onClick={handleSave} disabled={saving || loading}>
            {saving ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            Zapisz
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
