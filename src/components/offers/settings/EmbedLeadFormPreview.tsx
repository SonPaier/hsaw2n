import { useState } from 'react';
import { Check, ChevronDown, ChevronUp, Calendar } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';
import { getContrastTextColor } from '@/lib/colorUtils';

interface Template {
  id: string;
  name: string;
  short_name: string | null;
  description: string | null;
  price_from: number | null;
  available_durations?: number[];
}

interface Extra {
  id: string;
  name: string;
}

interface BrandingColors {
  bgColor: string;
  sectionBgColor: string;
  sectionTextColor: string;
  primaryColor: string;
}

interface EmbedLeadFormPreviewProps {
  templates: Template[];
  extras: Extra[];
  branding?: BrandingColors;
}

// Helper to format duration in Polish
const formatDuration = (months: number): string => {
  const years = months / 12;
  if (years === 1) return '1 rok';
  if (years < 5) return `${years} lata`;
  return `${years} lat`;
};

export default function EmbedLeadFormPreview({ templates, extras, branding }: EmbedLeadFormPreviewProps) {
  const [expandedDescriptions, setExpandedDescriptions] = useState<Set<string>>(new Set());
  const [selectedTemplates, setSelectedTemplates] = useState<Set<string>>(new Set());
  const [selectedExtras, setSelectedExtras] = useState<Set<string>>(new Set());
  const [durationSelections, setDurationSelections] = useState<Record<string, number | null>>({});

  // Default colors (fallback to blue theme)
  const bgColor = branding?.bgColor || '#f8fafc';
  const sectionBgColor = branding?.sectionBgColor || '#ffffff';
  const sectionTextColor = branding?.sectionTextColor || '#1e293b';
  const primaryColor = branding?.primaryColor || '#2563eb';
  const primaryTextColor = getContrastTextColor(primaryColor);

  // Computed colors for selections
  const selectedBgColor = `${primaryColor}15`; // 15% opacity
  const selectedBorderColor = primaryColor;

  const toggleDescription = (id: string) => {
    setExpandedDescriptions(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const toggleTemplate = (id: string) => {
    setSelectedTemplates(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
        // Clear duration selection when deselected
        setDurationSelections(d => {
          const newD = { ...d };
          delete newD[id];
          return newD;
        });
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const toggleExtra = (id: string) => {
    setSelectedExtras(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const setDurationSelection = (templateId: string, duration: number | null) => {
    setDurationSelections(prev => ({
      ...prev,
      [templateId]: duration,
    }));
  };

  return (
    <div className="p-4 min-h-full" style={{ backgroundColor: bgColor }}>
      <div className="max-w-md mx-auto space-y-4">
        {/* Header */}
        <div className="text-center mb-4" style={{ color: sectionTextColor }}>
          <h1 className="text-lg font-bold">Zapytaj o wycenę</h1>
          <p className="text-sm opacity-70">Wypełnij formularz</p>
        </div>

        {/* Customer Section */}
        <div className="rounded-lg p-3 shadow-sm space-y-3" style={{ backgroundColor: sectionBgColor, color: sectionTextColor }}>
          <h2 className="font-medium text-sm">Dane kontaktowe</h2>
          
          <div className="space-y-1">
            <Label className="text-xs">Imię i nazwisko *</Label>
            <Input placeholder="Jan Kowalski" className="h-8 text-sm" disabled />
          </div>

          <div className="space-y-1">
            <Label className="text-xs">E-mail *</Label>
            <Input type="email" placeholder="jan@example.com" className="h-8 text-sm" disabled />
          </div>

          <div className="space-y-1">
            <Label className="text-xs">Telefon *</Label>
            <Input type="tel" placeholder="+48 123 456 789" className="h-8 text-sm" disabled />
          </div>
        </div>

        {/* Vehicle Section */}
        <div className="rounded-lg p-3 shadow-sm space-y-3" style={{ backgroundColor: sectionBgColor, color: sectionTextColor }}>
          <h2 className="font-medium text-sm">Pojazd</h2>
          
          <div className="space-y-1">
            <Label className="text-xs">Model auta *</Label>
            <Input placeholder="BMW X5" className="h-8 text-sm" disabled />
          </div>

          <div className="space-y-1">
            <Label className="text-xs">Kolor lakieru *</Label>
            <Input placeholder="Czarny metalik" className="h-8 text-sm" disabled />
          </div>

          <div className="space-y-1">
            <Label className="text-xs">Rodzaj lakieru *</Label>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="flex-1 h-8 text-xs" disabled>
                Połysk
              </Button>
              <Button variant="outline" size="sm" className="flex-1 h-8 text-xs" disabled>
                Mat
              </Button>
            </div>
          </div>

          <div className="space-y-1">
            <Label className="text-xs">Przebieg (km)</Label>
            <Input type="number" placeholder="50000" className="h-8 text-sm" disabled />
          </div>
        </div>

        {/* Templates Section */}
        <div className="rounded-lg p-3 shadow-sm space-y-3" style={{ backgroundColor: sectionBgColor, color: sectionTextColor }}>
          <div>
            <h2 className="font-medium text-sm">Wybierz pakiet</h2>
            <p className="text-xs opacity-70">Możesz wybrać kilka</p>
          </div>
          
          <div className="space-y-2">
            {templates.map((template) => {
              const isSelected = selectedTemplates.has(template.id);
              const isExpanded = expandedDescriptions.has(template.id);
              const hasDurations = template.available_durations && template.available_durations.length > 0;
              
              return (
                <div key={template.id} className="space-y-2">
                  <button
                    type="button"
                    onClick={() => toggleTemplate(template.id)}
                    className="w-full text-left p-3 rounded-lg border-2 transition-all"
                    style={{
                      backgroundColor: isSelected ? selectedBgColor : sectionBgColor,
                      borderColor: isSelected ? selectedBorderColor : '#e5e7eb',
                      color: sectionTextColor,
                    }}
                  >
                    <div className="flex items-start gap-2">
                      <div 
                        className="w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 mt-0.5"
                        style={{
                          borderColor: isSelected ? primaryColor : '#9ca3af',
                          backgroundColor: isSelected ? primaryColor : 'transparent',
                        }}
                      >
                        {isSelected && <Check className="w-3 h-3" style={{ color: primaryTextColor }} />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <p className="font-medium text-sm">{template.name}</p>
                          {template.price_from && (
                            <span className="text-xs font-medium whitespace-nowrap" style={{ color: primaryColor }}>
                              od {template.price_from} zł
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </button>
                  
                  {/* Duration selection - only show if template is selected and has durations */}
                  {isSelected && hasDurations && (
                    <div className="ml-6 p-2 rounded-lg space-y-1.5" style={{ backgroundColor: `${primaryColor}10` }}>
                      <p className="text-xs font-medium">Pakiet powłoki:</p>
                      <div className="grid gap-1">
                        {template.available_durations!.map((months) => {
                          const isDurationSelected = durationSelections[template.id] === months;
                          return (
                            <label
                              key={months}
                              className="flex items-center gap-2 p-1.5 rounded cursor-pointer transition-colors"
                              style={{
                                backgroundColor: isDurationSelected ? selectedBgColor : 'transparent',
                              }}
                            >
                              <div
                                className="w-3 h-3 rounded-full border-2 flex items-center justify-center"
                                style={{
                                  borderColor: isDurationSelected ? primaryColor : '#9ca3af',
                                }}
                              >
                                {isDurationSelected && (
                                  <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: primaryColor }} />
                                )}
                              </div>
                              <span className="text-xs">{formatDuration(months)}</span>
                              <input
                                type="radio"
                                name={`duration-${template.id}`}
                                value={months}
                                checked={isDurationSelected}
                                onChange={() => setDurationSelection(template.id, months)}
                                className="sr-only"
                              />
                            </label>
                          );
                        })}
                        {/* "Nie wiem" option */}
                        {(() => {
                          const isNieWiemSelected = durationSelections[template.id] === null && template.id in durationSelections;
                          return (
                            <label
                              className="flex items-center gap-2 p-1.5 rounded cursor-pointer transition-colors"
                              style={{
                                backgroundColor: isNieWiemSelected ? selectedBgColor : 'transparent',
                              }}
                            >
                              <div
                                className="w-3 h-3 rounded-full border-2 flex items-center justify-center"
                                style={{
                                  borderColor: isNieWiemSelected ? primaryColor : '#9ca3af',
                                }}
                              >
                                {isNieWiemSelected && (
                                  <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: primaryColor }} />
                                )}
                              </div>
                              <span className="text-xs">Nie wiem, proszę o propozycję</span>
                              <input
                                type="radio"
                                name={`duration-${template.id}`}
                                value="null"
                                checked={isNieWiemSelected}
                                onChange={() => setDurationSelection(template.id, null)}
                                className="sr-only"
                              />
                            </label>
                          );
                        })()}
                      </div>
                    </div>
                  )}
                  
                  {template.description && (
                    <div className="mt-1 ml-6">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleDescription(template.id);
                        }}
                        className="text-xs hover:underline flex items-center gap-1"
                        style={{ color: primaryColor }}
                      >
                        Czytaj więcej...
                        {isExpanded ? (
                          <ChevronUp className="w-3 h-3" />
                        ) : (
                          <ChevronDown className="w-3 h-3" />
                        )}
                      </button>
                      {isExpanded && (
                        <p className="text-xs opacity-70 mt-1 whitespace-pre-wrap">
                          {template.description}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              );
            })}

            {templates.length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-4">
                Wybierz szablony w konfiguracji
              </p>
            )}
          </div>
        </div>

        {/* Extras Section */}
        {extras.length > 0 && (
          <div className="rounded-lg p-3 shadow-sm space-y-3" style={{ backgroundColor: sectionBgColor, color: sectionTextColor }}>
            <div>
              <h2 className="font-medium text-sm">Dodatki</h2>
              <p className="text-xs opacity-70">Opcjonalne usługi</p>
            </div>
            
            <div className="space-y-2">
              {extras.map((extra) => {
                const isSelected = selectedExtras.has(extra.id);
                return (
                  <button
                    key={extra.id}
                    type="button"
                    onClick={() => toggleExtra(extra.id)}
                    className="w-full text-left p-2 rounded-lg border transition-all flex items-center gap-2"
                    style={{
                      backgroundColor: isSelected ? selectedBgColor : sectionBgColor,
                      borderColor: isSelected ? selectedBorderColor : '#e5e7eb',
                      color: sectionTextColor,
                    }}
                  >
                    <div 
                      className="w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0"
                      style={{
                        borderColor: isSelected ? primaryColor : '#9ca3af',
                        backgroundColor: isSelected ? primaryColor : 'transparent',
                      }}
                    >
                      {isSelected && <Check className="w-3 h-3" style={{ color: primaryTextColor }} />}
                    </div>
                    <span className="text-sm">{extra.name}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Planned Date Section */}
        <div className="rounded-lg p-3 shadow-sm space-y-3" style={{ backgroundColor: sectionBgColor, color: sectionTextColor }}>
          <div>
            <h2 className="font-medium text-sm">Planowany termin realizacji</h2>
            <p className="text-xs opacity-70">Kiedy chciałbyś zrealizować usługę?</p>
          </div>
          
          <Button variant="outline" className="w-full h-8 justify-start text-sm" disabled>
            <Calendar className="w-4 h-4 mr-2" />
            Wybierz datę
          </Button>
        </div>

        {/* Budget & Notes Section */}
        <div className="rounded-lg p-3 shadow-sm space-y-3" style={{ backgroundColor: sectionBgColor, color: sectionTextColor }}>
          <h2 className="font-medium text-sm">Dodatkowe informacje</h2>
          
          <div className="space-y-1">
            <Label className="text-xs">Budżet (zł)</Label>
            <Input type="number" placeholder="np. 5000" className="h-8 text-sm" disabled />
          </div>

          <div className="space-y-1">
            <Label className="text-xs">Uwagi</Label>
            <Textarea 
              placeholder="Dodatkowe informacje..." 
              className="text-sm resize-none" 
              rows={2}
              disabled 
            />
          </div>
        </div>

        {/* GDPR Section */}
        <div className="rounded-lg p-3 shadow-sm" style={{ backgroundColor: sectionBgColor, color: sectionTextColor }}>
          <div className="flex items-start gap-2">
            <Checkbox disabled className="mt-0.5" />
            <p className="text-xs opacity-70">
              <span className="text-red-500 font-medium">*</span> Wyrażam zgodę na przetwarzanie moich danych osobowych...
            </p>
          </div>
        </div>

        {/* Submit Button */}
        <Button 
          className="w-full h-10" 
          disabled
          style={{ 
            backgroundColor: primaryColor, 
            color: primaryTextColor,
          }}
        >
          Wyślij zapytanie
        </Button>
      </div>
    </div>
  );
}
