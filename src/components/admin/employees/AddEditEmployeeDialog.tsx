import { useState, useEffect } from 'react';
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
import { Switch } from '@/components/ui/switch';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useCreateEmployee, useUpdateEmployee, Employee } from '@/hooks/useEmployees';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Loader2, Upload, X } from 'lucide-react';

interface AddEditEmployeeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  instanceId: string | null;
  employee?: Employee | null;
}

const AddEditEmployeeDialog = ({
  open,
  onOpenChange,
  instanceId,
  employee,
}: AddEditEmployeeDialogProps) => {
  const [name, setName] = useState('');
  const [hourlyRate, setHourlyRate] = useState('');
  const [active, setActive] = useState(true);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const createEmployee = useCreateEmployee(instanceId);
  const updateEmployee = useUpdateEmployee(instanceId);

  const isEditing = !!employee;
  const isSubmitting = createEmployee.isPending || updateEmployee.isPending;

  useEffect(() => {
    if (employee) {
      setName(employee.name);
      setHourlyRate(employee.hourly_rate?.toString() || '');
      setActive(employee.active);
      setPhotoUrl(employee.photo_url);
    } else {
      setName('');
      setHourlyRate('');
      setActive(true);
      setPhotoUrl(null);
    }
  }, [employee, open]);

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !instanceId) return;

    // Validate file type and size
    if (!file.type.startsWith('image/')) {
      toast.error('Dozwolone są tylko pliki graficzne');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Maksymalny rozmiar pliku to 5MB');
      return;
    }

    setIsUploading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${instanceId}/${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('employee-photos')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('employee-photos')
        .getPublicUrl(fileName);

      setPhotoUrl(publicUrl);
      toast.success('Zdjęcie zostało przesłane');
    } catch (error) {
      console.error('Upload error:', error);
      toast.error('Błąd podczas przesyłania zdjęcia');
    } finally {
      setIsUploading(false);
    }
  };

  const handleRemovePhoto = () => {
    setPhotoUrl(null);
  };

  const handleSubmit = async () => {
    if (!name.trim()) {
      toast.error('Podaj imię i nazwisko');
      return;
    }

    try {
      const data = {
        name: name.trim(),
        hourly_rate: hourlyRate ? parseFloat(hourlyRate) : null,
        active,
        photo_url: photoUrl,
      };

      if (isEditing && employee) {
        await updateEmployee.mutateAsync({ id: employee.id, ...data });
        toast.success('Pracownik został zaktualizowany');
      } else {
        await createEmployee.mutateAsync(data);
        toast.success('Pracownik został dodany');
      }

      onOpenChange(false);
    } catch (error) {
      toast.error('Wystąpił błąd');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? 'Edytuj pracownika' : 'Dodaj pracownika'}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Photo upload */}
          <div className="flex items-center gap-4">
            <div className="relative">
              <Avatar className="h-20 w-20">
                <AvatarImage src={photoUrl || undefined} />
                <AvatarFallback className="bg-primary/10 text-primary text-lg">
                  {name.slice(0, 2).toUpperCase() || '??'}
                </AvatarFallback>
              </Avatar>
              {photoUrl && (
                <button
                  type="button"
                  onClick={handleRemovePhoto}
                  className="absolute -top-1 -right-1 w-5 h-5 bg-destructive text-destructive-foreground rounded-full flex items-center justify-center hover:bg-destructive/90"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
            <div>
              <Label htmlFor="photo" className="cursor-pointer">
                <div className="flex items-center gap-2 text-sm text-primary hover:text-primary/80">
                  {isUploading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Upload className="w-4 h-4" />
                  )}
                  {photoUrl ? 'Zmień zdjęcie' : 'Dodaj zdjęcie'}
                </div>
              </Label>
              <input
                id="photo"
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handlePhotoUpload}
                disabled={isUploading}
              />
              <p className="text-xs text-muted-foreground mt-1">
                JPG, PNG do 5MB
              </p>
            </div>
          </div>

          {/* Name */}
          <div className="space-y-2">
            <Label htmlFor="name">Imię i nazwisko *</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="np. Jan Kowalski"
            />
          </div>

          {/* Hourly rate */}
          <div className="space-y-2">
            <Label htmlFor="rate">Stawka godzinowa (zł)</Label>
            <Input
              id="rate"
              type="number"
              min="0"
              step="0.01"
              value={hourlyRate}
              onChange={(e) => setHourlyRate(e.target.value)}
              placeholder="np. 30"
            />
          </div>

          {/* Active switch */}
          <div className="flex items-center justify-between">
            <Label htmlFor="active">Aktywny pracownik</Label>
            <Switch
              id="active"
              checked={active}
              onCheckedChange={setActive}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Anuluj
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            {isEditing ? 'Zapisz' : 'Dodaj'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default AddEditEmployeeDialog;
