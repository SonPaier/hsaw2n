import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
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
  Plus,
  Trash2,
  Package
} from 'lucide-react';
import { CustomerData, VehicleData, OfferOption, OfferState, OfferItem } from '@/hooks/useOffer';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';

interface SummaryStepProps {
  instanceId: string;
  offer: OfferState;
  onUpdateOffer: (data: Partial<OfferState>) => void;
  onUpdateOption: (optionId: string, data: Partial<OfferOption>) => void;
  calculateOptionTotal: (option: OfferOption) => number;
  calculateTotalNet: () => number;
  calculateTotalGross: () => number;
  additions: OfferItem[];
  onAddAddition: (item: Omit<OfferItem, 'id'>) => string;
  onUpdateAddition: (itemId: string, data: Partial<OfferItem>) => void;
  onRemoveAddition: (itemId: string) => void;
  calculateAdditionsTotal: () => number;
}

interface OfferTemplate {
  id: string;
  name: string;
  payment_terms: string | null;
  notes: string | null;
}

export const SummaryStep = ({
  instanceId,
  offer,
  onUpdateOffer,
  onUpdateOption,
  calculateOptionTotal,
  calculateTotalNet,
  calculateTotalGross,
  additions,
  onAddAddition,
  onUpdateAddition,
  onRemoveAddition,
  calculateAdditionsTotal,
}: SummaryStepProps) => {
  const [editingDiscount, setEditingDiscount] = useState<string | null>(null);
  const [tempDiscount, setTempDiscount] = useState('');
  const [templates, setTemplates] = useState<OfferTemplate[]>([]);

  useEffect(() => {
    const fetchTemplates = async () => {
      const { data } = await supabase
        .from('text_blocks_library')
        .select('*')
        .eq('active', true)
        .eq('block_type', 'offer_template')
        .or(`instance_id.eq.${instanceId},source.eq.global`)
        .order('sort_order');
      
      if (data) {
        setTemplates(data.map(t => ({
          id: t.id,
          name: t.name,
          payment_terms: t.content.split('|||')[0] || null,
          notes: t.content.split('|||')[1] || null,
        })));
      }
    };
    fetchTemplates();
  }, [instanceId]);

  const formatPrice = (value: number) => {
    return new Intl.NumberFormat('pl-PL', {
      style: 'currency',
      currency: 'PLN',
    }).format(value);
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

  const handleAddAddition = () => {
    onAddAddition({
      productId: undefined,
      customName: '',
      customDescription: '',
      quantity: 1,
      unitPrice: 0,
      unit: 'szt',
      discountPercent: 0,
      isOptional: false,
      isCustom: true,
    });
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
  const additionsTotal = calculateAdditionsTotal();

  return (
    <div className="space-y-6">
      {/* Customer & Vehicle Summary */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <User className="w-4 h-4 text-primary" />
              Klient
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm space-y-1">
            <p className="font-medium">{offer.customerData.name || '—'}</p>
            <p className="text-muted-foreground">{offer.customerData.email || '—'}</p>
            {offer.customerData.phone && (
              <p className="text-muted-foreground">{offer.customerData.phone}</p>
            )}
            {offer.customerData.company && (
              <div className="pt-2 flex items-center gap-2">
                <Building2 className="w-3 h-3" />
                <span>{offer.customerData.company}</span>
                {offer.customerData.nip && (
                  <span className="text-muted-foreground">NIP: {offer.customerData.nip}</span>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {offer.vehicleData.brandModel && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Car className="w-4 h-4 text-primary" />
                Pojazd
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm space-y-1">
              <p className="font-medium">{offer.vehicleData.brandModel}</p>
              {offer.vehicleData.plate && (
                <p className="text-muted-foreground">{offer.vehicleData.plate}</p>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      {/* Options Summary */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <FileText className="w-4 h-4 text-primary" />
            Opcje wyceny
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {offer.options.map((option) => (
            <div
              key={option.id}
              className={cn(
                "border rounded-lg p-4 space-y-3",
                option.isSelected ? "border-primary/50 bg-primary/5" : "border-border opacity-60"
              )}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Checkbox
                    checked={option.isSelected}
                    onCheckedChange={(checked) => 
                      onUpdateOption(option.id, { isSelected: !!checked })
                    }
                  />
                  <div>
                    <h4 className="font-medium">{option.name}</h4>
                    {option.description && (
                      <p className="text-sm text-muted-foreground">{option.description}</p>
                    )}
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-semibold">{formatPrice(calculateOptionTotal(option))}</p>
                  <p className="text-xs text-muted-foreground">netto</p>
                </div>
              </div>

              {/* Items table */}
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
                      className={cn(
                        "grid grid-cols-12 gap-2 px-2 py-2 border-b last:border-0",
                        item.isOptional && "text-muted-foreground italic"
                      )}
                    >
                      <div className="col-span-5 flex items-center gap-1">
                        {item.isOptional && <Badge variant="outline" className="text-xs px-1">OPC</Badge>}
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
                        {item.isOptional ? '—' : formatPrice(itemValue)}
                      </div>
                    </div>
                  );
                })}
              </div>

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
        </CardContent>
      </Card>

      {/* Additions Section */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Package className="w-4 h-4 text-primary" />
            Dodatki
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {additions.length > 0 && (
            <div className="text-sm">
              <div className="grid grid-cols-12 gap-2 px-2 py-1 bg-muted/50 rounded text-xs font-medium text-muted-foreground">
                <div className="col-span-4">Nazwa</div>
                <div className="col-span-2 text-center">Ilość</div>
                <div className="col-span-1 text-center">J.m.</div>
                <div className="col-span-2 text-center">Cena</div>
                <div className="col-span-2 text-right">Wartość</div>
                <div className="col-span-1"></div>
              </div>
              {additions.map((item) => {
                const itemValue = item.quantity * item.unitPrice * (1 - item.discountPercent / 100);
                return (
                  <div
                    key={item.id}
                    className="grid grid-cols-12 gap-2 px-2 py-2 border-b last:border-0 items-center"
                  >
                    <div className="col-span-4">
                      <Input
                        value={item.customName || ''}
                        onChange={(e) => onUpdateAddition(item.id, { customName: e.target.value })}
                        className="h-8"
                      />
                    </div>
                    <div className="col-span-2">
                      <Input
                        type="number"
                        value={item.quantity}
                        onChange={(e) => onUpdateAddition(item.id, { quantity: parseFloat(e.target.value) || 0 })}
                        min={0}
                        step={0.01}
                        className="h-8 text-center"
                      />
                    </div>
                    <div className="col-span-1">
                      <Input
                        value={item.unit}
                        onChange={(e) => onUpdateAddition(item.id, { unit: e.target.value })}
                        className="h-8 text-center"
                      />
                    </div>
                    <div className="col-span-2">
                      <Input
                        type="number"
                        value={item.unitPrice}
                        onChange={(e) => onUpdateAddition(item.id, { unitPrice: parseFloat(e.target.value) || 0 })}
                        min={0}
                        step={0.01}
                        className="h-8 text-center"
                      />
                    </div>
                    <div className="col-span-2 text-right font-medium">
                      {formatPrice(itemValue)}
                    </div>
                    <div className="col-span-1 flex justify-end">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => onRemoveAddition(item.id)}
                        className="h-8 w-8 text-destructive hover:text-destructive"
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>
                );
              })}
              {additions.length > 0 && (
                <div className="flex justify-end px-2 py-2 font-medium">
                  Suma dodatków: {formatPrice(additionsTotal)}
                </div>
              )}
            </div>
          )}
          
          <Button
            variant="outline"
            size="sm"
            onClick={handleAddAddition}
            className="gap-1"
          >
            <Plus className="w-3 h-3" />
            Dodaj pozycję
          </Button>
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

      {/* Notes & Terms */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Dodatkowe informacje</CardTitle>
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
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="hideUnitPrices">Ukryj ceny jednostkowe</Label>
              <p className="text-sm text-muted-foreground">
                Klient zobaczy tylko cenę końcową opcji, bez rozbicia na pozycje
              </p>
            </div>
            <Switch
              id="hideUnitPrices"
              checked={offer.hideUnitPrices}
              onCheckedChange={(checked) => onUpdateOffer({ hideUnitPrices: checked })}
            />
          </div>
          <Separator />
          <div className="space-y-2">
            <Label htmlFor="validUntil">Oferta ważna do</Label>
            <Input
              id="validUntil"
              type="date"
              value={offer.validUntil || ''}
              onChange={(e) => onUpdateOffer({ validUntil: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="paymentTerms">Warunki płatności</Label>
            <Input
              id="paymentTerms"
              value={offer.paymentTerms || ''}
              onChange={(e) => onUpdateOffer({ paymentTerms: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="notes">Uwagi</Label>
            <Textarea
              id="notes"
              value={offer.notes || ''}
              onChange={(e) => onUpdateOffer({ notes: e.target.value })}
              rows={4}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
