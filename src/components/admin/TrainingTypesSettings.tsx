import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { GraduationCap, Plus, Pencil, Trash2, Loader2, GripVertical } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface TrainingType {
  id: string;
  instance_id: string;
  name: string;
  duration_days: number;
  sort_order: number;
  active: boolean;
}

interface TrainingTypesSettingsProps {
  instanceId: string | null;
}

const DURATION_OPTIONS = [
  { value: '1', label: '1 dzień' },
  { value: '1.5', label: '1,5 dnia' },
  { value: '2', label: '2 dni' },
  { value: '2.5', label: '2,5 dnia' },
  { value: '3', label: '3 dni' },
  { value: '3.5', label: '3,5 dnia' },
  { value: '4', label: '4 dni' },
  { value: '4.5', label: '4,5 dnia' },
  { value: '5', label: '5 dni' },
];

export default function TrainingTypesSettings({ instanceId }: TrainingTypesSettingsProps) {
  const { t } = useTranslation();
  const [trainingTypes, setTrainingTypes] = useState<TrainingType[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingType, setEditingType] = useState<TrainingType | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingType, setDeletingType] = useState<TrainingType | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Form state
  const [formName, setFormName] = useState('');
  const [formDuration, setFormDuration] = useState('1');

  const fetchTypes = async () => {
    if (!instanceId) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('training_types')
      .select('*')
      .eq('instance_id', instanceId)
      .eq('active', true)
      .order('sort_order');

    if (!error && data) {
      setTrainingTypes(data as TrainingType[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchTypes();
  }, [instanceId]);

  const openAdd = () => {
    setEditingType(null);
    setFormName('');
    setFormDuration('1');
    setDialogOpen(true);
  };

  const openEdit = (type: TrainingType) => {
    setEditingType(type);
    setFormName(type.name);
    setFormDuration(String(type.duration_days));
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!instanceId || !formName.trim()) return;
    setSaving(true);
    try {
      if (editingType) {
        const { error } = await supabase
          .from('training_types')
          .update({
            name: formName.trim(),
            duration_days: parseFloat(formDuration),
          } as any)
          .eq('id', editingType.id);
        if (error) throw error;
        toast.success('Typ szkolenia zaktualizowany');
      } else {
        const maxOrder = trainingTypes.length > 0
          ? Math.max(...trainingTypes.map(t => t.sort_order)) + 1
          : 0;
        const { error } = await supabase
          .from('training_types')
          .insert({
            instance_id: instanceId,
            name: formName.trim(),
            duration_days: parseFloat(formDuration),
            sort_order: maxOrder,
          } as any);
        if (error) throw error;
        toast.success('Typ szkolenia dodany');
      }
      setDialogOpen(false);
      fetchTypes();
    } catch (err) {
      console.error('Error saving training type:', err);
      toast.error('Błąd zapisu');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingType) return;
    setDeleting(true);
    try {
      const { error } = await supabase
        .from('training_types')
        .update({ active: false } as any)
        .eq('id', deletingType.id);
      if (error) throw error;
      toast.success('Typ szkolenia usunięty');
      setDeleteDialogOpen(false);
      setDeletingType(null);
      fetchTypes();
    } catch (err) {
      console.error('Error deleting training type:', err);
      toast.error('Błąd usuwania');
    } finally {
      setDeleting(false);
    }
  };

  const getDurationLabel = (days: number) => {
    const opt = DURATION_OPTIONS.find(o => parseFloat(o.value) === days);
    return opt?.label || `${days} dni`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <GraduationCap className="w-5 h-5" />
            Typy szkoleń
          </h3>
          <p className="text-sm text-muted-foreground mt-1">
            Zarządzaj typami szkoleń dostępnymi w kalendarzu
          </p>
        </div>
        <Button onClick={openAdd} size="sm">
          <Plus className="w-4 h-4 mr-2" />
          Dodaj typ
        </Button>
      </div>

      {trainingTypes.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          <GraduationCap className="w-10 h-10 mx-auto mb-2 opacity-50" />
          <p>Brak typów szkoleń</p>
          <p className="text-sm">Dodaj pierwszy typ szkolenia</p>
        </div>
      ) : (
        <div className="space-y-2">
          {trainingTypes.map((type) => (
            <div
              key={type.id}
              className="flex items-center justify-between p-3 rounded-lg border border-border bg-background hover:bg-muted/30 transition-colors"
            >
              <div className="flex items-center gap-3">
                <GripVertical className="w-4 h-4 text-muted-foreground" />
                <div>
                  <div className="font-medium text-sm">{type.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {getDurationLabel(type.duration_days)}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => openEdit(type)}
                >
                  <Pencil className="w-4 h-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-destructive hover:text-destructive"
                  onClick={() => {
                    setDeletingType(type);
                    setDeleteDialogOpen(true);
                  }}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="bg-white dark:bg-card">
          <DialogHeader>
            <DialogTitle>
              {editingType ? 'Edytuj typ szkolenia' : 'Dodaj typ szkolenia'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Nazwa</Label>
              <Input
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="np. Grupowe podstawowe"
              />
            </div>
            <div className="space-y-2">
              <Label>Czas trwania</Label>
              <Select value={formDuration} onValueChange={setFormDuration}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-white dark:bg-card">
                  {DURATION_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Anuluj
            </Button>
            <Button onClick={handleSave} disabled={saving || !formName.trim()}>
              {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              {editingType ? 'Zapisz' : 'Dodaj'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title="Usuń typ szkolenia"
        description={`Czy na pewno chcesz usunąć typ "${deletingType?.name}"?`}
        onConfirm={handleDelete}
        loading={deleting}
        variant="destructive"
      />
    </div>
  );
}
