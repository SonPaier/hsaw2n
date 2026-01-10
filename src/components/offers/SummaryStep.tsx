import { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { 
  User, 
  Building2, 
  Car, 
  FileText, 
  Calculator,
  Edit,
  Check,
  X,
  Eye
} from 'lucide-react';
import { CustomerData, VehicleData, OfferOption, OfferState, OfferItem } from '@/hooks/useOffer';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';

interface SummaryStepProps {
  instanceId: string;
  offer: OfferState;
  showUnitPrices: boolean;
  onUpdateOffer: (data: Partial<OfferState>) => void;
  onUpdateOption: (optionId: string, data: Partial<OfferOption>) => void;
  calculateOptionTotal: (option: OfferOption) => number;
  calculateTotalNet: () => number;
  calculateTotalGross: () => number;
  onShowPreview?: () => void;
}

interface OfferTemplate {
  id: string;
  name: string;
  payment_terms: string | null;
  notes: string | null;
}

const paintTypeLabels: Record<string, string> = {
  matte: 'Mat',
  dark: 'Ciemny',
  other: 'Inny',
};

const getPaintTypeLabel = (type: string) => paintTypeLabels[type] || type;

export const SummaryStep = ({
  instanceId,
  offer,
  showUnitPrices,
  onUpdateOffer,
  onUpdateOption,
  calculateOptionTotal,
  calculateTotalNet,
  calculateTotalGross,
  onShowPreview,
}: SummaryStepProps) => {
  const { t } = useTranslation();
  const [editingDiscount, setEditingDiscount] = useState<string | null>(null);
  const [tempDiscount, setTempDiscount] = useState('');
  const [templates, setTemplates] = useState<OfferTemplate[]>([]);
  const [scopes, setScopes] = useState<{ id: string; name: string }[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      // Fetch templates
      const { data: templatesData } = await supabase
        .from('text_blocks_library')
        .select('*')
        .eq('active', true)
        .eq('block_type', 'offer_template')
        .or(`instance_id.eq.${instanceId},source.eq.global`)
        .order('sort_order');
      
      if (templatesData) {
        setTemplates(templatesData.map(t => ({
          id: t.id,
          name: t.name,
          payment_terms: t.content.split('|||')[0] || null,
          notes: t.content.split('|||')[1] || null,
        })));
      }

      // Fetch scopes for grouping
      if (offer.selectedScopeIds.length > 0) {
        const { data: scopesData } = await supabase
          .from('offer_scopes')
          .select('id, name, sort_order')
          .in('id', offer.selectedScopeIds)
          .order('sort_order');
        
        if (scopesData) {
          setScopes(scopesData);
        }
      }
    };
    fetchData();
  }, [instanceId, offer.selectedScopeIds]);

  // Group options by scope
  const groupedOptions = useMemo(() => {
    const groups: { scopeId: string | null; scopeName: string; options: OfferOption[] }[] = [];
    
    // Group by scope
    for (const scope of scopes) {
      const scopeOptions = offer.options
        .filter(o => o.scopeId === scope.id && o.isSelected)
        .sort((a, b) => a.sortOrder - b.sortOrder);
      if (scopeOptions.length > 0) {
        groups.push({ scopeId: scope.id, scopeName: scope.name, options: scopeOptions });
      }
    }
    
    // Options without scope
    const noScopeOptions = offer.options.filter(o => !o.scopeId && o.isSelected);
    if (noScopeOptions.length > 0) {
      groups.push({ scopeId: null, scopeName: 'Inne', options: noScopeOptions });
    }
    
    return groups;
  }, [offer.options, scopes]);

  const formatPrice = (value: number) => {
    return new Intl.NumberFormat('pl-PL', {
      style: 'currency',
      currency: 'PLN',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(Math.round(value));
  };

  const handleGlobalDiscountStart = (optionId: string) => {
    setEditingDiscount(optionId);
    setTempDiscount('0');
  };

  const handleGlobalDiscountApply = (optionId: string, option: OfferOption) => {
    const discount = parseFloat(tempDiscount) || 0;
    const updatedItems = option.items.map(item => ({
      ...item,
      discountPercent: discount,
    }));
    onUpdateOption(optionId, { items: updatedItems });
    setEditingDiscount(null);
    setTempDiscount('');
  };


  const handleApplyTemplate = (template: OfferTemplate) => {
    onUpdateOffer({
      paymentTerms: template.payment_terms || offer.paymentTerms,
      notes: template.notes || offer.notes,
    });
  };

  const totalNet = calculateTotalNet();
  const totalGross = calculateTotalGross();
  const vatAmount = totalGross - totalNet;

  return (
    <div className="space-y-6">
      {/* Customer & Vehicle Summary - single Card */}
      <Card>
        <CardContent className="pt-6 space-y-6">
          {/* Customer Section */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 font-semibold">
              <User className="w-4 h-4 text-primary" />
              Klient
            </div>
            <div className="text-sm space-y-1 pl-6">
              <p className="font-medium">{offer.customerData.name || '—'}</p>
              <p className="text-muted-foreground">{offer.customerData.email || '—'}</p>
              {offer.customerData.phone && (
                <p className="text-muted-foreground">{offer.customerData.phone}</p>
              )}
            </div>
          </div>
          
          {/* Company Section */}
          {offer.customerData.company && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 font-semibold">
                <Building2 className="w-4 h-4 text-primary" />
                Firma
              </div>
              <div className="text-sm space-y-1 pl-6">
                <p className="font-medium">{offer.customerData.company}</p>
                {offer.customerData.nip && (
                  <p className="text-muted-foreground">NIP: {offer.customerData.nip}</p>
                )}
              </div>
            </div>
          )}

          {/* Vehicle Section */}
          {offer.vehicleData.brandModel && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 font-semibold">
                <Car className="w-4 h-4 text-primary" />
                Pojazd
              </div>
              <div className="text-sm space-y-1 pl-6">
                <p className="font-medium">{offer.vehicleData.brandModel}</p>
                {(offer.vehicleData.paintColor || offer.vehicleData.paintType) && (
                  <p className="text-muted-foreground">
                    {offer.vehicleData.paintColor}
                    {offer.vehicleData.paintColor && offer.vehicleData.paintType && ' • '}
                    {offer.vehicleData.paintType && getPaintTypeLabel(offer.vehicleData.paintType)}
                  </p>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Options Summary - grouped by scope */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <FileText className="w-4 h-4 text-primary" />
            Opcje wyceny
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {groupedOptions.map((group) => (
            <div key={group.scopeId || 'other'} className="space-y-3">
              {/* Scope header */}
              <h3 className="font-bold text-xl border-b pb-2">{group.scopeName}</h3>
              
              {group.options.map((option) => (
                <div
                  key={option.id}
                  className="space-y-3 py-3 border-b last:border-0"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-semibold text-lg">{option.name}</h4>
                      {option.description && (
                        <p className="text-sm text-muted-foreground">{option.description}</p>
                      )}
                    </div>
                    <div className="text-right">
                      <p className="font-semibold">{formatPrice(calculateOptionTotal(option))}</p>
                      <p className="text-xs text-muted-foreground">netto</p>
                    </div>
                  </div>

                  {/* Items - conditional based on showUnitPrices */}
                  {showUnitPrices ? (
                    <div className="text-sm">
                      <div className="grid grid-cols-12 gap-2 px-2 py-1 bg-muted/50 rounded text-xs font-medium text-muted-foreground">
                        <div className="col-span-5">Pozycja</div>
                        <div className="col-span-2 text-right">Ilość</div>
                        <div className="col-span-2 text-right">Cena</div>
                        <div className="col-span-1 text-right">Rabat</div>
                        <div className="col-span-2 text-right">Wartość</div>
                      </div>
                      {option.items.map((item) => {
                        const itemValue = item.quantity * item.unitPrice * (1 - item.discountPercent / 100);
                        return (
                          <div
                            key={item.id}
                            className="grid grid-cols-12 gap-2 px-2 py-2 border-b last:border-0"
                          >
                            <div className="col-span-5">
                              {item.customName}
                            </div>
                            <div className="col-span-2 text-right">
                              {item.quantity} {item.unit}
                            </div>
                            <div className="col-span-2 text-right">{formatPrice(item.unitPrice)}</div>
                            <div className="col-span-1 text-right">
                              {item.discountPercent > 0 && `-${item.discountPercent}%`}
                            </div>
                            <div className="col-span-2 text-right font-medium">
                              {formatPrice(itemValue)}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="text-sm space-y-1">
                      {option.items.map((item) => {
                        const itemValue = item.quantity * item.unitPrice * (1 - item.discountPercent / 100);
                        return (
                          <div
                            key={item.id}
                            className="flex justify-between py-1"
                          >
                            <span>{item.customName}</span>
                            <span className="font-medium">{formatPrice(itemValue)}</span>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Global discount edit */}
                  <div className="flex items-center gap-2 pt-2">
                    {editingDiscount === option.id ? (
                      <>
                        <Input
                          type="number"
                          value={tempDiscount}
                          onChange={(e) => setTempDiscount(e.target.value)}
                          className="w-20 h-8"
                          min={0}
                          max={100}
                        />
                        <span className="text-sm">%</span>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8"
                          onClick={() => handleGlobalDiscountApply(option.id, option)}
                        >
                          <Check className="w-4 h-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8"
                          onClick={() => setEditingDiscount(null)}
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      </>
                    ) : (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleGlobalDiscountStart(option.id)}
                        className="gap-1 text-muted-foreground"
                      >
                        <Edit className="w-3 h-3" />
                        Ustaw rabat dla całej opcji
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ))}
        </CardContent>
      </Card>


      {/* Totals */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Calculator className="w-4 h-4 text-primary" />
            Podsumowanie
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Suma netto</span>
              <span className="font-medium">{formatPrice(totalNet)}</span>
            </div>
            <div className="flex justify-between items-center text-sm">
              <div className="flex items-center gap-2">
                <span>VAT</span>
                <Select
                  value={offer.vatRate.toString()}
                  onValueChange={(val) => onUpdateOffer({ vatRate: parseInt(val) })}
                >
                  <SelectTrigger className="w-20 h-7">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="23">23%</SelectItem>
                    <SelectItem value="8">8%</SelectItem>
                    <SelectItem value="5">5%</SelectItem>
                    <SelectItem value="0">0%</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <span className="font-medium">{formatPrice(vatAmount)}</span>
            </div>
            <Separator />
            <div className="flex justify-between text-lg font-bold">
              <span>Razem brutto</span>
              <span className="text-primary">{formatPrice(totalGross)}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Notes & Terms - 4 sections */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Warunki oferty</CardTitle>
            {templates.length > 0 && (
              <Select onValueChange={(id) => {
                const template = templates.find(t => t.id === id);
                if (template) handleApplyTemplate(template);
              }}>
                <SelectTrigger className="w-auto h-8">
                  <span className="text-sm">Wczytaj szablon</span>
                </SelectTrigger>
                <SelectContent>
                  {templates.map(t => (
                    <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="validUntil">Oferta ważna do</Label>
            <Input
              id="validUntil"
              type="date"
              value={offer.validUntil || ''}
              onChange={(e) => onUpdateOffer({ validUntil: e.target.value })}
            />
          </div>
          <Separator />
          <div className="space-y-2">
            <Label htmlFor="paymentTerms">Warunki płatności</Label>
            <Textarea
              id="paymentTerms"
              value={offer.paymentTerms || ''}
              onChange={(e) => onUpdateOffer({ paymentTerms: e.target.value })}
              rows={4}
              placeholder="Np. zaliczka 30%, pozostała kwota przy odbiorze..."
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="warranty">Warunki gwarancji</Label>
            <Textarea
              id="warranty"
              value={offer.warranty || ''}
              onChange={(e) => onUpdateOffer({ warranty: e.target.value })}
              rows={4}
              placeholder="Np. 10 lat gwarancji producenta, 2 lata gwarancji na montaż..."
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="serviceInfo">Oferta obejmuje</Label>
            <Textarea
              id="serviceInfo"
              value={offer.serviceInfo || ''}
              onChange={(e) => onUpdateOffer({ serviceInfo: e.target.value })}
              rows={4}
              placeholder="Np. kompleksowe czyszczenie pojazdu, dekontaminacja lakieru..."
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="notes">Inne informacje</Label>
            <Textarea
              id="notes"
              value={offer.notes || ''}
              onChange={(e) => onUpdateOffer({ notes: e.target.value })}
              rows={4}
              placeholder="Dodatkowe uwagi..."
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
};