import { useTranslation } from 'react-i18next';
import { FileText, Check, Phone } from 'lucide-react';
import { getContrastTextColor } from '@/lib/colorUtils';

interface OfferBrandingPreviewProps {
  bgColor: string;
  headerBgColor: string;
  headerTextColor: string;
  sectionBgColor: string;
  sectionTextColor: string;
  primaryColor: string;
}

export function OfferBrandingPreview({
  bgColor,
  headerBgColor,
  headerTextColor,
  sectionBgColor,
  sectionTextColor,
  primaryColor,
}: OfferBrandingPreviewProps) {
  const { t } = useTranslation();
  
  // Calculate button text color based on primary
  const buttonTextColor = getContrastTextColor(primaryColor);
  
  return (
    <div 
      className="rounded-lg overflow-hidden border shadow-sm"
      style={{ backgroundColor: bgColor }}
    >
      {/* Mini header */}
      <div 
        className="px-4 py-3 border-b flex items-center justify-between"
        style={{ backgroundColor: headerBgColor }}
      >
        <div className="flex items-center gap-2">
          <div 
            className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{ backgroundColor: `${primaryColor}20` }}
          >
            <FileText className="w-4 h-4" style={{ color: primaryColor }} />
          </div>
          <div>
            <div 
              className="font-semibold text-sm"
              style={{ color: headerTextColor }}
            >
              {t('offerSettings.previewCompanyName')}
            </div>
            <div 
              className="text-xs opacity-60"
              style={{ color: headerTextColor }}
            >
              Oferta #001
            </div>
          </div>
        </div>
      </div>
      
      {/* Mini content */}
      <div className="p-3 space-y-2">
        {/* Service card */}
        <div 
          className="rounded-lg p-3 border"
          style={{ backgroundColor: sectionBgColor }}
        >
          <div 
            className="font-medium text-sm mb-1"
            style={{ color: sectionTextColor }}
          >
            {t('offerSettings.previewService')}
          </div>
          <div className="flex items-center justify-between">
            <span 
              className="text-xs opacity-70"
              style={{ color: sectionTextColor }}
            >
              {t('offerSettings.previewDescription')}
            </span>
            <span 
              className="font-semibold text-sm"
              style={{ color: primaryColor }}
            >
              1 200 zł
            </span>
          </div>
        </div>
        
        {/* Action button */}
        <button
          className="w-full py-2 rounded-lg text-sm font-medium flex items-center justify-center gap-2"
          style={{ 
            backgroundColor: primaryColor,
            color: buttonTextColor,
          }}
        >
          <Check className="w-4 h-4" />
          {t('offerSettings.previewAccept')}
        </button>
        
        {/* Contact link */}
        <div className="flex justify-center">
          <span 
            className="text-xs flex items-center gap-1"
            style={{ color: primaryColor }}
          >
            <Phone className="w-3 h-3" />
            +48 123 456 789
          </span>
        </div>
      </div>
    </div>
  );
}
