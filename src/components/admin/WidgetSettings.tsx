import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Copy, ExternalLink, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';

interface WidgetSettingsProps {
  instanceSlug?: string;
}

export default function WidgetSettings({ instanceSlug }: WidgetSettingsProps) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);

  const slug = instanceSlug || 'your-instance';
  const embedUrl = `https://${slug}.n2wash.com/embed`;
  
  const iframeCode = `<iframe 
  src="${embedUrl}" 
  width="100%" 
  height="700" 
  frameborder="0"
  style="border: none; border-radius: 8px;"
></iframe>`;

  const handleCopyCode = () => {
    navigator.clipboard.writeText(iframeCode);
    setCopied(true);
    toast.success(t('widget.codeCopied'));
    setTimeout(() => setCopied(false), 2000);
  };

  const handlePreview = () => {
    window.open(embedUrl, '_blank');
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">{t('widget.title')}</h2>
        <p className="text-muted-foreground mt-1">{t('widget.description')}</p>
      </div>

      {/* Preview URL */}
      <div className="space-y-2">
        <Label>{t('widget.previewUrl')}</Label>
        <div className="flex items-center gap-2">
          <code className="flex-1 bg-muted px-3 py-2 rounded-md text-sm font-mono break-all">
            {embedUrl}
          </code>
          <Button variant="outline" size="icon" onClick={handlePreview}>
            <ExternalLink className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Iframe Code */}
      <div className="space-y-2">
        <Label>{t('widget.iframeCode')}</Label>
        <Textarea
          value={iframeCode}
          readOnly
          className="font-mono text-sm h-32 bg-muted"
        />
        <Button onClick={handleCopyCode} className="w-full">
          {copied ? (
            <>
              <Check className="w-4 h-4 mr-2" />
              {t('widget.codeCopied')}
            </>
          ) : (
            <>
              <Copy className="w-4 h-4 mr-2" />
              {t('widget.copyCode')}
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
