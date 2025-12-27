import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Upload, FileText, Loader2, Sparkles, X } from 'lucide-react';
import { toast } from 'sonner';

interface PriceListUploadDialogProps {
  instanceId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function PriceListUploadDialog({
  instanceId,
  open,
  onOpenChange,
  onSuccess,
}: PriceListUploadDialogProps) {
  const [file, setFile] = useState<File | null>(null);
  const [name, setName] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [progress, setProgress] = useState(0);
  const [stageLabel, setStageLabel] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const acceptedTypes = [
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-excel',
  ];

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragleave' || e.type === 'dragover') {
      setDragActive(e.type !== 'dragleave');
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const droppedFile = e.dataTransfer.files[0];
      if (acceptedTypes.includes(droppedFile.type)) {
        setFile(droppedFile);
        setErrorMessage(null);
        if (!name) {
          setName(droppedFile.name.replace(/\.[^/.]+$/, ''));
        }
      } else {
        toast.error('Nieobsługiwany format pliku. Użyj PDF lub Excel.');
      }
    }
  }, [name]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      if (!acceptedTypes.includes(selectedFile.type)) {
        toast.error('Nieobsługiwany format pliku. Użyj PDF lub Excel.');
        return;
      }
      setFile(selectedFile);
      setErrorMessage(null);
      if (!name) {
        setName(selectedFile.name.replace(/\.[^/.]+$/, ''));
      }
    }
  };

  const getFileType = (file: File): string => {
    if (file.type === 'application/pdf') return 'pdf';
    if (file.type.includes('spreadsheet') || file.type.includes('excel')) return 'xlsx';
    return 'unknown';
  };

  const readFileContent = (file: File, fileType: string) => {
    return new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error('Nie udało się odczytać pliku'));
      reader.onload = (e) => resolve(String(e.target?.result ?? ''));

      if (fileType === 'pdf') {
        // PDF wysyłamy jako base64 (DataURL)
        reader.readAsDataURL(file);
      } else {
        // Excel na razie jako tekst (uproszczenie)
        reader.readAsText(file);
      }
    });
  };

  const normalizeInvokeError = (err: unknown) => {
    const raw = err && typeof err === 'object' && 'message' in err ? String((err as any).message) : 'Wystąpił nieznany błąd.';

    if (/401|invalid jwt/i.test(raw)) {
      return 'Brak autoryzacji (Invalid JWT). Odśwież stronę i zaloguj się ponownie.';
    }

    return raw;
  };

  const handleUpload = async () => {
    if (!file || !name.trim()) {
      toast.error('Wybierz plik i podaj nazwę cennika');
      return;
    }

    setIsUploading(true);
    setProgress(8);
    setStageLabel('Przygotowuję upload...');
    setErrorMessage(null);

    let priceListId: string | null = null;

    try {
      // Upewnij się, że mamy sesję (żeby nie wysłać błędnego Authorization i nie dostać 401)
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) throw sessionError;
      const accessToken = sessionData.session?.access_token;
      if (!accessToken) {
        throw new Error('Brak aktywnej sesji. Zaloguj się ponownie.');
      }

      const fileType = getFileType(file);
      const filePath = `${instanceId}/${Date.now()}_${file.name}`;

      setProgress(20);
      setStageLabel('Wgrywam plik do magazynu...');

      // Upload file to storage
      const { error: uploadError } = await supabase.storage
        .from('price-lists')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      setProgress(38);
      setStageLabel('Zapisuję cennik w bazie...');

      // Create price list record
      const { data: priceList, error: insertError } = await supabase
        .from('price_lists')
        .insert({
          instance_id: instanceId,
          name: name.trim(),
          file_path: filePath,
          file_type: fileType,
          status: 'pending',
          is_global: false,
        })
        .select()
        .single();

      if (insertError) throw insertError;
      priceListId = priceList.id;

      setProgress(55);
      setStageLabel('Odczytuję plik...');

      const fileContent = await readFileContent(file, fileType);

      setProgress(78);
      setStageLabel('Uruchamiam ekstrakcję AI...');

      const { error: extractError } = await supabase.functions.invoke('extract-price-list', {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        body: {
          priceListId: priceList.id,
          fileContent,
          fileName: file.name,
        },
      });

      if (extractError) {
        const msg = normalizeInvokeError(extractError);

        // jeśli funkcja nie wystartowała (np. 401), to UI przynajmniej pokaże błąd na liście
        await supabase
          .from('price_lists')
          .update({ status: 'failed', error_message: msg })
          .eq('id', priceList.id);

        throw new Error(msg);
      }

      setProgress(100);
      setStageLabel('Gotowe — przetwarzanie trwa w tle.');
      toast.success('Ekstrakcja uruchomiona. Status zobaczysz na liście cenników.');

      onSuccess();
    } catch (error) {
      const msg = normalizeInvokeError(error);
      console.error('Upload/extraction error:', error);
      setErrorMessage(msg);
      toast.error(msg);

      // Bezpiecznik: jeśli coś padło po utworzeniu rekordu, oznacz jako failed
      if (priceListId) {
        await supabase
          .from('price_lists')
          .update({ status: 'failed', error_message: msg })
          .eq('id', priceListId);
      }
    } finally {
      setIsUploading(false);
    }
  };

  const handleClose = () => {
    if (!isUploading) {
      setFile(null);
      setName('');
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5 text-primary" />
            Wgraj cennik
          </DialogTitle>
          <DialogDescription>
            Wgraj plik PDF lub Excel z cennikiem. AI automatycznie wyekstrahuje produkty.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Drop zone */}
          <div
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
            className={`
              relative border-2 border-dashed rounded-lg p-8 text-center transition-colors
              ${dragActive ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'}
              ${file ? 'bg-muted/50' : ''}
            `}
          >
            {file ? (
              <div className="flex items-center justify-center gap-3">
                <FileText className="h-8 w-8 text-primary" />
                <div className="text-left">
                  <p className="font-medium">{file.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {(file.size / 1024 / 1024).toFixed(2)} MB
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="ml-auto"
                  onClick={() => setFile(null)}
                  disabled={isUploading}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <>
                <Upload className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
                <p className="text-muted-foreground mb-2">
                  Przeciągnij plik tutaj lub
                </p>
                <label>
                  <span className="text-primary hover:underline cursor-pointer">
                    wybierz z dysku
                  </span>
                  <input
                    type="file"
                    accept=".pdf,.xlsx,.xls"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                </label>
                <p className="text-xs text-muted-foreground mt-2">
                  PDF, XLSX lub XLS (max 10MB)
                </p>
              </>
            )}
          </div>

          {/* Name input */}
          <div className="space-y-2">
            <Label htmlFor="name">Nazwa cennika</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="np. Folie samochodowe 2024"
              disabled={isUploading}
            />
          </div>

          {/* Progress */}
          {isUploading && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>{stageLabel || 'Przetwarzam...'}</span>
                <span>{Math.min(100, Math.max(0, progress))}%</span>
              </div>
              <Progress value={progress} />
            </div>
          )}

          {/* Error */}
          {errorMessage && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
              {errorMessage}
            </div>
          )}

          {/* AI info */}
          <div className="flex items-start gap-3 p-3 bg-primary/5 rounded-lg">
            <Sparkles className="h-5 w-5 text-primary shrink-0 mt-0.5" />
            <div className="text-sm">
              <p className="font-medium">Automatyczna ekstrakcja AI</p>
              <p className="text-muted-foreground">
                Po wgraniu cennika, AI automatycznie wyekstrahuje produkty z ich cenami i parametrami.
              </p>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={handleClose} disabled={isUploading}>
            Anuluj
          </Button>
          <Button onClick={handleUpload} disabled={!file || !name.trim() || isUploading}>
            {isUploading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Wgrywanie...
              </>
            ) : (
              <>
                <Upload className="mr-2 h-4 w-4" />
                Wgraj i ekstrahuj
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
