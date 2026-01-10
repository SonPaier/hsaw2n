import { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
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
import { Upload, FileText, Loader2, X } from 'lucide-react';
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
  const { t } = useTranslation();
  const [file, setFile] = useState<File | null>(null);
  const [name, setName] = useState('');
  const [salespersonName, setSalespersonName] = useState('');
  const [salespersonPhone, setSalespersonPhone] = useState('');
  const [salespersonEmail, setSalespersonEmail] = useState('');
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
        if (!name) {
          setName(droppedFile.name.replace(/\.[^/.]+$/, ''));
        }
      } else {
        toast.error(t('priceListUpload.unsupportedFormat'));
      }
    }
  }, [name, t]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      if (!acceptedTypes.includes(selectedFile.type)) {
        toast.error(t('priceListUpload.unsupportedFormat'));
        return;
      }
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
      toast.error(t('priceListUpload.selectFileAndName'));
      return;
    }

    setIsUploading(true);

    try {
      const fileType = getFileType(file);
      const filePath = `${instanceId}/${Date.now()}_${file.name}`;

      const { error: uploadError } = await supabase.storage
        .from('price-lists')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { error: insertError } = await supabase
        .from('price_lists')
        .insert({
          instance_id: instanceId,
          name: name.trim(),
          file_path: filePath,
          file_type: fileType,
          is_global: false,
          salesperson_name: salespersonName.trim() || null,
          salesperson_phone: salespersonPhone.trim() || null,
          salesperson_email: salespersonEmail.trim() || null,
        });

      if (insertError) throw insertError;

      toast.success(t('priceListUpload.uploadSuccess'));
      handleClose();
      onSuccess();
    } catch (error) {
      console.error('Upload error:', error);
      toast.error(t('priceListUpload.uploadError'));
    } finally {
      setIsUploading(false);
    }
  };

  const handleClose = () => {
    if (!isUploading) {
      setFile(null);
      setName('');
      setSalespersonName('');
      setSalespersonPhone('');
      setSalespersonEmail('');
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5 text-primary" />
            {t('priceListUpload.title')}
          </DialogTitle>
          <DialogDescription>
            {t('priceListUpload.description')}
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
                  {t('priceListUpload.dropzone.dragHere')}
                </p>
                <label>
                  <span className="text-primary hover:underline cursor-pointer">
                    {t('priceListUpload.dropzone.selectFromDisk')}
                  </span>
                  <input
                    type="file"
                    accept=".pdf,.xlsx,.xls"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                </label>
                <p className="text-xs text-muted-foreground mt-2">
                  {t('priceListUpload.dropzone.formats')}
                </p>
              </>
            )}
          </div>

          {/* Name input */}
          <div className="space-y-2">
            <Label htmlFor="name">{t('priceListUpload.priceListName')}</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t('priceListUpload.priceListNamePlaceholder')}
              disabled={isUploading}
            />
          </div>

          {/* Salesperson fields (optional) */}
          <div className="space-y-3 p-3 border border-border rounded-lg">
            <p className="text-sm font-medium text-muted-foreground">{t('priceListUpload.salesperson.title')}</p>
            <div className="grid grid-cols-1 gap-3">
              <div className="space-y-1">
                <Label htmlFor="salesperson-name" className="text-xs">{t('priceListUpload.salesperson.name')}</Label>
                <Input
                  id="salesperson-name"
                  value={salespersonName}
                  onChange={(e) => setSalespersonName(e.target.value)}
                  placeholder={t('priceListUpload.salesperson.namePlaceholder')}
                  disabled={isUploading}
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label htmlFor="salesperson-phone" className="text-xs">{t('priceListUpload.salesperson.phone')}</Label>
                  <Input
                    id="salesperson-phone"
                    type="tel"
                    value={salespersonPhone}
                    onChange={(e) => setSalespersonPhone(e.target.value)}
                    placeholder={t('priceListUpload.salesperson.phonePlaceholder')}
                    disabled={isUploading}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="salesperson-email" className="text-xs">{t('priceListUpload.salesperson.email')}</Label>
                  <Input
                    id="salesperson-email"
                    type="email"
                    value={salespersonEmail}
                    onChange={(e) => setSalespersonEmail(e.target.value)}
                    placeholder={t('priceListUpload.salesperson.emailPlaceholder')}
                    disabled={isUploading}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={handleClose} disabled={isUploading}>
            {t('common.cancel')}
          </Button>
          <Button onClick={handleUpload} disabled={!file || !name.trim() || isUploading}>
            {isUploading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {t('priceListUpload.uploading')}
              </>
            ) : (
              <>
                <Upload className="mr-2 h-4 w-4" />
                {t('priceListUpload.upload')}
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
