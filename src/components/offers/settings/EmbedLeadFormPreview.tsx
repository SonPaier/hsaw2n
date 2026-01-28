import { useState } from 'react';
import { Check, ChevronDown, ChevronUp, Calendar } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';

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

interface EmbedLeadFormPreviewProps {
  templates: Template[];
  extras: Extra[];
}

// Helper to format duration in Polish
const formatDuration = (months: number): string => {
  const years = months / 12;
  if (years === 1) return '1 rok';
  if (years < 5) return `${years} lata`;
  return `${years} lat`;
};

export default function EmbedLeadFormPreview({ templates, extras }: EmbedLeadFormPreviewProps) {
  const [expandedDescriptions, setExpandedDescriptions] = useState<Set<string>>(new Set());
  const [selectedTemplates, setSelectedTemplates] = useState<Set<string>>(new Set());
  const [selectedExtras, setSelectedExtras] = useState<Set<string>>(new Set());
  const [durationSelections, setDurationSelections] = useState<Record<string, number | null>>({});

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
    <div className="p-4 bg-slate-50 min-h-full">
      <div className="max-w-md mx-auto space-y-4">
        {/* Header */}
        <div className="text-center mb-4">
          <h1 className="text-lg font-bold">Zapytaj o wycenę</h1>
          <p className="text-sm text-muted-foreground">Wypełnij formularz</p>
        </div>

        {/* Customer Section */}
        <div className="bg-white rounded-lg p-3 shadow-sm space-y-3">
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
        <div className="bg-white rounded-lg p-3 shadow-sm space-y-3">
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
        <div className="bg-white rounded-lg p-3 shadow-sm space-y-3">
          <div>
            <h2 className="font-medium text-sm">Wybierz pakiet</h2>
            <p className="text-xs text-muted-foreground">Możesz wybrać kilka</p>
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
                    className={cn(
                      "w-full text-left p-3 rounded-lg border-2 transition-all",
                      isSelected 
                        ? "border-blue-500 bg-blue-50" 
                        : "border-gray-200 hover:border-blue-300"
                    )}
                  >
                    <div className="flex items-start gap-2">
                      <div 
                        className={cn(
                          "w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 mt-0.5",
                          isSelected ? "border-blue-500 bg-blue-500" : "border-gray-400"
                        )}
                      >
                        {isSelected && <Check className="w-3 h-3 text-white" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <p className="font-medium text-sm">{template.name}</p>
                          {template.price_from && (
                            <span className="text-xs font-medium text-blue-600 whitespace-nowrap">
                              od {template.price_from} zł
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </button>
                  
                  {/* Duration selection - only show if template is selected and has durations */}
                  {isSelected && hasDurations && (
                    <div className="ml-6 p-2 bg-muted/30 rounded-lg space-y-1.5">
                      <p className="text-xs font-medium">Pakiet powłoki:</p>
                      <div className="grid gap-1">
                        {template.available_durations!.map((months) => (
                          <label
                            key={months}
                            className={cn(
                              "flex items-center gap-2 p-1.5 rounded cursor-pointer transition-colors",
                              durationSelections[template.id] === months
                                ? "bg-blue-100"
                                : "hover:bg-muted/50"
                            )}
                          >
                            <div
                              className={cn(
                                "w-3 h-3 rounded-full border-2 flex items-center justify-center",
                                durationSelections[template.id] === months
                                  ? "border-blue-500"
                                  : "border-gray-400"
                              )}
                            >
                              {durationSelections[template.id] === months && (
                                <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                              )}
                            </div>
                            <span className="text-xs">{formatDuration(months)}</span>
                            <input
                              type="radio"
                              name={`duration-${template.id}`}
                              value={months}
                              checked={durationSelections[template.id] === months}
                              onChange={() => setDurationSelection(template.id, months)}
                              className="sr-only"
                            />
                          </label>
                        ))}
                        {/* "Nie wiem" option */}
                        <label
                          className={cn(
                            "flex items-center gap-2 p-1.5 rounded cursor-pointer transition-colors",
                            durationSelections[template.id] === null && template.id in durationSelections
                              ? "bg-blue-100"
                              : "hover:bg-muted/50"
                          )}
                        >
                          <div
                            className={cn(
                              "w-3 h-3 rounded-full border-2 flex items-center justify-center",
                              durationSelections[template.id] === null && template.id in durationSelections
                                ? "border-blue-500"
                                : "border-gray-400"
                            )}
                          >
                            {durationSelections[template.id] === null && template.id in durationSelections && (
                              <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                            )}
                          </div>
                          <span className="text-xs">Nie wiem, proszę o propozycję</span>
                          <input
                            type="radio"
                            name={`duration-${template.id}`}
                            value="null"
                            checked={durationSelections[template.id] === null && template.id in durationSelections}
                            onChange={() => setDurationSelection(template.id, null)}
                            className="sr-only"
                          />
                        </label>
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
                        className="text-xs text-blue-600 hover:underline flex items-center gap-1"
                      >
                        Czytaj więcej...
                        {isExpanded ? (
                          <ChevronUp className="w-3 h-3" />
                        ) : (
                          <ChevronDown className="w-3 h-3" />
                        )}
                      </button>
                      {isExpanded && (
                        <p className="text-xs text-muted-foreground mt-1 whitespace-pre-wrap">
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
          <div className="bg-white rounded-lg p-3 shadow-sm space-y-3">
            <div>
              <h2 className="font-medium text-sm">Dodatki</h2>
              <p className="text-xs text-muted-foreground">Opcjonalne usługi</p>
            </div>
            
            <div className="space-y-2">
              {extras.map((extra) => {
                const isSelected = selectedExtras.has(extra.id);
                return (
                  <button
                    key={extra.id}
                    type="button"
                    onClick={() => toggleExtra(extra.id)}
                    className={cn(
                      "w-full text-left p-2 rounded-lg border transition-all flex items-center gap-2",
                      isSelected 
                        ? "border-blue-500 bg-blue-50" 
                        : "border-gray-200 hover:border-blue-300"
                    )}
                  >
                    <div 
                      className={cn(
                        "w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0",
                        isSelected ? "border-blue-500 bg-blue-500" : "border-gray-400"
                      )}
                    >
                      {isSelected && <Check className="w-3 h-3 text-white" />}
                    </div>
                    <span className="text-sm">{extra.name}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Planned Date Section */}
        <div className="bg-white rounded-lg p-3 shadow-sm space-y-3">
          <div>
            <h2 className="font-medium text-sm">Planowany termin realizacji</h2>
            <p className="text-xs text-muted-foreground">Kiedy chciałbyś zrealizować usługę?</p>
          </div>
          
          <Button variant="outline" className="w-full h-8 justify-start text-sm" disabled>
            <Calendar className="w-4 h-4 mr-2" />
            Wybierz datę
          </Button>
        </div>

        {/* Budget & Notes Section */}
        <div className="bg-white rounded-lg p-3 shadow-sm space-y-3">
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
        <div className="bg-white rounded-lg p-3 shadow-sm">
          <div className="flex items-start gap-2">
            <Checkbox disabled className="mt-0.5" />
            <p className="text-xs text-muted-foreground">
              Wyrażam zgodę na przetwarzanie moich danych osobowych...
            </p>
          </div>
        </div>

        {/* Submit Button */}
        <Button className="w-full h-10" disabled>
          Wyślij zapytanie
        </Button>
      </div>
    </div>
  );
}
