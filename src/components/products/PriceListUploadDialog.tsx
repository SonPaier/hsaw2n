import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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

  const acceptedTypes = [
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-excel',
  ];

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
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
      setFile(selectedFile);
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

  const handleUpload = async () => {
    if (!file || !name.trim()) {
      toast.error('Wybierz plik i podaj nazwę cennika');
      return;
    }

    setIsUploading(true);

    try {
      const fileType = getFileType(file);
      const filePath = `${instanceId}/${Date.now()}_${file.name}`;

      // Upload file to storage
      const { error: uploadError } = await supabase.storage
        .from('price-lists')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

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

      toast.success('Cennik został wgrany. Rozpoczynam ekstrakcję AI...');

      // Read file content for AI extraction
      const reader = new FileReader();
      reader.onload = async (e) => {
        const content = e.target?.result as string;
        
        // Call extraction edge function
        const { error: extractError } = await supabase.functions.invoke('extract-price-list', {
          body: {
            priceListId: priceList.id,
            fileContent: content,
            fileName: file.name,
          },
        });

        if (extractError) {
          console.error('Extraction error:', extractError);
          // Status will be updated by the edge function
        }
      };

      if (fileType === 'pdf') {
        // For PDF, we need to send base64
        reader.readAsDataURL(file);
      } else {
        // For Excel, read as text (simplified - in production you'd parse Excel)
        reader.readAsText(file);
      }

      onSuccess();
    } catch (error) {
      console.error('Upload error:', error);
      toast.error('Nie udało się wgrać cennika');
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
            />
          </div>

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
