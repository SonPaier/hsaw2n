import { useState, useRef, useEffect, forwardRef, useImperativeHandle } from 'react';
import { useTranslation } from 'react-i18next';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { User, Building2, Car, Search, Loader2 } from 'lucide-react';
import { CustomerData, VehicleData } from '@/hooks/useOffer';
import { toast } from 'sonner';
import { CarSearchAutocomplete, CarSearchValue } from '@/components/ui/car-search-autocomplete';

export interface ValidationErrors {
  name?: string;
  email?: string;
  brandModel?: string;
}

export interface CustomerDataStepHandle {
  scrollToFirstError: (errors: ValidationErrors) => void;
}

interface CustomerDataStepProps {
  customerData: CustomerData;
  vehicleData: VehicleData;
  onCustomerChange: (data: Partial<CustomerData>) => void;
  onVehicleChange: (data: Partial<VehicleData>) => void;
  validationErrors?: ValidationErrors;
  internalNotes?: string;
  onInternalNotesChange?: (value: string) => void;
}

// Parse address from API format: "ULICA NR, KOD MIASTO" or "ULICA NR/LOKAL, KOD MIASTO"
const parseAddress = (fullAddress: string) => {
  if (!fullAddress) return { street: '', postalCode: '', city: '' };
  
  // Try to match pattern: "STREET, POSTAL_CODE CITY"
  const match = fullAddress.match(/^(.+),\s*(\d{2}-\d{3})\s+(.+)$/);
  if (match) {
    return {
      street: match[1].trim(),
      postalCode: match[2].trim(),
      city: match[3].trim(),
    };
  }
  
  // Fallback - just return the full address as street
  return { street: fullAddress, postalCode: '', city: '' };
};

const paintTypes = [
  { value: 'gloss', label: 'Połysk' },
  { value: 'matte', label: 'Mat' },
];

// Auto-resizing textarea component
interface AutoResizeTextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  minRows?: number;
}

const AutoResizeTextarea = ({ value, minRows = 3, className, ...props }: AutoResizeTextareaProps) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      const lineHeight = parseInt(getComputedStyle(textarea).lineHeight) || 20;
      const minHeight = lineHeight * minRows;
      textarea.style.height = `${Math.max(minHeight, textarea.scrollHeight)}px`;
    }
  }, [value, minRows]);

  return (
    <Textarea
      ref={textareaRef}
      value={value}
      className={cn('resize-none overflow-hidden', className)}
      {...props}
    />
  );
};

export const CustomerDataStep = forwardRef<CustomerDataStepHandle, CustomerDataStepProps>(
  ({ customerData, vehicleData, onCustomerChange, onVehicleChange, validationErrors, internalNotes, onInternalNotesChange }, ref) => {
  const { t } = useTranslation();
  const [nipLoading, setNipLoading] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [showManualCompany, setShowManualCompany] = useState(
    !!customerData.company || !!customerData.nip || !!customerData.companyAddress
  );

  // Refs for scroll-to-error
  const nameInputRef = useRef<HTMLInputElement>(null);
  const emailInputRef = useRef<HTMLInputElement>(null);
  const brandModelRef = useRef<HTMLDivElement>(null);

  // Expose scrollToFirstError method to parent
  useImperativeHandle(ref, () => ({
    scrollToFirstError: (errors: ValidationErrors) => {
      if (errors.name && nameInputRef.current) {
        nameInputRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
        nameInputRef.current.focus();
      } else if (errors.email && emailInputRef.current) {
        emailInputRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
        emailInputRef.current.focus();
      } else if (errors.brandModel && brandModelRef.current) {
        brandModelRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
        // Focus the input inside the autocomplete if possible
        const input = brandModelRef.current.querySelector('input');
        if (input) input.focus();
      }
    }
  }));

  const validateEmail = (email: string): string | null => {
    if (!email) return null; // Empty is valid (will be caught by required validation)
    
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return 'Nieprawidłowy format adresu email';
    }
    
    // Check for common domain typos
    const domain = email.split('@')[1]?.toLowerCase() || '';
    
    // Gmail typos
    if (domain.match(/^g?mail\.com[a-z]+/i) || domain.match(/^gmail\.[a-z]{2,}\.[a-z]+$/i)) {
      return 'Sprawdź domenę - czy chodziło o gmail.com?';
    }
    if (domain === 'gmial.com' || domain === 'gmal.com' || domain === 'gmali.com' || domain === 'gmaill.com') {
      return 'Sprawdź domenę - czy chodziło o gmail.com?';
    }
    
    // Other common typos
    if (domain.match(/\.(com|pl|eu|net|org)[a-z]+$/i)) {
      return 'Sprawdź domenę - wygląda na literówkę';
    }
    
    // Double dots in domain
    if (domain.includes('..')) {
      return 'Nieprawidłowa domena - podwójna kropka';
    }
    
    return null;
  };

  const sanitizeEmail = (email: string): string => {
    // Remove mailto: prefix (case-insensitive) and trim whitespace
    return email.replace(/^mailto:/i, '').trim();
  };

  const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const email = e.target.value;
    onCustomerChange({ email });
    
    const error = validateEmail(email);
    setEmailError(error);
  };

  const handleEmailPaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    const pastedText = e.clipboardData.getData('text');
    
    // Check if pasted text contains mailto:
    if (pastedText.toLowerCase().startsWith('mailto:')) {
      e.preventDefault(); // Prevent default paste
      const cleanEmail = sanitizeEmail(pastedText);
      onCustomerChange({ email: cleanEmail });
      
      // Also validate the cleaned email
      const error = validateEmail(cleanEmail);
      setEmailError(error);
    }
  };

  const lookupNip = async () => {
    const nip = customerData.nip?.replace(/[^0-9]/g, '');
    if (!nip || nip.length !== 10) {
      toast.error('Wprowadź poprawny NIP (10 cyfr)');
      return;
    }

    setNipLoading(true);
    try {
      // Use White List API from Polish Ministry of Finance
      const today = new Date().toISOString().split('T')[0];
      const response = await fetch(
        `https://wl-api.mf.gov.pl/api/search/nip/${nip}?date=${today}`
      );
      
      if (!response.ok) {
        throw new Error('Nie znaleziono firmy');
      }

      const data = await response.json();
      
      if (data.result?.subject) {
        const subject = data.result.subject;
        const addressStr = subject.workingAddress || subject.residenceAddress || '';
        const parsed = parseAddress(addressStr);
        
        onCustomerChange({
          company: subject.name,
          companyAddress: parsed.street,
          companyPostalCode: parsed.postalCode,
          companyCity: parsed.city,
        });
        setShowManualCompany(true);
      } else {
        toast.error('Nie znaleziono firmy o podanym NIP');
      }
    } catch (error) {
      console.error('NIP lookup error:', error);
      toast.error('Nie udało się pobrać danych firmy');
    } finally {
      setNipLoading(false);
    }
  };

  // Determine if field has validation error
  const hasNameError = !!validationErrors?.name;
  const hasEmailError = !!validationErrors?.email || !!emailError;
  const hasBrandModelError = !!validationErrors?.brandModel;

  return (
    <div className="space-y-8">
      {/* Customer Info Section */}
      <div className="space-y-4">
        <div className="flex items-center gap-2 text-lg font-semibold">
          <User className="w-5 h-5 text-primary" />
          Dane klienta
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="customerName">Imię i nazwisko *</Label>
            <Input
              ref={nameInputRef}
              id="customerName"
              value={customerData.name}
              onChange={(e) => onCustomerChange({ name: e.target.value })}
              className={hasNameError ? 'border-red-500 focus-visible:ring-red-500' : ''}
            />
            {validationErrors?.name && (
              <p className="text-sm text-red-500">{validationErrors.name}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="customerEmail">Email *</Label>
            <Input
              ref={emailInputRef}
              id="customerEmail"
              type="email"
              value={customerData.email}
              onChange={handleEmailChange}
              onPaste={handleEmailPaste}
              className={hasEmailError ? 'border-red-500 focus-visible:ring-red-500' : ''}
            />
            {(validationErrors?.email || emailError) && (
              <p className="text-sm text-red-500">{validationErrors?.email || emailError}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="customerPhone">Telefon</Label>
            <Input
              id="customerPhone"
              value={customerData.phone}
              onChange={(e) => onCustomerChange({ phone: e.target.value })}
            />
          </div>
        </div>
        
        {/* Inquiry Content & Internal Notes */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="inquiryContent">Treść zapytania</Label>
            <AutoResizeTextarea
              id="inquiryContent"
              value={customerData.inquiryContent || ''}
              onChange={(e) => onCustomerChange({ inquiryContent: e.target.value })}
              placeholder="Treść zapytania od klienta..."
              minRows={3}
            />
          </div>
          {onInternalNotesChange && (
            <div className="space-y-2">
              <Label htmlFor="internalNotes">Notatka wewnętrzna (tylko dla admina)</Label>
              <AutoResizeTextarea
                id="internalNotes"
                value={internalNotes || ''}
                onChange={(e) => onInternalNotesChange(e.target.value)}
                placeholder="Notatki widoczne tylko w panelu admina..."
                minRows={3}
              />
            </div>
          )}
        </div>
      </div>

      {/* Company Info Section */}
      <div className="space-y-4">
        <div className="flex items-center gap-2 text-lg font-semibold">
          <Building2 className="w-5 h-5 text-primary" />
          Dane firmy (opcjonalne)
        </div>
        {!showManualCompany ? (
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1 flex gap-2">
              <div className="flex-1 space-y-2">
                <Label htmlFor="companyNipSearch">NIP</Label>
                <Input
                  id="companyNipSearch"
                  value={customerData.nip}
                  onChange={(e) => onCustomerChange({ nip: e.target.value })}
                />
              </div>
              <div className="flex items-end">
                <Button
                  variant="outline"
                  onClick={lookupNip}
                  disabled={nipLoading}
                  className="gap-2"
                >
                  {nipLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Search className="w-4 h-4" />
                  )}
                  Pobierz dane
                </Button>
              </div>
            </div>
            <div className="flex items-end">
              <Button
                variant="ghost"
                onClick={() => setShowManualCompany(true)}
              >
                Wprowadź ręcznie
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="companyName">Nazwa firmy</Label>
                <Input
                  id="companyName"
                  value={customerData.company}
                  onChange={(e) => onCustomerChange({ company: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="companyNip">NIP</Label>
                <div className="flex gap-2">
                  <Input
                    id="companyNip"
                    value={customerData.nip}
                    onChange={(e) => onCustomerChange({ nip: e.target.value })}
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={lookupNip}
                    disabled={nipLoading}
                    title="Pobierz dane z NIP"
                  >
                    {nipLoading ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Search className="w-4 h-4" />
                    )}
                  </Button>
                </div>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="companyAddress">Adres (ulica i numer)</Label>
              <Input
                id="companyAddress"
                value={customerData.companyAddress}
                onChange={(e) => onCustomerChange({ companyAddress: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="companyPostalCode">Kod pocztowy</Label>
                <Input
                  id="companyPostalCode"
                  value={customerData.companyPostalCode}
                  onChange={(e) => onCustomerChange({ companyPostalCode: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="companyCity">Miejscowość</Label>
                <Input
                  id="companyCity"
                  value={customerData.companyCity}
                  onChange={(e) => onCustomerChange({ companyCity: e.target.value })}
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Vehicle Info Section */}
      <div className="space-y-4">
        <div className="flex items-center gap-2 text-lg font-semibold">
          <Car className="w-5 h-5 text-primary" />
          Dane pojazdu
        </div>
        <div className="space-y-2" ref={brandModelRef}>
          <Label htmlFor="vehicleBrandModel">Marka i model *</Label>
          <CarSearchAutocomplete
            value={vehicleData.brandModel || ''}
            onChange={(val: CarSearchValue) => {
              if (val === null) {
                onVehicleChange({ brandModel: '' });
              } else if ('type' in val && val.type === 'custom') {
                onVehicleChange({ brandModel: val.label });
              } else {
                onVehicleChange({ brandModel: val.label });
              }
            }}
            error={hasBrandModelError}
          />
          {validationErrors?.brandModel && (
            <p className="text-sm text-red-500">{validationErrors.brandModel}</p>
          )}
        </div>
        
        {/* Paint Color and Type */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="paintColor">Kolor lakieru</Label>
            <Input
              id="paintColor"
              value={vehicleData.paintColor || ''}
              onChange={(e) => onVehicleChange({ paintColor: e.target.value })}
              placeholder="np. Czarny, Biały perłowy..."
            />
          </div>
          <div className="space-y-2">
            <Label>Typ lakieru</Label>
            <RadioGroup
              value={vehicleData.paintType || 'gloss'}
              onValueChange={(value) => onVehicleChange({ paintType: value })}
              className="flex items-center gap-6"
            >
              {paintTypes.map((type) => (
                <div key={type.value} className="flex items-center gap-2">
                  <RadioGroupItem value={type.value} id={`paintType-${type.value}`} />
                  <Label htmlFor={`paintType-${type.value}`} className="cursor-pointer font-normal">
                    {type.label}
                  </Label>
                </div>
              ))}
            </RadioGroup>
          </div>
        </div>
      </div>
    </div>
  );
});

CustomerDataStep.displayName = 'CustomerDataStep';
