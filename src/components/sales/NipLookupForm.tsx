import { useState } from 'react';
import { Search, Loader2, Building2, ChevronDown } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface NipData {
  nip: string;
  company: string;
  billingStreet: string;
  billingPostalCode: string;
  billingCity: string;
}

interface NipLookupFormProps {
  value: NipData;
  onChange: (data: NipData) => void;
  readOnly?: boolean;
  defaultOpen?: boolean;
}

const NipLookupForm = ({ value, onChange, readOnly = false, defaultOpen = false }: NipLookupFormProps) => {
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(defaultOpen || !!value.nip);

  const lookupNip = async () => {
    const cleanNip = value.nip.replace(/[^0-9]/g, '');
    if (cleanNip.length !== 10) {
      toast.error('NIP musi mieć 10 cyfr');
      return;
    }

    setLoading(true);
    try {
      const today = new Date().toISOString().split('T')[0];
      const res = await fetch(`https://wl-api.mf.gov.pl/api/search/nip/${cleanNip}?date=${today}`);
      if (!res.ok) throw new Error('Nie znaleziono podmiotu');
      const json = await res.json();
      const subject = json?.result?.subject;
      if (!subject) throw new Error('Brak danych');

      const addr = subject.residenceAddress || subject.workingAddress || '';
      let street = '';
      let postalCode = '';
      let city = '';

      if (typeof addr === 'string') {
        // Format: "ul. Przykładowa 1, 00-000 Miasto"
        const parts = addr.split(',').map((s: string) => s.trim());
        if (parts.length >= 2) {
          street = parts[0];
          const cityPart = parts[parts.length - 1];
          const pcMatch = cityPart.match(/(\d{2}-\d{3})\s*(.*)/);
          if (pcMatch) {
            postalCode = pcMatch[1];
            city = pcMatch[2];
          } else {
            city = cityPart;
          }
        } else {
          street = addr;
        }
      }

      onChange({
        nip: cleanNip,
        company: subject.name || '',
        billingStreet: street,
        billingPostalCode: postalCode,
        billingCity: city,
      });
      toast.success('Dane pobrane z GUS');
    } catch (err: any) {
      toast.error(err.message || 'Błąd pobierania danych');
    } finally {
      setLoading(false);
    }
  };

  if (readOnly) {
    if (!value.nip && !value.company) return null;
    return (
      <div className="space-y-3">
        <h4 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
          <Building2 className="w-4 h-4" />
          Dane firmy
        </h4>
        <div className="grid grid-cols-2 gap-4 text-sm">
          {value.nip && (
            <div>
              <p className="text-xs text-muted-foreground">NIP</p>
              <p className="font-medium">{value.nip}</p>
            </div>
          )}
          {value.company && (
            <div className="col-span-2">
              <p className="text-xs text-muted-foreground">Nazwa firmy</p>
              <p className="font-medium">{value.company}</p>
            </div>
          )}
          {value.billingStreet && (
            <div className="col-span-2">
              <p className="text-xs text-muted-foreground">Adres faktury</p>
              <p className="font-medium">
                {value.billingStreet}
                {value.billingPostalCode || value.billingCity
                  ? `, ${value.billingPostalCode} ${value.billingCity}`
                  : ''}
              </p>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger asChild>
        <button
          type="button"
          className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors w-full"
        >
          <Building2 className="w-4 h-4" />
          Dane firmy
          <ChevronDown className={cn('w-4 h-4 ml-auto transition-transform', open && 'rotate-180')} />
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent className="space-y-3 pt-3">
        <div className="flex gap-2 items-end">
          <div className="flex-1">
            <Label htmlFor="nip">NIP</Label>
            <Input
              id="nip"
              placeholder="0000000000"
              value={value.nip}
              onChange={(e) => onChange({ ...value, nip: e.target.value })}
            />
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-1.5 shrink-0"
            onClick={lookupNip}
            disabled={loading}
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            Pobierz z GUS
          </Button>
        </div>
        <div>
          <Label htmlFor="company">Nazwa firmy</Label>
          <Input
            id="company"
            value={value.company}
            onChange={(e) => onChange({ ...value, company: e.target.value })}
          />
        </div>
        <div>
          <Label htmlFor="billing-street">Ulica</Label>
          <Input
            id="billing-street"
            value={value.billingStreet}
            onChange={(e) => onChange({ ...value, billingStreet: e.target.value })}
          />
        </div>
        <div className="grid grid-cols-[120px_1fr] gap-2">
          <div>
            <Label htmlFor="billing-postal">Kod pocztowy</Label>
            <Input
              id="billing-postal"
              placeholder="00-000"
              value={value.billingPostalCode}
              onChange={(e) => onChange({ ...value, billingPostalCode: e.target.value })}
            />
          </div>
          <div>
            <Label htmlFor="billing-city">Miasto</Label>
            <Input
              id="billing-city"
              value={value.billingCity}
              onChange={(e) => onChange({ ...value, billingCity: e.target.value })}
            />
          </div>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
};

export default NipLookupForm;
